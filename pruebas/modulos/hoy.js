/* Pruebas del módulo HOY (parte 2) con Playwright (Chromium).
   Uso: CRM_HTML=/tmp/crm-hoy.html NODE_PATH=$(npm root -g) node pruebas/modulos/hoy.js
   Abre el CRM por file://, carga los datos de prueba más contactos propios con toque hoy,
   recorre la cola del día (mensajes, enviado, respondió, venta, posponer, dormir, perdido,
   cuentas, cierre del día) en laptop y celular, y deja capturas en pruebas/capturas/hoy-*.png. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..', '..');
const ARCHIVO = 'file://' + (process.env.CRM_HTML || path.join(RAIZ, 'crm-vdo.html'));
const CAPTURAS = path.join(RAIZ, 'pruebas', 'capturas');
fs.mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0, total = 0;
function ok(cond, msg) { total++; if (cond) console.log('  ✓ ' + msg); else { fallos++; console.log('  ✗ ' + msg); } }

// Estado limpio y determinista: datos de prueba del núcleo + contactos propios con toque hoy
async function prepararDatos(page) {
  await page.evaluate(() => {
    VDO.DB.restablecer(); VDO.DB.cargarPrueba();
    const hoy = VDO.util.hoyISO();
    const base = { etapa: 'atraer', estado: 'activo', toques: 0, proximoToque: hoy, consentimiento: true, prueba: true, ciudad: 'Lima', correo: '', empresa: '', cargo: '', notas: '', ocasion: '', personas: '' };
    VDO.DB.upsert('contactos', Object.assign({}, base, { id: 'c_hoy_corp', nombre: 'Elena Quiroz', telefono: '+51 977 111 222', segmento: 'corporativo', empresa: 'Interbank', cargo: 'Gerente de Personas', ocasion: 'regalos a clientes' }));
    VDO.DB.upsert('contactos', Object.assign({}, base, { id: 'c_hoy_dormir', nombre: 'Tomás Ríos', telefono: '+51 966 333 444', segmento: 'boca' }));
    VDO.DB.upsert('contactos', Object.assign({}, base, { id: 'c_hoy_perdido', nombre: 'Valeria Nuñez', telefono: '+51 955 555 666', segmento: 'boca' }));
    VDO.DB.upsert('contactos', Object.assign({}, base, { id: 'c_hoy_correo', nombre: 'Marco Antonio Ruiz', telefono: '', correo: 'mruiz@ejemplo.pe', segmento: 'corporativo', empresa: 'Scotiabank' }));
    VDO.DB.upsert('contactos', Object.assign({}, base, { id: 'c_hoy_vars', nombre: 'Rocío Paz', telefono: '+51 944 777 888', segmento: 'recontacto' }));
    const k = VDO.DB.buscar('cuentas', 'k_prueba_02'); k.fechaProximoPaso = hoy; VDO.DB.upsert('cuentas', k);
    VDO.DB.guardar();
  });
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]) .hoy-card');
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'es-PE', timezoneId: 'America/Lima' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  console.log('1. Carga y cabecera');
  await page.goto(ARCHIVO);
  await page.waitForSelector('#p-hoy:not([hidden])');
  await prepararDatos(page);
  const hoy = await page.evaluate(() => VDO.util.hoyISO());
  const dia = await page.evaluate(() => VDO.reglas.diaCalendario(VDO.util.hoyISO()));
  const hoyMas = await page.evaluate(() => [1, 2, 3].map(n => VDO.util.sumarDias(VDO.util.hoyISO(), n)));
  console.log('     hoy (Lima):', hoy, dia ? '· ola ' + dia.ola + ' · meta ' + dia.metaDia : '· sin atención');
  const cab = await page.$eval('#p-hoy .cabecera-pantalla', el => el.textContent);
  const fechaLarga = await page.evaluate(() => VDO.util.fechaLarga(VDO.util.hoyISO()));
  ok(cab.indexOf(fechaLarga) >= 0 && /hora de Lima/.test(cab), 'cabecera con la fecha larga de hoy y la hora de Lima');
  const tDia = await page.$eval('#p-hoy .hoy-dia', el => el.textContent);
  if (dia) {
    ok(/Ola/.test(tDia) && tDia.indexOf(dia.foco.slice(0, 40)) >= 0 && (!dia.hito || tDia.indexOf(dia.hito) >= 0), 'tarjeta del día con ola, foco e hito');
    ok((tDia.indexOf('Corte de control') >= 0) === !!dia.esCorte, 'badge "Corte de control" solo si el día es corte');
  } else {
    ok(tDia.indexOf('no es día de atención') >= 0, 'avisa que hoy no es día de atención y muestra igual la cola');
  }

  console.log('2. KPIs y cuotas por segmento');
  const kpis = await page.$$eval('#hoy-resumen .kpi', els => els.map(e => e.textContent.replace(/\s+/g, ' ')));
  ok(kpis.length === 5 && /Enviados hoy/.test(kpis[0]) && /Venta del día/.test(kpis[1]) && /cuota oficial/.test(kpis[2]) && /Respondieron/.test(kpis[3]) && /Compraron/.test(kpis[4]), 'cinco KPI: enviados, venta vs meta, vs cuota oficial, respondieron, compraron');
  ok((await page.$$('#hoy-resumen .hoy-barra')).length >= 3, 'barras de progreso en los KPI');
  const cuotas = await page.$$eval('#hoy-resumen .hoy-cuota', els => els.map(e => e.textContent.replace(/\s+/g, ' ')));
  if (dia) ok(cuotas.some(t => /Recontacto/.test(t) && t.indexOf('0 / ' + dia.cuotas.recontacto) >= 0), 'cuota por segmento "Recontacto 0 / ' + dia.cuotas.recontacto + '"');
  else ok(true, 'sin día de atención no hay cuotas que mostrar');

  console.log('3. Cola del día');
  const cola = await page.evaluate(() => VDO.embudo.colaDelDia(VDO.util.hoyISO()).map(i => ({ tipo: i.tipo, vencido: i.vencido, id: i.contacto ? i.contacto.id : '', cuenta: i.cuenta ? i.cuenta.id : '' })));
  const nCards = (await page.$$('#hoy-cola .hoy-card')).length;
  ok(nCards === cola.length && nCards >= 9, 'una tarjeta por item de la cola (' + nCards + ')');
  const secciones = await page.$$eval('#hoy-cola .hoy-seccion', els => els.map(e => e.getAttribute('data-seccion')));
  const orden = ['vencidos', 'responder', 'seguimientos', 'postventa', 'cuentas', 'nuevos'];
  ok(secciones.length >= 3 && secciones.every((s, i) => i === 0 || orden.indexOf(s) > orden.indexOf(secciones[i - 1])), 'secciones en orden: ' + secciones.join(' → '));
  const contadores = await page.$$eval('#hoy-cola .hoy-seccion', els => els.map(e => ({ n: +e.querySelector('[data-contador]').textContent, cards: e.querySelectorAll('.hoy-card').length })));
  ok(contadores.every(c => c.n === c.cards), 'los contadores por sección coinciden con las tarjetas');
  const vencidosDom = await page.$$eval('#hoy-cola [data-seccion="vencidos"] .hoy-card', els => els.length).catch(() => 0);
  ok(vencidosDom === cola.filter(i => i.vencido).length && vencidosDom >= 2, 'sección Vencidos con todo lo vencido (' + vencidosDom + ')');
  ok((await page.$eval('.hoy-card[data-id="c_prueba_05"] .hoy-motivo', el => el.textContent)).indexOf('Vencido desde el 05/10/2026') >= 0, 'motivo "Vencido desde dd/mm"');
  ok((await page.$eval('.hoy-card[data-id="c_prueba_03"]', el => el.textContent)).indexOf('toque 1 de 3') >= 0, 'la tarjeta indica "toque N de 3"');
  const grupos = await page.$$eval('#hoy-cola [data-seccion="nuevos"] .hoy-grupo', els => els.map(e => ({ seg: e.getAttribute('data-seg'), xy: e.querySelector('[data-xy]').textContent })));
  ok(grupos.length >= 3 && grupos.every(g => /^\d+ de \d+ enviados$/.test(g.xy)), 'nuevos toques agrupados por segmento con "X de Y": ' + grupos.map(g => g.seg + ' ' + g.xy).join(' · '));
  await page.screenshot({ path: path.join(CAPTURAS, 'hoy-cola-laptop.png'), fullPage: true });

  console.log('4. Mensajes armados');
  const carla = await page.$eval('.hoy-card[data-id="c_prueba_03"] textarea[data-campo="mensaje"]', el => el.value);
  ok(carla.indexOf('Carla') >= 0 && carla.indexOf('Rímac') >= 0 && carla.indexOf('67.40') >= 0, 'mensaje con nombre, empresa y precio del contacto');
  ok(carla.indexOf('Tomar bebidas alcohólicas en exceso es dañino') >= 0 && carla.indexOf('Venta prohibida a menores de 18 años') >= 0, 'plantilla masiva lleva las dos leyendas');
  const luisTexto = await page.$eval('.hoy-card[data-id="c_prueba_02"] textarea[data-campo="mensaje"]', el => el.value);
  const luisBtn = await page.$eval('.hoy-card[data-id="c_prueba_02"] a[data-accion-hoy="abrir"]', el => ({ href: el.getAttribute('href'), t: el.textContent, target: el.getAttribute('target') }));
  ok(luisTexto.indexOf('Luis') >= 0 && luisBtn.href === 'https://wa.me/51998111222?text=' + encodeURIComponent(luisTexto), 'URL de WhatsApp con el teléfono y el texto codificado');
  ok(/Copiar y abrir WhatsApp/.test(luisBtn.t) && luisBtn.target === '_blank', 'botón "Copiar y abrir WhatsApp" en pestaña nueva');
  await page.fill('.hoy-card[data-id="c_prueba_02"] textarea[data-campo="mensaje"]', 'Hola Luis, texto editado a mano.');
  const hrefEditado = await page.$eval('.hoy-card[data-id="c_prueba_02"] a[data-accion-hoy="abrir"]', el => el.getAttribute('href'));
  ok(hrefEditado.indexOf(encodeURIComponent('texto editado a mano')) >= 0, 'al editar el mensaje se actualiza el enlace');
  const correoBtn = await page.$eval('.hoy-card[data-id="c_hoy_correo"] a[data-accion-hoy="abrir"]', el => ({ t: el.textContent, h: el.getAttribute('href') }));
  ok(/Copiar y abrir correo/.test(correoBtn.t) && correoBtn.h.indexOf('mailto:mruiz%40ejemplo.pe?subject=') === 0 && correoBtn.h.indexOf('Scotiabank') > 0, 'sin teléfono: "Copiar y abrir correo" con mailto, asunto y cuerpo');
  ok(!!(await page.$('.hoy-card[data-id="c_hoy_correo"] input[data-campo="asunto"]')), 'la plantilla de correo muestra el asunto editable');
  const opciones = await page.$$eval('.hoy-card[data-id="c_hoy_corp"] select[data-campo="plantilla"] option', os => os.map(o => o.value));
  ok(opciones.indexOf('corporativo_t1') >= 0 && opciones.indexOf('corporativo_t1_correo') >= 0 && opciones.indexOf('propuesta') >= 0 && opciones.indexOf('boca_t1') < 0, 'select con las plantillas activas del segmento y de todos (*), sin las de otros segmentos');
  await page.selectOption('.hoy-card[data-id="c_hoy_corp"] select[data-campo="plantilla"]', 'corporativo_t1');
  await page.waitForTimeout(100);
  const elena = await page.$eval('.hoy-card[data-id="c_hoy_corp"]', el => ({ texto: el.querySelector('textarea').value, btn: el.querySelector('a[data-accion-hoy="abrir"]').textContent, sel: el.querySelector('select').value, asunto: !!el.querySelector('[data-campo="asunto"]') }));
  ok(elena.sel === 'corporativo_t1' && elena.texto.indexOf('Elena') >= 0 && elena.texto.indexOf('Interbank') >= 0 && /WhatsApp/.test(elena.btn) && !elena.asunto, 'cambiar de plantilla rearma el mensaje y pasa de correo a WhatsApp');
  ok(!!(await page.$('.hoy-card[data-id="c_hoy_vars"] input[data-var="ocasion"]')) && !(await page.$('.hoy-card[data-id="c_prueba_03"] input[data-var]')), 'falta {ocasion}: muestra el input solo donde hace falta');
  await page.click('.hoy-card[data-id="c_hoy_vars"] input[data-var="ocasion"]');
  await page.keyboard.type('aniversario', { delay: 15 });
  await page.waitForTimeout(100);
  const vars = await page.evaluate(() => ({ oc: VDO.DB.buscar('contactos', 'c_hoy_vars').ocasion, txt: document.querySelector('.hoy-card[data-id="c_hoy_vars"] textarea').value, foco: document.activeElement.getAttribute('data-var'), href: document.querySelector('.hoy-card[data-id="c_hoy_vars"] a[data-accion-hoy="abrir"]').getAttribute('href') }));
  ok(vars.oc === 'aniversario' && vars.txt.indexOf('para aniversario') >= 0 && vars.foco === 'ocasion' && vars.href.indexOf('aniversario') > 0, 'completar la variable actualiza el mensaje y el enlace, se guarda en el contacto y conserva el foco');
  // la propuesta toma producto y total de la última venta del contacto
  const patTxt = await page.$eval('.hoy-card[data-id="c_prueba_05"] textarea[data-campo="mensaje"]', el => el.value);
  ok(/Patricia/.test(patTxt) && /\[PRODUCTO Y CANTIDAD\]/.test(patTxt) && /\[TOTAL\]/.test(patTxt) && /\[LINK DE PAGO\]/.test(patTxt), 'propuesta sin venta previa deja marcadores visibles para completar');

  console.log('5. Marcar enviado');
  await page.fill('.hoy-card[data-id="c_prueba_03"] textarea[data-campo="mensaje"]', 'BORRADOR CARLA · no se debe perder');
  const antesInter = await page.evaluate(() => VDO.DB.tabla('interacciones').length);
  await page.click('.hoy-card[data-id="c_prueba_02"] [data-accion-hoy="enviado"]');
  await page.waitForTimeout(400);
  const luis = await page.evaluate(() => { const c = VDO.DB.buscar('contactos', 'c_prueba_02'); const i = VDO.DB.tabla('interacciones').filter(x => x.contactoId === 'c_prueba_02'); return { toques: c.toques, prox: c.proximoToque, etapa: c.etapa, ultimo: c.ultimoContacto, n: i.length, msg: i[0] && i[0].mensaje, toque: i[0] && i[0].toque, canal: i[0] && i[0].canal, pl: i[0] && i[0].plantillaId, total: VDO.DB.tabla('interacciones').length }; });
  ok(luis.total === antesInter + 1 && luis.n === 1 && luis.toque === 1 && luis.canal === 'whatsapp' && luis.pl === 'boca_t1' && luis.msg === 'Hola Luis, texto editado a mano.', 'crea la interacción con toque 1, canal, plantilla y el mensaje editado');
  ok(luis.toques === 1 && luis.prox === hoyMas[1] && luis.etapa === 'iniciar' && luis.ultimo === hoy, 'consumidor: toques 1, próximo toque a +2 días, etapa Iniciar, último contacto hoy');
  ok(!(await page.$('.hoy-card[data-id="c_prueba_02"]')), 'la tarjeta desaparece');
  ok((await page.$eval('.hoy-card[data-id="c_prueba_03"] textarea[data-campo="mensaje"]', el => el.value)) === 'BORRADOR CARLA · no se debe perder', 'lo escrito en otra tarjeta se conserva');
  await page.click('.hoy-card[data-id="c_hoy_corp"] [data-accion-hoy="enviado"]');
  await page.waitForTimeout(300);
  const elenaTras = await page.evaluate(() => { const c = VDO.DB.buscar('contactos', 'c_hoy_corp'); return { toques: c.toques, prox: c.proximoToque }; });
  ok(elenaTras.toques === 1 && elenaTras.prox === hoyMas[2], 'empresa (corporativo): próximo toque a +3 días');
  const kpiEnv = await page.$eval('#hoy-resumen .kpi', el => el.textContent.replace(/\s+/g, ' '));
  ok(/Enviados hoy\s*2 \//.test(kpiEnv), 'el KPI de enviados sube a 2 sin redibujar las tarjetas');
  ok(/^1 de/.test(await page.$eval('#hoy-cola .hoy-grupo[data-seg="boca"] [data-xy]', el => el.textContent)), 'el grupo Boca a boca pasa a "1 de N enviados"');
  const bocaCont = await page.$eval('#hoy-cola .hoy-grupo[data-seg="boca"]', g => ({ enCola: g.querySelector('[data-en-cola]').textContent, cards: g.querySelectorAll('.hoy-card').length }));
  ok(bocaCont.enCola === bocaCont.cards + ' en cola', 'el contador "en cola" del grupo baja');
  ok((await page.$$('#hoy-enviados tr[data-id]')).length === 2, 'lista "Enviados hoy, esperando respuesta" con los dos enviados');

  console.log('6. Respondió');
  await page.click('.hoy-card[data-id="c_prueba_01"] [data-accion-hoy="respondio"]');
  await page.waitForSelector('.hoy-card[data-id="c_prueba_01"] .hoy-inline:not([hidden]) [data-inline="texto"]');
  await page.fill('.hoy-card[data-id="c_prueba_01"] [data-inline="texto"]', 'Sí, quiero la sala para el sábado');
  await page.click('.hoy-card[data-id="c_prueba_01"] [data-accion-hoy="guardar-respuesta"]');
  await page.waitForTimeout(400);
  const mf = await page.evaluate(() => { const c = VDO.DB.buscar('contactos', 'c_prueba_01'); const i = VDO.DB.tabla('interacciones').filter(x => x.contactoId === 'c_prueba_01' && x.resultado === 'respondio'); return { etapa: c.etapa, prox: c.proximoToque, resp: c.respondio, n: i.length, texto: i[0] && i[0].respuesta }; });
  ok(mf.etapa === 'calificar' && mf.resp === true && mf.prox === hoy && mf.n === 1 && mf.texto === 'Sí, quiero la sala para el sábado', '"Respondió" mueve a Calificar y guarda la respuesta');
  const cardMf = await page.$eval('.hoy-card[data-id="c_prueba_01"]', el => ({ tipo: el.getAttribute('data-tipo'), txt: el.querySelector('textarea').value, sec: el.closest('.hoy-seccion').getAttribute('data-seccion') }));
  ok(cardMf.tipo === 'responder' && cardMf.sec === 'responder' && /le resumo la propuesta/.test(cardMf.txt) && /El Arte del Pisco/.test(cardMf.txt) && /580\.00/.test(cardMf.txt), 'la tarjeta pasa a "Responder y cerrar" con la propuesta armada con la venta cotizada');
  ok((await page.$eval('.hoy-card[data-id="c_prueba_03"] textarea[data-campo="mensaje"]', el => el.value)) === 'BORRADOR CARLA · no se debe perder', 'el borrador sobrevive al redibujo completo');
  // Respondió desde la lista de enviados (modal)
  await page.click('#hoy-enviados summary');
  await page.click('#hoy-enviados tr[data-id="c_hoy_corp"] [data-accion-hoy="respondio-lista"]');
  await page.waitForSelector('#hoy-modal-texto');
  await page.fill('#hoy-modal-texto', 'Me interesa para 20 personas');
  await page.click('#hoy-modal-ok');
  await page.waitForTimeout(400);
  const elenaResp = await page.evaluate(() => VDO.DB.buscar('contactos', 'c_hoy_corp').etapa);
  ok(elenaResp === 'calificar' && !!(await page.$('.hoy-card[data-id="c_hoy_corp"][data-tipo="responder"]')), 'desde la lista de enviados también se marca la respuesta y vuelve a la cola para responder');

  console.log('7. Registrar venta');
  await page.click('.hoy-card[data-id="c_prueba_05"] [data-accion-hoy="venta"]');
  await page.waitForSelector('#formVenta');
  ok((await page.$eval('#modalContenido', el => el.textContent)).indexOf('Patricia Vega') >= 0, 'abre el formulario de venta con el contacto');
  await page.selectOption('#formVenta [name="estado"]', 'pagado');
  await page.click('#formVenta button[type="submit"]');
  await page.waitForTimeout(500);
  const pat = await page.evaluate(() => { const c = VDO.DB.buscar('contactos', 'c_prueba_05'); const r = VDO.embudo.resumenDia(VDO.util.hoyISO()); const v = VDO.DB.tabla('ventas').filter(x => x.contactoId === 'c_prueba_05')[0]; return { etapa: c.etapa, venta: r.ventaDia, compraron: r.compraron, total: v && v.total, estado: v && v.estado, codigo: c.codigoReferido, modal: document.getElementById('modal').hidden }; });
  ok(pat.etapa === 'cerrar' && pat.estado === 'pagado' && pat.total === 74.9 && pat.venta === 74.9 && pat.compraron === 1 && !!pat.codigo && pat.modal, 'al guardar pagado el contacto pasa a Cerrar, recibe código de referido y la venta del día sube a S/ 74.90');
  ok((await page.$eval('#hoy-pie', el => el.textContent)).indexOf('S/ 74.90') >= 0 && (await page.$$eval('#hoy-resumen .kpi', els => els[1].textContent)).indexOf('S/ 74.90') >= 0, 'el KPI y el pie muestran la venta del día');
  ok(!(await page.$('.hoy-card[data-id="c_prueba_05"]')), 'la tarjeta de Patricia sale de la cola (próximo toque a +2)');
  ok(/Enviados hoy\s*2 \//.test(await page.$eval('#hoy-resumen .kpi', el => el.textContent.replace(/\s+/g, ' '))), 'un "compró" sin toque no cuenta como enviado');
  // con una cotización abierta, "Compró" edita esa venta en vez de duplicarla
  await page.click('.hoy-card[data-id="c_prueba_01"] [data-accion-hoy="venta"]');
  await page.waitForSelector('#formVenta');
  const formMf = await page.evaluate(() => ({ titulo: document.querySelector('#modalContenido h3').textContent, items: Array.from(document.querySelectorAll('#formVenta [data-item="nombre"]')).map(i => i.value), estado: document.querySelector('#formVenta [name="estado"]').value }));
  ok(/Editar venta/.test(formMf.titulo) && formMf.items.join() === 'El Arte del Pisco' && formMf.estado === 'link_enviado', 'con cotización abierta abre esa venta para marcarla pagada, sin duplicar');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  console.log('8. Posponer, dormir, perdido, ficha');
  await page.click('.hoy-card[data-id="c_prueba_08"] [data-accion-hoy="posponer"][data-dias="1"]');
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => VDO.DB.buscar('contactos', 'c_prueba_08').proximoToque)) === hoyMas[0] && !(await page.$('.hoy-card[data-id="c_prueba_08"]')), 'posponer +1 fija el próximo toque a mañana y quita la tarjeta');
  await page.click('.hoy-card[data-id="c_hoy_dormir"] [data-accion-hoy="dormir"]');
  await page.waitForTimeout(400);
  const tomas = await page.evaluate(() => VDO.DB.buscar('contactos', 'c_hoy_dormir'));
  ok(tomas.estado === 'dormido' && tomas.proximoToque === '' && !(await page.$('.hoy-card[data-id="c_hoy_dormir"]')), '"Dormir" deja al contacto dormido y quita la tarjeta');
  await page.click('.hoy-card[data-id="c_hoy_perdido"] [data-accion-hoy="perdido"]');
  await page.waitForSelector('.hoy-card[data-id="c_hoy_perdido"] .hoy-inline:not([hidden]) [data-inline="texto"]');
  await page.click('.hoy-card[data-id="c_hoy_perdido"] [data-accion-hoy="guardar-perdido"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => VDO.DB.buscar('contactos', 'c_hoy_perdido').estado)) === 'activo', 'perdido sin motivo no se guarda');
  await page.fill('.hoy-card[data-id="c_hoy_perdido"] [data-inline="texto"]', 'no le interesa el pisco');
  await page.click('.hoy-card[data-id="c_hoy_perdido"] [data-accion-hoy="guardar-perdido"]');
  await page.waitForTimeout(400);
  const val = await page.evaluate(() => VDO.DB.buscar('contactos', 'c_hoy_perdido'));
  ok(val.estado === 'perdido' && /no le interesa/.test(val.notas) && !(await page.$('.hoy-card[data-id="c_hoy_perdido"]')), '"Perdido" pide el motivo, lo anota y quita la tarjeta');
  await page.click('.hoy-card[data-id="c_prueba_03"] [data-accion-hoy="ficha"]');
  await page.waitForSelector('#formContacto, .pipe-ficha');
  ok((await page.evaluate(() => { const f = document.querySelector('#formContacto [name="nombre"]'); if (f) return f.value; const h = document.querySelector('.pipe-ficha h3'); return h ? h.textContent : ''; })) === 'Carla Huamán', '"Ficha" abre la ficha del contacto (formulario del núcleo o ficha del módulo Pipeline)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  console.log('9. Cuentas y eventos');
  const cuentaCard = await page.$('.hoy-card[data-tipo="cuenta"][data-id="k_prueba_02"]');
  ok(!!cuentaCard, 'tarjeta de cuenta con próximo paso hoy en "Cuentas y eventos"');
  const cuentaTxt = cuentaCard ? await cuentaCard.evaluate(el => el.textContent) : '';
  ok(/BCP/.test(cuentaTxt) && /Seguimiento por WhatsApp/.test(cuentaTxt) && /Jorge Salinas/.test(cuentaTxt) && /Hecho/.test(cuentaTxt) && /Ver cuenta/.test(cuentaTxt), 'muestra empresa, contacto, próximo paso y botones Hecho / Ver cuenta');
  await page.click('.hoy-card[data-id="k_prueba_02"] [data-accion-hoy="hecho"]');
  await page.waitForSelector('.hoy-card[data-id="k_prueba_02"] .hoy-inline:not([hidden]) [data-inline="texto"]');
  await page.fill('.hoy-card[data-id="k_prueba_02"] [data-inline="texto"]', 'Enviar cotización de 40 Gold');
  await page.fill('.hoy-card[data-id="k_prueba_02"] [data-inline="fecha"]', hoyMas[2]);
  await page.click('.hoy-card[data-id="k_prueba_02"] [data-accion-hoy="guardar-hecho"]');
  await page.waitForTimeout(400);
  const k2 = await page.evaluate(() => VDO.DB.buscar('cuentas', 'k_prueba_02'));
  ok(k2.proximoPaso === 'Enviar cotización de 40 Gold' && k2.fechaProximoPaso === hoyMas[2] && /hecho · Seguimiento por WhatsApp/.test(k2.notas) && !(await page.$('.hoy-card[data-id="k_prueba_02"]')), '"Hecho" anota el paso cumplido, fija el siguiente con su fecha y quita la tarjeta');
  await page.evaluate(() => { const k = VDO.DB.buscar('cuentas', 'k_prueba_01'); k.fechaProximoPaso = VDO.util.hoyISO(); VDO.DB.upsert('cuentas', k); VDO.ui.refrescar(); });
  await page.waitForSelector('.hoy-card[data-id="k_prueba_01"]');
  await page.click('.hoy-card[data-id="k_prueba_01"] [data-accion-hoy="ver-cuenta"]');
  await page.waitForSelector('#p-pipeline:not([hidden])');
  ok(true, '"Ver cuenta" navega al pipeline');
  await page.click('.nav [data-pantalla="hoy"]');
  await page.waitForSelector('#p-hoy:not([hidden]) .hoy-card');

  console.log('10. Próximos 7 días y cierre del día');
  const prox = await page.$eval('#hoy-proximos', el => el.textContent);
  const esperados = await page.evaluate(() => { const h = VDO.util.hoyISO(), f = VDO.util.sumarDias(h, 7); return VDO.cfg().fechasClave.filter(x => (x.hasta || x.fecha) >= h && x.fecha <= f).map(x => x.texto).concat(VDO.cfg().cortes.filter(c => c.fecha >= h && c.fecha <= f).map(c => c.nombre)); });
  ok(/Próximos 7 días/.test(prox) && esperados.every(t => prox.indexOf(t.slice(0, 24)) >= 0), 'fechas clave y cortes de los próximos 7 días (' + esperados.length + ')');
  const pieAntes = await page.$eval('#hoy-pie', el => el.textContent.replace(/\s+/g, ' '));
  ok(/Enviados\s*2 \/ cuota/.test(pieAntes) && /Venta del día\s*S\/ 74\.90 \/ meta/.test(pieAntes), 'pie con "Enviados X / cuota Y" y "Venta del día S/ A / meta S/ B"');
  if (dia) {
    await page.click('#hoy-pie [data-accion-hoy="cerrar-dia"]');
    await page.waitForSelector('#hoy-resumen-texto');
    const resumen = await page.$eval('#hoy-resumen-texto', el => el.value);
    const tras = await page.evaluate(() => ({ dia: VDO.reglas.diaCalendario(VDO.util.hoyISO()), r: VDO.hoy.resumenHoy(VDO.util.hoyISO()), hora: VDO.util.ahoraISO().slice(11, 16) }));
    const esperado = (tras.r.ventaDia >= tras.r.metaDia && tras.r.enviados >= Math.ceil(0.7 * tras.r.cuotaContactos)) ? 'cumplido' : (tras.hora < '18:00' ? 'en_curso' : 'no_cumplido');
    ok(tras.dia.estado === esperado && tras.dia.estado !== 'pendiente', '"Cerrar el día" fija el estado del día: ' + tras.dia.estado + ' (hora ' + tras.hora + ')');
    ok(/enviados 2 de \d+ · respondieron \d+ · compraron 1 · venta S\/ 74\.90/.test(tras.dia.notas), 'nota automática con enviados, respondieron, compraron y venta');
    ok(/^HOY · /.test(resumen) && /Enviados: 2 de/.test(resumen) && /Venta del día: S\/ 74\.90/.test(resumen) && /Por segmento:/.test(resumen) && /Estado del día: /.test(resumen), 'resumen copiable del día');
    await page.screenshot({ path: path.join(CAPTURAS, 'hoy-cierre-laptop.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    ok((await page.$eval('#hoy-pie', el => el.textContent)).indexOf('Cierre ') >= 0 && (await page.$eval('#p-hoy .hoy-dia', el => el.textContent)).toLowerCase().indexOf(esperado.replace('_', ' ')) >= 0, 'el estado se ve en el pie y en la tarjeta del día');
    // con una meta alcanzable el día queda cumplido y la nota anterior se reemplaza
    await page.evaluate(() => { const d = VDO.reglas.diaCalendario(VDO.util.hoyISO()); d.metaDia = 50; Object.keys(d.cuotas).forEach(k => { d.cuotas[k] = 0; }); d.cuotas.boca = 2; VDO.DB.upsert('calendario', d); VDO.ui.refrescar(); });
    await page.click('#hoy-pie [data-accion-hoy="cerrar-dia"]');
    await page.waitForSelector('#hoy-resumen-texto');
    const d2 = await page.evaluate(() => VDO.reglas.diaCalendario(VDO.util.hoyISO()));
    ok(d2.estado === 'cumplido' && (d2.notas.match(/^Cierre /gm) || []).length === 1, 'con venta ≥ meta y enviados ≥ 70 % queda cumplido; una sola nota de cierre');
    await page.keyboard.press('Escape');
  } else {
    ok(!(await page.$('#hoy-pie [data-accion-hoy="cerrar-dia"]')), 'sin día de atención no se ofrece cerrar el día');
    await page.click('#hoy-pie [data-accion-hoy="resumen-dia"]');
    await page.waitForSelector('#hoy-resumen-texto');
    ok(/Enviados: 2/.test(await page.$eval('#hoy-resumen-texto', el => el.value)), 'resumen copiable disponible igual');
    await page.keyboard.press('Escape');
  }

  console.log('11. Celular');
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-PE', timezoneId: 'America/Lima' });
  const pm = await movil.newPage();
  pm.on('pageerror', e => errores.push('móvil: ' + e));
  pm.on('console', m => { if (m.type() === 'error') errores.push('móvil: ' + m.text()); });
  await pm.goto(ARCHIVO);
  await pm.waitForSelector('#p-hoy:not([hidden])');
  await prepararDatos(pm);
  ok(!(await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'sin desplazamiento horizontal en celular');
  const alturas = await pm.$$eval('#p-hoy .hoy-card .btn, #hoy-pie .btn', els => els.map(e => e.getBoundingClientRect().height));
  ok(alturas.length > 20 && alturas.every(h => h >= 36), 'botones de al menos 36 px en celular (mín. ' + Math.min(...alturas).toFixed(1) + ' px)');
  await pm.screenshot({ path: path.join(CAPTURAS, 'hoy-cola-celular.png'), fullPage: true });
  await pm.screenshot({ path: path.join(CAPTURAS, 'hoy-kpis-celular.png') });
  await pm.tap('.hoy-card[data-id="c_prueba_02"] [data-accion-hoy="enviado"]');
  await pm.waitForTimeout(400);
  ok(!(await pm.$('.hoy-card[data-id="c_prueba_02"]')) && (await pm.evaluate(() => VDO.DB.buscar('contactos', 'c_prueba_02').toques)) === 1, 'marcar enviado funciona con un toque en celular');
  ok(!(await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'sigue sin desplazamiento horizontal tras la acción');
  const tarjeta = await pm.$('.hoy-card[data-id="c_prueba_03"]');
  await tarjeta.scrollIntoViewIfNeeded();
  await pm.screenshot({ path: path.join(CAPTURAS, 'hoy-tarjeta-celular.png') });

  ok(errores.length === 0, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log('\n' + (total - fallos) + ' de ' + total + ' comprobaciones correctas.');
  console.log(fallos ? 'FALLOS: ' + fallos : 'Todo en orden.');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
