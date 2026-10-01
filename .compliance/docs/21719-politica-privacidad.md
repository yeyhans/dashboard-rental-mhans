# Política de Privacidad — HANS SALINAS SpA (Mario Hans Rental Fotográfico, sistema Consolidado)

**Última actualización:** 2026-10-01

## 1. Responsable del tratamiento

HANS SALINAS SpA, RUT 77.892.569-9, domicilio Purísima 25, Recoleta, Santiago, Región Metropolitana, Chile. Contacto para datos personales: contacto@mariohans.cl (horario 08:00-20:00 todos los días; WhatsApp +56 9 9081 8976 solo para coordinación operativa, no es canal formal de derechos).

## 2. Qué datos tratamos

Nombre, apellido, email, RUT, dirección, ciudad, país, teléfono, Instagram, fecha de nacimiento (opcional), datos de empresa si arriendas como persona jurídica (RUT y dirección de empresa), fotos de tu cédula de identidad (anverso y reverso) para verificar tu identidad, imagen de tu firma y el PDF de tu contrato de arriendo, fotos del estado del equipo al momento de la devolución (garantía), datos de tus órdenes (productos arrendados, montos, direcciones de despacho, motivo de cancelación si aplica) y el historial de mensajes de soporte asociado a tus órdenes.

No tratamos datos sensibles en el sentido del Art. 16 de la Ley 21.719 (salud, biométricos, origen étnico, etc.). Las fotos de tu cédula y tu firma no son una categoría sensible, pero las tratamos con especial cuidado por su impacto si se filtran.

## 3. Finalidad y base de licitud

| Finalidad                                        | Base de licitud                      |
| ------------------------------------------------ | ------------------------------------ |
| Crear tu cuenta y gestionar el arriendo          | Ejecución de contrato                |
| Verificar tu identidad antes de arrendar         | Ejecución de contrato                |
| Generar y firmar el contrato de arriendo         | Ejecución de contrato                |
| Facturación y cumplimiento tributario            | Obligación legal (Código Tributario) |
| Comunicarnos contigo sobre tu orden              | Ejecución de contrato                |
| Notificación interna de nuevas órdenes al equipo | Interés legítimo (gestión operativa) |

No usamos tus datos para marketing ni perfilado; no hay decisiones automatizadas con efectos jurídicos sobre ti.

## 4. Con quién compartimos los datos

Usamos proveedores que actúan como **encargados** del tratamiento: Cloudflare (almacenamiento de fotos, firma y contratos en R2), Resend (envío de correos transaccionales), Vercel (hosting del panel administrativo), Hostinger (servidor donde corren el sitio y la base de datos), Google (si inicias sesión con tu cuenta de Google) y Telegram (notificación interna al equipo sobre nuevas órdenes). También trabajamos con un encargado individual, Yeyson Hans (RUT 18.502.826-7), para el desarrollo y la administración técnica del sistema, con acceso a la base de datos y servidores bajo contrato.

Algunos de estos proveedores procesan datos **fuera de Chile** (Cloudflare, Resend, Vercel, Google, Telegram). Esa transferencia se ampara en las **cláusulas contractuales modelo aprobadas por el Ministerio de Economía** (Resolución RAEX202503748, Diario Oficial 19-12-2025) — ver `21719-anexo-transferencias.md`. No vendemos tus datos personales.

## 5. Por cuánto tiempo

Conservamos tus datos según este calendario de retención (aprobado y fundado en el DL 830, Código Tributario, art. 17 inc. 2° y art. 200):

| Dato                                                 | Plazo                                                 |
| ---------------------------------------------------- | ----------------------------------------------------- |
| Órdenes, boletas/facturas, datos de facturación      | 6 años desde el período tributario                    |
| Contrato firmado (PDF) + imagen de firma             | duración del arriendo + 6 años                        |
| Perfil de cliente (nombre, RUT, contacto, dirección) | cuenta activa; se elimina 6 años tras tu última orden |
| Fotos de tu cédula (anverso/reverso), E-RUT          | se eliminan 12 meses tras tu última orden completada  |
| Fotos de garantía                                    | 12 meses desde la devolución                          |
| Chat de soporte de tus órdenes                       | junto con la orden (6 años)                           |
| Logs de servidor, IP, navegador                      | 90 días                                               |
| Cuenta sin ninguna orden                             | se elimina a los 12 meses de inactividad              |

## 6. Tus derechos

Puedes ejercer **acceso, rectificación, supresión, oposición, portabilidad y bloqueo**, y **retirar tu consentimiento** cuando quieras, escribiendo a contacto@mariohans.cl. Respondemos en **30 días corridos** (prorrogables una sola vez por 30 días más). La rectificación, supresión y oposición son siempre gratuitas; el acceso es gratuito al menos una vez por trimestre. Ver el detalle del procedimiento en `21719-canal-derechos.md`.

## 7. Decisiones automatizadas

No tomamos decisiones automatizadas con efectos jurídicos o significativos sobre ti. No hacemos perfilado.

## 8. Origen de los datos

Tus datos nos los entregas directamente al registrarte y arrendar. El dato de quien retira el equipo por ti (`order_retire_name/phone/rut`) lo entregas tú al autorizarlo.

## 9. Seguridad

Aplicamos TLS en tránsito (Cloudflare delante del sitio), contraseñas con hashing bcrypt (Supabase Auth), control de acceso por fila (RLS) en la base de datos, y segregación por roles en el panel administrativo. Estamos trabajando en cerrar brechas identificadas en nuestra auditoría interna (ver `RESUMEN.md`): falta de autenticación de dos factores (MFA) en el panel administrativo y algunos permisos de escritura más amplios de lo necesario en la base de datos, ya en proceso de corrección.

## 10. Cambios

Podemos actualizar esta política; publicaremos la versión vigente con su fecha.

## 11. Reclamos

Puedes reclamar ante la **Agencia de Protección de Datos Personales** de Chile.

---

_Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado antes de publicar. Fundamento normativo: Ley 21.719 (vigencia 1-dic-2026) y DL 830 Código Tributario art. 17 inc. 2° + art. 200 para los plazos de retención._
