import {
  EMAIL_SEND_TIMEOUT_MS,
  sendEmailViaWorker,
} from "../lib/emailWorkerService";
import { FetchTimeoutError, fetchWithTimeout } from "../lib/fetchWithTimeout";
import { supabaseAdmin } from "../lib/supabase";
import {
  renderTransactionalEmail,
  type TransactionalEmailKey,
} from "../lib/transactionalEmail";

/**
 * Sends one of the eight transactional emails for an order (R-09c), through the email worker
 * (`sendEmailViaWorker`, which fails closed without its shared secret).
 *
 * Never throws: the status change that triggered the email is already saved, so a missing
 * recipient, a render error or a worker failure is logged in Spanish and returned as a warning.
 */
// H-4: the service also sends account emails (Contrato), so the wording names no status change.
export const EMAIL_SEND_WARNING = "No se pudo enviar el correo al cliente.";
export const CONTRACT_ATTACHMENT_WARNING =
  "El correo se envió sin el contrato adjunto: no se pudo obtener el PDF.";

/** Bounds for the contract attachment (handoff §7: contract attached). */
export const CONTRACT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const CONTRACT_FETCH_TIMEOUT_MS = 10_000;
/** Below this, a download is not worth starting (H-4). */
const MIN_CONTRACT_FETCH_MS = 2_000;

/** Where the app's own PDFs are served from (orders/user_profiles rows, verified 2026-10-13). */
const DEFAULT_ATTACHMENT_HOSTS = ["media.mariohans.cl", "workers.mariohans.cl"];

/**
 * H-4 (R1-001): the hosts a contract attachment may be downloaded from — the public media host,
 * the upload worker the app writes through (`PUBLIC_CLOUDFLARE_WORKER_URL`, the same base
 * `generateRentalContract` uploads to), and any extra listed in `EMAIL_ATTACHMENT_HOSTS`.
 */
export function contractAttachmentHosts(): string[] {
  const hosts = new Set(DEFAULT_ATTACHMENT_HOSTS);
  try {
    const worker = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;
    if (worker) hosts.add(new URL(worker).hostname);
  } catch {
    // An invalid worker URL adds nothing.
  }
  for (const extra of String(
    import.meta.env.EMAIL_ATTACHMENT_HOSTS ?? "",
  ).split(",")) {
    if (extra.trim()) hosts.add(extra.trim().toLowerCase());
  }
  return [...hosts];
}

function isAllowedAttachmentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      contractAttachmentHosts().includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Reads a body up to `max` bytes, cancelling the stream as soon as it would exceed it. */
async function readCapped(
  response: Response,
  max: number,
): Promise<Uint8Array> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > max)
      throw new Error(`Tamaño fuera de rango: ${bytes.byteLength} bytes`);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new Error(`Tamaño fuera de rango: más de ${max} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Decoded size of a base64 string, without decoding it. */
function base64Bytes(content: string): number {
  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return Math.floor((content.length * 3) / 4) - padding;
}

/** The order columns the emails read. */
export interface EmailOrder {
  id: number;
  order_key?: string | null;
  customer_id?: number | string | null;
  billing_email?: string | null;
  billing_first_name?: string | null;
  billing_last_name?: string | null;
  billing_company?: string | null;
  new_pdf_on_hold_url?: string | null;
}

export interface SendForOrderOptions {
  /** The rental contract (processing PDF) to attach to "equipos-entregados". */
  contractUrl?: string | null;
  /** Text for "pedido-actualizado". */
  detalleModificaciones?: string | null;
  /**
   * H-4: milliseconds this send may still take (the lifecycle's overall budget minus what the
   * contract generation used). Undefined means no outer budget.
   */
  budgetMs?: number;
}

export interface SendResult {
  sent: boolean;
  warning?: string;
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export class TransactionalEmailService {
  static async sendForOrder(
    key: TransactionalEmailKey,
    order: EmailOrder,
    options: SendForOrderOptions = {},
  ): Promise<SendResult> {
    try {
      const recipient = await TransactionalEmailService.resolveRecipient(order);
      if (!recipient.email) {
        console.error("[Email] Correo transaccional sin destinatario:", {
          key,
          orderId: order.id,
        });
        return { sent: false, warning: EMAIL_SEND_WARNING };
      }

      const { subject, html } = renderTransactionalEmail(key, {
        nombre_cliente: recipient.name,
        numero_pedido: order.id,
        link_pdf: order.new_pdf_on_hold_url ?? null,
        detalle_modificaciones: options.detalleModificaciones ?? null,
      });

      let warning: string | undefined;
      let attachments: { filename: string; content: string }[] | undefined;
      // H-4: time left for the download once the send itself is reserved; too little, no fetch.
      const fetchBudgetMs =
        options.budgetMs === undefined
          ? CONTRACT_FETCH_TIMEOUT_MS
          : Math.min(
              CONTRACT_FETCH_TIMEOUT_MS,
              options.budgetMs - EMAIL_SEND_TIMEOUT_MS,
            );
      if (
        key === "equipos-entregados" &&
        options.contractUrl &&
        fetchBudgetMs < MIN_CONTRACT_FETCH_MS
      ) {
        console.error(
          "[Email] Sin tiempo para adjuntar el contrato, se envía sin él:",
          { orderId: order.id, budgetMs: options.budgetMs },
        );
        warning = CONTRACT_ATTACHMENT_WARNING;
      } else if (key === "equipos-entregados" && options.contractUrl) {
        const content = await TransactionalEmailService.fetchContract(
          options.contractUrl,
          order.id,
          fetchBudgetMs,
        );
        if (content) {
          attachments = [
            { filename: `Contrato_arriendo_${order.id}.pdf`, content },
          ];
        } else {
          warning = CONTRACT_ATTACHMENT_WARNING;
        }
      }

      const result = await sendEmailViaWorker(
        recipient.email,
        subject,
        html,
        attachments,
      );
      if (!result.success) {
        console.error("[Email] El worker no envió el correo transaccional:", {
          key,
          orderId: order.id,
          error: result.error,
        });
        return { sent: false, warning: EMAIL_SEND_WARNING };
      }

      console.log("[Email] Correo transaccional enviado:", {
        key,
        orderId: order.id,
      });
      return warning ? { sent: true, warning } : { sent: true };
    } catch (error) {
      console.error("[Email] Error al enviar el correo transaccional:", {
        key,
        orderId: order.id,
        error,
      });
      return { sent: false, warning: EMAIL_SEND_WARNING };
    }
  }

  /**
   * R-09d: an account email not tied to an order (02 Contrato). The caller already knows the
   * customer; an optional attachment travels as is (the contract PDF it just generated).
   */
  static async sendToCustomer(
    key: TransactionalEmailKey,
    recipient: {
      email: string | null | undefined;
      name?: string | null;
      usuario?: string | null;
    },
    options: { attachment?: { filename: string; content: string } } = {},
  ): Promise<SendResult> {
    try {
      const email = trimmed(recipient.email);
      if (!email) {
        console.error("[Email] Correo transaccional sin destinatario:", {
          key,
        });
        return { sent: false, warning: EMAIL_SEND_WARNING };
      }
      const { subject, html } = renderTransactionalEmail(key, {
        nombre_cliente: trimmed(recipient.name) || "cliente",
        usuario: recipient.usuario ?? null,
      });
      // H-4 (R4): same cap as a fetched contract; a bigger file is left out, not sent.
      let attachmentWarning: string | undefined;
      let attachment = options.attachment;
      if (
        attachment &&
        base64Bytes(attachment.content) > CONTRACT_ATTACHMENT_MAX_BYTES
      ) {
        console.error("[Email] Adjunto demasiado grande, se envía sin él:", {
          key,
          bytes: base64Bytes(attachment.content),
        });
        attachment = undefined;
        attachmentWarning = CONTRACT_ATTACHMENT_WARNING;
      }
      const result = await sendEmailViaWorker(
        email,
        subject,
        html,
        attachment ? [attachment] : undefined,
      );
      if (!result.success) {
        console.error("[Email] El worker no envió el correo transaccional:", {
          key,
          error: result.error,
        });
        return { sent: false, warning: EMAIL_SEND_WARNING };
      }
      console.log("[Email] Correo transaccional enviado:", { key });
      return attachmentWarning
        ? { sent: true, warning: attachmentWarning }
        : { sent: true };
    } catch (error) {
      console.error("[Email] Error al enviar el correo transaccional:", {
        key,
        error,
      });
      return { sent: false, warning: EMAIL_SEND_WARNING };
    }
  }

  /** Billing data first (what the existing senders use), then the customer profile. */
  private static async resolveRecipient(
    order: EmailOrder,
  ): Promise<{ email: string; name: string }> {
    const company = trimmed(order.billing_company);
    const person =
      `${trimmed(order.billing_first_name)} ${trimmed(order.billing_last_name)}`.trim();
    let email = trimmed(order.billing_email);
    let name = company || person;

    if (
      (!email || !name) &&
      order.customer_id !== null &&
      order.customer_id !== undefined
    ) {
      const customerId = Number.parseInt(String(order.customer_id), 10);
      if (!Number.isNaN(customerId)) {
        const { data } = await supabaseAdmin
          .from("user_profiles")
          .select("email, nombre, apellido, empresa_nombre")
          .eq("user_id", customerId)
          .maybeSingle();
        const profile = (data ?? null) as {
          email?: string | null;
          nombre?: string | null;
          apellido?: string | null;
          empresa_nombre?: string | null;
        } | null;
        if (profile) {
          email ||= trimmed(profile.email);
          name ||=
            trimmed(profile.empresa_nombre) ||
            `${trimmed(profile.nombre)} ${trimmed(profile.apellido)}`.trim();
        }
      }
    }
    return { email, name: name || "cliente" };
  }

  /**
   * The contract PDF as base64, or null (disallowed URL, redirect, timeout, error status,
   * oversized). H-4 (R1-001): the URL comes from the order row, so it is fetched only over https
   * from a host the app itself writes PDFs to (`contractAttachmentHosts`), never following a
   * redirect, and read with a hard byte cap — checked on `content-length` first, then enforced
   * on the stream, so a lying or missing header cannot make the server buffer an unbounded body.
   */
  private static async fetchContract(
    url: string,
    orderId: number,
    timeoutMs: number = CONTRACT_FETCH_TIMEOUT_MS,
  ): Promise<string | null> {
    try {
      if (!isAllowedAttachmentUrl(url)) {
        throw new Error("URL del contrato fuera de los hosts permitidos");
      }
      const response = await fetchWithTimeout(
        url,
        { redirect: "error" },
        timeoutMs,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const declared = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(declared) &&
        declared > CONTRACT_ATTACHMENT_MAX_BYTES
      ) {
        throw new Error(`Tamaño declarado fuera de rango: ${declared} bytes`);
      }
      const bytes = await readCapped(response, CONTRACT_ATTACHMENT_MAX_BYTES);
      if (bytes.byteLength === 0) throw new Error("PDF vacío");
      return Buffer.from(bytes).toString("base64");
    } catch (error) {
      console.error(
        "[Email] No se pudo adjuntar el contrato al correo de entrega:",
        {
          orderId,
          timedOut: error instanceof FetchTimeoutError,
          error: error instanceof Error ? error.message : error,
        },
      );
      return null;
    }
  }
}
