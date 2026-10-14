import { supabaseAdmin } from "../lib/supabase";
import { businessDay } from "../lib/businessDay";
import {
  isReturnDue,
  parseReturnReportLines,
  returnClosingSteps,
  type ReturnReportLine,
} from "../lib/checkInReception";
import { checkStatusChange } from "../lib/orderTransitionGate";
import {
  canTransition,
  canonicalStatus,
  emailOnTransition,
  isOrderStatus,
  statusLabel,
} from "../lib/orderStatus";
import type { TransactionalEmailKey } from "../lib/transactionalEmail";
import {
  TransactionalEmailService,
  type EmailOrder,
} from "./transactionalEmailService";
import { OrderService } from "./orderService";

/**
 * Side effects of an order entering a lifecycle stage, kept out of the API routes so every path
 * that changes a status (the status route today, the hourly cron later) can share them.
 *
 * R-14: cuando el equipo sale (`in-rental`) se genera el contrato de la orden — el PDF de
 * procesamiento guardado en `orders.new_pdf_processing_url`. El cambio de estado ya está
 * guardado cuando esto corre: un fallo aquí nunca lo revierte, solo devuelve un aviso.
 */

export const CONTRACT_GENERATION_WARNING =
  "El estado se actualizó, pero no se pudo generar el contrato de la orden. Genéralo manualmente desde la orden.";

/** Upper bound for the contract render + upload inside a status request. */
export const CONTRACT_GENERATION_TIMEOUT_MS = 20_000;

/**
 * H-4 (R3/R4): overall time budget of `onStatusChanged` inside a status request — contract
 * generation plus the email (attachment fetch and send). Whatever the contract used is no longer
 * available to the email, which then skips the attachment rather than outlive the budget.
 */
export const LIFECYCLE_BUDGET_MS = 25_000;

/** The delivery email (07), the one that carries the contract. */
const DELIVERY_EMAIL_KEY: TransactionalEmailKey = "equipos-entregados";

export interface LifecycleOrder extends EmailOrder {
  id: number;
  new_pdf_processing_url?: string | null;
}

export interface LifecycleResult {
  generated: boolean;
  warning?: string;
}

type ProfileRow = {
  rut?: string | null;
  tipo_cliente?: string | null;
  empresa_nombre?: string | null;
  empresa_rut?: string | null;
};

const PROFILE_COLUMNS = "rut, tipo_cliente, empresa_nombre, empresa_rut";

/* R-04b: closing a return from the shared reception panel ---------------------------------- */

export const RETURN_REPORT_COLUMN_WARNING =
  "La devolución se cerró, pero el informe no se guardó: falta aplicar la migración 0018.";
export const RETURN_REPORT_SAVE_WARNING =
  "La devolución se cerró, pero no se pudo guardar el informe de devolución.";

/** A refusal the finalize route turns into its HTTP status, with the Spanish message as-is. */
export class ReturnFinalizeError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
    readonly code?: string,
    /** H-2: on a partial close, the status the order was left in. */
    readonly currentStatus?: string,
  ) {
    super(message);
    this.name = "ReturnFinalizeError";
  }
}

export interface FinalizeReturnInput {
  orderId: number;
  role?: string | null;
  actorId?: string | null;
  /** The panel's report lines, untrusted until `parseReturnReportLines` accepts them. */
  lines: unknown;
  /** Business day (`YYYY-MM-DD`, America/Santiago); defaults to today. */
  todayChile?: string;
}

export interface FinalizeReturnResult {
  steps: ("return" | "completed")[];
  order: unknown;
  warning?: string;
}

/** `orders.return_report` (migration 0018). */
export interface ReturnReport {
  finalized_at: string;
  finalized_by: string | null;
  lines: ReturnReportLine[];
}

/** PostgREST / Postgres codes for "this column does not exist" (migration not applied). */
function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === "42703" || code === "PGRST204";
}

