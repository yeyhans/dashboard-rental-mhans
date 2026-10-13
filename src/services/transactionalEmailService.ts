import { sendEmailViaWorker } from "../lib/emailWorkerService";
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
export const EMAIL_SEND_WARNING =
  "El estado se guardó, pero no se pudo enviar el correo al cliente.";
export const CONTRACT_ATTACHMENT_WARNING =
  "El correo de entrega se envió sin el contrato adjunto: no se pudo descargar el PDF.";

/** Bounds for the delivery email's contract attachment (handoff §7: contract attached). */
export const CONTRACT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const CONTRACT_FETCH_TIMEOUT_MS = 10_000;

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
      if (key === "equipos-entregados" && options.contractUrl) {
        const content = await TransactionalEmailService.fetchContract(
          options.contractUrl,
          order.id,
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
      const result = await sendEmailViaWorker(
        email,
        subject,
        html,
        options.attachment ? [options.attachment] : undefined,
      );
      if (!result.success) {
        console.error("[Email] El worker no envió el correo transaccional:", {
          key,
          error: result.error,
        });
        return { sent: false, warning: EMAIL_SEND_WARNING };
      }
      console.log("[Email] Correo transaccional enviado:", { key });
      return { sent: true };
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

  /** The contract PDF as base64, or null (timeout, error status, oversized). */
  private static async fetchContract(
    url: string,
    orderId: number,
  ): Promise<string | null> {
    try {
      const response = await fetchWithTimeout(
        url,
        {},
        CONTRACT_FETCH_TIMEOUT_MS,
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        bytes.byteLength === 0 ||
        bytes.byteLength > CONTRACT_ATTACHMENT_MAX_BYTES
      ) {
        throw new Error(`Tamaño fuera de rango: ${bytes.byteLength} bytes`);
      }
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
