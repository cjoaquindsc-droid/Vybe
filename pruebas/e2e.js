/* Pruebas de extremo a extremo del CRM con Playwright (Chromium).
   Uso: NODE_PATH=$(npm root -g) node pruebas/e2e.js
   Abre crm-vdo.html por file://, recorre las pantallas, importa CSV y JSON, y deja capturas en pruebas/capturas/. */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const ARCHIVO = 'file://' + (process.env.CRM_HTML || path.join(RAIZ, 'crm-vdo.html'));
const CAPTURAS = path.join(__dirname, 'capturas');
const FIX = path.join(__dirname, 'fixtures');
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
  ok(!(await page.evaluate(() => VDO.DB.tabla('calendario').some(d => d.fecha === '2026-12-25'))), 'sin 25/12');
  const sumMetaOct = await page.evaluate(() => VDO.DB.tabla('calendario').filter(d => d.fecha.slice(0, 7) === '2026-10').reduce((s, d) => s + d.metaDia, 0));
  ok(Math.abs(sumMetaOct - 50000) < 40, 'metas diarias de octubre suman la proyección (' + sumMetaOct + ')');
  const hito1910 = await page.evaluate(() => VDO.DB.tabla('calendario').filter(d => d.fecha === '2026-10-19')[0].hito);
  ok((hito1910.match(/Corte/gi) || []).length === 1, 'hito del 19/10 sin duplicar el corte: ' + hito1910);
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').filter(c => c.prueba).length)) === 8, 'ocho contactos de prueba cargados');
  await page.screenshot({ path: path.join(CAPTURAS, 'hoy-laptop.png'), fullPage: true });

  console.log('2. Utilidades');
  const u = await page.evaluate(() => ({
    t1: VDO.util.normTelefono('987 654 321'), t2: VDO.util.normTelefono('+51 987654321'), t3: VDO.util.normTelefono('0051987654321'), t4: VDO.util.normTelefono('(01) 4451234'), t5: VDO.util.normTelefono('+1 305 555 0100'),
    t6: VDO.util.normTelefono('(056) 123456'), t7: VDO.util.normTelefono('999'), t8: VDO.util.normTelefono('+51 912 345 678 ::: 999 000 111'), t9: VDO.util.normTelefono('sin número'),
    s1: VDO.util.soles(1234.5), s2: VDO.util.soles(0), s3: VDO.util.soles(-80.5), n1: VDO.util.numero('S/ 1,234.50'), n2: VDO.util.numero('1.234,50'), f1: VDO.util.fechaCorta('2026-10-07'), i1: VDO.util.isoDe('7/10/2026'), i2: VDO.util.isoDe('31/02/2026'), i3: VDO.util.isoDe('10/13/2026'), i4: VDO.util.isoDe('2026-11-05T10:00'),
    w1: VDO.reglas.urlWhatsApp('+51 987 654 321', 'Hola'), ola: VDO.reglas.olaDe('2026-11-05'), olaHueco: VDO.reglas.olaDe('2026-11-21'), olaAntes: VDO.reglas.olaDe('2026-10-01'), d1: VDO.util.diasEntre('05/10/2026', '2026-10-07'), d2: VDO.util.diasEntre('basura', '2026-10-07')
  }));
  ok(u.t1 === '+51987654321' && u.t2 === '+51987654321' && u.t3 === '+51987654321', 'teléfonos peruanos normalizados a +51');
  ok(u.t4 === '+5114451234' && u.t6 === '+5156123456', 'fijos de Lima y provincia (' + u.t4 + ', ' + u.t6 + ')');
  ok(u.t5 === '+13055550100', 'número extranjero (' + u.t5 + ')');
  ok(u.t7 === '' && u.t9 === '' && u.t8 === '+51912345678', 'basura corta descartada y multivalor de Google toma el primero');
  ok(u.s1 === 'S/ 1,234.50' && u.s2 === 'S/ 0.00' && u.s3 === '-S/ 80.50', 'formato de soles: ' + u.s1);
  ok(u.n1 === 1234.5 && u.n2 === 1234.5, 'parser de montos');
  ok(u.f1 === '07/10/2026' && u.i1 === '2026-10-07' && u.i2 === '' && u.i3 === '' && u.i4 === '2026-11-05', 'fechas dd/mm/aaaa y rechazo de fechas imposibles');
  ok(u.d1 === 2 && u.d2 === null, 'diasEntre tolera dd/mm y devuelve null con basura');
  ok(u.w1 === 'https://wa.me/51987654321?text=Hola', 'url de WhatsApp');
  ok(u.ola === 2 && u.olaHueco === 2 && u.olaAntes === 1, 'olas: 05/11 → 2, sábado 21/11 (hueco) → 2, 01/10 → 1');

  console.log('3. Reglas');
  const r = await page.evaluate(() => {
    const hoy = VDO.util.hoyISO();
    const c1 = { segmento: 'recontacto', consentimiento: false, estado: 'activo' };
    const c2 = { segmento: 'recontacto', consentimiento: true, estado: 'activo', ultimoContacto: VDO.util.sumarDias(hoy, -3) };
    const c3 = { segmento: 'boca', estado: 'activo', ultimaOla: VDO.util.sumarDias(hoy, -10) };
    const c4 = { segmento: 'boca', estado: 'activo', ultimoContacto: VDO.util.sumarDias(hoy, -30) };
    const c5 = { segmento: 'boca', estado: 'activo', ultimoContacto: '05/09/2026' };
    const c6 = { segmento: 'boca', estado: 'dormido', toques: 3, ultimaOla: '2026-10-27', ultimoContacto: '2026-10-27' }; // ola 2; el 25/11 ya es ola 3
    const c7 = { segmento: 'boca', estado: 'dormido', toques: 3, ultimaOla: '2026-10-27', ultimoContacto: '2026-10-27' }; // el 20/11 sigue en ola 2
    return {
      r1: VDO.reglas.puedeIniciarOla(c1).ok, r2: VDO.reglas.puedeIniciarOla(c2).ok, r3: VDO.reglas.puedeIniciarOla(c3).ok, r4: VDO.reglas.puedeIniciarOla(c4).ok, r5: VDO.reglas.puedeIniciarOla(c5).ok,
      r6: VDO.reglas.puedeIniciarOla(c6, '2026-11-25').ok, r7: VDO.reglas.puedeIniciarOla(c7, '2026-11-20').ok, r7m: VDO.reglas.puedeIniciarOla(c7, '2026-11-20').motivo,
      b1: VDO.reglas.derivarB2B({ linea: 'botellas', botellas: 13, total: 900 }), b2: VDO.reglas.derivarB2B({ linea: 'botellas', botellas: 2, total: 1600 }), b3: VDO.reglas.derivarB2B({ linea: 'botellas', botellas: 12, total: 1500 }), b4: VDO.reglas.derivarB2B({ linea: 'experiencia', personas: 30, total: 12990 }),
      t1: VDO.reglas.proximoToqueTras({ segmento: 'recontacto' }, '2026-10-07', 1), t2: VDO.reglas.proximoToqueTras({ segmento: 'corporativo' }, '2026-10-07', 1), t3: VDO.reglas.proximoToqueTras({ segmento: 'corporativo', inicioConversacion: '2026-10-07' }, '2026-10-10', 2), t4: VDO.reglas.proximoToqueTras({ segmento: 'boca' }, '2026-10-07', 3), t5: VDO.reglas.proximoToqueTras({ segmento: 'boca' }, '2026-10-07', 0), t6: VDO.reglas.proximoToqueTras({ segmento: 'boca' }, 'basura', 1),
      msg: VDO.reglas.armarMensaje(VDO.DB.tabla('plantillas').filter(p => p.id === 'breca_t1')[0], { nombre: 'Carla Huamán', empresa: 'Rímac', segmento: 'breca' }).texto,
      msgSinNombre: VDO.reglas.armarMensaje(VDO.DB.tabla('plantillas').filter(p => p.id === 'recontacto_t1')[0], { nombre: '+51912000333' }).texto,
      msgGancho: VDO.reglas.armarMensaje(VDO.DB.tabla('plantillas').filter(p => p.id === 'boca_t1')[0], { nombre: 'Ana' }, { fecha: '2026-11-10' }).texto
    };
  });
  ok(!r.r1 && !r.r2 && !r.r3 && r.r4 && r.r5, 'bloqueos: sin consentimiento, 7 días, 3 semanas; libre tras 30 días y con fecha dd/mm');
  ok(r.r6 && !r.r7 && /toques/.test(r.r7m), 'dormido vuelve en la siguiente ola, no en la misma (' + r.r7m + ')');
  ok(r.b1 && r.b2 && !r.b3 && !r.b4, 'umbral B2B: más de 12 botellas o más de S/ 1,500 en botellas; los grupos en la sala no se derivan');
  ok(r.t1 === '2026-10-09' && r.t2 === '2026-10-10' && r.t3 === '2026-10-14' && r.t4 === '' && r.t5 === '2026-10-09' && r.t6 >= hoy, 'cadencias 2/5 y 3/7, fin tras el tercer toque, sin excepciones con entradas raras');
  ok(r.msg.indexOf('Carla') >= 0 && r.msg.indexOf('Rímac') >= 0 && r.msg.indexOf('67.40') >= 0 && r.msg.indexOf('Tomar bebidas') >= 0, 'mensaje Breca con nombre, empresa, precio y leyendas');
  ok(/^Hola, le saluda/.test(r.msgSinNombre), 'sin nombre no saluda al número: ' + r.msgSinNombre.slice(0, 30));
  ok(r.msgGancho.indexOf('noviembre') >= 0, 'texto neutro del gancho usa el mes del envío');

  console.log('4. Contactos');
  await page.click('.nav [data-pantalla="contactos"]');
  await page.waitForSelector('#p-contactos:not([hidden]) table');
  ok((await page.$$('#p-contactos tbody tr[data-id]')).length === 8, 'tabla con ocho filas');
  await page.click('#p-contactos input[name="texto"]');
  await page.keyboard.type('Roj', { delay: 60 });
  await page.waitForTimeout(400);
  await page.keyboard.type('as', { delay: 60 });
  await page.waitForTimeout(400);
  ok((await page.$$('#p-contactos tbody tr[data-id]')).length === 1, 'búsqueda por nombre');
  ok((await page.evaluate(() => document.activeElement && document.activeElement.name === 'texto' && document.activeElement.value === 'Rojas')), 'el buscador conserva el foco y el texto mientras se escribe');
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
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').length)) === 8, 'bloqueó el duplicado por teléfono al crear');
  await page.fill('#formContacto [name="telefono"]', '912 000 111');
  await page.click('#formContacto button[type="submit"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').length)) === 9, 'contacto nuevo guardado');
  await page.click('#p-contactos tr[data-id="c_prueba_02"] [data-accion="editar-contacto"]');
  await page.waitForSelector('#formContacto');
  await page.fill('#formContacto [name="telefono"]', '987654321');
  await page.click('#formContacto button[type="submit"]');
  await page.waitForTimeout(200);
  ok(!(await page.evaluate(() => document.getElementById('modal').hidden)) && (await page.evaluate(() => VDO.DB.buscar('contactos', 'c_prueba_02').telefono)) === '+51998111222', 'bloqueó el duplicado por teléfono al editar');
  await page.click('#formContacto [data-accion="cerrar"]');
  // soltar el mouse sobre el fondo no cierra el modal
  await page.click('[data-accion="nuevo-contacto"]');
  await page.waitForSelector('#formContacto');
  const caja = await page.$('#formContacto [name="nombre"]');
  const bb = await caja.boundingBox();
  await page.mouse.move(bb.x + 10, bb.y + 10); await page.mouse.down(); await page.mouse.move(5, 5); await page.mouse.up();
  ok(!(await page.evaluate(() => document.getElementById('modal').hidden)), 'arrastrar desde el formulario al fondo no cierra el modal');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: path.join(CAPTURAS, 'contactos-laptop.png'), fullPage: true });

  console.log('5. Importar CSV (agenda de Google)');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.waitForSelector('#p-ajustes:not([hidden])');
  await page.setInputFiles('#archivoCsv', path.join(FIX, 'agenda-google.csv'));
  await page.waitForSelector('[data-accion="ejecutar-import"]');
  const mapeo = await page.evaluate(() => Array.from(document.querySelectorAll('[data-mapeo]')).map(s => s.getAttribute('data-mapeo') + '=' + (s.selectedOptions[0] ? s.selectedOptions[0].textContent : '')));
  ok(['nombre=First Name', 'apellido=Last Name', 'telefono=Phone 1 - Value', 'correo=E-mail 1 - Value', 'empresa=Organization Name', 'cargo=Organization Title', 'notas=Notes'].every(m => mapeo.indexOf(m) >= 0), 'mapeo automático Google');
  await page.screenshot({ path: path.join(CAPTURAS, 'importar-csv.png'), fullPage: true });
  await page.selectOption('[data-defecto="segmento"]', 'boca');
  await page.fill('[data-defecto="subsegmento"]', 'Agenda personal');
  await page.click('[data-accion="ejecutar-import"]'); // clic directo tras escribir: no se debe tragar
  await page.waitForSelector('.lista-resumen', { timeout: 5000 });
  const resumen = await page.$eval('.lista-resumen', el => el.textContent);
  ok(/2\s*contactos nuevos/.test(resumen) && /1\s*ya existían/.test(resumen), 'dos nuevos y un duplicado completado');
  const imp = await page.evaluate(() => { const t = VDO.DB.tabla('contactos'); return { n: t.length, rosa: t.filter(c => c.nombre === 'Rosa Quispe')[0], mf: t.filter(c => c.nombre === 'María Fernanda Rojas')[0], carlos: t.filter(c => c.nombre === 'Carlos Benavides')[0] }; });
  ok(imp.n === 11, 'once contactos tras importar');
  ok(imp.rosa && imp.rosa.telefono === '+51912345678' && imp.rosa.correo === 'rosa.quispe@ejemplo.pe' && imp.rosa.segmento === 'boca' && imp.rosa.subsegmento === 'Agenda personal', 'Rosa normalizada, en el segmento y subsegmento elegidos');
  ok(imp.mf && imp.mf.segmento === 'recontacto' && imp.mf.subsegmento === 'G2 Alta' && imp.mf.consentimiento === true && imp.mf.notas.indexOf('cumpleaños') >= 0 && imp.mf.cargo === 'Diseñadora' && imp.mf.prueba === false, 'duplicado conservó segmento, subsegmento y consentimiento, completó el cargo y dejó de ser dato de prueba');
  ok(imp.carlos && imp.carlos.empresa === 'Interbank' && imp.carlos.cargo === 'Gerente' && imp.carlos.telefono === '+51999888777', 'empresa y cargo desde Organization');
  await page.click('.lista-resumen ~ .acciones [data-accion="cerrar"]');

  console.log('6. Importar CSV antiguo de Google con multivalores y reimportar con sobrescribir');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.setInputFiles('#archivoCsv', path.join(FIX, 'agenda-google-antigua.csv'));
  await page.waitForSelector('[data-accion="ejecutar-import"]');
  await page.selectOption('[data-defecto="segmento"]', 'piloto');
  await page.click('[data-accion="ejecutar-import"]');
  await page.waitForSelector('.lista-resumen');
  const imp3 = await page.evaluate(() => { const t = VDO.DB.tabla('contactos'); return { n: t.length, rosa: t.filter(c => c.nombre === 'Rosa Quispe')[0], jose: t.filter(c => c.nombre === 'José Muñoz')[0], rosas: t.filter(c => /Quispe/.test(c.nombre)).length }; });
  ok(imp3.n === 12 && imp3.rosas === 1 && imp3.rosa.telefono2 === '+51999000111' && imp3.rosa.segmento === 'boca', 'formato Name + Family Name no duplica el apellido, multivalor completa el teléfono 2 y no cambia el segmento del existente');
  ok(imp3.jose && imp3.jose.telefono === '+5156123456' && imp3.jose.segmento === 'piloto', 'fijo de Ica normalizado y segmento por defecto en el nuevo');
  await page.click('.lista-resumen ~ .acciones [data-accion="cerrar"]');
  await page.evaluate(() => { const c = VDO.DB.tabla('contactos').filter(x => x.nombre === 'Rosa Quispe')[0]; c.etapa = 'proponer'; c.toques = 2; c.cargo = 'Antiguo'; VDO.DB.upsert('contactos', c); });
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.setInputFiles('#archivoCsv', path.join(FIX, 'agenda-google.csv'));
  await page.waitForSelector('[data-accion="ejecutar-import"]');
  await page.selectOption('[data-politica]', 'sobrescribir');
  await page.selectOption('[data-defecto="segmento"]', 'pyme');
  await page.click('[data-accion="ejecutar-import"]');
  await page.waitForSelector('.lista-resumen');
  const imp4 = await page.evaluate(() => { const t = VDO.DB.tabla('contactos'); return { n: t.length, rosa: t.filter(c => c.nombre === 'Rosa Quispe')[0], mf: t.filter(c => c.nombre === 'María Fernanda Rojas')[0] }; });
  ok(imp4.n === 12 && imp4.rosa.etapa === 'proponer' && imp4.rosa.toques === 2 && imp4.rosa.segmento === 'boca' && imp4.rosa.cargo === 'Antiguo', 'sobrescribir no toca etapa, toques ni segmento, y solo pisa columnas con dato en el archivo');
  ok(imp4.mf.cargo === 'Diseñadora' && imp4.mf.empresa === 'Freelance' && imp4.mf.segmento === 'recontacto', 'sobrescribir sí actualiza empresa y cargo desde el archivo');
  await page.click('.lista-resumen ~ .acciones [data-accion="cerrar"]');

  console.log('7. Importar CSV con punto y coma (base Breca)');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.setInputFiles('#archivoCsv', path.join(FIX, 'base-breca.csv'));
  await page.waitForSelector('[data-accion="ejecutar-import"]');
  ok((await page.$eval('[data-defecto="segmento"]', s => s.value)) === 'breca', 'sugiere segmento Breca por el nombre del archivo');
  await page.click('[data-accion="ejecutar-import"]');
  await page.waitForSelector('.lista-resumen');
  const imp2 = await page.evaluate(() => { const t = VDO.DB.tabla('contactos'); return { n: t.length, p: t.filter(c => c.correo === 'pedro.luna@rimac.ejemplo')[0], carla: t.filter(c => c.nombre === 'Carla Huamán')[0] }; });
  ok(imp2.n === 13 && imp2.p && imp2.p.empresa === 'Rímac' && imp2.p.segmento === 'breca' && imp2.p.telefono === '+51955000111', 'Breca con punto y coma importada');
  ok(imp2.carla && imp2.carla.correo === 'chuaman@rimac.ejemplo' && imp2.carla.cargo === 'Analista', 'duplicado por correo detectado');
  await page.click('.lista-resumen ~ .acciones [data-accion="cerrar"]');

  console.log('8. Respaldo JSON, fusión y base del Centro de Mando');
  const exp = await page.evaluate(() => VDO.DB.exportar());
  ok(exp.formato === 'vdo-crm-respaldo' && exp.tablas.contactos.length === 13 && exp.tablas.calendario.length === 73 && exp.config.productos.length === 6, 'exportación completa');
  // fusión: un respaldo con una venta más antigua no pisa la local; una más nueva sí; y los contactos deduplicados remapean ids
  const fus = await page.evaluate(() => {
    const exp = JSON.parse(JSON.stringify(VDO.DB.exportar()));
    const vLocal = VDO.DB.buscar('ventas', 'v_prueba_01'); vLocal.estado = 'entregado'; vLocal.updatedAt = '2026-10-07T12:00'; VDO.DB.upsert('ventas', vLocal);
    const vieja = exp.tablas.ventas.filter(v => v.id === 'v_prueba_01')[0]; vieja.estado = 'cotizado'; vieja.updatedAt = '2026-09-01T00:00';
    const nueva = exp.tablas.ventas.filter(v => v.id === 'v_prueba_03')[0]; nueva.estado = 'pagado'; nueva.updatedAt = '2099-01-01T00:00';
    exp.tablas.contactos = [{ id: 'otro-id-rosa', nombre: 'Rosa Q.', telefono: '+51 912 345 678', correo: '', segmento: 'breca', etapa: 'cerrar', estado: 'activo', updatedAt: '2000-01-01T00:00' }];
    exp.tablas.ventas.push({ id: 'v_remota', contactoId: 'otro-id-rosa', fecha: '2026-10-06', linea: 'botellas', total: 100, estado: 'pagado', updatedAt: '2026-10-06T10:00' });
    exp.tablas.cuentas.push({ id: 'k_remota', empresa: 'X', contactos: ['otro-id-rosa'], estado: 'contactado', updatedAt: '2026-10-06T10:00' });
    const r = VDO.DB.importar(exp, 'fusionar');
    const rosa = VDO.DB.tabla('contactos').filter(c => c.nombre === 'Rosa Quispe')[0];
    return { r, v1: VDO.DB.buscar('ventas', 'v_prueba_01').estado, v3: VDO.DB.buscar('ventas', 'v_prueba_03').estado, remota: VDO.DB.buscar('ventas', 'v_remota').contactoId, cuenta: VDO.DB.buscar('cuentas', 'k_remota').contactos[0], rosaId: rosa.id, rosaEtapa: rosa.etapa, rosaSeg: rosa.segmento, n: VDO.DB.tabla('contactos').length };
  });
  ok(fus.v1 === 'entregado' && fus.v3 === 'pagado', 'al fusionar gana el registro más reciente por updatedAt');
  ok(fus.remota === fus.rosaId && fus.cuenta === fus.rosaId && fus.n === 13 && fus.rosaEtapa === 'proponer' && fus.rosaSeg === 'boca', 'contacto deduplicado por teléfono: ventas y cuentas remapean al id local y el más antiguo no pisa etapa ni segmento');
  const cm = JSON.parse(fs.readFileSync(path.join(RAIZ, 'datos', 'centro-de-mando.json'), 'utf8'));
  await page.evaluate(json => VDO.DB.importar(json, 'fusionar'), cm);
  const tras = await page.evaluate(() => ({ c: VDO.DB.tabla('contactos').length, v: VDO.DB.tabla('ventas').length, k: VDO.DB.tabla('cuentas').length, sku: VDO.DB.datos.config.skuMaestro.length, cal: VDO.DB.tabla('calendario').length, pl: VDO.DB.tabla('plantillas').length, huerfanas: VDO.DB.tabla('ventas').filter(v => v.contactoId && !VDO.DB.buscar('contactos', v.contactoId)).length }));
  ok(tras.c >= 13 + cm.tablas.contactos.length - 25 && tras.c <= 13 + cm.tablas.contactos.length && tras.v === 4 + cm.tablas.ventas.length && tras.k === 3 + cm.tablas.cuentas.length && tras.sku > 100 && tras.cal === 73 && tras.pl > 20 && tras.huerfanas === 0, 'fusión del Centro de Mando sin ventas huérfanas: ' + JSON.stringify(tras));
  await page.evaluate(json => VDO.DB.importar(json, 'fusionar'), cm);
  const tras2 = await page.evaluate(() => ({ c: VDO.DB.tabla('contactos').length, v: VDO.DB.tabla('ventas').length }));
  ok(tras2.c === tras.c && tras2.v === tras.v, 'reimportar no duplica');
  const guardado = await page.evaluate(() => { const raw = localStorage.getItem('vdo-crm-v1'); return raw ? raw.length : 0; });
  ok(guardado > 100000, 'persistido en localStorage (' + Math.round(guardado / 1024) + ' KB)');
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]), #p-ajustes:not([hidden]), #p-contactos:not([hidden])');
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').length)) === tras.c, 'los datos sobreviven a la recarga');
  // respaldo incompleto en modo reemplazar: no deja la base a medias
  const rep = await page.evaluate(() => { try { VDO.DB.importar({ formato: 'vdo-crm-respaldo', tablas: { contactos: [{ id: 'x', nombre: 'Solo uno' }] }, config: { reglas: { diasBloqueo: 9 } }, ui: 'basura' }, 'reemplazar'); } catch (e) { return 'error: ' + e.message; } return { c: VDO.DB.tabla('contactos').length, cal: VDO.DB.tabla('calendario').length, pl: VDO.DB.tabla('plantillas').length, bloqueo: VDO.DB.datos.config.reglas.diasBloqueo, umbral: VDO.DB.datos.config.reglas.umbralSolesB2B, filtros: typeof VDO.DB.datos.ui.filtros }; });
  ok(rep.c === 1 && rep.cal === 73 && rep.pl > 20 && rep.bloqueo === 9 && rep.umbral === 1500 && rep.filtros === 'object', 'reemplazar con un respaldo parcial completa calendario, plantillas, reglas y ui: ' + JSON.stringify(rep));
  await page.evaluate(() => { VDO.DB.restablecer(); });
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]), #p-ajustes:not([hidden]), #p-contactos:not([hidden])');
  // dato corrupto en localStorage no bloquea el arranque
  await page.evaluate(() => { localStorage.setItem('vdo-crm-v1', '"no soy un objeto"'); });
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]), #p-ajustes:not([hidden]), #p-contactos:not([hidden])');
  const arranque = await page.evaluate(() => ({ cal: VDO.DB.tabla('calendario').length, copia: Object.keys(localStorage).some(k => k.indexOf('vdo-crm-v1-corrupto') === 0) }));
  ok(arranque.cal === 73 && arranque.copia, 'con localStorage corrupto arranca de cero y guarda una copia del contenido dañado');
  await page.evaluate(() => { VDO.DB.restablecer(); VDO.DB.cargarPrueba(); });
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]), #p-ajustes:not([hidden]), #p-contactos:not([hidden])');

  console.log('9. Ajustes · precios, ganchos y reglas');
  await page.click('.nav [data-pantalla="ajustes"]');
  await page.click('#p-ajustes .subnav [data-sub="precios"]');
  await page.waitForSelector('input[data-tabla="productos"]');
  ok((await page.$eval('input[data-tabla="productos"][data-i="0"][data-campo="b2c"]', e => e.value)) === '74.9', 'Silver a S/ 74.90');
  await page.selectOption('select[data-tabla="ganchos"][data-i="0"]', 'activo');
  await page.waitForTimeout(100);
  ok((await page.evaluate(() => VDO.reglas.armarMensaje(VDO.DB.tabla('plantillas')[0], { nombre: 'Ana' }).texto)).indexOf('desde S/ 300') >= 0, 'gancho activado aparece en el mensaje');
  await page.screenshot({ path: path.join(CAPTURAS, 'ajustes-precios.png'), fullPage: true });
  await page.click('#p-ajustes .subnav [data-sub="reglas"]');
  await page.waitForSelector('[data-cadencia="consumidor"]');
  await page.fill('[data-cadencia="consumidor"]', ' 0, 2, 5, ');
  await page.press('[data-cadencia="consumidor"]', 'Tab');
  await page.waitForTimeout(100);
  const cad = await page.evaluate(() => VDO.DB.datos.config.cadencias.consumidor);
  ok(JSON.stringify(cad) === '[0,2,5]', 'cadencia con espacios y coma final se guarda limpia');
  await page.fill('[data-regla="diasBloqueo"]', '');
  await page.press('[data-regla="diasBloqueo"]', 'Tab');
  await page.waitForTimeout(100);
  ok((await page.evaluate(() => VDO.DB.datos.config.reglas.diasBloqueo)) === 7, 'un valor vacío en reglas no se guarda');
  await page.click('#p-ajustes .subnav [data-sub="datos"]');
  await page.waitForSelector('[data-accion="borrar-prueba"]');
  await page.click('[data-accion="borrar-prueba"]');
  await page.click('[data-accion="ok"]');
  await page.waitForTimeout(200);
  ok((await page.evaluate(() => VDO.DB.tabla('contactos').filter(c => c.prueba).length)) === 0, 'datos de prueba borrados');

  console.log('10. Embudo (acciones compartidas y cola del día)');
  await page.evaluate(() => { VDO.DB.restablecer(); VDO.DB.cargarPrueba(); });
  await page.reload();
  await page.waitForSelector('#p-hoy:not([hidden]), #p-ajustes:not([hidden]), #p-contactos:not([hidden])');
  const emb = await page.evaluate(() => {
    const E = VDO.embudo, DB = VDO.DB, hoy = VDO.util.hoyISO();
    const cola0 = E.colaDelDia(hoy); const tipos = {}; cola0.forEach(x => { tipos[x.tipo] = (tipos[x.tipo] || 0) + 1; });
    const c = DB.buscar('contactos', 'c_prueba_03'); // Carla · Breca · atraer
    const pl = E.plantillaPara(c, 1);
    E.marcarEnviado(c, { canal: 'whatsapp', plantilla: pl, mensaje: 'hola' });
    const a = { etapa: c.etapa, toques: c.toques, prox: c.proximoToque, ola: c.ultimaOla, inter: E.ultimaInteraccion(c.id).resultado };
    E.marcarRespondio(c, 'Sí, me interesa');
    const b = { etapa: c.etapa, prox: c.proximoToque, inter: E.ultimaInteraccion(c.id).resultado, enCola: E.colaDelDia(hoy).filter(x => x.contacto && x.contacto.id === c.id).map(x => x.tipo) };
    const v = VDO.ventas.normalizarVenta({ id: 'v_e2e', contactoId: c.id, fecha: hoy, items: [{ productoId: 'gold700', nombre: 'Gold', cantidad: 2, precio: 89.9, linea: 'botellas', botellas: 1 }], estado: 'pagado', codigoOrigen: 'BRECA-RIMAC', segmento: 'breca' });
    DB.upsert('ventas', v); E.marcarCompro(c, v);
    const cc = { etapa: c.etapa, cod: c.codigoReferido, inv: c.totalInvertido, total: v.total, b2b: v.derivarB2B, linea: v.linea, botellas: v.botellas };
    const d = DB.buscar('contactos', 'c_prueba_02'); // Luis · boca
    E.marcarEnviado(d, { toque: 1 }); E.marcarEnviado(d, { toque: 2 }); E.marcarEnviado(d, { toque: 3 });
    const dd = { toques: d.toques, cierre: d.cierrePendiente, prox: d.proximoToque };
    d.proximoToque = VDO.util.sumarDias(hoy, -1); DB.upsert('contactos', d);
    const n = E.mantenimientoDiario();
    const res = E.resumenDia(hoy);
    const g = VDO.ventas.normalizarVenta({ items: [{ productoId: 'signature', nombre: 'Signature', cantidad: 1, precio: 12990, linea: 'experiencia', personasBase: 30 }], estado: 'cotizado' });
    const b2b = VDO.ventas.normalizarVenta({ items: [{ productoId: 'silver700', nombre: 'Silver', cantidad: 15, precio: 74.9, linea: 'botellas', botellas: 1 }], estado: 'cotizado' });
    return { tipos, pl: pl && pl.id, a, b, cc, dd, dormido: d.estado, n, res: { env: res.enviados, resp: res.respondieron, comp: res.compraron, venta: res.ventaDia }, g: { linea: g.linea, personas: g.personas, b2b: g.derivarB2B, total: g.total }, b2b: { der: b2b.derivarB2B, botellas: b2b.botellas } };
  });
  ok(emb.pl === 'breca_t1' && emb.tipos.inicial >= 1, 'plantilla por segmento y cola con toques iniciales');
  ok(emb.a.etapa === 'iniciar' && emb.a.toques === 1 && emb.a.prox === await page.evaluate(() => VDO.util.sumarDias(VDO.util.hoyISO(), 2)) && emb.a.ola === hoy && emb.a.inter === 'enviado', 'marcar enviado: Iniciar, toque 1, próximo a +2 días, ola fijada');
  ok(emb.b.etapa === 'calificar' && emb.b.prox === hoy && emb.b.inter === 'respondio' && emb.b.enCola.indexOf('responder') >= 0, 'respondió: Calificar, hoy en la cola como "responder"');
  ok(emb.cc.etapa === 'cerrar' && /^CH-\d+/.test(emb.cc.cod) && emb.cc.inv === 179.8 && emb.cc.total === 179.8 && !emb.cc.b2b && emb.cc.linea === 'botellas' && emb.cc.botellas === 2, 'compró: Cerrar, código de referido, total invertido');
  ok(emb.dd.toques === 3 && emb.dd.cierre === true && emb.dd.prox > hoy, 'tercer toque deja la conversación pendiente de cierre');
  ok(emb.dormido === 'dormido' && emb.n === 1, 'mantenimiento diario duerme a quien no respondió al tercer toque');
  ok(emb.res.env >= 4 && emb.res.resp === 1 && emb.res.comp === 1 && emb.res.venta === 179.8, 'resumen del día: ' + JSON.stringify(emb.res));
  ok(emb.g.linea === 'experiencia' && emb.g.personas === 30 && !emb.g.b2b && emb.g.total === 12990 && emb.b2b.der && emb.b2b.botellas === 15, 'normalizar venta: paquete de grupo es experiencia (no B2B); 15 botellas sí derivan');
  // formulario de venta desde la UI
  await page.click('.nav [data-pantalla="contactos"]');
  await page.waitForSelector('#p-contactos table');
  await page.evaluate(() => VDO.ui.formVenta(null, { contacto: VDO.DB.buscar('contactos', 'c_prueba_01') }));
  await page.waitForSelector('#formVenta');
  await page.selectOption('#formVenta .venta-item [data-item="productoId"]', 'blue710');
  await page.waitForTimeout(50);
  await page.fill('#formVenta .venta-item [data-item="cantidad"]', '2');
  await page.selectOption('#formVenta [name="estado"]', 'pagado');
  await page.waitForTimeout(50);
  const totalForm = await page.$eval('#ventaTotal', e => e.textContent);
  ok(totalForm === 'S/ 799.80', 'formulario de venta calcula el total: ' + totalForm);
  await page.click('#formVenta button[type="submit"]');
  await page.waitForTimeout(200);
  const vForm = await page.evaluate(() => { const c = VDO.DB.buscar('contactos', 'c_prueba_01'); const v = VDO.DB.tabla('ventas').filter(x => x.contactoId === 'c_prueba_01' && x.total === 799.8)[0]; return { etapa: c.etapa, venta: !!v, estado: v && v.estado, cierre: v && v.fechaCierre }; });
  ok(vForm.venta && vForm.estado === 'pagado' && vForm.cierre === hoy && vForm.etapa === 'cerrar', 'venta guardada desde el formulario mueve el contacto a Cerrar');
  await page.evaluate(() => { VDO.DB.restablecer(); VDO.DB.cargarPrueba(); });

  console.log('11. Celular');
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'es-PE', timezoneId: 'America/Lima' });
  const pm = await movil.newPage();
  pm.on('pageerror', e => errores.push('móvil: ' + e));
  await pm.goto(ARCHIVO);
  await pm.waitForSelector('#p-hoy:not([hidden])');
  ok(!(await pm.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'sin desplazamiento horizontal en celular');
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