export class OrderLifecycleService {
  /**
   * R-04b: closes a return from the shared reception panel (/check-in and /bodega).
   *
   * 1. Validates the report (every line judged, canonical incident types, bounded lengths).
   * 2. Only `return` and a due `in-rental` (rental ended today or earlier) can be closed; the
   *    order then walks to `completed` one legal step at a time through the shared gate. An
   *    operator may take `return -> completed` here, and only here (`allowOperatorClosing`).
   * 3. Saves `orders.return_report`. If the column does not exist yet (0018 not applied), or the
   *    write fails, the close stands and the result carries a warning: the equipment is physically
   *    back, and refusing the close over a missing column would block the garage.
   */
  static async finalizeReturn(
    input: FinalizeReturnInput,
  ): Promise<FinalizeReturnResult> {
    const report = parseReturnReportLines(input.lines);
    if (!report.ok)
      throw new ReturnFinalizeError(400, report.error, "INVALID_REPORT");

    const order = (await OrderService.getOrderById(input.orderId)) as {
      status?: string;
      order_fecha_termino?: string | null;
    } | null;
    if (!order) throw new ReturnFinalizeError(404, "La orden no existe");

    const status = String(order.status ?? "");

    // H-2: resumable. A previous close may have completed the order and then failed (or been cut
    // off) before the report was written. Re-running it is a success, not a 409: the report is
    // written if it is missing, and nothing else changes.
    if (status === "completed") {
      const existing = await OrderLifecycleService.getReturnReport(
        input.orderId,
      );
      // H-3: an existing report is never rewritten — re-running the close is a no-op success.
      if (existing) return { steps: [], order };

      // A completed order without a report was either a close whose report write failed, or an
      // order completed by another path (the admin status route). Only an admin may attach a
      // report to it; an operator never decides about an order they did not close here.
      if (input.role !== "admin" && input.role !== "super_admin") {
        throw new ReturnFinalizeError(
          409,
          "El pedido ya está completado. Pide a un administrador que registre el informe de devolución.",
          "ALREADY_COMPLETED",
        );
      }
      const warning = await OrderLifecycleService.saveReturnReport(
        input.orderId,
        {
          finalized_at: new Date().toISOString(),
          finalized_by: input.actorId ?? null,
          lines: report.lines,
        },
      );
      return { steps: [], order, ...(warning ? { warning } : {}) };
    }

    const steps = returnClosingSteps(status);
    if (!steps) {
      throw new ReturnFinalizeError(
        409,
        "Solo se puede cerrar una devolución de un pedido en arriendo o en devolución.",
        "NOT_RETURNABLE",
      );
    }
    const today = input.todayChile ?? businessDay(new Date());
    if (
      status === "in-rental" &&
      !isReturnDue(order.order_fecha_termino, today)
    ) {
      throw new ReturnFinalizeError(
        409,
        "El arriendo aún no termina: no se puede cerrar la devolución antes de la fecha de término.",
        "RETURN_NOT_DUE",
      );
    }

    let current = status;
    let updated: unknown = order;
    let reportWarning: string | undefined;
    for (const [index, step] of steps.entries()) {
      // H-4: the report is written BEFORE the order is completed. If completing fails, a retry
      // finds the report in place and only has the status step left — an operator is never
      // locked out by ALREADY_COMPLETED, and an existing report is never rewritten.
      if (index === steps.length - 1) {
        const existing = await OrderLifecycleService.getReturnReport(
          input.orderId,
        );
        if (!existing) {
          reportWarning = await OrderLifecycleService.saveReturnReport(
            input.orderId,
            {
              finalized_at: new Date().toISOString(),
              finalized_by: input.actorId ?? null,
              lines: report.lines,
            },
          );
        }
      }
      const rejection = checkStatusChange({
        from: current,
        to: step,
        role: input.role,
        allowOperatorClosing: true,
      });
      if (rejection) {
        throw new ReturnFinalizeError(
          rejection.status,
          rejection.error,
          rejection.code,
        );
      }
      try {
        updated = await OrderService.updateOrderStatus(input.orderId, step);
      } catch (error) {
        // H-2: never a silent half-state. If an earlier step already landed, say where the order
        // stopped; finalize again resumes from there (the steps are derived from the live status).
        if (current === status) throw error;
        console.error(
          "[OrderLifecycleService] Cierre de devolución incompleto:",
          {
            orderId: input.orderId,
            stoppedAt: current,
            failedStep: step,
            error,
          },
        );
        throw new ReturnFinalizeError(
          409,
          `La devolución quedó a medias: el pedido está en «${statusLabel(current)}». Vuelve a finalizar para completarla.`,
          "PARTIAL_CLOSE",
          current,
        );
      }
      current = step;
    }

    // R-09c: the close enters `completed` like any other path, so it gets the same single
    // "Pedido completado" email — judged from where the order started, once for all steps.
    const lifecycle = await OrderLifecycleService.onStatusChanged(
      {
        ...(order as object),
        ...(updated as object),
        id: input.orderId,
      } as LifecycleOrder,
      "completed",
      // The close walks the machine step by step; only the email is judged from the start, so
      // `in-rental -> completed` must not be read as an admin jump.
      { previousStatus: status, notify: true },
    );

    const warning = [reportWarning, lifecycle.warning]
      .filter(Boolean)
      .join(" ");
    return { steps, order: updated, ...(warning ? { warning } : {}) };
  }

