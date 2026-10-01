# Consentimiento y avisos en el punto de captura — HANS SALINAS SpA

> Art. 12 de la Ley 21.719: el consentimiento debe ser **previo, libre, específico, informado e
> inequívoco**, mediante un **acto afirmativo** (casilla NO premarcada), y **revocable** por un medio
> expedito, gratuito y permanente. Estos textos van en el formulario de registro de new.mariohans.cl.

## 1. Aviso corto (en el punto de captura, junto al formulario de registro)

> Tus datos (nombre, email, RUT, teléfono, dirección y, si corresponde, foto de tu cédula y tu firma) los trata HANS SALINAS SpA para gestionar tu cuenta y tus arriendos fotográficos. Puedes ejercer tus derechos en contacto@mariohans.cl. Más detalles en nuestra [Política de Privacidad](/privacy).

## 2. Consentimiento (checkbox, NO premarcado)

> ☐ Acepto que HANS SALINAS SpA trate mis datos para gestionar mi cuenta y mis arriendos, según su [Política de Privacidad](/privacy) y sus [Términos](/terms).

No se usa un segundo checkbox de marketing porque el sistema no envía marketing (confirmado en Fase 1: sin Google Analytics, Meta Pixel ni GTM, sin banner de cookies).

## 3. Datos sensibles (Art. 16)

No aplica: el sistema no capta datos sensibles (salud, biométricos, etc.). Las fotos de cédula y firma se tratan como datos de especial cuidado (ver `21719-rat.md`), no como categoría sensible — no requieren consentimiento reforzado adicional, pero sí minimización y el plazo de retención corto (12 meses) documentado en el RAT.

## 4. Revocación

Pendiente de construir: un medio simple para que el titular revoque el consentimiento (hoy solo existe el texto "Solicitar eliminación de mis datos" en la cuenta, resuelto manualmente por correo). Ver remediación en `data-rights-channel` (`RESUMEN.md`).

## 5. Registro del consentimiento (prueba)

**Hallazgo (Fase 1):** el formulario de registro del frontend tiene el checkbox "Acepto los términos y condiciones y la política de privacidad", pero **no se guarda el timestamp ni la versión de la política aceptada**. La carga de la prueba del consentimiento es del responsable (Art. 12) — sin ese registro, HANS SALINAS SpA no puede demostrar cuándo ni qué versión aceptó cada titular.

**Remediación recomendada:** agregar columnas `consent_accepted_at` (timestamp) y `consent_policy_version` (texto) a `user_profiles`, pobladas al momento del registro. Ver receta en `references/build/` si se decide construir.

---

_Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado._
