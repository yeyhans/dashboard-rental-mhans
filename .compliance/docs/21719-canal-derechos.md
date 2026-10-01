# Canal de ejercicio de derechos — HANS SALINAS SpA

> Art. 14 ter: el responsable debe ofrecer un medio para que el titular ejerza sus derechos. Este
> documento tiene (1) el texto público y (2) el procedimiento interno con los plazos correctos.

## 1. Texto público ("Tus derechos", para la web/política)

> Como titular de tus datos puedes ejercer estos derechos: **acceso, rectificación, supresión,
> oposición, portabilidad y bloqueo**. Escríbenos a **contacto@mariohans.cl**. Responderemos
> dentro de los plazos legales y sin costo en los casos que la ley establece.

## 2. Procedimiento interno (plazos verificados contra la ley)

1. **Recepción:** registra la solicitud (titular, derecho pedido, fecha) y verifica identidad (comparar con el RUT/email registrado en `user_profiles`).
2. **Plazo de respuesta: 30 días corridos**, prorrogable **una sola vez hasta por 30 días corridos** más, avisando al titular (Art. 11).
3. **Gratuidad:** rectificación, supresión y oposición son **siempre gratuitas**. El **acceso** es gratuito **al menos una vez por trimestre**; se puede cobrar un costo razonable solo si el titular pide acceso o portabilidad **más de una vez en el mismo trimestre**.
4. **Ejecución por derecho:**
   - **Acceso** → exportar su fila de `user_profiles` + sus `orders` + `order_communications` en formato comprensible (hoy manual vía consulta directa a la base; no hay endpoint de autoservicio).
   - **Portabilidad** → entregar en formato estructurado (JSON/CSV).
   - **Rectificación** → corregir el dato en `user_profiles`/`orders` vía panel admin.
   - **Supresión** → eliminar o anonimizar, **salvo** lo que debe conservarse por obligación legal: datos de facturación (DL 830, 6 años) y el contrato que la sustenta. Informar esta excepción al titular, fundada.
   - **Oposición** → dejar de tratar para ese fin (ej. dejar de usar el dato para notificaciones internas).
   - **Bloqueo** → suspender temporalmente el tratamiento mientras se resuelve la solicitud.
5. **Cierre:** responder por escrito y **guardar evidencia** (correo + fecha + qué se hizo) en el registro interno de solicitudes.

## 3. Estado actual (hallazgo Fase 1) y remediación

El sitio ya muestra un texto "Solicitar eliminación de mis datos" en la cuenta del cliente, pero el manejo es **100% manual** por correo: no hay endpoints de exportación ni de eliminación de autoservicio. Esto es funcional para el volumen actual (150 perfiles), pero no escala y no deja evidencia automática.

**Remediación recomendada (no aplicada en esta corrida):** construir endpoints `GET /api/account/export` (acceso/portabilidad) y `POST /api/account/delete-request` (supresión, con cola de revisión humana antes de borrar por la excepción tributaria). Ver `references/build/` para la receta.

## 4. Si no se puede cumplir

Informar el motivo legal (ej. obligación de conservar datos de facturación). El titular puede reclamar ante la **Agencia de Protección de Datos**.

---

_Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado._
