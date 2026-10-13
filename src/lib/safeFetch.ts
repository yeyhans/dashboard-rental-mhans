import { fetchWithTimeout } from "./fetchWithTimeout";

/**
 * Bounded downloads of attachment URLs (H-4 R1-001, D1-c).
 *
 * Attachment URLs come from order rows or from an admin request, so the server only downloads
 * them over https from a host the app itself writes files to, never follows a redirect (which
 * could point anywhere, internal addresses included), and reads the body with a hard byte cap.
 */

/** Per-attachment ceiling (handoff §7: contract attached). */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_FETCH_TIMEOUT_MS = 10_000;

/** Where the app's own PDFs are served from (orders/user_profiles rows, verified 2026-10-13). */
const DEFAULT_ATTACHMENT_HOSTS = ["media.mariohans.cl", "workers.mariohans.cl"];

/**
 * The hosts an attachment may be downloaded from: the public media host, the upload worker the
 * app writes through (`PUBLIC_CLOUDFLARE_WORKER_URL`), and any extra listed in
 * `EMAIL_ATTACHMENT_HOSTS`.
 */
export function attachmentHosts(): string[] {
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

export function isAllowedAttachmentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && attachmentHosts().includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Reads a body up to `max` bytes, cancelling the stream as soon as it would exceed it. */
export async function readCapped(
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

export interface FetchAttachmentOptions {
  maxBytes?: number;
  timeoutMs?: number;
}

/**
 * Downloads one attachment, or throws (disallowed URL, redirect, timeout, error status,
 * oversized, empty). The size is checked on `content-length` first, then enforced on the stream,
 * so a lying or missing header cannot make the server buffer an unbounded body.
 */
export async function fetchAttachment(
  url: string,
  {
    maxBytes = ATTACHMENT_MAX_BYTES,
    timeoutMs = ATTACHMENT_FETCH_TIMEOUT_MS,
  }: FetchAttachmentOptions = {},
): Promise<Uint8Array> {
  if (!isAllowedAttachmentUrl(url)) {
    throw new Error("URL del adjunto fuera de los hosts permitidos");
  }
  const response = await fetchWithTimeout(
    url,
    { redirect: "error" },
    timeoutMs,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Tamaño declarado fuera de rango: ${declared} bytes`);
  }
  const bytes = await readCapped(response, maxBytes);
  if (bytes.byteLength === 0) throw new Error("Adjunto vacío");
  return bytes;
}