  /**
   * Reads `orders.return_report` with `select('*')`: before migration 0018 the key is simply
   * absent and this returns `null`, instead of failing on a named column that does not exist.
   */
  static async getReturnReport(orderId: number): Promise<unknown> {
    const { data, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    return (data as { return_report?: unknown } | null)?.return_report ?? null;
  }

  /** Writes `orders.return_report`; returns a warning instead of throwing. */
  static async saveReturnReport(
    orderId: number,
    report: ReturnReport,
  ): Promise<string | undefined> {
    try {
      const { error } = await supabaseAdmin
        .from("orders")
        .update({ return_report: report } as never)
        .eq("id", orderId);
      if (!error) return undefined;
      if (isMissingColumnError(error)) {
        console.error(
          "[OrderLifecycleService] orders.return_report no existe (migración 0018 pendiente):",
          { orderId },
        );
        return RETURN_REPORT_COLUMN_WARNING;
      }
      console.error(
        "[OrderLifecycleService] No se pudo guardar el informe de devolución:",
        {
          orderId,
          error,
        },
      );
      return RETURN_REPORT_SAVE_WARNING;
    } catch (error) {
      console.error(
        "[OrderLifecycleService] No se pudo guardar el informe de devolución:",
        {
          orderId,
          error,
        },
      );
      return RETURN_REPORT_SAVE_WARNING;
    }
  }

  /**
   * Never throws: the caller has already persisted the status change.
   *
   * 1. R-14: entering `in-rental` without a contract generates it.
   * 2. R-09c: entering a stage with an email (`emailOnTransition`) sends exactly that one
   *    transactional email — the delivery email with the contract attached. This is the only
   *    place status emails are sent from, so every route sends the same single email. Without
   *    `previousStatus` no email is sent: the transition cannot be judged, and guessing would
   *    re-send on every save.
   * 3. Admin status jump (2026-10-14): a change the state machine would reject (a skip, a step
   *    back, leaving a terminal status) sends its email only when `notify` is `true` — the admin
   *    ticked "Notificar al cliente". Sequential changes ignore `notify`. An origin outside the
   *    vocabulary is not judged a jump, so legacy rows keep today's behaviour.
   */
  static async onStatusChanged(
    order: LifecycleOrder,
    newStatus: string,
    options: { previousStatus?: string | null; notify?: boolean } = {},
  ): Promise<LifecycleResult> {
    const startedAt = Date.now();
    let generated = false;
    let contractUrl = order.new_pdf_processing_url ?? null;
    const warnings: string[] = [];

    if (newStatus === "in-rental" && !contractUrl) {
      try {
        contractUrl = await OrderLifecycleService.generateRentalContract(
          order.id,
        );
        generated = true;
      } catch (error) {
        console.error(
          "[OrderLifecycleService] No se pudo generar el contrato de la orden:",
          { orderId: order.id, error },
        );
        warnings.push(CONTRACT_GENERATION_WARNING);
      }
    }

    // H-4: `null` is as unknown as `undefined` — neither may judge a transition.
    const emailKey =
      options.previousStatus != null
        ? emailOnTransition(options.previousStatus, newStatus)
        : null;
    const isJump = OrderLifecycleService.isStatusJump(
      options.previousStatus,
      newStatus,
    );
    if (emailKey && (!isJump || options.notify === true)) {
      const result = await TransactionalEmailService.sendForOrder(
        emailKey as TransactionalEmailKey,
        order,
        {
          ...(emailKey === DELIVERY_EMAIL_KEY ? { contractUrl } : {}),
          budgetMs: Math.max(0, LIFECYCLE_BUDGET_MS - (Date.now() - startedAt)),
        },
      );
      if (result.warning) warnings.push(result.warning);
    }

    return warnings.length > 0
      ? { generated, warning: warnings.join(" ") }
      : { generated };
  }

  /**
   * A change the state machine would reject. A legacy origin (`processing`, `on-hold`, …) is
   * never a jump, the same way `checkStatusChange` does not judge it.
   */
  static isStatusJump(previous: unknown, next: unknown): boolean {
    const to = canonicalStatus(next);
    return isOrderStatus(previous) && to !== null && !canTransition(previous, to);
  }

  /**
   * Server-side render of the processing PDF, upload to R2 and save of its URL. Same building
   * blocks as `POST /api/order/generate-processing-pdf`, but it throws on any failure instead
   * of falling back to a base64 URL, since a data URL must never be stored on the order.
   * The PDF modules are imported lazily so importing this service stays cheap.
   *
   * Bounded by `CONTRACT_GENERATION_TIMEOUT_MS`: the caller is a status request an admin is
   * waiting on. At the deadline the upload is aborted and the URL is never stored, even if the
   * render finishes later, so a late result cannot overwrite anything.
   */
  static async generateRentalContract(orderId: number): Promise<string> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(
          new Error(
            `La generación del contrato superó el tiempo límite de ${CONTRACT_GENERATION_TIMEOUT_MS / 1000} s`,
          ),
        );
      }, CONTRACT_GENERATION_TIMEOUT_MS);
    });

    try {
      const pdfUrl = await Promise.race([
        OrderLifecycleService.renderAndUpload(orderId, controller.signal),
        deadline,
      ]);
      if (controller.signal.aborted) {
        throw new Error("La generación del contrato fue cancelada");
      }

      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          new_pdf_processing_url: pdfUrl,
          date_modified: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (updateError) throw updateError;

      return pdfUrl;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Render + R2 upload; returns the uploaded URL. Stores nothing. */
  private static async renderAndUpload(
    orderId: number,
    signal: AbortSignal,
  ): Promise<string> {
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();
    if (orderError || !order) {
      throw orderError ?? new Error(`Orden ${orderId} no encontrada`);
    }

    const profile = await OrderLifecycleService.findCustomerProfile(
      order.customer_id,
    );

    const [
      { default: React },
      { ProcessingDocument },
      { buildProcessingDocumentData },
      { generatePdfBuffer },
      { SiteSettingsService },
    ] = await Promise.all([
      import("react"),
      import("../lib/pdf/components/processing/ProcessingDocument"),
      import("../lib/pdf/mappers/processingData"),
      import("../lib/pdf/core/pdfService"),
      import("./siteSettingsService"),
    ]);

    const settings = await SiteSettingsService.get();
    const documentData = buildProcessingDocumentData(
      order,
      profile,
      new Date(),
      settings,
    );
    const pdfBuffer = await generatePdfBuffer({
      document: React.createElement(ProcessingDocument, { data: documentData }),
    });

    const header = String.fromCharCode(
      ...new Uint8Array(pdfBuffer).slice(0, 4),
    );
    if (!header.startsWith("%PDF")) {
      throw new Error("El PDF generado es inválido");
    }

    const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;
    if (!workerUrl) {
      throw new Error("PUBLIC_CLOUDFLARE_WORKER_URL no está configurado");
    }

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([pdfBuffer], { type: "application/pdf" }),
      `order_processing_${orderId}_${Date.now()}.pdf`,
    );
    formData.append("userId", String(order.customer_id));

    const uploadResponse = await fetch(`${workerUrl}/upload-pdf-only`, {
      method: "POST",
      body: formData,
      headers: { Accept: "application/json" },
      signal,
    });
    if (!uploadResponse.ok) {
      throw new Error(`La subida a R2 respondió ${uploadResponse.status}`);
    }
    const uploadResult = await uploadResponse.json();
    const pdfUrl: string | undefined =
      uploadResult?.fileUrl || uploadResult?.url;
    if (!uploadResult?.success || !pdfUrl) {
      throw new Error("La subida a R2 no devolvió una URL");
    }

    return pdfUrl;
  }

  /** `customer_id` is a `user_profiles.user_id`; older rows carry the `auth_uid` instead. */
  private static async findCustomerProfile(
    customerId: unknown,
  ): Promise<ProfileRow | null> {
    if (customerId === null || customerId === undefined || customerId === "") {
      return null;
    }

    const numericId = Number.parseInt(String(customerId), 10);
    if (!Number.isNaN(numericId)) {
      const { data } = await supabaseAdmin
        .from("user_profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", numericId)
        .single();
      if (data) return data as ProfileRow;
    }

    const { data } = await supabaseAdmin
      .from("user_profiles")
      .select(PROFILE_COLUMNS)
      .eq("auth_uid", String(customerId))
      .single();
    return (data as ProfileRow | null) ?? null;
  }
}
