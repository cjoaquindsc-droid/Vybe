# Contrato de módulos · CRM B2C Viñas de Oro

Cada pantalla grande vive en `src/modulos/<nombre>.js` (+ `src/modulos/<nombre>.css` opcional). `herramientas/ensamblar.py` concatena los módulos en orden alfabético **después** de `crm-datos.js` y `crm-logica.js`, dentro de `crm-vdo.html`. No hay bundler: cada módulo es un IIFE que usa la API global `window.VDO`.

```js
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, E = V.embudo, DB = V.DB;
  function render() { UI.$('p-hoy').innerHTML = '...'; /* enlazar eventos del propio section */ }
  V.registrarPantalla('hoy', render);           // reemplaza el placeholder del núcleo
  V.registrarAccion('hoy-marcar-enviado', function (el) { /* data-accion fuera de modales llega aquí */ });
})();
```

## Reglas

1. **Sin dependencias externas ni red.** Nada de CDN, fuentes web, fetch. El archivo se abre por `file://` en laptop y celular.
2. **Todo texto del usuario pasa por `U.esc()`** (contenido) o `U.attr()` (atributos) antes de ir a `innerHTML`. Incluye números y campos "seguros": vienen de respaldos JSON editables.
3. **Español, soles y fechas de Lima.** Montos con `U.soles(n)` → `S/ 1,234.50`; fechas con `U.fechaCorta(iso)` → `dd/mm/aaaa`; hoy con `U.hoyISO()`. Fechas se guardan `AAAA-MM-DD`.
4. **Estilo The Pisco Room**: usa las clases del núcleo (`.tarjeta`, `.tarjeta.oro`, `.kpis/.kpi`, `.chip`, `.pill`, `.btn`, `.btn.primario`, `.btn.chico`, `.btn.peligro`, `.tabla`, `.tabla-scroll`, `.form-grid`, `.campo`, `.acciones`, `.cabecera-pantalla`, `.subnav`, `.grid-2`, `.texto2/.texto3`, `.num`, `.bien/.mal`). Variables CSS: `--oro`, `--oro-claro`, `--oro-suave`, `--oro-fondo`, `--superficie`, `--superficie2`, `--borde`, `--borde-oro`, `--texto`, `--texto2`, `--texto3`, `--ok`, `--alerta`, `--aviso`, `--titulos` (versales), `--cuerpo`. Títulos `h2/h3` ya salen en versales doradas. Prefija tus clases nuevas con el nombre del módulo (`.hoy-…`, `.cal-…`).
5. **Celular**: todo debe funcionar a 390 px de ancho sin desplazamiento horizontal. Las tablas anchas van dentro de `.tabla-scroll` o se convierten en tarjetas con `td[data-label]` (ver `.tabla.contactos` en el CSS del núcleo). Botones de al menos 36 px de alto.
6. **El CRM no envía mensajes.** Para WhatsApp: `R.urlWhatsApp(telefono, texto)` → abre `wa.me` en pestaña nueva (`target="_blank" rel="noopener"`); para correo: `R.urlCorreo(correo, asunto, texto)`. Copiar: `UI.copiar(texto)` (Promise). El usuario envía.
7. **Guardar** siempre con `DB.upsert(tabla, obj)` / `DB.eliminar(tabla, id)` (hacen `guardarPronto`). Para cambios directos en `DB.datos.ui` o `config`, llama a `DB.guardarPronto()`. Nunca escribas a `localStorage` directamente.
8. **Eventos**: enlaza dentro de tu `section` (`UI.$('p-<pantalla>')`) con delegación propia, o registra `data-accion` globales con `V.registrarAccion`. Los clics con `data-accion` dentro de un modal **no** llegan al núcleo: pon `onclick` a tus botones del modal. `data-pantalla="x"` y `data-ir="x"` los maneja el núcleo (navegación).
9. **Re-render**: tu `render()` puede llamarse muchas veces (al navegar, tras guardar, al cambiar filtros). Debe ser idempotente y no perder el foco de un campo en el que el usuario escribe (re-dibuja solo la parte necesaria, como hace `renderContactos(soloTabla)`).
10. **Datos de prueba**: los registros con `prueba: true` se borran con un botón. Si creas registros de ejemplo, márcalos así; si creas datos reales, no.
11. **Pruebas**: cada módulo trae `pruebas/modulos/<nombre>.js` con Playwright (mismo patrón que `pruebas/e2e.js`: abre `crm-vdo.html` por `file://`, `locale es-PE`, `timezoneId America/Lima`, captura `pageerror`, imprime ✓/✗ y sale con código 1 si falla). Debe pasar en laptop (1366×860) y celular (390×844). Ejecutar: `python3 herramientas/ensamblar.py && NODE_PATH=$(npm root -g) node pruebas/modulos/<nombre>.js`.

