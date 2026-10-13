import { supabaseAdmin } from "../lib/supabase";

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

/** Upper bound for render + upload; matches the email hop's deadline in the update route. */
export const CONTRACT_GENERATION_TIMEOUT_MS = 20_000;

export interface LifecycleOrder {
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

export class OrderLifecycleService {
  /** Never throws: the caller has already persisted the status change. */
  static async onStatusChanged(
    order: LifecycleOrder,
    newStatus: string,
  ): Promise<LifecycleResult> {
    if (newStatus !== "in-rental") return { generated: false };
    if (order.new_pdf_processing_url) return { generated: false };

    try {
      await OrderLifecycleService.generateRentalContract(order.id);
      return { generated: true };
    } catch (error) {
      console.error(
        "[OrderLifecycleService] No se pudo generar el contrato de la orden:",
        { orderId: order.id, error },
      );
      return { generated: false, warning: CONTRACT_GENERATION_WARNING };
    }
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
