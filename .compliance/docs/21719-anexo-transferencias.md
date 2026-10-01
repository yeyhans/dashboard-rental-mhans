# Anexo de Transferencia Internacional de Datos — HANS SALINAS SpA

> Para amparar el envío de datos personales fuera de Chile. Se incorpora con cada proveedor
> extranjero que actúe como encargado. Mecanismo: **Cláusulas Contractuales Modelo** aprobadas por
> el Ministerio de Economía (Resolución RAEX202503748, Diario Oficial 19-12-2025,
> `sources/clausulas-modelo-transferencia-economia.pdf`). Chile aún no tiene lista de países
> adecuados vigente, por lo que este es el mecanismo aplicable.

## 1. Partes

- **Exportador de datos:** HANS SALINAS SpA, RUT 77.892.569-9 (Chile).
- **Importadores de datos:**

| Proveedor                                             | País                                                                   | Rol                               | Datos que recibe                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| Cloudflare, Inc. (R2 + Worker `workers.mariohans.cl`) | EE.UU. / global                                                        | Encargado                         | Fotos de cédula, firma, contrato PDF, fotos de garantía                         |
| Resend                                                | EE.UU.                                                                 | Encargado                         | Email, nombre, datos de la orden (envío de correos transaccionales)             |
| Vercel Inc.                                           | EE.UU.                                                                 | Encargado                         | Todo lo que procesa el dashboard admin (hosting)                                |
| Google LLC                                            | EE.UU. / global                                                        | Responsable independiente (OAuth) | Email usado para iniciar sesión con Google                                      |
| Telegram FZ-LLC                                       | fuera de Chile (infraestructura distribuida)                           | Encargado (uso interno)           | Resumen de nuevas órdenes y datos de `user_profiles` para el notificador Hermes |
| Hostinger                                             | región del VPS sin confirmar — `[COMPLETAR: región del VPS Hostinger]` | Encargado (infraestructura)       | Toda la base de datos y el frontend, si el VPS está físicamente fuera de Chile  |

## 2. Mecanismo de transferencia

Las partes adoptan las **Cláusulas Contractuales Modelo** del Ministerio de Economía como garantía adecuada conforme a la Ley 21.719, para cada uno de los proveedores listados en la tabla anterior. El texto oficial está en `sources/clausulas-modelo-transferencia-economia.pdf`. No basta el DPA/Terms of Service estándar de cada proveedor por sí solo: estas cláusulas deben incorporarse o referenciarse en el contrato con cada proveedor.

## 3. Datos y finalidad

Ver columna "Datos que recibe" de la tabla anterior; finalidad: almacenamiento de archivos (Cloudflare), envío de correos transaccionales (Resend), hosting del panel admin (Vercel), autenticación (Google), notificación operativa interna (Telegram), e infraestructura general (Hostinger, pendiente de confirmar región).

## 4. Compromisos del importador

Tratar los datos solo según instrucciones, aplicar medidas de seguridad equivalentes, no transferir a terceros sin garantías equivalentes, y colaborar ante solicitudes de los titulares y de la Agencia. Para Cloudflare, Resend y Vercel: aceptar su DPA estándar (`data-dpa`, pendiente — ver `RESUMEN.md`) además de este anexo.

## 5. Declaración en la política

Esta transferencia se declara en `21719-politica-privacidad.md`, sección 4 ("Con quién compartimos los datos").

## 6. Pendiente

Confirmar la región física del VPS de Hostinger (`[COMPLETAR: región del VPS Hostinger]`) para saber si constituye una transferencia internacional adicional de la base de datos misma, no solo de los archivos.

---

_Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado._
