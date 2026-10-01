# Plan de Respuesta a Brechas de Datos Personales — HANS SALINAS SpA

**Responsable del plan:** Mario Hans · **Contacto:** contacto@mariohans.cl
**Plazo legal:** notificar a la Agencia **sin dilaciones indebidas** (Art. 14 sexies; la ley NO fija un plazo de 72 horas — eso es estándar GDPR, no chileno). Mantener además el **registro de las vulneraciones** (`21719-registro-vulneraciones.md`), aunque no se notifiquen.

## Roles

- **Coordinador de incidente:** Mario Hans. **Soporte técnico:** Yeyson Hans (encargado de desarrollo/infraestructura). **Apoyo legal:** solo si el incidente escala a fiscalización (ver `references/cuando-acudir-a-abogado.md`).

## Fase 1 — Detección y contención (0-4h)

1. Registrar fecha/hora de detección y quién detecta.
2. Contener: aislar sistemas, revocar accesos (rotar claves de Supabase, R2, Resend, Telegram según corresponda), rotar credenciales.
3. Abrir bitácora del incidente.

## Fase 2 — Evaluación (4-24h)

1. Qué datos y de cuántos titulares (consultar `supabase-v2` vía `mhans-db-consolidado`, nunca escribir por MCP).
2. Riesgo para los titulares (alto / no alto). Las fotos de cédula y firma son de alto impacto si se filtran, aunque no sean categoría sensible legal.
3. Si hay un proveedor involucrado (Cloudflare, Resend, Vercel, Hostinger, Telegram, Google), exigirle la información del incidente.

## Fase 3 — Notificación (sin dilaciones indebidas)

1. **A la Agencia:** naturaleza, categorías y volumen de datos, consecuencias probables, medidas adoptadas, contacto (contacto@mariohans.cl).
2. **A los titulares:** cuando haya riesgo alto, y también si afecta **datos sensibles, económicos/financieros/bancarios o de niños, niñas y adolescentes** (no aplica el caso de menores en este negocio): qué pasó, qué datos, qué pueden hacer, contacto.

## Fase 4 — Cierre y mejora

Causa raíz · medidas correctivas · actualizar el RAT y este plan.

## Plantilla de aviso (borrador)

> El [FECHA] detectamos [DESCRIPCIÓN]. Datos afectados: [CATEGORÍAS], ~[N] titulares.
> Medidas adoptadas: [...]. Contacto: contacto@mariohans.cl.

## Primera entrada registrada en esta corrida (2026-10-01)

Durante la auditoría previa a esta corrida se detectó y **corrigió** en el sistema Consolidado una vulnerabilidad: 17 funciones RPC `SECURITY DEFINER` eran ejecutables por el rol `anon` sin verificación de `auth.uid()` (`supabase/migrations/0000_baseline.sql:3012-3015` y siguientes), lo que permitía leer o reescribir cualquier `user_profile`, incluidas las URLs de firma, cédula y contrato, usando solo la clave pública anónima. Corregida con la migración `supabase/migrations/0014_rpc_least_privilege.sql` (commit `2bf283b`) aplicada en la base del consolidado, y con el commit `88ac3d6` del frontend que enruta las escrituras por endpoints de servidor autenticados. **No hay evidencia de explotación pasada** (haría falta conservar logs de Kong/PostgREST, hoy de retención `[verificar]`), por lo que se trata como una vulnerabilidad potencial, no como una brecha confirmada. Queda registrada formalmente en `21719-registro-vulneraciones.md`. **Producción (rental.mariohans.cl) sigue expuesta** a la misma clase de problema — ver `RESUMEN.md`.

---

_Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado._
