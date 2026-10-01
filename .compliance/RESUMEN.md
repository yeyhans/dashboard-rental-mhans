# RESUMEN — Compliance HANS SALINAS SpA (sistema Consolidado)

**Fecha de esta corrida:** 2026-10-01 · **Commit auditado:** `24f84c8` (dashboard-worktrees/consolidado) · **Packs:** Ley 21.719 (datos personales) + Ley 21.595 (delitos económicos)
**Entorno auditado:** Consolidado (new.mariohans.cl, dash-consolidado-mhans.vercel.app, supabase-v2.mariohans.cl). Producción (rental.mariohans.cl) no se re-auditó a fondo; ver sección "Delta producción" abajo con lo que ya se sabe que sigue abierto ahí.

> **Disclaimer:** no constituye asesoría legal. Documentación generada sin abogado, fundada en el texto oficial de la Ley 21.719 y la Ley 21.595 (ver `sources/FUENTES.md`); el abogado es opcional (`references/cuando-acudir-a-abogado.md`).

## Postura por marco

| Marco                                 | Score   | Controles requeridos | ✅ Pass | ⚠️ Partial | ❌ Fail | ❓ Unknown |
| ------------------------------------- | ------- | -------------------- | ------- | ---------- | ------- | ---------- |
| Ley 21.719 (Datos Personales)         | **52%** | 24                   | 6       | 13         | 4       | 1          |
| Ley 21.595 (Delitos Económicos / MPD) | **56%** | 8                    | 3       | 3          | 2       | 0          |

Detalle control por control en `state.json`.

## Brechas priorizadas (orden de corrección)

1. **Producción sigue expuesta a la misma vulnerabilidad RPC `anon` ya corregida en consolidado.** RLS deshabilitado + permisos `anon` completos en `orders/products/categories/order_communications/hermes_*` en `rental.mariohans.cl`/`supabase.mariohans.cl`. Orden de corrección: (a) desplegar el frontend commit `88ac3d6` a `main`, (b) aplicar en producción las migraciones `0014_rpc_least_privilege.sql` y `0001/0005` (RLS + grants). Es la brecha de mayor impacto porque afecta datos de clientes reales que compran a diario.
2. **CSV con PII en el repositorio de código** (`frontend/src/utils/users.csv`, `orders.csv`, commit `bf3bd55`, pusheado a `origin/main` y `origin/consolidado-web-2027`). Eliminar los archivos y purgar el historial del repo privado.
3. **Derechos ARCO sin endpoints** (`data-derechos` ❌): manejo 100% manual por correo. Construir exportación y solicitud de borrado de autoservicio.
4. **Retención sin automatizar** (`data-minimizacion` ❌): sin jobs de purga según el calendario aprobado; tabla `orders_status_backup_20260817` (499 filas, copia completa de PII) debe eliminarse ahora.
5. **MFA ausente en el panel admin** (`sec-mfa` ❌).
6. **DPAs y transferencias sin formalizar** (`data-dpa`, `data-transfer` ⚠️): documentos ya redactados (`21719-dpa.md`, `21719-anexo-transferencias.md`), falta firmarlos/incorporarlos con cada proveedor.
7. **Monitoreo y alertas** (`sec-monitoring` ❌): no instalado aún (ver `references/build/monitoreo.md`).

## Qué quedó resuelto solo (antes de esta corrida, en el consolidado)

- La exposición de las 17 funciones RPC `SECURITY DEFINER` sin verificación de `auth.uid()` ya fue remediada en el consolidado (migración `0014_rpc_least_privilege.sql`, commit `2bf283b`, + frontend `88ac3d6`). Sin esa corrección, el score de `sec-tenant` y de todo el marco 21.719 habría sido considerablemente peor.
- RLS está habilitado en todas las tablas del consolidado (migración `0001`), aunque persisten privilegios de escritura/`TRUNCATE` más amplios de lo necesario en algunas tablas.

## Insumos externos (NO self-service)

- **Supervisión externa anual del Modelo de Prevención de Delitos** (Ley 21.595): requiere un tercero independiente (~UF 3-5, no necesariamente abogado). Es el único componente de todo este compliance que la empresa no puede autoproveerse. Pendiente de contratar.
- La representación ante la Agencia en caso de fiscalización formal también requiere abogado, pero es reactiva (ver `INSTRUCTIVO.md`, sección C).

## Diff vs. corrida anterior

**Primera corrida.** No existe `state.json` previo en `.compliance/` — este es el punto de partida. Las futuras re-corridas de `compliance-cl` compararán contra este estado y reportarán avance o _drift_ (algo que cumplía y dejó de cumplir).

## Datos marcados `[COMPLETAR]` (genuinamente desconocidos en esta corrida)

- Número de trabajadores de HANS SALINAS SpA (afecta si aplica el libro auxiliar de remuneraciones del Código del Trabajo art. 62, exigible desde 5 trabajadores).
- Región física del VPS de Hostinger (afecta si hay una transferencia internacional adicional de la base de datos misma, no solo de los archivos en R2).

## Artículos que no se pudieron verificar al 100%

- Numeración exacta de los artículos de **transferencia internacional** y del **Modelo de Prevención/DPO** de la Ley 21.719: se tienen las líneas del texto (`references/mapa-articulos-21719.md`, L1276-L2322) pero no el número definitivo de artículo — marcado `[verificar contra fuente oficial]` donde corresponde.
- El plazo laboral de conservación de datos de remuneraciones: el Código del Trabajo art. 62 no fija un plazo en años; el plazo informado al titular es siempre el tributario (DL 830 art. 200), tal como indica `sources/FUENTES.md`.

## Siguiente paso

**Corregir la brecha #1 (producción expuesta)** desplegando el frontend `88ac3d6` a `main` y aplicando las migraciones `0014`/`0001`/`0005` en `supabase.mariohans.cl`, porque es la única de las siete brechas priorizadas que afecta datos de clientes reales hoy. Después de eso, re-correr `compliance-cl` para confirmar el cierre y seguir con la brecha #2 (CSV con PII). Ver también `references/revisiones-periodicas.md` para agendar re-corridas automáticas y detectar drift.

---

_Generado por compliance-cl. No constituye asesoría legal._
