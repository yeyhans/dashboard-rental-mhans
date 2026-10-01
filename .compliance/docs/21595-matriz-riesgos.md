# Matriz de Riesgos de Delitos — HANS SALINAS SpA

**Fecha:** 2026-10-01 · **Versión:** 1.0 · **Responsable:** Mario Hans (Encargado de Prevención)

> Identifica, por proceso, dónde puede ocurrir un delito de la Ley 21.595, su nivel de riesgo y
> el control que lo mitiga. Actualizar al menos anualmente.

| Proceso                                                                                              | Delito potencial                         | Probabilidad                                                                                      | Impacto | Nivel      | Control mitigante                                                                                      | Control técnico (id)                | Estado                                        |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------- | --------------------------------------------- |
| Pagos recibidos de clientes (incluye retiro por terceros autorizados, `order_retire_name/phone/rut`) | Lavado de activos / receptación          | Baja-media                                                                                        | Alto    | Medio      | Verificación de identidad (foto cédula) antes de arrendar; registrar quién retira                      | `data-info`                         | [x] implementado, [ ] formalizado por escrito |
| Facturación / tributario                                                                             | Delito tributario                        | Baja                                                                                              | Alto    | Medio      | Facturación electrónica + respaldo de órdenes 6 años                                                   | —                                   | [x]                                           |
| Contratación con el Estado                                                                           | Cohecho / fraude en licitaciones         | No aplica (negocio B2C)                                                                           | —       | —          | No aplica actualmente                                                                                  | —                                   | [x] N/A                                       |
| Acceso a sistemas/datos de clientes (incl. encargado externo de desarrollo)                          | Delitos informáticos                     | Media (hallazgo confirmado en esta corrida: permisos `anon` excesivos, corregidos en consolidado) | Alto    | Alto       | MFA (❌ pendiente) + logs (⚠️ parcial) + RLS/segregación por rol (✅ en consolidado, ❌ en producción) | `sec-mfa`, `sec-logs`, `sec-tenant` | [ ] pendiente completar (MFA y producción)    |
| Gastos / reembolsos                                                                                  | Administración desleal / fraude          | Baja (operación unipersonal)                                                                      | Medio   | Bajo-medio | Revisión manual por el propio dueño                                                                    | `ctrl-interno`                      | [x]                                           |
| Contrataciones / prestadores de servicio (ej. encargado de desarrollo)                               | Conflicto de interés                     | Baja                                                                                              | Medio   | Bajo       | Declaración de conflictos (pendiente de formalizar)                                                    | —                                   | [ ]                                           |
| Manejo de datos personales de clientes                                                               | Uso indebido de datos (cruce Ley 21.719) | Media (CSV con PII en git, hallazgo confirmado)                                                   | Alto    | Alto       | Eliminar CSV + purgar historial; capa de Services para escrituras                                      | `data-minimizacion`, `sec-secrets`  | [ ] pendiente                                 |

## Notas

- Niveles: combinación cualitativa de probabilidad × impacto (bajo/medio/alto).
- Los controles técnicos enlazan con `references/controls.md` (evaluados en `state.json` de esta auditoría).
- Las filas marcadas `[ ] pendiente` son el plan de remediación prioritario de este modelo; ver orden de corrección en `RESUMEN.md`.

---

_Borrador generado con compliance-cl (pack ley-21595). No constituye asesoría legal; revisar con un abogado._
