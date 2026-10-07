# Modelo de datos · CRM B2C Viñas de Oro

Todo vive en `localStorage` bajo la clave `vdo-crm-v1` como un solo objeto JSON:

```
{ version, creado, actualizado, config, ui,
  contactos[], interacciones[], ventas[], embajadores[], cuentas[], calendario[], plantillas[] }
```

Cada registro tiene `id`, `createdAt`, `updatedAt` (hora de Lima, `AAAA-MM-DDTHH:MM`) y, si vino de los datos de ejemplo, `prueba: true`. Las fechas de negocio se guardan como `AAAA-MM-DD` y se muestran como `dd/mm/aaaa`; los montos son números en soles y se muestran como `S/ 1,234.50`.

## contactos

| Campo | Valores |
|---|---|
| nombre, telefono (+51…), telefono2, correo, empresa, cargo, ciudad | texto |
| segmento | `boca` · `recontacto` · `corporativo` · `breca` · `pyme` · `grupos` · `piloto` |
| subsegmento | texto libre (empresa Breca, ciudad del piloto, "Embajador", "Hotel"…) |
| origen | de dónde salió (Agenda, WhatsApp Business, Base Breca, LinkedIn, Centro de Mando…) |
| perfil | `A` alto poder adquisitivo · `B` pyme · vacío |
| consentimiento | `true` si escribió primero (obligatorio para que el número de la empresa le escriba) |
| ultimoContacto, proximoToque, inicioConversacion, ultimaOla, ultimaRespuesta | fechas |
| etapa | `atraer` · `iniciar` · `calificar` · `proponer` · `cerrar` · `fidelizar` |
| estado | `activo` · `dormido` · `perdido` · `b2b` |
| toques | 0–3 en la conversación actual |
| respondio, cierrePendiente, yaCompro | booleanos que fija el embudo (respondió en esta conversación; tercer toque enviado sin respuesta; ya compró alguna vez) |
| ocasion, personas, notas, referidoPor, codigoReferido | texto / número |
| cmId, cmTipo, cmClasificacion, cmPrioridad, interes, totalInvertido, canalPreferido | compatibilidad con el Centro de Mando |

Duplicados: se consideran la misma persona dos registros con el mismo teléfono normalizado (solo dígitos de `+51…`) o el mismo correo en minúsculas.

## interacciones

`contactoId`, `fecha` (fecha y hora), `canal` (`whatsapp` · `correo` · `linkedin` · `llamada` · `visita`), `toque` (1, 2, 3), `ola`, `plantillaId`, `mensaje`, `respuesta`, `resultado` (`enviado` · `respondio` · `compro` · `sin_respuesta`), `codigoOrigen`.

## ventas (oportunidades)

`contactoId`, `cuentaId`, `fecha`, `linea` (`botellas` · `experiencia`), `items[{productoId, codigo, nombre, cantidad, precio, total}]`, `botellas`, `personas`, `total`, `gancho` (id del gancho aplicado), `codigoOrigen`, `estado` (`cotizado` · `link_enviado` · `pagado` · `entregado` · `perdido`), `fechaCierre`, `motivoPerdida`, `segmento`, `derivarB2B` (más de 12 botellas o más de S/ 1,500: no suma a la cuota), `embajadorId`, `notas`. Los pedidos del Centro de Mando traen además `pedidoId`, `clienteNombre`, `modalidad`, `tour`, `fechaEntrega`.

## embajadores

`nombre`, `ciudad`, `codigo` (ej. `CIX-ANA`), `telefono`, `contactoId`, `estado` (`candidato` · `activo` · `inactivo`), `desde`, `pagos[{fecha, monto, nota}]`. Las ventas se atribuyen por `embajadorId` o por `codigoOrigen` igual al código. Comisión 10 %, 15 % desde S/ 1,500 vendidos en el mes.

## cuentas (corporativo, pymes, grupos, alianzas)

`empresa`, `segmento`, `contactos[]` (ids), `paquete`, `personas`, `fechaEvento`, `monto`, `estado` (`contactado` · `respondio` · `reunion` · `cotizacion` · `cerrado` · `perdido`), `notas`, `proximoPaso`, `fechaProximoPaso`. Las alianzas del Centro de Mando traen `tipoAlianza`, `estadoOriginal`, `acuerdos[]`, `log[]`.

## calendario

Un registro por día de atención del 07/10 al 31/12 (lunes a sábado, sin el 25/12): `fecha`, `dow`, `ola` (1–4), `foco`, `hito`, `periodo`, `metaDia` (reparto de la proyección mensual por días con peso 1 de lunes a viernes y 0.7 el sábado), `cuotaDia` (igual con la cuota oficial), `cuotas{segmento: contactos por día}`, `estado` (`pendiente` · `en_curso` · `cumplido` · `no_cumplido`), `notas`, `esCorte`. Los campos editados a mano se marcan con `focoEditado` / `cuotasEditadas` para sobrevivir a un recálculo.

## plantillas

`id`, `nombre`, `segmento` (código o `*`), `toque` (1, 2, 3, `post`, `cierre`, `propuesta`, `recordatorio`), `ola` (0 = cualquiera), `canal` (`whatsapp` · `correo`), `asunto`, `texto`, `masivo` (si lleva leyendas), `activa`. Variables: `{nombre}` `{nombre_completo}` `{empresa}` `{ocasion}` `{codigo}` `{gancho}` `{ciudad}` `{personas}` `{producto}` `{total}` `{link}` `{precio_silver}` `{precio_gold}` `{precio_blue}` `{precio_breca_silver}` `{precio_breca_gold}` `{precio_breca_blue}` `{total_10_gold}` `{firma}`.

## config

`empresa`, `segmentos`, `etapas`, `cadencias` (`consumidor: [0,2,5]`, `empresa: [0,3,7]`), `reglas` (toques, bloqueo 7 días, 21 días entre olas, umbral B2B, comisiones, delivery), `leyendas`, `productos`, `packs`, `experiencias`, `paquetesGrupo`, `olas`, `ganchos` (estado `pendiente` · `activo` · `inactivo`), `metas` (cuota oficial, proyección, mix, líneas del plan, pesos por día, venta previa), `tasasPlan`, `cortes`, `fechasClave`, `skuMaestro` (maestro del ERP, 153 códigos).

## Respaldo

El archivo de respaldo tiene la forma `{ formato: "vdo-crm-respaldo", version, generado, fuente, tablas: {…}, config, ui }`. Importarlo en modo **fusionar** añade registros nuevos por id y, en contactos, también por teléfono o correo, completando los campos vacíos; en modo **reemplazar** sustituye todo.