## API del núcleo (`window.VDO`)

- `DB.tabla(n)`, `DB.buscar(n, id)`, `DB.upsert(n, obj)`, `DB.eliminar(n, id)`, `DB.datos` (incluye `ui` para filtros persistentes), `DB.exportar()`.
- `cfg()` → configuración: `segmentos[]` (codigo, nombre, num, detalle, grupo, cadencia, trato, color, empresas[]), `etapas[]`, `cadencias`, `reglas`, `leyendas`, `productos[]`, `packs[]`, `experiencias[]`, `paquetesGrupo[]`, `olas[]`, `ganchos[]`, `metas` (total, cuotaOficial{mes}, proyeccion{mes}, mix, lineasPlan[], pesoDia, ventaPrevia), `tasasPlan{segmento:{respuesta, compra}}`, `cortes[]`, `fechasClave[]`, `skuMaestro[]`.
- `util`: `hoyISO, ahoraISO, isoDe, fechaValida, fechaCorta, fechaHora, fechaLarga, diaSemana, mesDe, nombreMes, soles, entero, pct, numero, normTelefono, telefonoDigitos, normCorreo, correoValido, normTexto, primerNombre, sumarDias, diasEntre, parseCSV, aCSV, columnasDe, descargar(nombre, contenido, tipo), nuevoId(prefijo), clonar, esc, attr`.
- `reglas`: `puedeIniciarOla(c, hoy)` → `{ok, motivo}`; `derivarB2B(venta)`; `proximoToqueTras(c, fechaEnvio, toque)`; `cadenciaDe(c)`; `tratoDe(c)` ('tu'|'usted'); `olaDe(fecha)`; `ganchosDe(fecha)`; `ganchoTexto(fecha)`; `armarMensaje(plantilla, contacto, extra)` → `{texto, asunto}` (ya con leyendas si la plantilla es masiva); `urlWhatsApp`, `urlCorreo`; `variablesDe`, `rellenar`; `precioDe(id, 'b2c'|'breca'|'supermercado')`; `segmentoDe`, `nombreSegmento`, `nombreEtapa`; `diaCalendario(fecha)`.
- `embudo`: `plantillaPara(c, toque, canal?, fecha?)` (toque 1|2|3|'post'|'propuesta'|'recordatorio'|'cierre'); `marcarEnviado(c, {canal, plantilla, mensaje, toque, codigoOrigen})` → crea la interacción, cuenta el toque, fija `proximoToque` y mueve a Iniciar; `marcarRespondio(c, texto)` → Calificar, `proximoToque` hoy; `marcarPropuesta(c)` → Proponer; `marcarCompro(c, venta)` → Cerrar/Fidelizar, programa post-venta a +3 días, genera `codigoReferido`; `marcarDormido(c, motivo)`; `marcarPerdido(c, motivo)`; `registrarInteraccion({...})`; `ultimaInteraccion(contactoId)`; `mantenimientoDiario()`; `colaDelDia(fecha)` → `[{tipo, contacto, cuenta?, toque, vencido, plantilla}]` con tipos `inicial | seguimiento | responder | cobro | entrega | postventa | cerrar_conversacion | cuenta`; `resumenDia(fecha)` → `{enviados, respondieron, compraron, ventaDia, metaDia, cuotaDia, cuotaContactos, dia}`.
- `ventas`: `formVenta(venta|null, {contacto, cuentaId, alGuardar})` abre el formulario compartido (productos, packs, experiencias, paquetes, gancho, código de origen, estado, umbral B2B automático; al guardar mueve el contacto en el embudo); `catalogoVenta()`; `normalizarVenta(v)`; `totalVenta(items)`; `lineaDe(items)`.
- `ui`: `navegar(pantalla, sub?)`, `refrescar()`, `toast(msg, 'alerta'?)`, `abrirModal(html, {ancho:'ancho'})`, `cerrarModal()`, `confirmar(texto, onOk, textoBoton)`, `copiar(texto)`, `formContacto(c|null)`, `formVenta`, `opciones(lista, valor, vacio)`, `opcionesSegmentos`, `opcionesEtapas`, `campo(etiqueta, inputHtml, ayuda)`, `inp(nombre, valor, extra)`, `leerForm(form)`, `$`, `qs`, `qsa`.
- `DIAS`, `MESES`, `ORDEN_ETAPAS`.

