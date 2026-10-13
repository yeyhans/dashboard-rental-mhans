/**
 * The eight transactional emails of the rental (R-09b).
 *
 * Content and layout: `CONSOLIDADO WEB YEYSON/correos/Correo *.html`, ported verbatim to
 * `src/templates/emails/transactional/<key>.html` with the sample data replaced by the variables
 * of the handoff §6 (`MarioHans_OS_Rental_Email_Flow_Developer_Handoff_v1.0.html`):
 * `{{nombre_cliente}}`, `{{usuario}}`, `{{numero_pedido}}`, `{{link_pdf}}`,
 * `{{detalle_modificaciones}}`, plus three of ours: `{{logo_url}}` (Gmail does not render the
 * designs' base64 logo), `{{whatsapp_url}}` and `{{site_url}}`.
 *
 * Pure: every value is HTML-escaped, a link must be http(s), and the subject is the design's
 * `<title>` ("Mario Hans FotoRental · …"). Sending is `transactionalEmailService`'s job.
 */

const TEMPLATES = import.meta.glob("../templates/emails/transactional/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const TRANSACTIONAL_EMAIL_KEYS = [
  "registro",
  "contrato",
  "solicitud-recibida",
  "equipos-disponibles",
  "pedido-actualizado",
  "equipos-no-disponibles",
  "equipos-entregados",
  "pedido-completado",
] as const;

export type TransactionalEmailKey = (typeof TRANSACTIONAL_EMAIL_KEYS)[number];

export interface TransactionalEmailData {
  nombre_cliente?: string | null;
  usuario?: string | null;
  numero_pedido?: string | number | null;
  link_pdf?: string | null;
  detalle_modificaciones?: string | null;
  logo_url?: string | null;
  whatsapp_url?: string | null;
  site_url?: string | null;
}

/** The business WhatsApp (verified 2026-09-30); the designs carry a 56900000000 placeholder. */
export const BUSINESS_WHATSAPP_URL = "https://wa.me/56990818976";

const DEFAULT_SITE_URL = "https://rental.mariohans.cl";
const DEFAULT_DASHBOARD_URL = "https://dash-consolidado-mhans.vercel.app";

/** The two designs with a dark (#0A0A0A) header carry the white logo. */
const DARK_HEADER: ReadonlySet<TransactionalEmailKey> = new Set([
  "registro",
  "contrato",
]);

/** Keys whose `{{...}}` holds a URL: validated as http(s) before it is escaped. */
const URL_KEYS = new Set(["link_pdf", "logo_url", "whatsapp_url", "site_url"]);

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString().replace(/\/$/, "")
      : "#";
  } catch {
    return "#";
  }
}

function httpsOrigin(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

function templateFor(key: TransactionalEmailKey): string {
  const entry = Object.entries(TEMPLATES).find(([path]) =>
    path.endsWith(`/transactional/${key}.html`),
  );
  if (
    !entry ||
    !(TRANSACTIONAL_EMAIL_KEYS as readonly string[]).includes(key)
  ) {
    throw new Error(`Plantilla de correo desconocida: ${key}`);
  }
  return entry[1];
}

/**
 * Defaults resolved from the environment: the customer site, the hosted logo, and — for an order
 * whose PDF does not exist yet (a fresh Solicitud) — the customer's orders page as the download
 * target, so the design's button never points nowhere (R-09d).
 */
function defaults(
  key: TransactionalEmailKey,
): Required<
  Pick<
    TransactionalEmailData,
    "logo_url" | "whatsapp_url" | "site_url" | "link_pdf"
  >
> {
  const dashboard = httpsOrigin(
    import.meta.env.PUBLIC_SITE_URL,
    DEFAULT_DASHBOARD_URL,
  );
  const site = httpsOrigin(
    import.meta.env.PUBLIC_FRONTEND_URL,
    DEFAULT_SITE_URL,
  );
  const logo = DARK_HEADER.has(key) ? "logo-white.png" : "logo-black.png";
  return {
    logo_url: import.meta.env.EMAIL_LOGO_URL || `${dashboard}/${logo}`,
    whatsapp_url: BUSINESS_WHATSAPP_URL,
    site_url: site,
    link_pdf: `${site}/cuenta/pedidos`,
  };
}

export function renderTransactionalEmail(
  key: TransactionalEmailKey,
  data: TransactionalEmailData,
): { subject: string; html: string } {
  const template = templateFor(key);
  const values: Record<string, unknown> = { ...defaults(key) };
  for (const [name, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== "")
      values[name] = value;
  }

  const html = template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const raw = values[name];
    if (raw === undefined || raw === null) return "";
    const text = String(raw);
    return escapeHtml(URL_KEYS.has(name) ? safeUrl(text) : text);
  });

  const title =
    /<title>([\s\S]*?)<\/title>/i.exec(template)?.[1]?.trim() ??
    "Mario Hans FotoRental";
  const subject = title
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

  return { subject, html };
}
