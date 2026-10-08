/* ============================================================================
   calendario.js · Pantalla Calendario (parte 2) · CRM B2C Viñas de Oro
   Vista mensual (grilla lunes a domingo), vista lista con filtros, panel de
   edición por día (lateral en laptop, modal en celular), resumen por mes con
   gráfica SVG de meta del día vs venta real, recálculo desde metas y CSV.
   Usa solo la API pública window.VDO (ver docs/MODULOS.md).
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, DB = V.DB, cfg = V.cfg;

  var ESTADOS = [
    { valor: 'pendiente', texto: 'Pendiente' },
    { valor: 'en_curso', texto: 'En curso' },
    { valor: 'cumplido', texto: 'Cumplido' },
    { valor: 'no_cumplido', texto: 'No cumplido' }
  ];
  var NOMBRE_ESTADO = { pendiente: 'Pendiente', en_curso: 'En curso', cumplido: 'Cumplido', no_cumplido: 'No cumplido' };
  var CABECERA_GRILLA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
  var ESTADOS_VENTA_REAL = ['pagado', 'entregado'];

  var diaAbierto = '';      // fecha abierta en el panel lateral (laptop)
  var timerResize = null;

  /* =========================== Estado de la pantalla =========================== */
  function esMovil() { return !!(window.matchMedia && window.matchMedia('(max-width: 820px)').matches); }
  function mesesDelCalendario() {
    var m = {}; DB.tabla('calendario').forEach(function (d) { var k = U.mesDe(d.fecha); if (k) m[k] = true; });
    return Object.keys(m).sort();
  }
  function mesMasCercano(meses, ym) {
    if (!meses.length) return '';
    if (meses.indexOf(ym) >= 0) return ym;
    return ym < meses[0] ? meses[0] : meses[meses.length - 1];
  }
  // Filtros persistentes en DB.datos.ui.filtros.calendario (vista, mes visible, ola, estado, alcance de la lista)
  function estadoUI() {
    var f = DB.datos.ui.filtros.calendario;
    if (!f || typeof f !== 'object' || Array.isArray(f)) { f = { vista: 'mes', mes: '', ola: '', estado: '', alcance: 'mes' }; DB.datos.ui.filtros.calendario = f; }
    if (f.vista !== 'lista') f.vista = 'mes';
    if (f.alcance !== 'todo') f.alcance = 'mes';
    var meses = mesesDelCalendario();
    if (meses.indexOf(f.mes) < 0) f.mes = mesMasCercano(meses, U.mesDe(U.hoyISO()));
    return f;
  }

  /* =========================== Datos reales por día =========================== */
  // Ventas que cuentan (pagado o entregado, no B2B) por fecha de cierre o fecha, e interacciones por día
  function datosReales() {
    var ventas = {}, enviados = {};
    DB.tabla('ventas').forEach(function (v) {
      if (ESTADOS_VENTA_REAL.indexOf(v.estado) < 0 || v.derivarB2B) return;
      var f = U.isoDe(v.fechaCierre) || U.isoDe(v.fecha); if (!f) return;
      (ventas[f] = ventas[f] || []).push(v);
    });
    DB.tabla('interacciones').forEach(function (i) {
      var f = U.isoDe(String(i.fecha || '').slice(0, 10)); if (!f) return;
      (enviados[f] = enviados[f] || []).push(i);
    });
    return { ventas: ventas, enviados: enviados };
  }
  function ventaDe(reales, fecha) { return (reales.ventas[fecha] || []).reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0); }
  function enviadosDe(reales, fecha) { return (reales.enviados[fecha] || []).length; }
  function contactosDe(dia) { var c = dia.cuotas || {}; return Object.keys(c).reduce(function (s, k) { return s + (Number(c[k]) || 0); }, 0); }
  function diasDelMes(mes) { return DB.tabla('calendario').filter(function (d) { return U.mesDe(d.fecha) === mes; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }); }
  function olaInfo(n) { return cfg().olas.filter(function (o) { return o.n === n; })[0] || null; }
  function nombreOla(n) { var o = olaInfo(n); return o ? o.nombre : 'Ola ' + n; }
  function recortar(txt, n) { txt = String(txt || ''); return txt.length > n ? txt.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : txt; }
  function compacto(n) { n = Number(n) || 0; return n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : U.entero(n); }
  // Día recalculado desde las metas y el plan actual (misma fecha), sin tocar lo guardado
  function diaDelPlan(fecha) { return V.generarCalendario(cfg()).filter(function (d) { return d.fecha === fecha; })[0] || null; }
  function mismasCuotas(a, b) {
    a = a || {}; b = b || {};
    var claves = {}; Object.keys(a).concat(Object.keys(b)).forEach(function (k) { claves[k] = true; });
    return Object.keys(claves).every(function (k) { return (Number(a[k]) || 0) === (Number(b[k]) || 0); });
  }

  /* =========================== Resumen por mes =========================== */
  function resumenMes(mes, reales) {
    var M = cfg().metas; var dias = diasDelMes(mes);
    var r = { mes: mes, dias: dias.length, cumplidos: 0, noCumplidos: 0, pendientes: 0, enCurso: 0, sumaMetas: 0, sumaCuotas: 0, proyeccion: Number(M.proyeccion[mes]) || 0, cuota: Number(M.cuotaOficial[mes]) || 0, venta: 0 };
    dias.forEach(function (d) {
      if (d.estado === 'cumplido') r.cumplidos++; else if (d.estado === 'no_cumplido') r.noCumplidos++; else if (d.estado === 'en_curso') { r.enCurso++; r.pendientes++; } else r.pendientes++;
      r.sumaMetas += Number(d.metaDia) || 0; r.sumaCuotas += Number(d.cuotaDia) || 0;
    });
    Object.keys(reales.ventas).forEach(function (f) { if (U.mesDe(f) === mes) r.venta += ventaDe(reales, f); });
    return r;
  }
  function htmlResumen(f, reales) {
    var meses = mesesDelCalendario();
    return '<div class="cal-resumen" id="cal-resumen">' + meses.map(function (mes) {
      var r = resumenMes(mes, reales);
      var desvio = r.sumaMetas - r.proyeccion;
      return '<div class="cal-mes-card' + (mes === f.mes ? ' activo' : '') + '" role="button" tabindex="0" data-cal="ir-mes" data-valor="' + U.attr(mes) + '" title="Ver ' + U.attr(U.nombreMes(mes)) + '">' +
        '<span class="etiqueta">' + U.esc(U.nombreMes(mes)) + ' · ' + r.dias + ' días</span>' +
        '<div class="cal-mes-dias"><span class="bien"><b>' + r.cumplidos + '</b> cumplidos</span><span class="mal"><b>' + r.noCumplidos + '</b> no cumplidos</span><span class="texto2"><b>' + r.pendientes + '</b> pendientes' + (r.enCurso ? ' (' + r.enCurso + ' en curso)' : '') + '</span></div>' +
        '<div class="cal-mes-fila"><span>Suma de metas diarias</span><span class="num">' + U.esc(U.soles(r.sumaMetas)) + (Math.abs(desvio) > 50 ? ' <small class="' + (desvio < 0 ? 'mal' : 'bien') + '">(' + (desvio > 0 ? '+' : '') + U.esc(U.soles(desvio)) + ')</small>' : '') + '</span></div>' +
        '<div class="cal-mes-fila"><span>Proyección del mes</span><span class="num">' + U.esc(U.soles(r.proyeccion)) + '</span></div>' +
        '<div class="cal-mes-fila"><span>Cuota oficial</span><span class="num">' + U.esc(U.soles(r.cuota)) + '</span></div>' +
        '<div class="cal-mes-fila venta"><span>Venta real acumulada</span><span class="num">' + U.esc(U.soles(r.venta)) + '</span></div>' +
        '<div class="cal-mes-pct">' + U.esc(U.pct(r.cuota ? r.venta / r.cuota : null, 0)) + ' de la cuota · ' + U.esc(U.pct(r.proyeccion ? r.venta / r.proyeccion : null, 0)) + ' de la proyección</div>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* =========================== Gráfica SVG: meta del día vs venta real =========================== */
  function barraRedonda(x, y, w, h, clase) {
    // Barra con la punta superior redondeada (radio 4 máx.) y base recta en la línea cero
    if (h <= 0 || w <= 0) return '';
    var r = Math.min(4, w / 2, h);
    var d = 'M' + x.toFixed(1) + ' ' + (y + h).toFixed(1) + 'V' + (y + r).toFixed(1) + 'Q' + x.toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + r).toFixed(1) + ' ' + y.toFixed(1) + 'H' + (x + w - r).toFixed(1) + 'Q' + (x + w).toFixed(1) + ' ' + y.toFixed(1) + ' ' + (x + w).toFixed(1) + ' ' + (y + r).toFixed(1) + 'V' + (y + h).toFixed(1) + 'Z';
    return '<path class="' + clase + '" d="' + d + '"></path>';
  }
  function svgGrafica(mes, reales, anchoDisponible) {
    var dias = diasDelMes(mes); var hoy = U.hoyISO();
    if (!dias.length) return '<p class="texto3">Sin días de atención en este mes.</p>';
    var W = Math.max(300, Math.floor(anchoDisponible || 640)), H = 130, padI = 6, padD = 6, padS = 18, padB = 18;
    var n = dias.length, ranura = (W - padI - padD) / n;
    var max = 1;
    dias.forEach(function (d) { max = Math.max(max, Number(d.metaDia) || 0, ventaDe(reales, d.fecha)); });
    var alto = H - padS - padB, base = H - padB;
    var escala = alto / max;
    var anchoBarra = Math.max(2, Math.min(12, Math.floor((ranura - 4) / 2)));
    var cadaCuanto = ranura >= 20 ? 1 : ranura >= 12 ? 2 : 5;
    // Etiquetas del eje: una cada "cadaCuanto" barras (espaciado parejo) y la de hoy, sin vecinas que choquen
    var etiquetas = {}; var idxHoy = -1;
    dias.forEach(function (d, i) { if (i % cadaCuanto === 0) etiquetas[i] = true; if (d.fecha === hoy) idxHoy = i; });
    if (idxHoy >= 0 && cadaCuanto > 1) { etiquetas[idxHoy] = true; delete etiquetas[idxHoy - 1]; delete etiquetas[idxHoy + 1]; }
    var h = '<svg class="cal-grafica" id="cal-grafica" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="height:' + H + 'px" role="img" aria-label="Meta del día frente a venta real en ' + U.attr(U.nombreMes(mes)) + '">';
    h += '<text x="' + padI + '" y="11">máx. ' + U.esc(U.soles(max)) + '</text>';
    h += '<line class="eje" x1="' + padI + '" y1="' + padS + '" x2="' + (W - padD) + '" y2="' + padS + '"></line>';
    dias.forEach(function (d, i) {
      var x0 = padI + i * ranura; var meta = Number(d.metaDia) || 0; var venta = ventaDe(reales, d.fecha);
      var xMeta = x0 + (ranura - anchoBarra * 2 - 2) / 2, xReal = xMeta + anchoBarra + 2;
      var hMeta = Math.round(meta * escala), hReal = Math.round(venta * escala);
      var titulo = V.DIAS[d.dow] + ' ' + U.fechaCorta(d.fecha) + ' · meta ' + U.soles(meta) + ' · venta real ' + U.soles(venta) + (d.esCorte ? ' · corte' : '');
      h += '<g class="cal-barra" data-cal="abrir" data-fecha="' + U.attr(d.fecha) + '" tabindex="-1"><title>' + U.esc(titulo) + '</title>';
      h += '<rect class="fondo' + (d.fecha === hoy ? ' hoy-fondo' : '') + '" x="' + x0.toFixed(1) + '" y="' + padS + '" width="' + ranura.toFixed(1) + '" height="' + (alto + padB) + '" fill="transparent"></rect>';
      h += barraRedonda(xMeta, base - hMeta, anchoBarra, hMeta, 'meta').replace('<path ', '<path fill="var(--cal-meta)" ');
      h += barraRedonda(xReal, base - hReal, anchoBarra, hReal, 'real').replace('<path ', '<path fill="var(--cal-real)" ');
      var num = parseInt(String(d.fecha || '').slice(8, 10), 10);
      if (etiquetas[i]) h += '<text x="' + (x0 + ranura / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle"' + (d.fecha === hoy ? ' fill="var(--oro-claro)"' : '') + '>' + num + '</text>';
      h += '</g>';
    });
    h += '<line class="eje" x1="' + padI + '" y1="' + base + '" x2="' + (W - padD) + '" y2="' + base + '"></line>';
    return h + '</svg>';
  }
  function anchoGrafica() {
    var cont = UI.$('cal-grafica-caja'); var w = cont ? cont.clientWidth : 0;
    if (!w) { var p = UI.$('cal-principal'); w = (p ? p.clientWidth : 0) - 38; }
    return w > 0 ? w : 640;
  }
  function htmlGrafica(f, reales) {
    return '<div class="tarjeta cal-grafica-tarjeta"><div class="fila-sup"><h3>Meta del día vs venta real · ' + U.esc(U.nombreMes(f.mes)) + '</h3><span class="cal-leyenda"><span><i class="cal-sw meta"></i>Meta del día</span><span><i class="cal-sw real"></i>Venta real</span></span></div><div id="cal-grafica-caja">' + svgGrafica(f.mes, reales, anchoGrafica()) + '</div></div>';
  }
  function redibujarGrafica() {
    var caja = UI.$('cal-grafica-caja'); if (!caja || UI.$('p-calendario').hidden) return;
    var f = estadoUI(); caja.innerHTML = svgGrafica(f.mes, datosReales(), caja.clientWidth);
  }

  /* =========================== Navegación de meses =========================== */
  function htmlNav(f) {
    var meses = mesesDelCalendario(); var i = meses.indexOf(f.mes);
    return '<div class="cal-nav"><button type="button" class="btn chico" data-cal="mes-ant" aria-label="Mes anterior"' + (i <= 0 ? ' disabled' : '') + '>◀</button>' +
      '<h3 id="cal-mes-titulo">' + U.esc(U.nombreMes(f.mes)) + '</h3>' +
      '<button type="button" class="btn chico" data-cal="mes-sig" aria-label="Mes siguiente"' + (i < 0 || i >= meses.length - 1 ? ' disabled' : '') + '>▶</button>' +
      '<button type="button" class="btn chico" data-cal="hoy">Hoy</button></div>';
  }
  function htmlLeyendaOlas() {
    return '<div class="cal-leyenda-olas">' + cfg().olas.map(function (o) { return '<span class="chip"><span class="cal-punto ola-' + U.attr(o.n) + '"></span>' + U.esc(o.nombre) + ' <small class="texto3">' + U.esc(U.fechaCorta(o.desde).slice(0, 5)) + '–' + U.esc(U.fechaCorta(o.hasta).slice(0, 5)) + '</small></span>'; }).join('') + '</div>';
  }

  /* =========================== Vista mensual =========================== */
  function celdaDia(d, fecha, hoy, reales) {
    var venta = ventaDe(reales, fecha); var contactos = contactosDe(d);
    var clases = 'cal-dia ola-' + U.attr(d.ola) + ' est-' + U.attr(d.estado) + (fecha === hoy ? ' hoy' : '') + (d.esCorte ? ' corte' : '') + (fecha === diaAbierto ? ' seleccionado' : '');
    var hito = String(d.hito || '');
    var h = '<div class="' + clases + '" role="button" tabindex="0" data-cal="abrir" data-fecha="' + U.attr(fecha) + '" title="' + U.attr(V.DIAS[d.dow] + ' ' + U.fechaCorta(fecha) + ' · ' + nombreOla(d.ola) + (hito ? ' · ' + hito : '')) + '">';
    h += '<span class="cal-num"><span>' + parseInt(fecha.slice(8, 10), 10) + '</span>' + (d.esCorte ? '<span class="cal-corte">◆ Corte</span>' : (d.focoEditado || d.cuotasEditadas) ? '<span class="cal-editado" title="Editado a mano">✎</span>' : '') + '</span>';
    h += '<span class="cal-meta" title="Meta del día"><span class="cal-meta-larga">' + U.esc(U.soles(d.metaDia)) + '</span><span class="cal-meta-corta">' + U.esc(compacto(d.metaDia)) + '</span></span>';
    if (hito) h += '<span class="cal-hito" title="' + U.attr(hito) + '">▸ ' + U.esc(recortar(hito, 30)) + '</span>';
    if (venta > 0) h += '<span class="cal-venta" title="Venta real">▲ ' + U.esc(U.soles(venta)) + '</span>';
    h += '<span class="cal-pie"><span class="pill chica est-' + U.attr(d.estado) + '" title="' + U.attr(NOMBRE_ESTADO[d.estado] || d.estado) + '">' + U.esc(NOMBRE_ESTADO[d.estado] || d.estado) + '</span><span class="cal-contactos" title="Contactos del día">' + U.esc(U.entero(contactos)) + '<span class="cal-cont-suf"> cont.</span></span></span>';
    return h + '</div>';
  }
  function htmlGrilla(f, reales, hoy) {
    var mes = f.mes; var anio = parseInt(mes.slice(0, 4), 10), m = parseInt(mes.slice(5, 7), 10);
    var diasEnMes = new Date(anio, m, 0).getDate();
    var porFecha = {}; DB.tabla('calendario').forEach(function (d) { porFecha[d.fecha] = d; });
    var libres = (cfg().empresa.calendario && cfg().empresa.calendario.diasLibres) || [];
    var h = '<div class="tarjeta"><div class="cal-grilla" id="cal-grilla">' + CABECERA_GRILLA.map(function (c, i) { return '<div class="cal-cab' + (i === 6 ? ' dom' : '') + '">' + c + '</div>'; }).join('');
    var desplaza = (U.diaSemana(mes + '-01') + 6) % 7; // columnas vacías antes del día 1 (la grilla empieza en lunes)
    for (var i = 0; i < desplaza; i++) h += '<div class="cal-dia fuera" aria-hidden="true"></div>';
    for (var dia = 1; dia <= diasEnMes; dia++) {
      var fecha = mes + '-' + String(dia).padStart(2, '0'); var d = porFecha[fecha];
      if (d) { h += celdaDia(d, fecha, hoy, reales); continue; }
      var dow = U.diaSemana(fecha); var esLibre = libres.indexOf(fecha) >= 0;
      h += '<div class="cal-dia vacio' + (dow === 0 ? ' dom' : '') + (esLibre ? ' libre' : '') + (fecha === hoy ? ' hoy' : '') + '" aria-label="' + U.attr(U.fechaCorta(fecha) + (dow === 0 ? ' · domingo, sin atención' : esLibre ? ' · feriado' : ' · fuera del calendario')) + '"><span class="cal-num"><span>' + dia + '</span></span>' + (esLibre ? '<span class="cal-libre">Feriado</span>' : dow !== 0 ? '<span class="cal-libre">Sin atención</span>' : '') + '</div>';
    }
    var resto = (desplaza + diasEnMes) % 7; if (resto) for (var k = resto; k < 7; k++) h += '<div class="cal-dia fuera" aria-hidden="true"></div>';
    return h + '</div></div>';
  }

  /* =========================== Vista lista =========================== */
  function diasFiltrados(f) {
    return DB.tabla('calendario').filter(function (d) {
      if (f.alcance !== 'todo' && U.mesDe(d.fecha) !== f.mes) return false;
      if (f.ola && String(d.ola) !== String(f.ola)) return false;
      if (f.estado && d.estado !== f.estado) return false;
      return true;
    }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
  }
  function htmlFiltros(f) {
    return '<div class="tarjeta filtros cal-filtros">' +
      '<select name="alcance" aria-label="Alcance">' + UI.opciones([{ valor: 'mes', texto: 'Mes visible' }, { valor: 'todo', texto: 'Todo el trimestre' }], f.alcance) + '</select>' +
      '<select name="ola" aria-label="Ola">' + UI.opciones(cfg().olas.map(function (o) { return { valor: String(o.n), texto: o.nombre }; }), f.ola, 'Todas las olas') + '</select>' +
      '<select name="estado" aria-label="Estado">' + UI.opciones(ESTADOS, f.estado, 'Todos los estados') + '</select></div>';
  }
  function htmlLista(f, reales, hoy) {
    var dias = diasFiltrados(f); var tMeta = 0, tVenta = 0, tEnv = 0;
    var h = '<div class="tarjeta sin-padding"><div class="tabla-scroll"><table class="tabla cal-lista"><thead><tr><th>Fecha</th><th>Ola</th><th>Foco</th><th>Hito</th><th class="num">Meta del día</th><th class="num">Venta real</th><th class="num">Enviados</th><th>Estado</th></tr></thead><tbody>';
    if (!dias.length) h += '<tr><td colspan="8" class="vacio">Sin días con estos filtros.</td></tr>';
    dias.forEach(function (d) {
      var venta = ventaDe(reales, d.fecha), env = enviadosDe(reales, d.fecha); tMeta += Number(d.metaDia) || 0; tVenta += venta; tEnv += env;
      h += '<tr data-fecha="' + U.attr(d.fecha) + '"' + (d.fecha === hoy ? ' class="hoy"' : '') + '>' +
        '<td data-label="Fecha"><button type="button" class="cal-enlace" data-cal="abrir" data-fecha="' + U.attr(d.fecha) + '">' + U.esc(U.fechaCorta(d.fecha)) + '</button><br><small class="texto3">' + U.esc(V.DIAS[d.dow]) + '</small>' + (d.esCorte ? '<br><span class="pill chica alerta">Corte</span>' : '') + '</td>' +
        '<td data-label="Ola"><span class="cal-punto ola-' + U.attr(d.ola) + '"></span>' + U.esc(d.ola) + '</td>' +
        '<td data-label="Foco" class="celda-larga" title="' + U.attr(d.foco || '') + '">' + U.esc(recortar(d.foco, 110)) + (d.focoEditado ? ' <span class="pill chica" title="Editado a mano; sobrevive al recálculo">editado</span>' : '') + '</td>' +
        '<td data-label="Hito">' + U.esc(d.hito || '—') + (d.periodo ? '<br><small class="texto3">' + U.esc(d.periodo) + '</small>' : '') + '</td>' +
        '<td data-label="Meta del día" class="num">' + U.esc(U.soles(d.metaDia)) + '</td>' +
        '<td data-label="Venta real" class="num' + (venta > 0 ? ' bien' : '') + '">' + U.esc(venta > 0 ? U.soles(venta) : '—') + '</td>' +
        '<td data-label="Enviados" class="num">' + U.esc(env || '—') + '</td>' +
        '<td data-label="Estado"><select class="cal-estado-sel est-' + U.attr(d.estado) + '" data-fecha="' + U.attr(d.fecha) + '" aria-label="Estado del ' + U.attr(U.fechaCorta(d.fecha)) + '">' + UI.opciones(ESTADOS, d.estado) + '</select></td></tr>';
    });
    if (dias.length) h += '<tr class="total"><td data-label="Total" colspan="4">' + dias.length + ' días</td><td data-label="Meta" class="num">' + U.esc(U.soles(tMeta)) + '</td><td data-label="Venta real" class="num">' + U.esc(U.soles(tVenta)) + '</td><td data-label="Enviados" class="num">' + U.esc(U.entero(tEnv)) + '</td><td></td></tr>';
    return h + '</tbody></table></div></div>';
  }
  function redibujarLista() {
    var cont = UI.$('cal-lista'); if (!cont) return;
    cont.innerHTML = htmlLista(estadoUI(), datosReales(), U.hoyISO());
  }

  /* =========================== Render principal =========================== */
  function htmlCabecera(f) {
    var n = DB.tabla('calendario').length; var E = cfg().empresa.calendario || {};
    return '<div class="cabecera-pantalla"><h2>Calendario</h2><p class="sub">Del ' + U.esc(U.fechaCorta(E.desde || '')) + ' al ' + U.esc(U.fechaCorta(E.hasta || '')) + ' · lunes a sábado' + ((E.diasLibres || []).length ? ', sin el ' + (E.diasLibres || []).map(function (x) { return U.fechaCorta(x).slice(0, 5); }).join(', ') : '') + ' · ' + n + ' días de atención</p>' +
      '<div class="acciones"><span class="cal-vistas" role="tablist">' +
      '<button type="button" class="btn chico' + (f.vista === 'mes' ? ' activa' : '') + '" data-cal="vista" data-valor="mes">Mes</button>' +
      '<button type="button" class="btn chico' + (f.vista === 'lista' ? ' activa' : '') + '" data-cal="vista" data-valor="lista">Lista</button></span>' +
      '<button type="button" class="btn" data-accion="recalcular-calendario" title="Vuelve a repartir la meta y la cuota del día desde Ajustes → Metas. Conserva estado, notas y los focos y cuotas editados a mano.">Recalcular desde metas</button>' +
      '<button type="button" class="btn" data-accion="cal-exportar">Exportar CSV</button></div></div>';
  }
  function renderPrincipal() {
    var f = estadoUI(); var reales = datosReales(); var hoy = U.hoyISO();
    var cont = UI.$('cal-principal');
    var h = htmlCabecera(f) + htmlResumen(f, reales) + htmlNav(f);
    if (f.vista === 'lista') h += htmlFiltros(f) + '<div id="cal-lista">' + htmlLista(f, reales, hoy) + '</div>';
    else h += htmlLeyendaOlas() + htmlGrilla(f, reales, hoy);
    h += '<div id="cal-grafica-caja-ext">' + htmlGrafica(f, reales) + '</div>';
    cont.innerHTML = h;
    // La gráfica se dibuja con el ancho real del contenedor ya insertado
    redibujarGrafica();
  }
  function render() {
    var raiz = UI.$('p-calendario');
    if (!UI.$('cal-principal')) raiz.innerHTML = '<div class="cal-layout" id="cal-layout"><div id="cal-principal"></div><aside id="cal-panel" class="cal-panel" hidden aria-label="Edición del día"></aside></div>';
    enlazarUnaVez(raiz);
    renderPrincipal();
    renderPanel(false);
  }

  /* =========================== Panel / modal de edición del día =========================== */
  function htmlFormDia(fecha) {
    var d = R.diaCalendario(fecha); if (!d) return '<p class="texto2">Ese día no está en el calendario de atención.</p>';
    var reales = datosReales(); var ventas = reales.ventas[fecha] || []; var inter = reales.enviados[fecha] || [];
    var venta = ventaDe(reales, fecha); var segs = cfg().segmentos; var ola = olaInfo(d.ola);
    function nombreContacto(id) { var c = id ? DB.buscar('contactos', id) : null; return c ? c.nombre : '(sin contacto)'; }
    var h = '<form class="cal-form" id="formCalDia" data-fecha="' + U.attr(fecha) + '" autocomplete="off">' +
      '<div class="cal-form-cab"><h3>' + U.esc(U.fechaLarga(fecha)) + '</h3><div class="cal-chips">' +
      '<span class="chip"><span class="cal-punto ola-' + U.attr(d.ola) + '"></span><b>Ola ' + U.esc(d.ola) + '</b>' + (ola ? ' · ' + U.esc(ola.nombre.replace(/^Ola \d+ · /, '')) : '') + '</span>' +
      (d.esCorte ? '<span class="pill alerta">Corte de control</span>' : '') +
      (d.focoEditado ? '<span class="pill chica" title="Sobrevive al recálculo">foco editado</span>' : '') +
      (d.cuotasEditadas ? '<span class="pill chica" title="Sobreviven al recálculo">cuotas editadas</span>' : '') + '</div></div>';
    h += '<div class="campo"><span class="cal-etq">Foco del día <button type="button" class="btn chico" data-plan="foco" title="Recalcula este día con V.generarCalendario y carga el foco del plan">Volver al valor del plan</button></span><textarea name="foco" rows="4" placeholder="Qué se hace este día">' + U.esc(d.foco || '') + '</textarea></div>';
    h += '<div class="form-grid">' +
      UI.campo('Hito', UI.inp('hito', d.hito, 'placeholder="Evento o fecha clave"')) +
      UI.campo('Periodo', UI.inp('periodo', d.periodo, 'placeholder="Pieza o campaña vigente"')) +
      UI.campo('Meta del día (proyección)', UI.inp('metaDia', d.metaDia, 'type="number" min="0" step="1" inputmode="numeric"')) +
      UI.campo('Cuota oficial del día', UI.inp('cuotaDia', d.cuotaDia, 'type="number" min="0" step="1" inputmode="numeric"')) +
      UI.campo('Estado', '<select name="estado">' + UI.opciones(ESTADOS, d.estado) + '</select>') + '</div>';
    h += '<div class="campo"><span class="cal-etq">Contactos por segmento <button type="button" class="btn chico" data-plan="cuotas" title="Carga las cuotas del plan para este día">Volver al valor del plan</button></span><div class="cal-cuotas">' +
      segs.map(function (s) { return '<label><span>' + U.esc(s.num + ' · ' + s.nombre) + '</span><input name="cuota_' + U.attr(s.codigo) + '" type="number" min="0" step="1" inputmode="numeric" value="' + U.attr(Number((d.cuotas || {})[s.codigo]) || 0) + '"></label>'; }).join('') +
      '</div><div class="cal-cuotas-total">Total del plan para el día: <b id="cal-cuotas-total">' + U.esc(U.entero(contactosDe(d))) + '</b> contactos</div></div>';
    h += '<div class="campo"><span class="cal-etq">Notas</span><textarea name="notas" rows="2" placeholder="Qué pasó, qué quedó pendiente">' + U.esc(d.notas || '') + '</textarea></div>';
    h += '<div class="cal-real"><h4>Lo real del día</h4><div class="kpis">' +
      '<div class="kpi"><span class="lab">Venta real</span><span class="val">' + U.esc(U.soles(venta)) + '</span></div>' +
      '<div class="kpi"><span class="lab">Enviados</span><span class="val">' + U.esc(inter.length) + '</span></div>' +
      '<div class="kpi"><span class="lab">Meta del día</span><span class="val">' + U.esc(U.soles(d.metaDia)) + '</span></div></div>';
    if (ventas.length) h += '<ul class="cal-lista-real">' + ventas.slice(0, 8).map(function (v) { return '<li><b>' + U.esc(U.soles(v.total)) + '</b> · ' + U.esc(nombreContacto(v.contactoId)) + ' · ' + U.esc(v.linea === 'experiencia' ? 'experiencia' : 'botellas') + ' · ' + U.esc(v.estado) + '</li>'; }).join('') + (ventas.length > 8 ? '<li class="texto3">y ' + (ventas.length - 8) + ' más</li>' : '') + '</ul>';
    if (inter.length) h += '<ul class="cal-lista-real">' + inter.slice(0, 8).map(function (i) { return '<li>' + U.esc(String(i.fecha || '').slice(11, 16) || '—') + ' · ' + U.esc(nombreContacto(i.contactoId)) + ' · ' + U.esc(i.canal || '') + (i.toque !== '' && i.toque != null ? ' · toque ' + U.esc(i.toque) : '') + ' · ' + U.esc(i.resultado || '') + '</li>'; }).join('') + (inter.length > 8 ? '<li class="texto3">y ' + (inter.length - 8) + ' más</li>' : '') + '</ul>';
    if (!ventas.length && !inter.length) h += '<p class="texto3">Sin ventas ni mensajes registrados este día.</p>';
    h += '</div><p class="cal-aviso">La meta y la cuota del día editadas a mano se vuelven a repartir al "Recalcular desde metas"; el foco y los contactos por segmento editados sí se conservan.</p>';
    h += '<div class="acciones"><button type="button" class="btn" data-cerrar-dia>Cerrar</button><button type="submit" class="btn primario">Guardar</button></div></form>';
    return h;
  }
  function enlazarFormDia(contenedor, enModal) {
    var form = UI.qs('#formCalDia', contenedor); if (!form) return;
    form.onsubmit = function (ev) { ev.preventDefault(); guardarDia(form, enModal); };
    UI.qsa('[data-plan]', form).forEach(function (b) { b.onclick = function () { cargarPlan(form, b.getAttribute('data-plan')); }; });
    var cerrar = UI.qs('[data-cerrar-dia]', form); if (cerrar) cerrar.onclick = function () { if (enModal) UI.cerrarModal(); else cerrarPanel(); };
    form.addEventListener('input', function (ev) {
      if (/^cuota_/.test(ev.target.name || '')) { var t = 0; UI.qsa('[name^="cuota_"]', form).forEach(function (i) { t += Math.max(0, Math.round(Number(i.value) || 0)); }); var tot = UI.qs('#cal-cuotas-total', form); if (tot) tot.textContent = U.entero(t); }
    });
  }
  function cargarPlan(form, que) {
    var plan = diaDelPlan(form.getAttribute('data-fecha'));
    if (!plan) { UI.toast('No se pudo recalcular ese día desde el plan', 'alerta'); return; }
    if (que === 'foco') { form.elements.foco.value = plan.foco || ''; form.elements.foco.focus(); UI.toast('Foco del plan cargado · pulse Guardar para aplicarlo'); }
    else {
      cfg().segmentos.forEach(function (s) { var el = form.elements['cuota_' + s.codigo]; if (el) el.value = Number((plan.cuotas || {})[s.codigo]) || 0; });
      var tot = UI.qs('#cal-cuotas-total', form); if (tot) tot.textContent = U.entero(contactosDe(plan));
      UI.toast('Cuotas del plan cargadas · pulse Guardar para aplicarlas');
    }
  }
  function guardarDia(form, enModal) {
    var fecha = form.getAttribute('data-fecha'); var d = R.diaCalendario(fecha);
    if (!d) { UI.toast('Ese día ya no existe en el calendario', 'alerta'); return; }
    var v = UI.leerForm(form);
    var meta = Number(v.metaDia), cuota = Number(v.cuotaDia);
    if (v.metaDia === '' || isNaN(meta) || meta < 0 || v.cuotaDia === '' || isNaN(cuota) || cuota < 0) { UI.toast('Escriba montos válidos (0 o más) en meta y cuota del día', 'alerta'); return; }
    var nuevo = U.clonar(d);
    nuevo.foco = String(v.foco || '').trim(); nuevo.hito = String(v.hito || '').trim(); nuevo.periodo = String(v.periodo || '').trim(); nuevo.notas = String(v.notas || '').trim();
    nuevo.metaDia = Math.round(meta); nuevo.cuotaDia = Math.round(cuota);
    nuevo.estado = NOMBRE_ESTADO[v.estado] ? v.estado : (d.estado || 'pendiente');
    var cuotas = U.clonar(d.cuotas || {});
    cfg().segmentos.forEach(function (s) { var n = Number(v['cuota_' + s.codigo]); cuotas[s.codigo] = isNaN(n) || n < 0 ? 0 : Math.round(n); });
    nuevo.cuotas = cuotas;
    var plan = diaDelPlan(fecha);
    // "Editado" significa distinto del plan: así sobrevive al recálculo solo lo que de verdad cambió
    nuevo.focoEditado = plan ? nuevo.foco !== String(plan.foco || '').trim() : (nuevo.foco !== String(d.foco || '').trim() || !!d.focoEditado);
    nuevo.cuotasEditadas = plan ? !mismasCuotas(nuevo.cuotas, plan.cuotas) : (!mismasCuotas(nuevo.cuotas, d.cuotas) || !!d.cuotasEditadas);
    DB.upsert('calendario', nuevo);
    UI.toast('Día guardado · ' + U.fechaCorta(fecha));
    if (enModal) { UI.cerrarModal(); diaAbierto = ''; render(); }
    else { renderPrincipal(); renderPanel(true); }
  }
  function abrirDia(fecha) {
    if (!R.diaCalendario(fecha)) return;
    diaAbierto = fecha;
    if (esMovil()) {
      UI.abrirModal(htmlFormDia(fecha), { ancho: 'ancho', sinFoco: true });
      enlazarFormDia(UI.$('modalContenido'), true);
    } else {
      renderPanel(true);
      marcarSeleccion();
    }
  }
  function cerrarPanel() {
    diaAbierto = '';
    var panel = UI.$('cal-panel'); if (panel) { panel.hidden = true; panel.innerHTML = ''; }
    var layout = UI.$('cal-layout'); if (layout) layout.classList.remove('con-panel');
    marcarSeleccion();
    redibujarGrafica();
  }
  // Redibuja el panel lateral; si el usuario está escribiendo dentro y no se fuerza, lo deja como está
  function renderPanel(forzar) {
    var panel = UI.$('cal-panel'), layout = UI.$('cal-layout'); if (!panel || !layout) return;
    if (!diaAbierto || esMovil() || !R.diaCalendario(diaAbierto)) {
      if (!esMovil() || !diaAbierto) diaAbierto = esMovil() ? diaAbierto : '';
      panel.hidden = true; panel.innerHTML = ''; layout.classList.remove('con-panel'); return;
    }
    if (!forzar && panel.contains(document.activeElement) && document.activeElement !== document.body) return;
    panel.innerHTML = htmlFormDia(diaAbierto); panel.hidden = false;
    var abiertoAntes = layout.classList.contains('con-panel');
    layout.classList.add('con-panel');
    enlazarFormDia(panel, false);
    if (!abiertoAntes) redibujarGrafica();
  }
  function marcarSeleccion() {
    UI.qsa('.cal-dia[data-fecha]', UI.$('p-calendario')).forEach(function (c) { c.classList.toggle('seleccionado', c.getAttribute('data-fecha') === diaAbierto); });
  }

  /* =========================== Exportar CSV =========================== */
  function exportarCSV() {
    var reales = datosReales(); var segs = cfg().segmentos;
    var filas = DB.tabla('calendario').slice().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; }).map(function (d) {
      var o = { fecha: U.fechaCorta(d.fecha), dia: V.DIAS[d.dow], ola: d.ola, foco: d.foco || '', hito: d.hito || '', periodo: d.periodo || '', metaDia: d.metaDia, cuotaDia: d.cuotaDia };
      segs.forEach(function (s) { o['contactos_' + s.codigo] = Number((d.cuotas || {})[s.codigo]) || 0; });
      o.contactosTotal = contactosDe(d); o.estado = d.estado; o.notas = d.notas || ''; o.esCorte = d.esCorte ? 'sí' : '';
      o.focoEditado = d.focoEditado ? 'sí' : ''; o.cuotasEditadas = d.cuotasEditadas ? 'sí' : '';
      o.ventaReal = ventaDe(reales, d.fecha); o.enviados = enviadosDe(reales, d.fecha);
      return o;
    });
    if (!filas.length) { UI.toast('No hay días que exportar', 'alerta'); return; }
    U.descargar('calendario-' + U.hoyISO() + '.csv', U.aCSV(filas, Object.keys(filas[0])), 'text/csv;charset=utf-8');
    UI.toast('CSV del calendario descargado');
  }

  /* =========================== Eventos (delegación en la sección) =========================== */
  function cambiarMes(delta) {
    var f = estadoUI(); var meses = mesesDelCalendario(); var i = meses.indexOf(f.mes) + delta;
    if (i < 0 || i >= meses.length) return;
    f.mes = meses[i]; DB.guardarPronto(); renderPrincipal();
  }
  function irAHoy() {
    var f = estadoUI(); var hoy = U.hoyISO();
    f.mes = mesMasCercano(mesesDelCalendario(), U.mesDe(hoy)); DB.guardarPronto(); renderPrincipal();
    var celda = UI.qs('.cal-dia.hoy[data-fecha]', UI.$('p-calendario'));
    if (celda && celda.scrollIntoView) celda.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (!celda && !R.diaCalendario(hoy)) UI.toast('Hoy no es un día de atención del calendario');
  }
  function alClic(ev) {
    var recalc = ev.target.closest('[data-accion="recalcular-calendario"]');
    if (recalc) { setTimeout(render, 0); return; } // el núcleo recalcula en su propio manejador; aquí solo se redibuja después
    var el = ev.target.closest('[data-cal]'); if (!el) return;
    var que = el.getAttribute('data-cal'); var f = estadoUI();
    switch (que) {
      case 'vista': f.vista = el.getAttribute('data-valor') === 'lista' ? 'lista' : 'mes'; DB.guardarPronto(); renderPrincipal(); break;
      case 'mes-ant': cambiarMes(-1); break;
      case 'mes-sig': cambiarMes(1); break;
      case 'hoy': irAHoy(); break;
      case 'ir-mes': f.mes = mesMasCercano(mesesDelCalendario(), el.getAttribute('data-valor')); DB.guardarPronto(); renderPrincipal(); break;
      case 'abrir': abrirDia(el.getAttribute('data-fecha')); break;
    }
  }
  function alTecla(ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el = ev.target.closest('[role="button"][data-cal]'); if (!el || el.tagName === 'BUTTON') return;
    ev.preventDefault(); alClic({ target: el });
  }
  function alCambio(ev) {
    var el = ev.target;
    if (el.closest('.cal-filtros') && el.name) { var f = estadoUI(); f[el.name] = el.value; DB.guardarPronto(); redibujarLista(); return; }
    if (el.classList.contains('cal-estado-sel')) {
      var d = R.diaCalendario(el.getAttribute('data-fecha')); if (!d || !NOMBRE_ESTADO[el.value]) return;
      d.estado = el.value; DB.upsert('calendario', d);
      el.className = 'cal-estado-sel est-' + el.value;
      var res = UI.$('cal-resumen'); if (res) res.outerHTML = htmlResumen(estadoUI(), datosReales());
      if (diaAbierto === d.fecha) renderPanel(true);
      UI.toast('Estado guardado · ' + U.fechaCorta(d.fecha));
    }
  }
  function enlazarUnaVez(raiz) {
    if (raiz.getAttribute('data-cal-enlazado')) return;
    raiz.setAttribute('data-cal-enlazado', '1');
    raiz.addEventListener('click', alClic);
    raiz.addEventListener('keydown', alTecla);
    raiz.addEventListener('change', alCambio);
    window.addEventListener('resize', function () {
      clearTimeout(timerResize);
      timerResize = setTimeout(function () {
        if (UI.$('p-calendario').hidden || !UI.$('cal-principal')) return;
        if (esMovil() && diaAbierto && UI.$('modal').hidden) { diaAbierto = ''; renderPanel(true); marcarSeleccion(); }
        redibujarGrafica();
      }, 150);
    });
  }

  V.registrarPantalla('calendario', render);
  V.registrarAccion('cal-exportar', exportarCSV);
})();