## API que exponen los módulos (si están cargados)

- `ui.fichaContacto(id|contacto)` (pipeline): abre la ficha completa con embudo, historial, ventas y acciones. HOY y CONTACTOS la usan si existe.
- `modulos.ventas` (ventas): `ventasDelTrimestre()`, `fechaEfectiva(v)`, `precioPaquete`, `precioExperiencia`, `calculo(params)`, `ventaDesdeCalculadora`, `comisionPorMes(embajador, mes)`, `resumenEmbajador`, `rankingEmbajadores(rango?)`, `sugerirCodigo(nombre, ciudad)`.
- `metricas` (metricas): `alertaCorte()` → `{corte, fecha, acumulado, metaALaFecha, cuotaALaFecha, brecha, ritmoActual, ritmoRequerido, ticket, tasaCompra, contactosDiaRequeridos, contactosDiaActuales, diasRestantes, nivel ok|aviso|alerta, texto}`; `datos(rango)`; `rango()`; `cortes()`; `ranking()`.
- `plantillas` (plantillas): `VARIABLES`, `variablesDesconocidas(texto)`, `importar(jsonTexto)`.
- `reporte` (reporte): `generar(lunesISO)` → texto plano del reporte de esa semana.

Comprueba la existencia antes de usar (`if (V.metricas) …`): cada módulo debe funcionar solo.

## Tablas (ver docs/modelo-de-datos.md)

`contactos` (nombre, telefono, correo, empresa, cargo, ciudad, segmento, subsegmento, origen, perfil A|B, consentimiento, ultimoContacto, proximoToque, inicioConversacion, ultimaOla, respondio, cierrePendiente, etapa, estado activo|dormido|perdido|b2b, toques, ocasion, personas, notas, referidoPor, codigoReferido, yaCompro, totalInvertido, prueba) · `interacciones` (contactoId, fecha `AAAA-MM-DDTHH:MM`, canal, toque, ola, plantillaId, mensaje, respuesta, resultado enviado|respondio|compro|sin_respuesta, codigoOrigen) · `ventas` (contactoId, cuentaId, fecha, linea botellas|experiencia, items[{productoId, nombre, cantidad, precio, total, linea, botellas, porPersona}], botellas, personas, total, gancho, codigoOrigen, estado cotizado|link_enviado|pagado|entregado|perdido, fechaCierre, fechaEntrega, motivoPerdida, segmento, derivarB2B, embajadorId, notas) · `embajadores` (nombre, ciudad, codigo, telefono, contactoId, estado candidato|activo|inactivo, desde, pagos[{fecha, monto, nota}]) · `cuentas` (empresa, segmento, contactos[], paquete, personas, fechaEvento, monto, estado contactado|respondio|reunion|cotizacion|cerrado|perdido, notas, proximoPaso, fechaProximoPaso) · `calendario` (fecha, dow, ola, foco, hito, periodo, metaDia, cuotaDia, cuotas{segmento}, estado pendiente|en_curso|cumplido|no_cumplido, notas, esCorte, focoEditado, cuotasEditadas) · `plantillas` (id, nombre, segmento|'*', toque, ola 0..3, canal whatsapp|correo, asunto, texto, masivo, activa).

Las ventas que cuentan para la cuota son `estado ∈ {pagado, entregado}` y `derivarB2B = false`, por `fechaCierre` (o `fecha`). El mix es botellas vs experiencia por `linea`.
