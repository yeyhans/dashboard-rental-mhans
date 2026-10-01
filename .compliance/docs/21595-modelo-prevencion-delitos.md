# Modelo de Prevención de Delitos (MPD) — HANS SALINAS SpA

**RUT:** 77.892.569-9 · **Vigente desde:** 2026-10-01 · **Versión:** 1.0
**Encargado de Prevención:** Mario Hans

> Conforme a la Ley 21.595 (que amplía la Ley 20.393). Modelo proporcional al tamaño de la
> empresa (micro, Ley 20.416). Aprobado por la administración (Mario Hans, representante legal).

## 1. Objeto y alcance

Este modelo busca prevenir la comisión de delitos que puedan generar responsabilidad penal de HANS SALINAS SpA. Aplica a socios, administradores, trabajadores (`[COMPLETAR: número de trabajadores]`) y prestadores de servicios, incluido el encargado de desarrollo (Yeyson Hans).

## 2. Encargado de Prevención de Delitos

Se designa a **Mario Hans** como Encargado de Prevención, con autonomía respecto de la administración y los medios para ejercer su función. Al ser una SpA de administración unipersonal, el propio dueño asume la función (criterio aplicable en micro/pequeña empresa). Reporta a sí mismo como administración; en caso de crecer la empresa, se recomienda separar ambos roles. Duración: indefinida, revisable anualmente.

## 3. Identificación de riesgos

Los riesgos de delitos por proceso se detallan en la **Matriz de Riesgos** (`21595-matriz-riesgos.md`). Procesos de mayor exposición en HANS SALINAS SpA: pagos recibidos de clientes (efectivo o transferencia de terceros), facturación/tributario, manejo de datos personales de clientes (cruce con Ley 21.719), y acceso de terceros (encargado de desarrollo) a sistemas y datos.

## 4. Controles internos

- Procedimientos de **autorización** de pagos, compras y contratos (montos y firmas) — a formalizar por escrito dado el tamaño actual (operación unipersonal con roles admin/super_admin/operator en el dashboard, migración `0011_operator_role.sql`).
- **Segregación de funciones**: limitada por ser empresa unipersonal; se mitiga con los roles del dashboard y con acceso de solo lectura (`hermes_ro`) para el encargado de desarrollo en tareas de auditoría.
- Controles tributarios: facturación electrónica y respaldo de operaciones (órdenes retenidas 6 años, ver `21719-rat.md`).
- Controles de acceso a sistemas y datos: ver controles técnicos `sec-mfa` (❌ pendiente), `sec-logs` (⚠️ parcial), `ctrl-interno` (⚠️ parcial).
- Debida diligencia de contrapartes (clientes que retiran a nombre de terceros) ante señales de riesgo de lavado o receptación (ej. pagos de terceros no identificados).

## 5. Canal de denuncias

Canal de denuncias: **contacto@mariohans.cl** (compartido con el canal de derechos de datos; se recomienda una alias dedicado, ej. `denuncias@mariohans.cl`, para separar denuncias de delitos de solicitudes ordinarias de clientes — ver `RESUMEN.md`). Garantiza confidencialidad y **prohíbe represalias** contra el denunciante. Procedimiento de investigación en `21595-reglamento-canal-denuncias.md`.

## 6. Capacitación

**Estado: no realizada aún** (`[COMPLETAR: capacitación pendiente]`). Plan propuesto: capacitación inicial al Encargado de Prevención y a cualquier trabajador/prestador con acceso a datos o pagos, dentro de los 90 días siguientes a esta corrida, y luego **anual**, sobre este modelo y el código de ética.

## 7. Régimen disciplinario

El incumplimiento de este modelo se sanciona conforme al reglamento interno y la legislación laboral, según gravedad.

## 8. Supervisión y actualización

El Encargado supervisa el modelo y lo actualiza al menos **anualmente** o ante cambios relevantes del negocio. Deja registro de las revisiones. **Supervisión externa anual por un tercero independiente** (único componente no self-service de este modelo, ~UF 3-5): pendiente de contratar — es el insumo externo que esta skill no puede generar (ver `RESUMEN.md`).

---

_Borrador generado con compliance-cl (pack ley-21595). No constituye asesoría legal; revisar con un abogado._
