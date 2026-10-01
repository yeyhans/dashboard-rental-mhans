# INSTRUCTIVO — Qué hacer ante cada situación (HANS SALINAS SpA, sistema Consolidado)

Manual operativo para Mario Hans. Se ejecuta solo; el abogado solo entra en la representación ante una fiscalización (ver `references/cuando-acudir-a-abogado.md` de la skill).

---

## A. Llega un derecho del titular (acceso, rectificación, supresión, oposición, portabilidad, bloqueo)

**Plazo: 30 días corridos, prorrogable una sola vez por 30 días más** (avisando al titular).
**Gratuidad:** rectificación, supresión y oposición siempre gratis; acceso gratis al menos una vez por trimestre.

1. Registra la solicitud (fecha, quién, qué pide) y verifica identidad contra `user_profiles`.
2. Ubica sus datos: `user_profiles`, `orders`, `order_communications` en `supabase-v2` (consulta con `mhans-db-consolidado`, nunca escribas por MCP).
3. Ejecuta: **acceso/portabilidad** → exporta en JSON/CSV; **supresión** → borra o anonimiza (salvo datos de facturación, retenidos 6 años por el DL 830); **rectificación/oposición/bloqueo** → aplica vía panel admin.
4. Responde por escrito a contacto@mariohans.cl y **guarda evidencia**.
5. Procedimiento completo: `docs/21719-canal-derechos.md`.

## B. Brecha de seguridad (acceso no autorizado, fuga, pérdida, alteración)

**Plazo: notificar a la Agencia sin dilaciones indebidas** (Art. 14 sexies; NO son 72h).

1. **Contén:** aísla, revoca accesos, rota credenciales (Supabase, R2, Resend, Telegram). Abre bitácora.
2. **Evalúa:** qué datos, cuántos titulares, nivel de riesgo. Si fue un proveedor, exígele la info.
3. **Notifica:** a la Agencia (naturaleza, datos, volumen, consecuencias, medidas); a los titulares si hay riesgo alto o afecta datos sensibles/económicos/niños (no aplica aquí, pero las fotos de cédula/firma son alto impacto).
4. **Registra** en `docs/21719-registro-vulneraciones.md` aunque no se notifique.
5. **Cierra:** causa raíz + fix + actualiza RAT y el plan. No notificar deliberadamente = gravísima.
6. Procedimiento completo: `docs/21719-plan-respuesta-brechas.md`.

## C. Te fiscaliza la Agencia de Protección de Datos

Único caso donde conviene un **abogado**.

1. Designa un contacto único (Mario Hans). Todo por escrito.
2. Identifica la etapa: ¿solicitud de información (preliminar) o **pliego de cargos** (formal)?
3. Reúne los antecedentes: ya están en `.compliance/docs/` (RAT, consentimiento, DPA, registro de vulneraciones, EIPD).
4. Responde en plazo, cargo por cargo, mostrando debida diligencia y remediación.
5. **Atenuantes:** MIPYME tiene gracia el primer año (dic-2026 a dic-2027); el MPD y la corrección rápida ayudan.
6. Nunca ocultar o destruir documentos, ni ignorar plazos.

## D. Denuncia por el canal de delitos económicos (Ley 21.595)

1. Recíbela en contacto@mariohans.cl (recomendado: alias dedicado `denuncias@mariohans.cl`).
2. Regístrala con confidencialidad; no identifiques al denunciante si pidió anonimato.
3. Investiga con debido proceso (Mario Hans, como Encargado de Prevención); documenta en el registro de `docs/21595-reglamento-canal-denuncias.md`.
4. Resuelve y comunica el resultado al denunciante cuando sea posible sin romper confidencialidad.
5. Nunca tomes ni toleres represalias contra quien denunció de buena fe.

## E. Cambia la ley o sale un reglamento (ej. DS 662)

1. Actualiza el corpus en `sources/` de la skill (re-descarga, ver `sources/FUENTES.md`).
2. Ajusta el pack afectado y los controles.
3. Re-corre `compliance-cl` → `state.json` muestra qué cambió (avance/drift).

## F. Calendario de revisión

| Cuándo                                 | Qué                                                                                                              | Quién                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Anual (o ante cambios)                 | Revisar y actualizar el RAT (`docs/21719-rat.md`)                                                                | Mario Hans                      |
| Anual                                  | **Supervisión externa del MPD** (21.595, obligatoria, NO self-service)                                           | consultor/tercero independiente |
| Anual                                  | Capacitación del equipo y prestadores                                                                            | Mario Hans                      |
| Al firmar/renovar proveedor            | DPA + anexo de transferencia                                                                                     | Mario Hans                      |
| Cada release relevante del consolidado | Re-correr `compliance-cl` (drift)                                                                                | Yeyson Hans                     |
| Antes de ir a producción               | Desplegar y aplicar en producción las mismas correcciones ya hechas en consolidado (ver `RESUMEN.md`, brecha #1) | Yeyson Hans                     |

---

_Guía operativa de compliance-cl. No es asesoría legal._
