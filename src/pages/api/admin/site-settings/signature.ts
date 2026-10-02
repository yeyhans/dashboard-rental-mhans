import type { APIRoute } from "astro";
import { requireRole } from "../../../../middleware/auth";
import { SiteSettingsService } from "../../../../services/siteSettingsService";

// POST /api/admin/site-settings/signature — multipart `file` (PNG or JPEG, <= 1 MB). Forwards the
// image to the Cloudflare worker and stores the returned URL, cache-busted, as the legal
// representative's signature. `super_admin` only. CORS handled by global middleware.

const MAX_SIGNATURE_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status);
}

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return (
    bytes.length >= magic.length &&
    magic.every((byte, index) => bytes[index] === byte)
  );
}

function actorEmail(context: any): string {
  return context?.user?.email ?? context?.locals?.user?.email ?? "desconocido";
}

export const POST: APIRoute = requireRole("super_admin")(async (context) => {
  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return fail(
      "La solicitud debe ser un formulario con el archivo de la firma",
      400,
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return fail("Debes adjuntar el archivo de la firma", 400);
  }
  if (file.size === 0) {
    return fail("El archivo está vacío", 400);
  }
  if (file.size > MAX_SIGNATURE_BYTES) {
    return fail("La firma no puede pesar más de 1 MB", 400);
  }

  // The declared MIME type and file name come from the client; the bytes decide.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isPng = startsWith(bytes, PNG_MAGIC);
  const isJpeg = startsWith(bytes, JPEG_MAGIC);
  if (!isPng && !isJpeg) {
    return fail("La firma debe ser una imagen PNG o JPEG", 400);
  }

  const upload = new FormData();
  upload.append(
    "file",
    new Blob([bytes], { type: isPng ? "image/png" : "image/jpeg" }),
    isPng ? "firma_representante.png" : "firma_representante.jpg",
  );
  upload.append("documentType", "firma_representante");
  upload.append("userId", "site");

  const workerUrl = import.meta.env.PUBLIC_CLOUDFLARE_WORKER_URL;
  const admin = actorEmail(context);

  let uploadedUrl: string | undefined;
  try {
    const response = await fetch(`${workerUrl}/upload-file-only`, {
      method: "POST",
      body: upload,
    });
    if (!response.ok) {
      console.error(
        "[POST /api/admin/site-settings/signature] El worker respondió con error:",
        {
          status: response.status,
          admin,
        },
      );
      return fail(
        "No se pudo subir la firma. Inténtalo de nuevo en unos minutos.",
        502,
      );
    }
    const data = (await response.json().catch(() => ({}))) as {
      success?: boolean;
      url?: string;
    };
    uploadedUrl = data.success ? data.url : undefined;
  } catch (error) {
    console.error(
      "[POST /api/admin/site-settings/signature] Error al llamar al worker:",
      { error, admin },
    );
    return fail(
      "No se pudo subir la firma. Inténtalo de nuevo en unos minutos.",
      502,
    );
  }

  if (!uploadedUrl) {
    console.error(
      "[POST /api/admin/site-settings/signature] El worker no devolvió una URL:",
      { admin },
    );
    return fail(
      "No se pudo subir la firma. Inténtalo de nuevo en unos minutos.",
      502,
    );
  }

  try {
    const separator = uploadedUrl.includes("?") ? "&" : "?";
    const settings = await SiteSettingsService.setSignatureUrl(
      `${uploadedUrl}${separator}v=${Date.now()}`,
      admin,
    );
    return json({ success: true, data: settings.representative }, 200);
  } catch (error) {
    console.error(
      "[POST /api/admin/site-settings/signature] Error al guardar la URL:",
      { error, admin },
    );
    return fail(
      "La firma se subió pero no se pudo guardar. Inténtalo de nuevo.",
      500,
    );
  }
});
