/* Pruebas de extremo a extremo del CRM con Playwright (Chromium).
   Uso: NODE_PATH=$(npm root -g) node pruebas/e2e.js
   Abre crm-vdo.html por file://, recorre las pantallas, importa CSV y JSON, y deja capturas en pruebas/capturas/. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const ARCHIVO = 'file://' + path.join(RAIZ, 'crm-vdo.html');
const CAPTURAS = path.join(__dirname, 'capturas');
fs.mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
function ok(cond, msg) { if (cond) console.log('  ✓ ' + msg); else { fallos++; console.log('  ✗ ' + msg); } }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'es-PE', timezoneId: 'America/Lima' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errores.push(m.text()); });

  console.log('1. Carga inicial');
  await page.goto(ARCHIVO);
  await page.waitForSelector('#p-hoy:not([hidden])');
  ok((await page.title()).indexOf('CRM B2C') >= 0, 'título');
  ok((await page.$$('.nav [data-pantalla]')).length === 9, 'nueve pantallas en la barra');
  const hoy = await page.evaluate(() => VDO.util.hoyISO());
  console.log('     hoy (Lima):', hoy);
  const nCal = await page.evaluate(() => VDO.DB.tabla('calendario').length);
  ok(nCal === 73, 'calendario con 73 días de atención (' + nCal + ')');
  const dia = await page.evaluate(() => VDO.DB.tabla('calendario')[0]);
  ok(dia.fecha === '2026-10-07' && dia.ola === 1 && dia.metaDia > 0, 'primer día 07/10, ola 1, meta > 0');
  const sin25 = await page.evaluate(() => VDO.DB.tabla('calendario').some(d => d.fecha === '2026-12-25'));
  ok(!sin25, 'sin 25/12');
  const sumMetaOct = await page.evaluate(() => VDO.DB.tabla('calendario').filter(d => d.fecha.slice(0, 7) === '2026-10').reduce((s, d) => s + d.metaDia, 0));
  ok(Math.abs(sumMetaOct - 50000) < 40, 'metas diarias de octubre suman la proyección (' + sumMetaOct + ')');
  const nPrueba = await page.evaluate(() => VDO.DB.tabla('contactos').filter(c => c.prueba).length);
  ok(nPrueba === 8, 'ocho contactos de prueba cargados');
  await page.screenshot({ path: path.join(CAPTURAS, 'hoy-laptop.png'), fullPage: true });

  console.log('2. Utilidades');
  const u = await page.evaluate(() => ({
    t1: VDO.util.normTelefono('987 654 321'), t2: VDO.util.normTelefono('+51 987654321'), t3: VDO.util.normTelefono('0051987654321'), t4: VDO.util.normTelefono('(01) 4451234'), t5: VDO.util.normTelefono('+1 305 555 0100'),
    s1: VDO.util.soles(1234.5), s2: VDO.util.soles(0), n1: VDO.util.numero('S/ 1,234.50'), n2: VDO.util.numero('1.234,50'), f1: VDO.util.fechaCorta('2026-10-07'), i1: VDO.util.isoDe('7/10/2026'),
    w1: VDO.reglas.urlWhatsApp('+51 987 654 321', 'Hola'), ola: VDO.reglas.olaDe('2026-11-05')
  }));
  ok(u.t1 === '+51987654321' && u.t2 === '+51987654321' && u.t3 === '+51987654321', 'teléfonos peruanos normalizados a +51');
  ok(u.t4 === '+5114451234', 'fijo de Lima (' + u.t4 + ')');
  ok(u.t5 === '+13055550100', 'número extranjero (' + u.t5 + ')');
  ok(u.s1 === 'S/ 1,234.50' && u.s2 === 'S/ 0.00', 'formato de soles: ' + u.s1);
  ok(u.n1 === 1234.5 && u.n2 === 1234.5, 'parser de montos');
  ok(u.f1 === '07/10/2026' && u.i1 === '2026-10-07', 'fechas dd/mm/aaaa');
  ok(u.w1 === 'https://wa.me/51987654321?text=Hola', 'url de WhatsApp');
  ok(u.ola === 2, 'ola 2 el 05/11');

  console.log('3. Reglas');
  const r = await page.evaluate(() => {
    const hoy = VDO.util.hoyISO();
    const c1 = { segmento: 'recontacto', consentimiento: false, estado: 'activo' };
    const c2 = { segmento: 'recontacto', consentimiento: true, estado: 'activo', ultimoContacto: VDO.util.sumarDias(hoy, -3) };
    const c3 = { segmento: 'boca', estado: 'activo', ultimaOla: VDO.util.sumarDias(hoy, -10) };
    const c4 = { segmento: 'boca', estado: 'activo', ultimoContacto: VDO.util.sumarDias(hoy, -30) };
    return {
      r1: VDO.reglas.puedeIniciarOla(c1).ok, r2: VDO.reglas.puedeIniciarOla(c2).ok, r3: VDO.reglas.puedeIniciarOla(c3).ok, r4: VDO.reglas.puedeIniciarOla(c4).ok,
      b1: VDO.reglas.derivarB2B({ botellas: 13, total: 900 }), b2: VDO.reglas.derivarB2B({ botellas: 2, total: 1600 }), b3: VDO.reglas.derivarB2B({ botellas: 12, total: 1500 }),
      t1: VDO.reglas.proximoToqueTras({ segmento: 'recontacto' }, '2026-10-07', 1), t2: VDO.reglas.proximoToqueTras({ segmento: 'corporativo' }, '2026-10-07', 1), t3: VDO.reglas.proximoToqueTras({ segmento: 'corporativo', inicioConversacion: '2026-10-07' }, '2026-10-10', 2), t4: VDO.reglas.proximoToqueTras({ segmento: 'boca' }, '2026-10-07', 3),
      msg: VDO.reglas.armarMensaje(VDO.DB.tabla('plantillas').filter(p => p.id === 'breca_t1')[0], { nombre: 'Carla Huamán', empresa: 'Rímac', segmento: 'breca' }).texto
    };
  });
  ok(!r.r1 && !r.r2 && !r.r3 && r.r4, 'bloqueos: sin consentimiento, 7 días, 3 semanas; libre tras 30 días');
  ok(r.b1 && r.b2 && !r.b3, 'umbral B2B: más de 12 botellas o más de S/ 1,500');
  ok(r.t1 === '2026-10-09' && r.t2 === '2026-10-10' && r.t3 === '2026-10-14' && r.t4 === '', 'cadencias 2/5 y 3/7 y fin tras el tercer toque');
  ok(r.msg.indexOf('Carla') >= 0 && r.msg.indexOf('Rímac') >= 0 && r.msg.indexOf('67.40') >= 0 && r.msg.indexOf('Tomar bebidas') >= 0, 'mensaje Breca con nombre, empresa, precio y leyendas');

  console.log('4. Contactos');
  await page.click('.nav [data-pantalla="contactos"]');
  await page.waitForSelector('#p-contactos:not([hidden]) table');
  ok((await page.$$('#p-contactos tbody tr[data-id]')).length === 8, 'tabla con ocho filas');
  await page.fill('#p-contactos input[name="texto"]', 'Rojas');
  await page.waitForTimeout(400);
  ok((await page.$$('#p-contactos tbody tr[data-id]')).length === 1, 'búsqueda por nombre');
  await page.fill('#p-contactos input[name="texto"]', '');
  await page.waitForTimeout(400);
  await page.selectOption('#p-contactos select[name="segmento"]', 'breca');
  await page.waitForTimeout(100);
  ok((await page.$$('#p-contactos tbody tr[data-id]')).length === 1, 'filtro por segmento');
  await page.click('[data-accion="limpiar-filtros"]');
  await page.waitForTimeout(100);
  await page.click('[data-accion="nuevo-contacto"]');
  await page.waitForSelector('#formContacto');
  await page.fill('#formContacto [name="nombre"]', 'Prueba Nuevo');
  await page.fill('#formContacto [name="telefono"]', '987654321');
  await page.click('#formContacto button[type="submit"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').length)) === 8, 'bloqueó el duplicado por teléfono');
  await page.fill('#formContacto [name="telefono"]', '912 000 111');
  await page.click('#formContacto button[type="submit"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').length)) === 9, 'contacto nuevo guardado');
  await page.screenshot({ path: path.join(CAPTURAS, 'contactos-laptop.png'), fullPage: true });

  console.log('5. Importar CSV (agenda de Google)');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.waitForSelector('#p-ajustes:not([hidden])');
  await page.setInputFiles('#archivoCsv', path.join(__dirname, 'fixtures', 'agenda-google.csv'));
  await page.waitForSelector('[data-accion="ejecutar-import"]');
  const mapeo = await page.evaluate(() => Array.from(document.querySelectorAll('[data-mapeo]')).map(s => s.getAttribute('data-mapeo') + '=' + (s.selectedOptions[0] ? s.selectedOptions[0].textContent : '')));
  ok(mapeo.some(m => m === 'nombre=First Name') && mapeo.some(m => m === 'apellido=Last Name') && mapeo.some(m => m === 'telefono=Phone 1 - Value') && mapeo.some(m => m === 'correo=E-mail 1 - Value') && mapeo.some(m => m === 'empresa=Organization Name'), 'mapeo automático Google');
  await page.screenshot({ path: path.join(CAPTURAS, 'importar-csv.png'), fullPage: true });
  await page.selectOption('[data-defecto="segmento"]', 'boca');
  await page.click('[data-accion="ejecutar-import"]');
  await page.waitForSelector('.lista-resumen');
  const resumen = await page.$eval('.lista-resumen', el => el.textContent);
  ok(/2\s*contactos nuevos/.test(resumen) && /1\s*ya existían/.test(resumen), 'dos nuevos y un duplicado completado (' + resumen.replace(/\s+/g, ' ').trim() + ')');
  const imp = await page.evaluate(() => { const t = VDO.DB.tabla('contactos'); return { n: t.length, rosa: t.filter(c => c.nombre === 'Rosa Quispe')[0], mf: t.filter(c => c.nombre === 'María Fernanda Rojas')[0], carlos: t.filter(c => c.nombre === 'Carlos Benavides')[0] }; });
  ok(imp.n === 11, 'once contactos tras importar');
  ok(imp.rosa && imp.rosa.telefono === '+51912345678' && imp.rosa.correo === 'rosa.quispe@ejemplo.pe' && imp.rosa.segmento === 'boca', 'Rosa normalizada y en el segmento elegido');
  ok(imp.mf && imp.mf.segmento === 'recontacto' && imp.mf.notas.indexOf('cumpleaños') >= 0 && imp.mf.cargo === 'Diseñadora', 'duplicado conservó su segmento y completó el cargo vacío');
  ok(imp.carlos && imp.carlos.empresa === 'Interbank' && imp.carlos.cargo === 'Gerente' && imp.carlos.telefono === '+51999888777', 'empresa y cargo desde Organization');
  await page.click('.lista-resumen ~ .acciones [data-accion="cerrar"]');

  console.log('6. Importar CSV con punto y coma (base Breca)');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.setInputFiles('#archivoCsv', path.join(__dirname, 'fixtures', 'base-breca.csv'));
  await page.waitForSelector('[data-accion="ejecutar-import"]');
  const segDef = await page.$eval('[data-defecto="segmento"]', s => s.value);
  ok(segDef === 'breca', 'sugiere segmento Breca por el nombre del archivo');
  await page.click('[data-accion="ejecutar-import"]');
  await page.waitForSelector('.lista-resumen');
  const imp2 = await page.evaluate(() => { const t = VDO.DB.tabla('contactos'); return { n: t.length, p: t.filter(c => c.correo === 'pedro.luna@rimac.ejemplo')[0], carla: t.filter(c => c.nombre === 'Carla Huamán')[0] }; });
  ok(imp2.n === 12 && imp2.p && imp2.p.empresa === 'Rímac' && imp2.p.segmento === 'breca' && imp2.p.telefono === '+51955000111', 'Breca con punto y coma importada');
  ok(imp2.carla && imp2.carla.correo === 'chuaman@rimac.ejemplo' && imp2.carla.cargo === 'Analista', 'duplicado por correo detectado');
  await page.click('.lista-resumen ~ .acciones [data-accion="cerrar"]');

  console.log('7. Respaldo JSON y base del Centro de Mando');
  const exp = await page.evaluate(() => VDO.DB.exportar());
  ok(exp.formato === 'vdo-crm-respaldo' && exp.tablas.contactos.length === 12 && exp.tablas.calendario.length === 73 && exp.config.productos.length === 6, 'exportación completa');
  const cm = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'centro-de-mando.json'), 'utf8'));
  const resCm = await page.evaluate(json => VDO.DB.importar(json, 'fusionar'), cm);
  const tras = await page.evaluate(() => ({ c: VDO.DB.tabla('contactos').length, v: VDO.DB.tabla('ventas').length, k: VDO.DB.tabla('cuentas').length, sku: VDO.DB.datos.config.skuMaestro.length, cal: VDO.DB.tabla('calendario').length, pl: VDO.DB.tabla('plantillas').length }));
  ok(tras.c >= 12 + cm.tablas.contactos.length - 25 && tras.c <= 12 + cm.tablas.contactos.length && tras.v === 3 + cm.tablas.ventas.length && tras.k === 2 + cm.tablas.cuentas.length && tras.sku > 100 && tras.cal === 73 && tras.pl > 20, 'fusión del Centro de Mando: ' + JSON.stringify(tras));
  const resCm2 = await page.evaluate(json => VDO.DB.importar(json, 'fusionar'), cm);
  const tras2 = await page.evaluate(() => ({ c: VDO.DB.tabla('contactos').length, v: VDO.DB.tabla('ventas').length }));
  ok(tras2.c === tras.c && tras2.v === tras.v, 'reimportar no duplica');
  const guardado = await page.evaluate(() => { const raw = localStorage.getItem('vdo-crm-v1'); return raw ? raw.length : 0; });
  ok(guardado > 100000, 'persistido en localStorage (' + Math.round(guardado / 1024) + ' KB)');
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]), #p-ajustes:not([hidden]), #p-contactos:not([hidden])');
  const trasRecarga = await page.evaluate(() => VDO.DB.tabla('contactos').length);
  ok(trasRecarga === tras.c, 'los datos sobreviven a la recarga');

  console.log('8. Ajustes · precios y ganchos');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.click('#p-ajustes .subnav [data-sub="precios"]');
  await page.waitForSelector('input[data-tabla="productos"]');
  const silver = await page.$eval('input[data-tabla="productos"][data-i="0"][data-campo="b2c"]', e => e.value);
  ok(silver === '74.9', 'Silver a S/ 74.90');
  await page.selectOption('select[data-tabla="ganchos"][data-i="0"]', 'activo');
  await page.waitForTimeout(100);
  const gancho = await page.evaluate(() => VDO.reglas.armarMensaje(VDO.DB.tabla('plantillas')[0], { nombre: 'Ana' }).texto);
  ok(gancho.indexOf('desde S/ 300') >= 0, 'gancho activado aparece en el mensaje');
  await page.screenshot({ path: path.join(CAPTURAS, 'ajustes-precios.png'), fullPage: true });
  await page.click('#p-ajustes .subnav [data-sub="datos"]');
  await page.waitForSelector('[data-accion="borrar-prueba"]');
  await page.click('[data-accion="borrar-prueba"]');
  await page.click('[data-accion="ok"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').filter(c => c.prueba).length)) === 0, 'datos de prueba borrados');

  console.log('9. Celular');
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-PE', timezoneId: 'America/Lima' });
  const pm = await movil.newPage();
  pm.on('pageerror', e => errores.push('móvil: ' + e));
  await pm.goto(ARCHIVO);
  await pm.waitForSelector('#p-hoy:not([hidden])');
  const scrollX = await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!scrollX, 'sin desplazamiento horizontal en celular');
  await pm.screenshot({ path: path.join(CAPTURAS, 'hoy-celular.png'), fullPage: true });
  await pm.click('.tabbar-movil [data-pantalla="contactos"]');
  await pm.waitForSelector('#p-contactos:not([hidden]) table');
  await pm.screenshot({ path: path.join(CAPTURAS, 'contactos-celular.png'), fullPage: true });
  await pm.click('[data-accion="nuevo-contacto"]');
  await pm.waitForSelector('#formContacto');
  await pm.screenshot({ path: path.join(CAPTURAS, 'contacto-form-celular.png'), fullPage: true });

  ok(errores.length === 0, 'sin errores de consola' + (errores.length ? ': ' + errores.join(' | ') : ''));
  await browser.close();
  console.log(fallos ? '\nFALLOS: ' + fallos : '\nTodo en orden.');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
