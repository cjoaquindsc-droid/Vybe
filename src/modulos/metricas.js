/* ============================================================================
   metricas.js · Pantalla MÉTRICAS (parte 5) · Bodegas Viñas de Oro / The Pisco Room
   Tasas reales por segmento contra el plan, tickets, venta por código de origen,
   gancho y ola, ranking de embajadores, embudo del periodo y cortes de control
   con alerta de ritmo. Expone V.metricas.alertaCorte() para HOY y el reporte.
   Gráficas en HTML/SVG sin librerías; colores validados sobre el fondo oscuro:
   real #b38e22 (dorado), plan #4f8ad0 (azul).
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, DB = V.DB, cfg = V.cfg;
  var estado = { enlazado: false };

  /* =========================== Periodo =========================== */
  function filtros() {
    var f = DB.datos.ui.filtros.metricas;
    if (!f || typeof f !== 'object') { f = { tipo: 'trimestre', mes: U.hoyISO().slice(0, 7), semana: lunesDe(U.hoyISO()), ola: R.olaDe(U.hoyISO()) }; DB.datos.ui.filtros.metricas = f; }
    return f;
  }
  function lunesDe(iso) { var d = U.diaSemana(iso); return U.sumarDias(iso, d === 0 ? -6 : 1 - d); }
  function periodoPlan() { var p = cfg().empresa.periodo || {}; return { desde: p.desde || '2026-10-01', hasta: p.hasta || '2026-12-31' }; }
  function rango() {
    var f = filtros(); var P = periodoPlan();
    if (f.tipo === 'mes') { var m = /^\d{4}-\d{2}$/.test(f.mes) ? f.mes : U.hoyISO().slice(0, 7); var ini = m + '-01'; return { desde: ini, hasta: U.sumarDias(U.sumarDias(ini, 32).slice(0, 7) + '-01', -1), nombre: U.nombreMes(m) }; }
    if (f.tipo === 'semana') { var l = U.isoDe(f.semana) || lunesDe(U.hoyISO()); return { desde: l, hasta: U.sumarDias(l, 5), nombre: 'semana del ' + U.fechaCorta(l) + ' al ' + U.fechaCorta(U.sumarDias(l, 5)) }; }
    if (f.tipo === 'ola') { var o = cfg().olas.filter(function (x) { return x.n === Number(f.ola); })[0] || cfg().olas[0]; return { desde: o.desde, hasta: o.hasta, nombre: o.nombre }; }
    return { desde: P.desde, hasta: P.hasta, nombre: 'trimestre (' + U.fechaCorta(P.desde) + ' al ' + U.fechaCorta(P.hasta) + ')' };
  }
  function en(fecha, r) { fecha = U.isoDe(fecha); return !!fecha && fecha >= r.desde && fecha <= r.hasta; }
  function fechaVenta(v) { return U.isoDe(v.fechaCierre) || U.isoDe(v.fecha) || ''; }
  function cuenta(v) { return ['pagado', 'entregado'].indexOf(v.estado) >= 0 && !v.derivarB2B; }

  /* =========================== Cálculos =========================== */
  function datos(r) {
    r = r || rango(); var porId = {}; DB.tabla('contactos').forEach(function (c) { porId[c.id] = c; });
    var inter = DB.tabla('interacciones').filter(function (i) { return en(String(i.fecha || '').slice(0, 10), r); });
    var ventas = DB.tabla('ventas').filter(function (v) { return cuenta(v) && en(fechaVenta(v), r); });
    var oportunidades = DB.tabla('ventas').filter(function (v) { return v.estado !== 'perdido' && en(fechaVenta(v), r); });
    var cont = {}, resp = {}, comp = {}, prop = {};
    var hayToque1 = inter.some(function (i) { return String(i.toque) === '1'; });
    inter.forEach(function (i) { if (!i.contactoId) return; if (String(i.toque) === '1' || (!hayToque1 && i.resultado === 'enviado')) cont[i.contactoId] = 1; if (i.resultado === 'respondio' || i.resultado === 'compro') resp[i.contactoId] = 1; });
    ventas.forEach(function (v) { if (v.contactoId) { comp[v.contactoId] = 1; cont[v.contactoId] = cont[v.contactoId] || 1; } });
    oportunidades.forEach(function (v) { if (v.contactoId) prop[v.contactoId] = 1; });
    Object.keys(cont).forEach(function (id) { var c = porId[id]; if (c && V.ORDEN_ETAPAS.indexOf(c.etapa) >= V.ORDEN_ETAPAS.indexOf('proponer')) prop[id] = 1; });
    var porSeg = {};
    cfg().segmentos.forEach(function (s) { porSeg[s.codigo] = { segmento: s, contactados: 0, respondieron: 0, propuestas: 0, compraron: 0, venta: 0, ventas: 0 }; });
    function seg(id) { var c = porId[id]; var k = c && porSeg[c.segmento] ? c.segmento : null; return k; }
    Object.keys(cont).forEach(function (id) { var k = seg(id); if (k) { porSeg[k].contactados++; if (resp[id]) porSeg[k].respondieron++; if (prop[id]) porSeg[k].propuestas++; if (comp[id]) porSeg[k].compraron++; } });
    ventas.forEach(function (v) { var k = (v.contactoId && seg(v.contactoId)) || (porSeg[v.segmento] ? v.segmento : null); if (k) { porSeg[k].venta += Number(v.total) || 0; porSeg[k].ventas++; } });
    var tot = { contactados: Object.keys(cont).length, respondieron: Object.keys(resp).filter(function (id) { return cont[id]; }).length, propuestas: Object.keys(prop).filter(function (id) { return cont[id]; }).length, compraron: Object.keys(comp).length, venta: ventas.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0), ventas: ventas.length };
    var bot = ventas.filter(function (v) { return v.linea !== 'experiencia'; }), exp = ventas.filter(function (v) { return v.linea === 'experiencia'; });
    function suma(l) { return l.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0); }
    function agrupar(lista, clave) { var m = {}; lista.forEach(function (v) { var k = clave(v) || '(sin dato)'; if (!m[k]) m[k] = { clave: k, n: 0, total: 0 }; m[k].n++; m[k].total += Number(v.total) || 0; }); return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.total - a.total; }); }
    return {
      rango: r, porSeg: porSeg, tot: tot, ventas: ventas, inter: inter,
      ticket: { general: ventas.length ? tot.venta / ventas.length : 0, botellas: bot.length ? suma(bot) / bot.length : 0, experiencia: exp.length ? suma(exp) / exp.length : 0, vBot: suma(bot), vExp: suma(exp) },
      porCodigo: agrupar(ventas, function (v) { return String(v.codigoOrigen || '').trim().toUpperCase(); }),
      porGancho: agrupar(ventas, function (v) { var g = cfg().ganchos.filter(function (x) { return x.id === v.gancho; })[0]; return g ? g.nombre : (v.gancho || ''); }),
      porOla: agrupar(ventas, function (v) { return 'Ola ' + R.olaDe(fechaVenta(v)); })
    };
  }
  function ranking() {
    if (V.modulos && V.modulos.ventas && V.modulos.ventas.rankingEmbajadores) return V.modulos.ventas.rankingEmbajadores().map(function (x) { return { nombre: x.e.nombre, codigo: x.e.codigo, ciudad: x.e.ciudad, n: x.n, vendido: x.vendido, comision: x.comision }; });
    var P = periodoPlan(); var ventas = DB.tabla('ventas').filter(function (v) { return cuenta(v) && en(fechaVenta(v), P); });
    return DB.tabla('embajadores').map(function (e) { var vs = ventas.filter(function (v) { return v.embajadorId === e.id || (e.codigo && String(v.codigoOrigen || '').toUpperCase() === String(e.codigo).toUpperCase()); }); var t = vs.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0); return { nombre: e.nombre, codigo: e.codigo, ciudad: e.ciudad, n: vs.length, vendido: t, comision: Math.round(t * (cfg().reglas.comisionBase || 0.1) * 100) / 100 }; }).sort(function (a, b) { return b.vendido - a.vendido; });
  }
  function cortes() {
    var hoy = U.hoyISO(); var cal = DB.tabla('calendario'); var P = periodoPlan();
    var todas = DB.tabla('ventas').filter(function (v) { return cuenta(v) && en(fechaVenta(v), P); });
    return cfg().cortes.map(function (c) {
      var meta = cal.filter(function (d) { return d.fecha <= c.fecha; }).reduce(function (s, d) { return s + (Number(d.metaDia) || 0); }, 0);
      var cuota = cal.filter(function (d) { return d.fecha <= c.fecha; }).reduce(function (s, d) { return s + (Number(d.cuotaDia) || 0); }, 0);
      var real = todas.filter(function (v) { return fechaVenta(v) <= c.fecha; }).reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0);
      var estadoC = c.fecha > hoy ? 'pendiente' : real >= cuota ? 'cumplido' : 'no_cumplido';
      return { fecha: c.fecha, nombre: c.nombre, meta: meta, cuota: cuota, real: real, brecha: real - meta, estado: estadoC };
    });
  }
  function alertaCorte() {
    var hoy = U.hoyISO(); var cal = DB.tabla('calendario'); var P = periodoPlan(); var M = cfg().metas;
    var proximo = cfg().cortes.filter(function (c) { return c.fecha >= hoy; })[0] || cfg().cortes[cfg().cortes.length - 1]; if (!proximo) return null;
    var todas = DB.tabla('ventas').filter(function (v) { return cuenta(v) && en(fechaVenta(v), P); });
    var acum = todas.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0);
    var transcurridos = cal.filter(function (d) { return d.fecha <= hoy; }), restantes = cal.filter(function (d) { return d.fecha > hoy; });
    var metaHoy = transcurridos.reduce(function (s, d) { return s + (Number(d.metaDia) || 0); }, 0), cuotaHoy = transcurridos.reduce(function (s, d) { return s + (Number(d.cuotaDia) || 0); }, 0);
    var metaTotal = Number(M.total) || Object.keys(M.proyeccion || {}).reduce(function (s, k) { return s + (Number(M.proyeccion[k]) || 0); }, 0);
    var ritmoActual = transcurridos.length ? acum / transcurridos.length : 0;
    var ritmoRequerido = restantes.length ? Math.max(0, metaTotal - acum) / restantes.length : 0;
    var d = datos({ desde: P.desde, hasta: P.hasta });
    var ticket = d.ticket.general || 215; var tasa = d.tot.contactados ? Math.max(0.01, d.tot.compraron / d.tot.contactados) : 0.05;
    var contactosReq = Math.ceil(ritmoRequerido / (ticket * tasa)); var contactosAct = transcurridos.length ? Math.round(d.tot.contactados / transcurridos.length) : 0;
    var brecha = acum - metaHoy; var nivel = brecha < 0 ? (acum < cuotaHoy ? 'alerta' : 'aviso') : 'ok';
    var texto = (brecha < 0 ? 'Vas ' + U.soles(-brecha) + ' por debajo de la meta acumulada a hoy (' + U.soles(metaHoy) + ').' : 'Vas ' + U.soles(brecha) + ' por encima de la meta acumulada a hoy.') + ' Próximo corte: ' + U.fechaCorta(proximo.fecha) + ' (' + proximo.nombre + '). Ritmo actual ' + U.soles(ritmoActual) + '/día; para cerrar el trimestre hacen falta ' + U.soles(ritmoRequerido) + '/día, unos ' + U.entero(contactosReq) + ' contactos nuevos por día' + (contactosAct ? ' (hoy promedias ' + U.entero(contactosAct) + ')' : '') + '.';
    return { corte: proximo.nombre, fecha: proximo.fecha, acumulado: acum, metaALaFecha: metaHoy, cuotaALaFecha: cuotaHoy, brecha: brecha, ritmoActual: ritmoActual, ritmoRequerido: ritmoRequerido, ticket: ticket, tasaCompra: tasa, contactosDiaRequeridos: contactosReq, contactosDiaActuales: contactosAct, diasRestantes: restantes.length, nivel: nivel, texto: texto };
  }

  /* =========================== Gráficas (HTML) =========================== */
  function barra(valor, max, cls) { var p = max > 0 ? Math.min(100, valor / max * 100) : 0; return '<span class="met-barra"><i class="' + cls + '" style="width:' + p.toFixed(1) + '%"></i></span>'; }
  function tasa(n, d) { return d ? n / d : null; }
  function deltaCls(real, plan) { if (real == null || plan == null) return ''; if (real >= plan) return 'bien'; if (real < plan * 0.7) return 'mal'; return 'aviso'; }

  /* =========================== Render =========================== */
  function render() {
    enlazar();
    var f = filtros(); var r = rango(); var d = datos(r); var T = cfg().tasasPlan; var al = alertaCorte(); var cs = cortes(); var rk = ranking();
    var meses = Object.keys(cfg().metas.proyeccion || {}).sort();
    var h = '<div class="cabecera-pantalla"><h2>Métricas</h2><p class="sub">' + U.esc(r.nombre) + '</p><div class="acciones"><button type="button" class="btn chico" data-met="csv-tasas">Exportar tasas CSV</button><button type="button" class="btn chico" data-met="csv-codigos">Exportar códigos CSV</button></div>' +
      '<nav class="subnav met-periodo">' + [['trimestre', 'Trimestre'], ['mes', 'Mes'], ['semana', 'Semana'], ['ola', 'Ola']].map(function (x) { return '<button type="button" class="btn chico' + (f.tipo === x[0] ? ' activa' : '') + '" data-met="tipo" data-v="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
      (f.tipo === 'mes' ? '<select data-met="mes">' + UI.opciones(meses.map(function (m) { return { valor: m, texto: U.nombreMes(m) }; }), f.mes) + '</select>' : '') +
      (f.tipo === 'semana' ? '<button type="button" class="btn chico" data-met="semana" data-v="-7">◀</button><span class="texto2">' + U.esc(U.fechaCorta(r.desde)) + ' – ' + U.esc(U.fechaCorta(r.hasta)) + '</span><button type="button" class="btn chico" data-met="semana" data-v="7">▶</button>' : '') +
      (f.tipo === 'ola' ? '<select data-met="ola">' + UI.opciones(cfg().olas.map(function (o) { return { valor: String(o.n), texto: o.nombre }; }), String(f.ola)) + '</select>' : '') + '</nav></div>';
    // Alerta de corte
    if (al) h += '<div class="tarjeta met-alerta ' + al.nivel + '"><div class="fila-sup"><span class="etiqueta">Corte de control</span><span class="pill' + (al.nivel === 'ok' ? ' ok' : ' alerta') + '">' + (al.nivel === 'ok' ? 'En meta' : al.nivel === 'aviso' ? 'Bajo la proyección' : 'Bajo la cuota') + '</span></div><p id="metAlertaTexto">' + U.esc(al.texto) + '</p><div class="kpis">' +
      kpi('Acumulado a hoy', U.soles(al.acumulado)) + kpi('Meta acumulada a hoy', U.soles(al.metaALaFecha)) + kpi('Cuota acumulada a hoy', U.soles(al.cuotaALaFecha)) + kpi('Ritmo actual', U.soles(al.ritmoActual) + '<small>/día</small>') + kpi('Ritmo requerido', U.soles(al.ritmoRequerido) + '<small>/día</small>', al.ritmoRequerido > al.ritmoActual ? 'mal' : '') + kpi('Contactos/día requeridos', U.entero(al.contactosDiaRequeridos) + '<small> vs ' + U.entero(al.contactosDiaActuales) + ' hoy</small>') + '</div><p class="texto3">Contactos/día requeridos = ritmo requerido ÷ (ticket promedio ' + U.soles(al.ticket) + ' × tasa de compra ' + U.pct(al.tasaCompra, 1) + '). Días de atención restantes: ' + al.diasRestantes + '.</p></div>';
    // Tasas por segmento
    h += '<div class="tarjeta"><h3>Tasas por segmento vs plan · ' + U.esc(r.nombre) + '</h3><div class="tabla-scroll"><table class="tabla compacta met-tabla" id="metTasas"><thead><tr><th>Segmento</th><th class="num">Contactados</th><th class="num">Respondieron</th><th class="num">Propuestas</th><th class="num">Compraron</th><th>Respuesta real / plan</th><th>Compra real / plan</th><th class="num">Venta</th></tr></thead><tbody>';
    cfg().segmentos.forEach(function (s) {
      var x = d.porSeg[s.codigo]; var p = T[s.codigo] || {}; var tr = tasa(x.respondieron, x.contactados), tc = tasa(x.compraron, x.contactados), tp = tasa(x.propuestas, x.contactados);
      h += '<tr data-seg="' + U.attr(s.codigo) + '"><td data-label="Segmento"><span class="chip seg-' + U.esc(s.codigo) + '">' + U.esc(s.nombre) + '</span></td><td data-label="Contactados" class="num">' + U.entero(x.contactados) + '</td><td data-label="Respondieron" class="num">' + U.entero(x.respondieron) + '</td><td data-label="Propuestas" class="num">' + U.entero(x.propuestas) + (tp != null ? ' <small class="texto3">' + U.pct(tp, 0) + '</small>' : '') + '</td><td data-label="Compraron" class="num">' + U.entero(x.compraron) + '</td>' +
        '<td data-label="Respuesta"><div class="met-comp"><span class="' + deltaCls(tr, p.respuesta) + '">' + (tr == null ? '–' : U.pct(tr, 1)) + '</span>' + barra(tr || 0, 1, 'real') + barra(p.respuesta || 0, 1, 'plan') + '<small class="texto3">plan ' + U.pct(p.respuesta || 0, 0) + '</small></div></td>' +
        '<td data-label="Compra"><div class="met-comp"><span class="' + deltaCls(tc, p.compra) + '">' + (tc == null ? '–' : U.pct(tc, 1)) + '</span>' + barra(tc || 0, 0.25, 'real') + barra(p.compra || 0, 0.25, 'plan') + '<small class="texto3">plan ' + U.pct(p.compra || 0, 1) + '</small></div></td>' +
        '<td data-label="Venta" class="num">' + U.soles(x.venta) + '</td></tr>';
    });
    h += '<tr class="total"><td>Total</td><td class="num">' + U.entero(d.tot.contactados) + '</td><td class="num">' + U.entero(d.tot.respondieron) + '</td><td class="num">' + U.entero(d.tot.propuestas) + '</td><td class="num">' + U.entero(d.tot.compraron) + '</td><td>' + (d.tot.contactados ? U.pct(d.tot.respondieron / d.tot.contactados, 1) : '–') + '</td><td>' + (d.tot.contactados ? U.pct(d.tot.compraron / d.tot.contactados, 1) : '–') + '</td><td class="num">' + U.soles(d.tot.venta) + '</td></tr></tbody></table></div>' +
      '<div class="met-leyenda"><span><i class="real"></i>Real</span><span><i class="plan"></i>Plan</span><span class="texto3">Contactado = recibió el primer toque en el periodo; compra = contactos con venta pagada o entregada (no B2B). Verde: en plan; ámbar: entre 70 % y 100 % del plan; rojo: por debajo del 70 %.</span></div></div>';
    // Embudo
    var emb = [['Contactados', d.tot.contactados], ['Respondieron', d.tot.respondieron], ['Propuestas', d.tot.propuestas], ['Compraron', d.tot.compraron]];
    h += '<div class="grid-2"><div class="tarjeta"><h3>Embudo del periodo</h3><div class="met-embudo">' + emb.map(function (e) { return '<div class="met-emb-fila"><span>' + e[0] + '</span>' + barra(e[1], emb[0][1] || 1, 'real') + '<b>' + U.entero(e[1]) + '</b><small class="texto3">' + (emb[0][1] ? U.pct(e[1] / emb[0][1], 0) : '–') + '</small></div>'; }).join('') + '</div></div>';
    // Tickets y mix
    var totLinea = d.ticket.vBot + d.ticket.vExp;
    h += '<div class="tarjeta"><h3>Ticket promedio y mix</h3><div class="kpis">' + kpi('Ticket general', U.soles(d.ticket.general), '', 'metTicket') + kpi('Ticket botellas', U.soles(d.ticket.botellas)) + kpi('Ticket experiencia', U.soles(d.ticket.experiencia)) + '</div>' +
      '<div class="met-emb-fila"><span>Mix real</span><span class="met-barra"><i class="real" style="width:' + (totLinea ? d.ticket.vBot / totLinea * 100 : 0).toFixed(1) + '%"></i></span><b>' + (totLinea ? U.pct(d.ticket.vBot / totLinea, 0) + ' / ' + U.pct(d.ticket.vExp / totLinea, 0) : '–') + '</b></div><div class="met-emb-fila"><span>Objetivo</span><span class="met-barra"><i class="plan" style="width:' + ((cfg().metas.mix.botellas || 0.6) * 100).toFixed(0) + '%"></i></span><b>' + U.pct(cfg().metas.mix.botellas, 0) + ' / ' + U.pct(cfg().metas.mix.experiencia, 0) + '</b></div><p class="texto3">Botellas / experiencia por venta. Ticket por segmento:</p><div class="tabla-scroll"><table class="tabla compacta"><tbody>' + cfg().segmentos.map(function (s) { var x = d.porSeg[s.codigo]; return x.ventas ? '<tr><td>' + U.esc(s.nombre) + '</td><td class="num">' + U.soles(x.venta / x.ventas) + '</td><td class="num texto3">' + x.ventas + ' ventas</td></tr>' : ''; }).join('') + '</tbody></table></div></div></div>';
    // Códigos, ganchos, olas, embajadores
    function tablaAgrupada(titulo, lista, id) { var max = lista.length ? lista[0].total : 0; return '<div class="tarjeta"><h3>' + titulo + '</h3>' + (lista.length ? '<div class="tabla-scroll"><table class="tabla compacta met-tabla" id="' + id + '"><thead><tr><th>Código</th><th class="num">Ventas</th><th class="num">Total</th><th>Peso</th></tr></thead><tbody>' + lista.map(function (x) { return '<tr data-clave="' + U.attr(x.clave) + '"><td>' + U.esc(x.clave) + '</td><td class="num">' + U.entero(x.n) + '</td><td class="num">' + U.soles(x.total) + '</td><td><div class="met-comp">' + barra(x.total, max, 'real') + '<small>' + (d.tot.venta ? U.pct(x.total / d.tot.venta, 0) : '–') + '</small></div></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="texto3">Sin ventas en el periodo.</p>') + '</div>'; }
    h += '<div class="grid-2">' + tablaAgrupada('Venta por código de origen', d.porCodigo, 'metCodigos') + tablaAgrupada('Venta por gancho aplicado', d.porGancho, 'metGanchos') + tablaAgrupada('Venta por ola', d.porOla, 'metOlas') +
      '<div class="tarjeta met-ancho"><h3>Ranking de embajadores (trimestre)</h3>' + (rk.length ? '<div class="tabla-scroll"><table class="tabla compacta met-tabla" id="metEmbajadores"><thead><tr><th>#</th><th>Embajador</th><th class="num">Ventas</th><th class="num">Vendido</th><th class="num">Comisión</th></tr></thead><tbody>' + rk.map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td>' + U.esc(x.nombre) + ' <code>' + U.esc(x.codigo || '') + '</code><br><small class="texto3">' + U.esc(x.ciudad || '') + '</small></td><td class="num">' + U.entero(x.n) + '</td><td class="num">' + U.soles(x.vendido) + '</td><td class="num">' + U.soles(x.comision) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="texto3">Sin embajadores registrados.</p>') + '</div></div>';
    // Cortes
    h += '<div class="tarjeta"><h3>Cortes de control</h3><div class="tabla-scroll"><table class="tabla compacta met-tabla" id="metCortes"><thead><tr><th>Fecha</th><th>Corte</th><th class="num">Meta acumulada</th><th class="num">Cuota acumulada</th><th class="num">Real acumulado</th><th class="num">Brecha vs meta</th><th>Estado</th></tr></thead><tbody>' + cs.map(function (c) { return '<tr><td data-label="Fecha">' + U.esc(U.fechaCorta(c.fecha)) + '</td><td data-label="Corte">' + U.esc(c.nombre) + '</td><td data-label="Meta" class="num">' + U.soles(c.meta) + '</td><td data-label="Cuota" class="num">' + U.soles(c.cuota) + '</td><td data-label="Real" class="num">' + U.soles(c.real) + '</td><td data-label="Brecha" class="num ' + (c.brecha >= 0 ? 'bien' : 'mal') + '">' + U.soles(c.brecha) + '</td><td data-label="Estado"><span class="pill' + (c.estado === 'cumplido' ? ' ok' : c.estado === 'no_cumplido' ? ' alerta' : '') + '">' + U.esc(c.estado.replace('_', ' ')) + '</span></td></tr>'; }).join('') + '</tbody></table></div><p class="texto3">Meta acumulada = suma de la meta del día (proyección) del calendario hasta la fecha del corte; cuota acumulada, igual con la cuota oficial. Un corte pasado se marca cumplido si el real acumulado alcanza la cuota.</p></div>';
    UI.$('p-metricas').innerHTML = h;
  }
  function kpi(lab, val, cls, id) { return '<div class="kpi' + (cls ? ' ' + cls : '') + '"><span class="lab">' + U.esc(lab) + '</span><span class="val"' + (id ? ' id="' + id + '"' : '') + '>' + val + '</span></div>'; }
  function exportarTasas() {
    var d = datos(); var filas = cfg().segmentos.map(function (s) { var x = d.porSeg[s.codigo]; var p = cfg().tasasPlan[s.codigo] || {}; return { segmento: s.nombre, contactados: x.contactados, respondieron: x.respondieron, propuestas: x.propuestas, compraron: x.compraron, tasaRespuesta: x.contactados ? (x.respondieron / x.contactados * 100).toFixed(1) : '', planRespuesta: ((p.respuesta || 0) * 100).toFixed(1), tasaCompra: x.contactados ? (x.compraron / x.contactados * 100).toFixed(1) : '', planCompra: ((p.compra || 0) * 100).toFixed(1), venta: x.venta.toFixed(2) }; });
    U.descargar('metricas-tasas-' + U.hoyISO() + '.csv', U.aCSV(filas, ['segmento', 'contactados', 'respondieron', 'propuestas', 'compraron', 'tasaRespuesta', 'planRespuesta', 'tasaCompra', 'planCompra', 'venta']), 'text/csv;charset=utf-8');
  }
  function exportarCodigos() { var d = datos(); U.descargar('metricas-codigos-' + U.hoyISO() + '.csv', U.aCSV(d.porCodigo.map(function (x) { return { codigo: x.clave, ventas: x.n, total: x.total.toFixed(2) }; }), ['codigo', 'ventas', 'total']), 'text/csv;charset=utf-8'); }
  function enlazar() {
    if (estado.enlazado) return; estado.enlazado = true; var r = UI.$('p-metricas');
    r.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-met]'); if (!b || b.tagName === 'SELECT') return; var acc = b.getAttribute('data-met'); var f = filtros();
      if (acc === 'tipo') { f.tipo = b.getAttribute('data-v'); DB.guardarPronto(); render(); }
      else if (acc === 'semana') { f.semana = U.sumarDias(U.isoDe(f.semana) || lunesDe(U.hoyISO()), Number(b.getAttribute('data-v'))); DB.guardarPronto(); render(); }
      else if (acc === 'csv-tasas') exportarTasas(); else if (acc === 'csv-codigos') exportarCodigos();
    });
    r.addEventListener('change', function (ev) { var s = ev.target.closest('select[data-met]'); if (!s) return; var f = filtros(); if (s.getAttribute('data-met') === 'mes') f.mes = s.value; else if (s.getAttribute('data-met') === 'ola') f.ola = Number(s.value); DB.guardarPronto(); render(); });
  }
  V.metricas = { alertaCorte: alertaCorte, datos: datos, rango: rango, cortes: cortes, ranking: ranking };
  V.registrarPantalla('metricas', render);
})();
