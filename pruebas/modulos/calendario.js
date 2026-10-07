/* Pruebas del módulo Calendario con Playwright (Chromium).
   Uso: python3 herramientas/ensamblar.py --salida /tmp/crm-calendario.html --solo-modulo calendario
        CRM_HTML=/tmp/crm-calendario.html NODE_PATH=$(npm root -g) node pruebas/modulos/calendario.js
   Abre el CRM por file://, recorre la vista mensual, la lista y el panel de edición en laptop y celular,
   y deja capturas en pruebas/capturas/calendario-*.png. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..', '..');
const ARCHIVO = 'file://' + (process.env.CRM_HTML || path.join(RAIZ, 'crm-vdo.html'));
const CAPTURAS = path.join(RAIZ, 'pruebas', 'capturas');
fs.mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
function ok(cond, msg) { if (cond) console.log('  ✓ ' + msg); else { fallos++; console.log('  ✗ ' + msg); } }
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'es-PE', timezoneId: 'America/Lima', acceptDownloads: true });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  console.log('1. Carga y datos del calendario');
  await page.goto(ARCHIVO);
  await page.waitForSelector('#p-hoy:not([hidden])');
  const hoy = await page.evaluate(() => VDO.util.hoyISO());
  console.log('     hoy (Lima):', hoy);
  ok((await page.evaluate(() => VDO.DB.tabla('calendario').length)) === 73, 'calendario con 73 días de atención');
  const planOct = await page.evaluate(() => VDO.generarCalendario(VDO.cfg()).filter(d => d.fecha.slice(0, 7) === '2026-10').length);
  ok(planOct === 22, 'octubre tiene 22 días de atención en el plan (' + planOct + ')');

  console.log('2. Vista mensual · octubre');
  await page.click('.nav [data-pantalla="calendario"]');
  await page.waitForSelector('#p-calendario:not([hidden]) #cal-grilla');
  await page.click('[data-cal="ir-mes"][data-valor="2026-10"]');
  await page.waitForSelector('#cal-grilla');
  ok((await page.$eval('#cal-mes-titulo', e => e.textContent.trim())) === 'octubre 2026', 'título del mes: octubre 2026');
  const primera = await page.$eval('#cal-grilla .cal-dia[data-fecha]', e => e.getAttribute('data-fecha'));
  ok(primera === '2026-10-07', 'el 07/10 es el primer día de atención que se muestra (' + primera + ')');
  ok((await page.$$('#cal-grilla .cal-dia[data-fecha]')).length === 22, 'octubre muestra 22 celdas de atención');
  const cabeceras = await page.$$eval('#cal-grilla .cal-cab', els => els.map(e => e.textContent.trim()).join(' '));
  ok(cabeceras === 'lun mar mié jue vie sáb dom', 'grilla de lunes a domingo: ' + cabeceras);
  const vacios = await page.$$eval('#cal-grilla .cal-dia.vacio', els => els.map(e => e.querySelector('.cal-num').textContent.trim()));
  ok(vacios[0] === '1' && vacios.indexOf('4') >= 0 && vacios.indexOf('6') >= 0 && vacios.indexOf('7') < 0, 'días 1 al 6 de octubre y domingos atenuados sin día: ' + vacios.join(','));
  ok((await page.$$('#cal-grilla .cal-dia.vacio.dom')).length === 4, 'cuatro domingos atenuados en octubre');
  const columnas = await page.evaluate(() => { const cs = Array.from(document.querySelectorAll('#cal-grilla .cal-dia')); return cs.length % 7 === 0 ? cs.length / 7 : -1; });
  ok(columnas === 5, 'la grilla cierra las semanas completas (' + columnas + ' filas)');
  ok(await page.$('#cal-grilla .cal-dia.corte[data-fecha="2026-10-19"]'), 'el 19/10 está marcado como corte');
  ok((await page.$$('#cal-grilla .cal-dia.corte')).length === 2, 'dos cortes en octubre (19 y 31)');
  const celda0710 = await page.$eval('#cal-grilla .cal-dia[data-fecha="2026-10-07"]', e => ({ ola: e.classList.contains('ola-1'), meta: e.querySelector('.cal-meta-larga').textContent, pill: e.querySelector('.pill').textContent.trim(), cont: e.querySelector('.cal-contactos').textContent, hito: !!e.querySelector('.cal-hito') }));
  ok(celda0710.ola && /^S\/ \d/.test(celda0710.meta) && celda0710.pill === 'Pendiente' && /\d+ cont\./.test(celda0710.cont), 'celda del 07/10: ola 1, meta en soles, pill de estado y contactos del día (' + celda0710.meta + ', ' + celda0710.cont + ')');
  ok(await page.$('#cal-grilla .cal-dia[data-fecha="2026-10-08"] .cal-hito'), 'el 08/10 muestra el hito abreviado (Master of Pisco)');
  if (hoy >= '2026-10-07' && hoy <= '2026-12-31') {
    await page.click('[data-cal="hoy"]');
    await espera(100);
    ok((await page.$('#cal-grilla .cal-dia.hoy[data-fecha="' + hoy + '"]')) || (await page.$('#cal-grilla .cal-dia.vacio.hoy')), 'hoy resaltado en la grilla');
    await page.click('[data-cal="ir-mes"][data-valor="2026-10"]');
  } else console.log('     (hoy está fuera del trimestre; no se comprueba el resaltado)');
  ok((await page.$$('#cal-resumen .cal-mes-card')).length === 3, 'resumen con una tarjeta por mes');
  ok((await page.$$('#cal-grafica g.cal-barra')).length === 22, 'gráfica SVG con una barra por día de atención de octubre');
  const leyenda = await page.$eval('.cal-leyenda', e => e.textContent);
  ok(/Meta del día/.test(leyenda) && /Venta real/.test(leyenda), 'leyenda de la gráfica con las dos series');

  console.log('3. Panel lateral del 19/10 y edición del foco');
  await page.click('#cal-grilla .cal-dia[data-fecha="2026-10-19"]');
  await page.waitForSelector('#cal-panel:not([hidden]) #formCalDia');
  const panelTxt = await page.$eval('#cal-panel', e => e.textContent);
  ok(/Corte/.test(panelTxt) && /19 de octubre/.test(panelTxt), 'el panel del 19/10 muestra "Corte" y la fecha larga');
  ok(await page.$('#cal-grilla .cal-dia.seleccionado[data-fecha="2026-10-19"]'), 'la celda abierta queda marcada como seleccionada');
  const nSeg = await page.evaluate(() => VDO.cfg().segmentos.length);
  ok((await page.$$('#formCalDia [name^="cuota_"]')).length === nSeg, 'un input de cuota por segmento (' + nSeg + ')');
  ok(/Venta real/.test(panelTxt) && /Enviados/.test(panelTxt), 'el panel muestra venta real y enviados del día');
  const focoPlan = await page.evaluate(() => VDO.generarCalendario(VDO.cfg()).filter(d => d.fecha === '2026-10-19')[0].foco);
  await page.fill('#formCalDia [name="foco"]', 'Foco de prueba editado a mano');
  // el re-render del núcleo no debe pisar lo que se está escribiendo
  await page.evaluate(() => VDO.ui.refrescar());
  await espera(50);
  ok((await page.evaluate(() => document.activeElement && document.activeElement.name === 'foco' && document.activeElement.value === 'Foco de prueba editado a mano')), 'refrescar() no pierde el foco ni el texto del panel mientras se escribe');
  await page.click('#formCalDia button[type="submit"]');
  await espera(400);
  let d1910 = await page.evaluate(() => VDO.DB.buscar('calendario', '2026-10-19'));
  ok(d1910.foco === 'Foco de prueba editado a mano' && d1910.focoEditado === true && !d1910.cuotasEditadas, 'guardar persiste el foco y marca focoEditado (no cuotasEditadas)');
  ok(await page.$('#cal-panel:not([hidden]) .pill:text("foco editado")'), 'el panel indica "foco editado"');
  ok(await page.$('#cal-grilla .cal-dia[data-fecha="2026-10-19"]'), 'la grilla sigue dibujada tras guardar');
  await page.evaluate(() => window.scrollTo(0, 0));
  await espera(150);
  await page.screenshot({ path: path.join(CAPTURAS, 'calendario-laptop.png'), fullPage: true });
  await page.reload();
  await page.waitForSelector('#p-calendario:not([hidden]) #cal-grilla');
  d1910 = await page.evaluate(() => VDO.DB.buscar('calendario', '2026-10-19'));
  ok(d1910.foco === 'Foco de prueba editado a mano' && d1910.focoEditado === true, 'el foco editado sobrevive a la recarga');
  ok((await page.$eval('#cal-mes-titulo', e => e.textContent.trim())) === 'octubre 2026', 'la pantalla recuerda el mes visible');

  console.log('4. Volver al valor del plan, cuotas y recálculo');
  await page.click('#cal-grilla .cal-dia[data-fecha="2026-10-19"]');
  await page.waitForSelector('#cal-panel:not([hidden]) #formCalDia');
  await page.click('#formCalDia [data-plan="foco"]');
  ok((await page.$eval('#formCalDia [name="foco"]', e => e.value)) === focoPlan, '"Volver al valor del plan" carga el foco del plan');
  await page.fill('#formCalDia [name="cuota_boca"]', '99');
  await page.selectOption('#formCalDia [name="estado"]', 'cumplido');
  await page.click('#formCalDia button[type="submit"]');
  await espera(400);
  d1910 = await page.evaluate(() => VDO.DB.buscar('calendario', '2026-10-19'));
  ok(d1910.foco === focoPlan && d1910.focoEditado === false, 'al guardar el foco del plan deja de estar marcado como editado');
  ok(d1910.cuotas.boca === 99 && d1910.cuotasEditadas === true && d1910.estado === 'cumplido', 'cuotas editadas (boca = 99) y estado cumplido guardados');
  ok(/1 cumplidos/.test(await page.$eval('#cal-resumen .cal-mes-card.activo', e => e.textContent.replace(/\s+/g, ' '))), 'el resumen de octubre cuenta 1 día cumplido');
  await page.evaluate(() => { VDO.cfg().metas.proyeccion['2026-10'] = 60000; });
  await page.click('[data-accion="recalcular-calendario"]');
  await espera(400);
  const trasRecalc = await page.evaluate(() => { const d = VDO.DB.buscar('calendario', '2026-10-19'); const suma = VDO.DB.tabla('calendario').filter(x => x.fecha.slice(0, 7) === '2026-10').reduce((s, x) => s + x.metaDia, 0); return { boca: d.cuotas.boca, editadas: d.cuotasEditadas, estado: d.estado, suma, n: VDO.DB.tabla('calendario').length }; });
  ok(trasRecalc.n === 73 && Math.abs(trasRecalc.suma - 60000) < 40 && trasRecalc.boca === 99 && trasRecalc.editadas && trasRecalc.estado === 'cumplido', 'recalcular desde metas reparte la nueva proyección y conserva cuotas editadas y estado: ' + JSON.stringify(trasRecalc));
  ok(await page.$('#cal-grilla .cal-dia[data-fecha="2026-10-19"]'), 'la pantalla se redibuja tras recalcular');
  ok(/60,000/.test(await page.$eval('#cal-resumen .cal-mes-card.activo', e => e.textContent)), 'el resumen muestra la nueva suma de metas');
  await page.evaluate(() => { VDO.cfg().metas.proyeccion['2026-10'] = 50000; });
  await page.click('[data-accion="recalcular-calendario"]');
  await espera(300);
  await page.click('#formCalDia [data-cerrar-dia]').catch(() => {});
  await espera(100);
  ok(await page.$('#cal-panel[hidden]'), 'cerrar oculta el panel lateral');

  console.log('5. Vista lista');
  await page.click('[data-cal="vista"][data-valor="lista"]');
  await page.waitForSelector('#cal-lista table.cal-lista');
  ok((await page.$$('#cal-lista tbody tr[data-fecha]')).length === 22, 'la lista muestra los 22 días de octubre');
  const fila0719 = await page.$eval('#cal-lista tr[data-fecha="2026-10-19"]', e => e.textContent.replace(/\s+/g, ' '));
  ok(/19\/10\/2026/.test(fila0719) && /lunes/.test(fila0719) && /Corte/.test(fila0719), 'fila del 19/10 con fecha, día de la semana y corte');
  await page.selectOption('#cal-lista .cal-estado-sel[data-fecha="2026-10-20"]', 'no_cumplido');
  await espera(300);
  ok((await page.evaluate(() => VDO.DB.buscar('calendario', '2026-10-20').estado)) === 'no_cumplido', 'cambiar el estado desde la lista persiste');
  ok(/1 no cumplidos/.test(await page.$eval('#cal-resumen .cal-mes-card.activo', e => e.textContent.replace(/\s+/g, ' '))), 'el resumen se actualiza al cambiar el estado en la lista');
  await page.selectOption('.cal-filtros [name="estado"]', 'no_cumplido');
  await espera(150);
  ok((await page.$$('#cal-lista tbody tr[data-fecha]')).length === 1, 'filtro por estado deja una fila');
  await page.selectOption('.cal-filtros [name="estado"]', '');
  await page.selectOption('.cal-filtros [name="alcance"]', 'todo');
  await espera(150);
  ok((await page.$$('#cal-lista tbody tr[data-fecha]')).length === 73, 'todo el trimestre lista 73 filas');
  const ola2 = await page.evaluate(() => VDO.DB.tabla('calendario').filter(d => d.ola === 2).length);
  await page.selectOption('.cal-filtros [name="ola"]', '2');
  await espera(150);
  ok((await page.$$('#cal-lista tbody tr[data-fecha]')).length === ola2, 'filtro por ola 2 (' + ola2 + ' días)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await espera(150);
  await page.screenshot({ path: path.join(CAPTURAS, 'calendario-lista-laptop.png'), fullPage: true });
  await page.selectOption('.cal-filtros [name="ola"]', '');
  await page.selectOption('.cal-filtros [name="alcance"]', 'mes');
  await page.click('#cal-lista tr[data-fecha="2026-10-08"] [data-cal="abrir"]');
  await page.waitForSelector('#cal-panel:not([hidden]) #formCalDia');
  ok(/8 de octubre/.test(await page.$eval('#cal-panel h3', e => e.textContent)), 'abrir un día desde la lista muestra su panel');
  await page.click('#formCalDia [data-cerrar-dia]');

  console.log('6. Navegación entre meses');
  await page.click('[data-cal="vista"][data-valor="mes"]');
  await page.waitForSelector('#cal-grilla');
  ok(await page.$('[data-cal="mes-ant"][disabled]'), 'en octubre el botón ◀ está deshabilitado');
  await page.click('[data-cal="mes-sig"]');
  ok((await page.$eval('#cal-mes-titulo', e => e.textContent.trim())) === 'noviembre 2026', '▶ pasa a noviembre');
  ok((await page.$$('#cal-grilla .cal-dia[data-fecha]')).length === 25, 'noviembre con 25 días de atención');
  await page.click('[data-cal="mes-sig"]');
  ok((await page.$eval('#cal-mes-titulo', e => e.textContent.trim())) === 'diciembre 2026', '▶ pasa a diciembre');
  ok(!(await page.$('#cal-grilla .cal-dia[data-fecha="2026-12-25"]')), 'diciembre no muestra el 25/12 como día de atención');
  ok((await page.$eval('#cal-grilla .cal-dia.vacio.libre .cal-num', e => e.textContent.trim())) === '25', 'el 25/12 aparece atenuado como feriado');
  ok((await page.$$('#cal-grilla .cal-dia[data-fecha]')).length === 26, 'diciembre con 26 días de atención');
  ok(await page.$('[data-cal="mes-sig"][disabled]'), 'en diciembre el botón ▶ está deshabilitado');
  ok(await page.$('#cal-grilla .cal-dia.corte[data-fecha="2026-12-31"]'), 'el 31/12 está marcado como corte (cierre del trimestre)');
  await page.click('[data-cal="mes-ant"]');
  ok((await page.$eval('#cal-mes-titulo', e => e.textContent.trim())) === 'noviembre 2026', '◀ vuelve a noviembre');
  await page.click('[data-cal="hoy"]');
  const mesHoy = hoy < '2026-10-07' ? 'octubre 2026' : hoy > '2026-12-31' ? 'diciembre 2026' : await page.evaluate(h => VDO.util.nombreMes(h.slice(0, 7)), hoy);
  ok((await page.$eval('#cal-mes-titulo', e => e.textContent.trim())) === mesHoy, '"Hoy" lleva al mes de hoy (' + mesHoy + ')');
  // una venta pagada de prueba debe verse como venta real en la celda, la lista y la gráfica
  await page.evaluate(() => { VDO.DB.upsert('ventas', { id: 'v_cal_prueba', prueba: true, contactoId: 'c_prueba_02', fecha: '2026-11-04', fechaCierre: '2026-11-04', linea: 'botellas', items: [], botellas: 2, total: 179.80, estado: 'pagado', derivarB2B: false }); VDO.DB.upsert('ventas', { id: 'v_cal_b2b', prueba: true, contactoId: 'c_prueba_02', fecha: '2026-11-04', fechaCierre: '2026-11-04', linea: 'botellas', items: [], botellas: 20, total: 1800, estado: 'pagado', derivarB2B: true }); VDO.ui.refrescar(); });
  await page.click('[data-cal="ir-mes"][data-valor="2026-11"]');
  const ventaCelda = await page.$eval('#cal-grilla .cal-dia[data-fecha="2026-11-04"] .cal-venta', e => e.textContent).catch(() => '');
  ok(/179\.80/.test(ventaCelda), 'la venta pagada del 04/11 aparece en la celda y la derivada a B2B no suma (' + ventaCelda.trim() + ')');
  ok(/179\.80/.test(await page.$eval('#cal-resumen .cal-mes-card.activo .cal-mes-fila.venta', e => e.textContent)), 'venta real acumulada de noviembre en el resumen');
  await page.evaluate(() => { VDO.DB.eliminar('ventas', 'v_cal_prueba'); VDO.DB.eliminar('ventas', 'v_cal_b2b'); });

  console.log('7. Exportar CSV');
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('[data-accion="cal-exportar"]')]);
  const nombreCSV = descarga.suggestedFilename();
  const csv = fs.readFileSync(await descarga.path(), 'utf8');
  const lineas = csv.split(/\r?\n/).filter(l => l.trim());
  ok(/^calendario-\d{4}-\d{2}-\d{2}\.csv$/.test(nombreCSV) && lineas.length === 74 && /^﻿?fecha,dia,ola,foco/.test(lineas[0]) && /contactos_boca/.test(lineas[0]) && /ventaReal,enviados/.test(lineas[0]), 'CSV con 73 filas y columnas de cuotas, venta real y enviados (' + nombreCSV + ')');
  ok(/^07\/10\/2026,miércoles,1,/.test(lineas[1]), 'primera fila del CSV: 07/10/2026 miércoles ola 1');

  console.log('8. Celular');
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-PE', timezoneId: 'America/Lima' });
  const pm = await movil.newPage();
  pm.on('pageerror', e => errores.push('móvil: ' + e));
  pm.on('console', m => { if (m.type() === 'error') errores.push('móvil: ' + m.text()); });
  await pm.goto(ARCHIVO);
  await pm.waitForSelector('#p-hoy:not([hidden])');
  await pm.click('.tabbar-movil [data-pantalla="calendario"]');
  await pm.waitForSelector('#p-calendario:not([hidden]) #cal-grilla');
  await pm.click('[data-cal="ir-mes"][data-valor="2026-10"]');
  await pm.waitForSelector('#cal-grilla');
  ok(!(await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'sin desplazamiento horizontal en la vista mensual');
  const anchoGrilla = await pm.$eval('#cal-grilla', e => e.getBoundingClientRect().width);
  ok(anchoGrilla <= 390 && anchoGrilla > 300, 'la grilla cabe en 390 px (' + Math.round(anchoGrilla) + ' px)');
  const botonesBajos = await pm.$$eval('#p-calendario .btn', els => els.filter(e => e.offsetParent !== null && e.getBoundingClientRect().height < 36).map(e => e.textContent.trim()));
  ok(!botonesBajos.length, 'todos los botones miden al menos 36 px' + (botonesBajos.length ? ': ' + botonesBajos.join(', ') : ''));
  const altoCelda = await pm.$eval('#cal-grilla .cal-dia[data-fecha="2026-10-19"]', e => e.getBoundingClientRect().height);
  ok(altoCelda >= 44, 'las celdas son tocables (' + Math.round(altoCelda) + ' px de alto)');
  await pm.evaluate(() => window.scrollTo(0, 0));
  await espera(150);
  await pm.screenshot({ path: path.join(CAPTURAS, 'calendario-celular.png'), fullPage: true });
  await pm.tap('#cal-grilla .cal-dia[data-fecha="2026-10-19"]');
  await pm.waitForSelector('#modal:not([hidden]) #formCalDia');
  ok(/Corte/.test(await pm.$eval('#modalContenido', e => e.textContent)), 'en celular el día se abre en un modal y muestra "Corte"');
  ok(await pm.$('#cal-panel[hidden]'), 'el panel lateral permanece oculto en celular');
  await pm.screenshot({ path: path.join(CAPTURAS, 'calendario-dia-celular.png'), fullPage: false });
  await pm.selectOption('#formCalDia [name="estado"]', 'en_curso');
  await pm.fill('#formCalDia [name="notas"]', 'Nota desde el celular');
  await pm.click('#formCalDia button[type="submit"]');
  await espera(400);
  const dMovil = await pm.evaluate(() => VDO.DB.buscar('calendario', '2026-10-19'));
  ok(dMovil.estado === 'en_curso' && dMovil.notas === 'Nota desde el celular' && (await pm.$('#modal[hidden]')), 'guardar desde el modal persiste estado y notas y cierra el modal');
  await pm.click('[data-cal="vista"][data-valor="lista"]');
  await pm.waitForSelector('#cal-lista table.cal-lista');
  ok(!(await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'sin desplazamiento horizontal en la vista lista (tarjetas)');
  ok((await pm.$eval('#cal-lista td[data-label="Meta del día"]', e => getComputedStyle(e).display)) === 'block', 'en celular las filas de la lista se ven como tarjetas con etiqueta');
  await pm.evaluate(() => window.scrollTo(0, 0));
  await espera(3500); // deja que el toast desaparezca antes de la captura
  await pm.screenshot({ path: path.join(CAPTURAS, 'calendario-lista-celular.png'), fullPage: true });

  ok(errores.length === 0, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log(fallos ? '\nFALLOS: ' + fallos : '\nTodo en orden.');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
