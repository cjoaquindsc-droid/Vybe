/* ============================================================================
   ventas.js · Pantalla VENTAS (parte 4) · Bodegas Viñas de Oro / The Pisco Room
   Tres pestañas:
     1) Ventas: avance del trimestre contra cuota oficial y proyección, tabla por
        mes con ritmo, mix botellas/experiencia contra el 60/40, tickets,
        oportunidades abiertas, derivadas a B2B y tabla de ventas con filtros.
     2) Calculadora de grupos: paquetes (precio por grupo, salón del Westin
        incluido) o experiencias por persona (con opción Breca 25 %), comparativa,
        "Crear cotización" y "Copiar resumen".
     3) Embajadores: ranking con ventas atribuidas, comisión 10 % / 15 %, pagos
        y saldo; detalle, registro de pagos, alta, edición y baja.
   Las ventas que cuentan son pagadas o entregadas, sin derivar a B2B, por fecha
   de cierre (o de registro) dentro del periodo del plan.
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, DB = V.DB, cfg = V.cfg;

  var PESTANAS = [
    { id: 'ventas', titulo: 'Ventas' },
    { id: 'calculadora', titulo: 'Calculadora de grupos' },
    { id: 'embajadores', titulo: 'Embajadores' }
  ];
  var NOMBRE_ESTADO = { cotizado: 'Cotizado', link_enviado: 'Link enviado', pagado: 'Pagado', entregado: 'Entregado', perdido: 'Perdido' };
  var ESTADOS_VENTA = ['cotizado', 'link_enviado', 'pagado', 'entregado', 'perdido'].map(function (e) { return { valor: e, texto: NOMBRE_ESTADO[e] }; });
  var ESTADOS_EMBAJADOR = [{ valor: 'candidato', texto: 'Candidato' }, { valor: 'activo', texto: 'Activo' }, { valor: 'inactivo', texto: 'Inactivo' }];
  // Prefijo del código de embajador: código de ciudad conocido (CIX-ANA) o las tres primeras letras
  var CODIGOS_CIUDAD = { chiclayo: 'CIX', 'santa cruz': 'SCZ', cusco: 'CUZ', cuzco: 'CUZ', ica: 'ICA', trujillo: 'TRU', arequipa: 'AQP', piura: 'PIU', lima: 'LIM', tacna: 'TCQ', cajamarca: 'CJA', huancayo: 'HUY', iquitos: 'IQT', pucallpa: 'PCL', tarapoto: 'TPP', tumbes: 'TBP', puno: 'JUL', ayacucho: 'AYP' };
  var COLUMNAS_VENTAS_CSV = ['fecha', 'fechaRegistro', 'contacto', 'segmento', 'linea', 'detalle', 'botellas', 'personas', 'total', 'gancho', 'codigoOrigen', 'estado', 'derivarB2B', 'embajador', 'notas'];
  var COLUMNAS_EMB_CSV = ['puesto', 'nombre', 'ciudad', 'codigo', 'estado', 'telefono', 'contacto', 'desde', 'ventas', 'vendido', 'comision', 'pagado', 'saldo'];

  // Estado de la pantalla que no se persiste
  var estado = { enlazado: false, timerTexto: null };

  /* =========================== Utilidades =========================== */
  function raiz() { return UI.$('p-ventas'); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function esObj(o) { return o != null && typeof o === 'object' && !Array.isArray(o); }
  function normCodigo(c) { return U.normTexto(c).toUpperCase().replace(/\s+/g, ''); }
  function periodo() { var p = (cfg().empresa && cfg().empresa.periodo) || {}; return { desde: p.desde || '2026-10-01', hasta: p.hasta || '2026-12-31' }; }
  // Fecha que cuenta para la cuota: cierre (pago) o, si no hay, la de registro
  function fechaEfectiva(v) { return U.isoDe(v.fechaCierre) || U.isoDe(v.fecha) || ''; }
  function cuentaParaCuota(v) { return ['pagado', 'entregado'].indexOf(v.estado) >= 0 && !v.derivarB2B; }
  function enPeriodo(fecha) { var p = periodo(); return !!fecha && fecha >= p.desde && fecha <= p.hasta; }
  function ventasDelTrimestre() { return DB.tabla('ventas').filter(function (v) { return cuentaParaCuota(v) && enPeriodo(fechaEfectiva(v)); }); }
  function mesesPlan() {
    var M = cfg().metas || {}; var m = {};
    Object.keys(M.cuotaOficial || {}).concat(Object.keys(M.proyeccion || {})).forEach(function (k) { if (/^\d{4}-\d{2}$/.test(k)) m[k] = true; });
    return Object.keys(m).sort();
  }
  function sumaTotal(lista) { return r2(lista.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0)); }
  function contactoDe(v) { return v.contactoId ? DB.buscar('contactos', v.contactoId) : null; }
  function nombreContacto(v) { var c = contactoDe(v); return c ? (c.nombre || '') : (v.clienteNombre || ''); }
  function nombreGancho(id) { if (!id) return ''; var g = cfg().ganchos.filter(function (x) { return x.id === id; })[0]; return g ? g.nombre : String(id); }
  function nombreEmbajador(id) { if (!id) return ''; var e = DB.buscar('embajadores', id); return e ? e.nombre : ''; }
  function resumenItems(v) { return (v.items || []).map(function (it) { return (it.nombre || it.productoId || 'ítem') + ' × ' + (Number(it.cantidad) || 0); }).join(', '); }
  function nombreLinea(l) { return l === 'experiencia' ? 'Experiencia' : 'Botellas'; }
  function diasAtencionTranscurridos(mes, hoy) { return DB.tabla('calendario').filter(function (d) { return String(d.fecha || '').slice(0, 7) === mes && d.fecha <= hoy; }).length; }
  function kpi(etiqueta, valor, opciones) {
    opciones = opciones || {};
    return '<div class="kpi' + (opciones.clase ? ' ' + opciones.clase : '') + '"><span class="lab">' + U.esc(etiqueta) + '</span><span class="val' + (opciones.chico ? ' chico' : '') + '"' + (opciones.id ? ' id="' + U.attr(opciones.id) + '"' : '') + '>' + valor + '</span>' + (opciones.sub ? '<span class="ventas-sub">' + opciones.sub + '</span>' : '') + '</div>';
  }
  function pillEstadoVenta(v) {
    var e = v.estado || 'cotizado'; var cls = (e === 'pagado' || e === 'entregado') ? ' ok' : e === 'perdido' ? ' alerta' : '';
    return '<span class="pill' + cls + '">' + U.esc(NOMBRE_ESTADO[e] || e) + '</span>' + (v.derivarB2B ? ' <span class="pill alerta chica" title="Supera el umbral B2C: no suma a la cuota">B2B</span>' : '');
  }
  function pillEmbajador(e) { var cls = e === 'activo' ? ' ok' : e === 'inactivo' ? ' alerta' : ''; return '<span class="pill' + cls + '">' + U.esc(e || 'candidato') + '</span>'; }
  function resolverContacto(texto) {
    var s = String(texto || '').trim(); if (!s) return null;
    var txt = U.normTexto(s.split(' · ')[0]); var dig = s.replace(/\D/g, '');
    return DB.tabla('contactos').filter(function (x) { return (txt && U.normTexto(x.nombre) === txt) || (dig.length >= 9 && U.telefonoDigitos(x.telefono) === dig); })[0] || null;
  }
  function listaContactosHtml(id) { return '<datalist id="' + U.attr(id) + '">' + DB.tabla('contactos').slice(0, 2000).map(function (x) { return '<option value="' + U.attr((x.nombre || '') + (x.telefono ? ' · ' + x.telefono : '')) + '">'; }).join('') + '</datalist>'; }

  /* =========================== Pestañas =========================== */
  function esPestana(t) { return PESTANAS.some(function (p) { return p.id === t; }); }
  function pestanaActual() {
    var ui = DB.datos.ui; var tab = esPestana(ui.ventasTab) ? ui.ventasTab : 'ventas';
    // navegar('ventas', sub) deja la subpestaña en ui.sub; se adopta si es una de las nuestras
    if (esPestana(ui.sub) && ui.sub !== tab) { tab = ui.sub; ui.ventasTab = tab; DB.guardarPronto(); }
    return tab;
  }
  function fijarPestana(t) { if (!esPestana(t)) t = 'ventas'; DB.datos.ui.ventasTab = t; DB.datos.ui.sub = t; DB.guardarPronto(); }
  function cabecera(tab, acciones, subtitulo) {
    return '<div class="cabecera-pantalla"><h2>Ventas</h2>' + (subtitulo ? '<p class="sub">' + subtitulo + '</p>' : '') + (acciones ? '<div class="acciones">' + acciones + '</div>' : '') +
      '<nav class="subnav">' + PESTANAS.map(function (p) { return '<button type="button" class="btn chico' + (p.id === tab ? ' activa' : '') + '" data-vta="pestana" data-tab="' + p.id + '">' + U.esc(p.titulo) + '</button>'; }).join('') + '</nav></div>';
  }

  function render() {
    enlazar();
    var tab = pestanaActual();
    if (tab === 'calculadora') renderCalculadora();
    else if (tab === 'embajadores') renderEmbajadores();
    else renderVentas(false);
  }

  /* =========================== 1) VENTAS =========================== */
  function filtros() {
    var f = DB.datos.ui.filtros.ventas;
    if (!esObj(f)) { f = { mes: '', estado: '', linea: '', segmento: '', codigo: '', texto: '' }; DB.datos.ui.filtros.ventas = f; }
    return f;
  }
  function barraMetas(real, cuota, proy) {
    var max = Math.max(real, cuota, proy, 1);
    function pos(x) { return Math.min(100, x / max * 100); }
    function marca(x, texto, cls) { var p = pos(x); return '<span class="ventas-marca ' + cls + (p > 78 ? ' der' : p < 18 ? ' izq' : '') + '" style="left:' + p.toFixed(2) + '%"><span>' + U.esc(texto) + '</span></span>'; }
    return '<div class="ventas-barra' + (cuota > 0 && real >= cuota ? ' ok' : '') + '"><i style="width:' + pos(real).toFixed(2) + '%"></i>' + (cuota > 0 ? marca(cuota, 'Cuota ' + U.soles(cuota), 'cuota') : '') + (proy > 0 ? marca(proy, 'Proyección ' + U.soles(proy), 'proy') : '') + '</div>';
  }
  function filaMix(etiqueta, pb, pe, vacia) {
    return '<div class="ventas-mix-fila"><span>' + U.esc(etiqueta) + '</span><div class="ventas-mix-barra">' + (vacia ? '' : '<i class="bot" style="width:' + (pb * 100).toFixed(1) + '%"></i><i class="exp" style="width:' + (pe * 100).toFixed(1) + '%"></i>') + '</div><span class="num">' + (vacia ? '—' : U.pct(pb, 0) + ' / ' + U.pct(pe, 0)) + '</span></div>';
  }
  function kpisVentasHtml() {
    var hoy = U.hoyISO(); var M = cfg().metas || {}; var meses = mesesPlan(); var trim = ventasDelTrimestre(); var p = periodo(); var todas = DB.tabla('ventas');
    var real = sumaTotal(trim);
    var cuotaTot = meses.reduce(function (s, m) { return s + (Number((M.cuotaOficial || {})[m]) || 0); }, 0);
    var proyTot = meses.reduce(function (s, m) { return s + (Number((M.proyeccion || {})[m]) || 0); }, 0);
    var bot = trim.filter(function (v) { return v.linea !== 'experiencia'; }), exp = trim.filter(function (v) { return v.linea === 'experiencia'; });
    var vBot = sumaTotal(bot), vExp = sumaTotal(exp), tot = r2(vBot + vExp);
    var mix = M.mix || { botellas: 0.6, experiencia: 0.4 };
    var abiertas = todas.filter(function (v) { return (v.estado === 'cotizado' || v.estado === 'link_enviado') && !v.derivarB2B; });
    var b2b = todas.filter(function (v) { return v.derivarB2B && v.estado !== 'perdido'; });

    var h = '<div class="tarjeta oro"><div class="fila-sup"><span class="etiqueta">Trimestre ' + U.esc(U.fechaCorta(p.desde)) + ' – ' + U.esc(U.fechaCorta(p.hasta)) + '</span></div>' +
      '<div class="kpis">' +
      kpi('Acumulado del trimestre', U.soles(real), { id: 'ventasAcumulado', sub: U.entero(trim.length) + ' ventas que cuentan' }) +
      kpi('Cuota oficial', U.soles(cuotaTot), { sub: 'Avance ' + (cuotaTot ? U.pct(real / cuotaTot, 1) : '–') + ' · faltan ' + U.soles(Math.max(0, cuotaTot - real)), clase: cuotaTot && real >= cuotaTot ? '' : '' }) +
      kpi('Proyección del plan', U.soles(proyTot), { sub: 'Avance ' + (proyTot ? U.pct(real / proyTot, 1) : '–') + ' · faltan ' + U.soles(Math.max(0, proyTot - real)) }) +
      '</div>' + barraMetas(real, cuotaTot, proyTot) +
      '<div class="tabla-scroll"><table class="tabla compacta ventas-tabla ventas-meses"><thead><tr><th>Mes</th><th class="num">Cuota oficial</th><th class="num">Proyección</th><th class="num">Venta real</th><th class="num">% cuota</th><th class="num">% proyección</th><th class="num">Ritmo (S/ por día)</th></tr></thead><tbody>';
    meses.forEach(function (m) {
      var vm = trim.filter(function (v) { return fechaEfectiva(v).slice(0, 7) === m; });
      var realM = sumaTotal(vm), cuotaM = Number((M.cuotaOficial || {})[m]) || 0, proyM = Number((M.proyeccion || {})[m]) || 0;
      var dias = diasAtencionTranscurridos(m, hoy);
      h += '<tr' + (hoy.slice(0, 7) === m ? ' class="ventas-fila-mes-actual"' : '') + ' data-mes="' + U.attr(m) + '"><td data-label="Mes">' + U.esc(U.nombreMes(m)) + '</td><td data-label="Cuota oficial" class="num">' + U.soles(cuotaM) + '</td><td data-label="Proyección" class="num">' + U.soles(proyM) + '</td><td data-label="Venta real" class="num">' + U.soles(realM) + '</td>' +
        '<td data-label="% cuota" class="num' + (cuotaM && realM >= cuotaM ? ' bien' : '') + '">' + (cuotaM ? U.pct(realM / cuotaM, 1) : '–') + '</td><td data-label="% proyección" class="num">' + (proyM ? U.pct(realM / proyM, 1) : '–') + '</td>' +
        '<td data-label="Ritmo" class="num">' + (dias ? U.soles(realM / dias) + '<br><small class="texto3">' + dias + ' día' + (dias === 1 ? '' : 's') + ' de atención</small>' : '<span class="texto3">aún no empieza</span>') + '</td></tr>';
    });
    h += '<tr class="total"><td data-label="Mes">Trimestre</td><td data-label="Cuota oficial" class="num">' + U.soles(cuotaTot) + '</td><td data-label="Proyección" class="num">' + U.soles(proyTot) + '</td><td data-label="Venta real" class="num">' + U.soles(real) + '</td><td data-label="% cuota" class="num">' + (cuotaTot ? U.pct(real / cuotaTot, 1) : '–') + '</td><td data-label="% proyección" class="num">' + (proyTot ? U.pct(real / proyTot, 1) : '–') + '</td><td></td></tr></tbody></table></div>' +
      '<p class="texto3 ventas-nota-regla">Cuentan las ventas pagadas o entregadas, sin las derivadas a B2B, por fecha de cierre (o de registro). Ritmo = venta real ÷ días de atención transcurridos del mes según el calendario.</p></div>';

    h += '<div class="grid-2"><div class="tarjeta"><h3>Mix botellas / experiencia</h3>' +
      '<div class="ventas-mix">' + filaMix('Real', tot ? vBot / tot : 0, tot ? vExp / tot : 0, !tot) + filaMix('Objetivo', Number(mix.botellas) || 0, Number(mix.experiencia) || 0, false) + '</div>' +
      '<div class="ventas-leyenda"><span><i class="bot"></i>Botellas <b id="ventasMixBotellas">' + U.soles(vBot) + '</b>' + (tot ? ' (' + U.pct(vBot / tot, 1) + ')' : '') + '</span><span><i class="exp"></i>Experiencia <b id="ventasMixExperiencia">' + U.soles(vExp) + '</b>' + (tot ? ' (' + U.pct(vExp / tot, 1) + ')' : '') + '</span></div>' +
      '<p class="texto3">Objetivo del plan: ' + U.pct(Number(mix.botellas) || 0, 0) + ' botellas y ' + U.pct(Number(mix.experiencia) || 0, 0) + ' experiencia. Las experiencias de grupo son B2C y sí suman.</p></div>' +
      '<div class="tarjeta"><h3>Ticket y oportunidades</h3><div class="kpis">' +
      kpi('Ticket promedio', U.soles(trim.length ? real / trim.length : 0), { chico: true, sub: U.entero(trim.length) + ' ventas' }) +
      kpi('Ticket botellas', U.soles(bot.length ? vBot / bot.length : 0), { chico: true, sub: U.entero(bot.length) + ' ventas' }) +
      kpi('Ticket experiencia', U.soles(exp.length ? vExp / exp.length : 0), { chico: true, sub: U.entero(exp.length) + ' ventas' }) + '</div><div class="kpis">' +
      kpi('Oportunidades abiertas', U.entero(abiertas.length), { id: 'ventasAbiertas', sub: U.soles(sumaTotal(abiertas)) + ' · cotizado + link enviado' }) +
      kpi('Derivadas a B2B (aparte)', U.entero(b2b.length), { id: 'ventasB2B', sub: U.soles(sumaTotal(b2b)) + ' · no suman a la cuota', clase: b2b.length ? 'mal' : '' }) +
      '</div></div></div>';
    return h;
  }
  function filtrosHtml() {
    var f = filtros(); var todas = DB.tabla('ventas');
    var meses = {}; mesesPlan().forEach(function (m) { meses[m] = true; }); todas.forEach(function (v) { var m = fechaEfectiva(v).slice(0, 7); if (m) meses[m] = true; });
    var codigos = {}; todas.forEach(function (v) { var c = normCodigo(v.codigoOrigen); if (c) codigos[c] = true; });
    return '<div class="tarjeta filtros ventas-filtros"><input type="search" name="texto" placeholder="Buscar contacto, producto, código o nota" value="' + U.attr(f.texto) + '">' +
      '<select name="mes">' + UI.opciones(Object.keys(meses).sort().map(function (m) { return { valor: m, texto: U.nombreMes(m) }; }), f.mes, 'Todos los meses') + '</select>' +
      '<select name="estado">' + UI.opciones(ESTADOS_VENTA.concat([{ valor: 'abiertas', texto: 'Abiertas (cotizado + link)' }, { valor: 'cuenta', texto: 'Cuentan para la cuota' }, { valor: 'b2b', texto: 'Derivadas a B2B' }]), f.estado, 'Todos los estados') + '</select>' +
      '<select name="linea">' + UI.opciones([{ valor: 'botellas', texto: 'Botellas' }, { valor: 'experiencia', texto: 'Experiencia' }], f.linea, 'Todas las líneas') + '</select>' +
      '<select name="segmento">' + UI.opcionesSegmentos(f.segmento, 'Todos los segmentos') + '</select>' +
      '<select name="codigo">' + UI.opciones(Object.keys(codigos).sort(), f.codigo, 'Todos los códigos de origen') + '</select>' +
      '<button type="button" class="btn chico" data-vta="limpiar-filtros">Limpiar</button></div>';
  }
  function ventasFiltradas() {
    var f = filtros(); var t = U.normTexto(f.texto); var cod = normCodigo(f.codigo);
    return DB.tabla('ventas').filter(function (v) {
      var fe = fechaEfectiva(v);
      if (f.mes && fe.slice(0, 7) !== f.mes) return false;
      if (f.estado === 'abiertas') { if (v.estado !== 'cotizado' && v.estado !== 'link_enviado') return false; }
      else if (f.estado === 'cuenta') { if (!cuentaParaCuota(v)) return false; }
      else if (f.estado === 'b2b') { if (!v.derivarB2B) return false; }
      else if (f.estado && v.estado !== f.estado) return false;
      if (f.linea && (v.linea === 'experiencia' ? 'experiencia' : 'botellas') !== f.linea) return false;
      if (f.segmento && v.segmento !== f.segmento) return false;
      if (cod && normCodigo(v.codigoOrigen) !== cod) return false;
      if (t) { var pajar = U.normTexto([nombreContacto(v), v.clienteNombre, v.notas, v.codigoOrigen, v.pedidoId, resumenItems(v)].join(' ')); if (pajar.indexOf(t) < 0) return false; }
      return true;
    }).sort(function (a, b) { var fa = fechaEfectiva(a), fb = fechaEfectiva(b); if (fa !== fb) return fa < fb ? 1 : -1; return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
  }
  function renderVentas(soloTabla) {
    var r = raiz();
    if (!soloTabla || !UI.$('ventasCuerpo')) {
      r.innerHTML = cabecera('ventas', '<button type="button" class="btn primario" data-vta="nueva-venta">Registrar venta</button><button type="button" class="btn" data-vta="exportar-ventas">Exportar CSV</button>', '<span id="ventasConteo"></span>') +
        kpisVentasHtml() + filtrosHtml() +
        '<div class="tarjeta sin-padding"><div class="tabla-scroll"><table class="tabla ventas-tabla" id="ventasTabla"><thead><tr><th>Fecha</th><th>Contacto</th><th>Línea</th><th>Detalle</th><th class="num">Total</th><th>Gancho</th><th>Origen</th><th>Estado</th><th></th></tr></thead><tbody id="ventasCuerpo"></tbody></table></div><p class="texto2 pad" id="ventasNota" hidden></p></div>';
    }
    pintarTablaVentas();
  }
  function pintarTablaVentas() {
    var lista = ventasFiltradas(); var cuerpo = UI.$('ventasCuerpo'); if (!cuerpo) return;
    UI.$('ventasConteo').textContent = U.entero(lista.length) + ' de ' + U.entero(DB.tabla('ventas').length) + ' ventas y oportunidades';
    var h = '';
    if (!lista.length) h = '<tr><td colspan="9" class="vacio">Sin ventas con estos filtros. Registre una venta o cambie los filtros.</td></tr>';
    lista.slice(0, 500).forEach(function (v) {
      var c = contactoDe(v); var nombre = c ? c.nombre : (v.clienteNombre || ''); var fe = fechaEfectiva(v); var fReg = U.isoDe(v.fecha);
      h += '<tr data-id="' + U.attr(v.id) + '"><td data-label="Fecha">' + U.esc(U.fechaCorta(fe) || '—') + (fReg && fReg !== fe ? '<br><small class="texto3">registro ' + U.esc(U.fechaCorta(fReg)) + '</small>' : '') + '</td>' +
        '<td data-label="Contacto"><b>' + U.esc(nombre || '(sin contacto)') + '</b>' + (v.prueba ? ' <span class="pill chica">prueba</span>' : '') + (v.segmento ? '<br><small class="texto3">' + U.esc(R.nombreSegmento(v.segmento)) + '</small>' : '') + '</td>' +
        '<td data-label="Línea">' + U.esc(nombreLinea(v.linea)) + '</td>' +
        '<td data-label="Detalle" class="celda-larga">' + U.esc(resumenItems(v) || '—') + (Number(v.personas) ? '<br><small class="texto3">' + U.esc(v.personas) + ' personas</small>' : '') + '</td>' +
        '<td data-label="Total" class="num">' + U.soles(v.total) + '</td>' +
        '<td data-label="Gancho">' + U.esc(nombreGancho(v.gancho) || '—') + '</td>' +
        '<td data-label="Origen">' + U.esc(v.codigoOrigen || '—') + (v.embajadorId ? '<br><small class="texto3">emb. ' + U.esc(nombreEmbajador(v.embajadorId) || v.embajadorId) + '</small>' : '') + '</td>' +
        '<td data-label="Estado">' + pillEstadoVenta(v) + '</td>' +
        '<td class="acciones-fila"><button type="button" class="btn chico" data-vta="editar-venta" data-id="' + U.attr(v.id) + '">Editar</button>' + (c ? '<button type="button" class="btn chico" data-vta="ficha" data-id="' + U.attr(c.id) + '">Ficha</button>' : '') + '</td></tr>';
    });
    cuerpo.innerHTML = h;
    var nota = UI.$('ventasNota'); nota.hidden = lista.length <= 500; nota.textContent = 'Se muestran las primeras 500. Afine los filtros para ver el resto.';
  }
  function exportarVentas() {
    var filas = ventasFiltradas().map(function (v) {
      return { fecha: fechaEfectiva(v), fechaRegistro: U.isoDe(v.fecha), contacto: nombreContacto(v), segmento: v.segmento ? R.nombreSegmento(v.segmento) : '', linea: nombreLinea(v.linea), detalle: resumenItems(v), botellas: v.botellas, personas: v.personas, total: v.total, gancho: nombreGancho(v.gancho), codigoOrigen: v.codigoOrigen, estado: NOMBRE_ESTADO[v.estado] || v.estado, derivarB2B: v.derivarB2B ? 'Sí' : 'No', embajador: nombreEmbajador(v.embajadorId), notas: v.notas };
    });
    U.descargar('ventas-' + U.hoyISO() + '.csv', U.aCSV(filas, COLUMNAS_VENTAS_CSV), 'text/csv;charset=utf-8');
    UI.toast(U.entero(filas.length) + ' ventas exportadas a CSV');
  }

  /* =========================== 2) CALCULADORA DE GRUPOS =========================== */
  function estadoCalc() {
    var s = DB.datos.ui.ventasCalc;
    if (!esObj(s)) { s = { personas: 30, modo: 'paquete', paquete: (cfg().paquetesGrupo[0] || {}).id || '', experiencia: (cfg().experiencias[0] || {}).id || '', breca: false }; DB.datos.ui.ventasCalc = s; }
    return s;
  }
  function personasCalc(s) { var n = parseInt(s.personas, 10); return n > 0 ? n : 0; }
  function paqueteDe(id) { var l = cfg().paquetesGrupo; return l.filter(function (p) { return p.id === id; })[0] || l[0] || null; }
  function experienciaDe(id) { var l = cfg().experiencias; return l.filter(function (e) { return e.id === id; })[0] || l[0] || null; }
  // Paquete: precio para la base (30) × personas ÷ base, redondeado a S/ 10
  function precioPaquete(p, personas) { var base = Number(p.personasBase) || 30; return Math.round((Number(p.precio30) || 0) * personas / base / 10) * 10; }
  function precioUnitarioExperiencia(e, breca) { var u = Number(e.precio) || 0; if (breca) u = u * (1 - (Number(cfg().reglas.descuentoBrecaExperiencias) || 0)); return r2(u); }
  function precioExperiencia(e, personas, breca) { return r2(precioUnitarioExperiencia(e, breca) * personas); }
  function calculo() {
    var s = estadoCalc(); var n = personasCalc(s);
    var out = { personas: n, modo: s.modo === 'experiencia' ? 'experiencia' : 'paquete', breca: s.modo === 'experiencia' && !!s.breca };
    if (out.modo === 'experiencia') {
      var e = experienciaDe(s.experiencia); out.opcion = e; out.nombre = e ? e.nombre : ''; out.unitario = e ? precioUnitarioExperiencia(e, out.breca) : 0; out.total = e ? precioExperiencia(e, n, out.breca) : 0; out.porConfirmar = false;
      out.nota = e ? U.soles(out.unitario) + ' por persona' + (out.breca ? ' con precio colaborador Breca (25 %)' : '') : '';
    } else {
      var p = paqueteDe(s.paquete); out.opcion = p; out.nombre = p ? 'Paquete ' + p.nombre : ''; out.total = p ? precioPaquete(p, n) : 0; out.unitario = n ? r2(out.total / n) : 0; out.porConfirmar = !!(p && p.estado === 'por_confirmar');
      out.nota = p ? (p.incluye || 'Salón del Westin incluido') : '';
    }
    out.porPersona = n ? r2(out.total / n) : 0; out.fueraRango = n > 0 && (n < 20 || n > 40);
    return out;
  }
  function resultadoCalcHtml() {
    var c = calculo(); var base = c.opcion && c.modo === 'paquete' ? (Number(c.opcion.personasBase) || 30) : 30;
    return '<div class="kpis">' + kpi('Total', U.soles(c.total), { id: 'calcTotal' }) + kpi('Por persona', U.soles(c.porPersona), { id: 'calcPorPersona' }) + kpi('Personas', U.entero(c.personas), { id: 'calcPersonas' }) + '</div>' +
      '<p id="calcDetalle">' + (c.opcion ? '<b>' + U.esc(c.nombre) + '</b> · ' + U.esc(c.nota) + (c.porConfirmar ? ' <span class="pill">por confirmar</span>' : '') : '<span class="texto2">No hay opciones configuradas en Ajustes → Precios.</span>') + '</p>' +
      (c.fueraRango ? '<p class="ventas-aviso" id="calcAviso">Fuera del rango del segmento 5 (grupos de 20 a 40 personas). Se puede cotizar igual; confirme la disponibilidad del salón.</p>' : '') +
      '<p class="texto3">' + (c.modo === 'paquete' ? 'Precio del paquete = precio para ' + base + ' personas × personas ÷ ' + base + ', redondeado a S/ 10. Salón del Westin incluido.' : 'Total = precio por persona × personas' + (c.breca ? ', con 25 % de descuento Breca (solo experiencias)' : '') + '. Sin salón privado: se reserva mesa en la sala.') + '</p>';
  }
  function comparativaHtml() {
    var s = estadoCalc(); var n = personasCalc(s);
    var h = '<div class="tabla-scroll"><table class="tabla compacta ventas-tabla ventas-comparativa"><thead><tr><th>Opción</th><th class="num">Total</th><th class="num">Por persona</th><th class="num">Con 25 % Breca</th><th></th></tr></thead><tbody>';
    cfg().paquetesGrupo.forEach(function (p) {
      var t = precioPaquete(p, n); var sel = s.modo !== 'experiencia' && paqueteDe(s.paquete) === p;
      h += '<tr' + (sel ? ' class="ventas-sel"' : '') + ' data-vta="calc-elegir" data-tipo="paquete" data-id="' + U.attr(p.id) + '"><td data-label="Opción"><b>Paquete ' + U.esc(p.nombre) + '</b><br><small class="texto3">' + U.esc(p.incluye || 'Salón del Westin incluido') + (p.estado === 'por_confirmar' ? ' · por confirmar' : '') + '</small></td><td data-label="Total" class="num">' + U.soles(t) + '</td><td data-label="Por persona" class="num">' + U.soles(n ? t / n : 0) + '</td><td data-label="Con 25 % Breca" class="num texto3">no aplica</td><td class="acciones-fila"><button type="button" class="btn chico">' + (sel ? 'Elegido' : 'Elegir') + '</button></td></tr>';
    });
    cfg().experiencias.forEach(function (e) {
      var t = precioExperiencia(e, n, false), tb = precioExperiencia(e, n, true); var sel = s.modo === 'experiencia' && experienciaDe(s.experiencia) === e;
      h += '<tr' + (sel ? ' class="ventas-sel"' : '') + ' data-vta="calc-elegir" data-tipo="experiencia" data-id="' + U.attr(e.id) + '"><td data-label="Opción"><b>' + U.esc(e.nombre) + '</b><br><small class="texto3">experiencia por persona · ' + U.soles(e.precio) + '</small></td><td data-label="Total" class="num">' + U.soles(t) + '</td><td data-label="Por persona" class="num">' + U.soles(e.precio) + '</td><td data-label="Con 25 % Breca" class="num">' + U.soles(tb) + '</td><td class="acciones-fila"><button type="button" class="btn chico">' + (sel ? 'Elegido' : 'Elegir') + '</button></td></tr>';
    });
    return h + '</tbody></table></div><p class="texto3">Comparativa para ' + U.entero(n) + ' personas. Los paquetes incluyen el salón del Westin y siguen por confirmar; el 25 % Breca aplica solo a experiencias.</p>';
  }
  function renderCalculadora() {
    var s = estadoCalc(); var r = raiz();
    var opPaq = cfg().paquetesGrupo.map(function (p) { return { valor: p.id, texto: p.nombre + ' · ' + U.soles(p.precio30) + ' para ' + (p.personasBase || 30) + (p.estado === 'por_confirmar' ? ' · por confirmar' : '') }; });
    var opExp = cfg().experiencias.map(function (e) { return { valor: e.id, texto: e.nombre + ' · ' + U.soles(e.precio) + ' por persona' }; });
    r.innerHTML = cabecera('calculadora', '', 'Paquetes para grupos (salón del Westin incluido) o experiencias por persona. Los precios salen de Ajustes → Precios.') +
      '<div class="grid-2"><div class="tarjeta oro"><h3>Cotizar un grupo</h3><form id="calcForm" class="form-grid" autocomplete="off">' +
      UI.campo('Número de personas', '<input name="personas" type="number" min="1" step="1" inputmode="numeric" value="' + U.attr(s.personas) + '">', 'Segmento 5: grupos de 20 a 40 personas') +
      UI.campo('Modo', '<select name="modo">' + UI.opciones([{ valor: 'paquete', texto: 'Paquete (precio por grupo)' }, { valor: 'experiencia', texto: 'Experiencia por persona' }], s.modo === 'experiencia' ? 'experiencia' : 'paquete') + '</select>') +
      '<div id="calcCampoPaquete"' + (s.modo === 'experiencia' ? ' hidden' : '') + '>' + UI.campo('Paquete', '<select name="paquete">' + UI.opciones(opPaq, (paqueteDe(s.paquete) || {}).id) + '</select>') + '</div>' +
      '<div id="calcCampoExperiencia"' + (s.modo === 'experiencia' ? '' : ' hidden') + '>' + UI.campo('Experiencia', '<select name="experiencia">' + UI.opciones(opExp, (experienciaDe(s.experiencia) || {}).id) + '</select>') + '</div>' +
      '<div id="calcCampoBreca"' + (s.modo === 'experiencia' ? '' : ' hidden') + '>' + UI.campo('Precio Breca', '<select name="breca">' + UI.opciones([{ valor: 'false', texto: 'No · precio B2C' }, { valor: 'true', texto: 'Sí · 25 % en experiencias' }], String(!!s.breca)) + '</select>') + '</div>' +
      '</form><div id="calcResultado">' + resultadoCalcHtml() + '</div>' +
      '<div class="acciones"><button type="button" class="btn primario" data-vta="calc-cotizar">Crear cotización</button><button type="button" class="btn" data-vta="calc-copiar">Copiar resumen</button></div>' +
      '<p class="texto3">"Crear cotización" abre el formulario de venta con la opción elegida, en estado cotizado. "Copiar resumen" arma el texto para WhatsApp; el envío lo hace usted.</p></div>' +
      '<div class="tarjeta"><h3>Comparativa</h3><div id="calcComparativa">' + comparativaHtml() + '</div></div></div>';
  }
  function actualizarCalc() {
    var s = estadoCalc(); var exp = s.modo === 'experiencia';
    var cp = UI.$('calcCampoPaquete'), ce = UI.$('calcCampoExperiencia'), cb = UI.$('calcCampoBreca');
    if (cp) cp.hidden = exp; if (ce) ce.hidden = !exp; if (cb) cb.hidden = !exp;
    var res = UI.$('calcResultado'); if (res) res.innerHTML = resultadoCalcHtml();
    var comp = UI.$('calcComparativa'); if (comp) comp.innerHTML = comparativaHtml();
  }
  // Venta prellenada (sin id) para el formulario compartido del núcleo
  function ventaDesdeCalculadora() {
    var c = calculo(); if (!c.opcion || !c.personas) return null;
    var hoy = U.hoyISO(); var item;
    if (c.modo === 'paquete') item = { productoId: c.opcion.id, nombre: 'Paquete ' + c.opcion.nombre + ' · ' + c.personas + ' personas', cantidad: 1, precio: c.total, total: c.total, linea: 'experiencia', botellas: 0, porPersona: false, personasBase: c.personas };
    else item = { productoId: c.opcion.id, nombre: c.opcion.nombre + (c.breca ? ' · precio Breca (25 %)' : ''), cantidad: c.personas, precio: c.unitario, total: c.total, linea: 'experiencia', botellas: 0, porPersona: true, personasBase: 0 };
    return { contactoId: '', fecha: hoy, linea: 'experiencia', items: [item], botellas: 0, personas: c.personas, total: c.total, gancho: '', codigoOrigen: '', estado: 'cotizado', fechaCierre: '', fechaEntrega: '', motivoPerdida: '', segmento: c.breca ? 'breca' : 'grupos', derivarB2B: false, embajadorId: '', notas: 'Cotización desde la calculadora de grupos: ' + c.nombre + ' para ' + c.personas + ' personas.' + (c.porConfirmar ? ' Paquete por confirmar.' : '') + ' Link de pago a confirmar.' };
  }
  // Texto de la cotización para WhatsApp (en usted). El CRM no envía nada: se copia y el usuario lo pega.
  function resumenCotizacion() {
    var c = calculo(); if (!c.opcion || !c.personas) return '';
    var E = cfg().empresa || {};
    var t = 'Le comparto la cotización para su grupo de ' + c.personas + ' personas en The Pisco Room, la sala de Viñas de Oro en el Hotel Westin Lima:\n\n';
    if (c.modo === 'paquete') t += '• ' + c.nombre + ' · ' + (c.opcion.incluye || 'salón del Westin incluido') + '\n';
    else t += '• ' + c.opcion.nombre + ' · ' + U.soles(c.unitario) + ' por persona' + (c.breca ? ' (precio colaborador Breca, 25 % en experiencias)' : '') + '\n';
    t += '• Total: ' + U.soles(c.total) + ' (' + U.soles(c.porPersona) + ' por persona)\n';
    t += '• Link de pago a confirmar\n';
    if (c.porConfirmar) t += '• Paquete sujeto a confirmación\n';
    t += '\nSi me confirma la fecha y la hora, reservo el espacio y le envío el total con el link de pago en un solo mensaje.\n\n' + (E.firma || 'The Pisco Room by Viñas de Oro');
    return t;
  }

  /* =========================== 3) EMBAJADORES =========================== */
  // Ventas atribuidas: por embajador asignado o por código de origen igual al código (sin importar mayúsculas)
  function ventasAtribuidas(e, lista) { var cod = normCodigo(e.codigo); return lista.filter(function (v) { return (e.id && v.embajadorId === e.id) || (cod && normCodigo(v.codigoOrigen) === cod); }); }
  // Comisión por mes: 10 % de lo vendido; si el mes llega al umbral (S/ 1,500), 15 % sobre todo el mes
  function comisionPorMes(ventas) {
    var Rg = cfg().reglas; var umbral = Number(Rg.umbralComisionMes) || 1500; var base = Number(Rg.comisionBase) || 0.10; var alta = Number(Rg.comisionAlta) || 0.15;
    var porMes = {};
    ventas.forEach(function (v) { var m = fechaEfectiva(v).slice(0, 7) || 'sin fecha'; if (!porMes[m]) porMes[m] = { mes: m, n: 0, vendido: 0 }; porMes[m].n++; porMes[m].vendido += Number(v.total) || 0; });
    return Object.keys(porMes).sort().map(function (m) { var x = porMes[m]; x.vendido = r2(x.vendido); x.tasa = x.vendido >= umbral ? alta : base; x.comision = r2(x.vendido * x.tasa); return x; });
  }
  function resumenEmbajador(e, listaTrimestre) {
    var vs = ventasAtribuidas(e, listaTrimestre || ventasDelTrimestre()); var meses = comisionPorMes(vs);
    var comision = r2(meses.reduce(function (s, m) { return s + m.comision; }, 0));
    var pagado = r2((Array.isArray(e.pagos) ? e.pagos : []).reduce(function (s, p) { return s + (Number(p.monto) || 0); }, 0));
    return { e: e, ventas: vs, meses: meses, n: vs.length, vendido: sumaTotal(vs), comision: comision, pagado: pagado, saldo: r2(comision - pagado) };
  }
  function rankingEmbajadores() {
    var trim = ventasDelTrimestre();
    return DB.tabla('embajadores').map(function (e) { return resumenEmbajador(e, trim); }).sort(function (a, b) { return (b.vendido - a.vendido) || (b.n - a.n) || String(a.e.nombre || '').localeCompare(String(b.e.nombre || '')); });
  }
  function sugerirCodigo(ciudad, nombre) {
    var c = U.normTexto(ciudad); var n = U.primerNombre(nombre);
    if (!c || !n) return '';
    var pre = CODIGOS_CIUDAD[c] || c.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase();
    var suf = U.normTexto(n).replace(/[^a-z0-9]/g, '').toUpperCase();
    return pre && suf ? pre + '-' + suf : '';
  }
  function textoReglaComision() {
    var Rg = cfg().reglas;
    return 'Comisión: ' + U.pct(Number(Rg.comisionBase) || 0.1, 0) + ' de lo vendido en el mes; si el mes llega a ' + U.soles(Number(Rg.umbralComisionMes) || 1500) + ', ' + U.pct(Number(Rg.comisionAlta) || 0.15, 0) + ' sobre todo lo vendido ese mes (supuesto por confirmar: el plan no dice si el 15 % aplica solo al excedente). Cuentan las ventas pagadas o entregadas del trimestre, sin derivar a B2B, con el código del embajador o con el embajador asignado.';
  }
  function renderEmbajadores() {
    var r = raiz(); var ranking = rankingEmbajadores();
    var activos = ranking.filter(function (x) { return x.e.estado === 'activo'; }).length;
    var vendido = r2(ranking.reduce(function (s, x) { return s + x.vendido; }, 0)), comision = r2(ranking.reduce(function (s, x) { return s + x.comision; }, 0)), saldo = r2(ranking.reduce(function (s, x) { return s + x.saldo; }, 0));
    var h = cabecera('embajadores', '<button type="button" class="btn primario" data-vta="emb-nuevo">Nuevo embajador</button><button type="button" class="btn" data-vta="emb-exportar">Exportar CSV</button>', 'Red de embajadores del piloto. Ranking por ventas atribuidas del trimestre.') +
      '<div class="kpis">' + kpi('Embajadores', U.entero(ranking.length), { sub: U.entero(activos) + ' activos' }) + kpi('Vendido por embajadores', U.soles(vendido), { id: 'embVendidoTotal' }) + kpi('Comisión devengada', U.soles(comision), { id: 'embComisionTotal' }) + kpi('Saldo por pagar', U.soles(saldo), { id: 'embSaldoTotal' }) + '</div>' +
      '<div class="tarjeta sin-padding"><div class="tabla-scroll"><table class="tabla ventas-tabla ventas-emb" id="embTabla"><thead><tr><th>#</th><th>Embajador</th><th>Código</th><th>Estado</th><th>Teléfono</th><th class="num">Ventas</th><th class="num">Vendido</th><th class="num">Comisión</th><th class="num">Pagado</th><th class="num">Saldo</th><th></th></tr></thead><tbody>';
    if (!ranking.length) h += '<tr><td colspan="11" class="vacio">Aún no hay embajadores. Cree el primero con "Nuevo embajador".</td></tr>';
    ranking.forEach(function (x, i) {
      var e = x.e;
      h += '<tr data-id="' + U.attr(e.id) + '" data-pos="' + (i + 1) + '"><td data-label="Puesto"><span class="ventas-pos">' + (i + 1) + '</span></td>' +
        '<td data-label="Embajador"><b>' + U.esc(e.nombre || '(sin nombre)') + '</b>' + (e.prueba ? ' <span class="pill chica">prueba</span>' : '') + '<br><small class="texto3">' + U.esc(e.ciudad || '—') + (e.desde ? ' · desde ' + U.esc(U.fechaCorta(e.desde)) : '') + '</small></td>' +
        '<td data-label="Código"><code>' + U.esc(e.codigo || '—') + '</code></td><td data-label="Estado">' + pillEmbajador(e.estado) + '</td>' +
        '<td data-label="Teléfono">' + (e.telefono ? '<a target="_blank" rel="noopener" href="' + U.attr(R.urlWhatsApp(e.telefono)) + '">' + U.esc(e.telefono) + '</a>' : '—') + '</td>' +
        '<td data-label="Ventas" class="num" data-col="ventas">' + U.entero(x.n) + '</td><td data-label="Vendido" class="num" data-col="vendido">' + U.soles(x.vendido) + '</td><td data-label="Comisión" class="num" data-col="comision">' + U.soles(x.comision) + '</td><td data-label="Pagado" class="num" data-col="pagado">' + U.soles(x.pagado) + '</td><td data-label="Saldo" class="num' + (x.saldo > 0 ? ' bien' : '') + '" data-col="saldo">' + U.soles(x.saldo) + '</td>' +
        '<td class="acciones-fila"><button type="button" class="btn chico" data-vta="emb-detalle" data-id="' + U.attr(e.id) + '">Detalle</button><button type="button" class="btn chico" data-vta="emb-editar" data-id="' + U.attr(e.id) + '">Editar</button></td></tr>';
    });
    h += '</tbody></table></div><p class="texto3 pad">' + U.esc(textoReglaComision()) + '</p></div>';
    r.innerHTML = h;
  }
  function detalleEmbajador(id) {
    var e = DB.buscar('embajadores', id); if (!e) { UI.toast('No se encontró el embajador', 'alerta'); return; }
    var x = resumenEmbajador(e); var c = e.contactoId ? DB.buscar('contactos', e.contactoId) : null; var pagos = Array.isArray(e.pagos) ? e.pagos : [];
    var h = '<div class="ventas-modal" id="detalleEmbajador"><h3>' + U.esc(e.nombre) + '</h3>' +
      '<p class="texto2"><code>' + U.esc(e.codigo || '—') + '</code> · ' + U.esc(e.ciudad || '—') + ' · ' + pillEmbajador(e.estado) + (e.telefono ? ' · <a target="_blank" rel="noopener" href="' + U.attr(R.urlWhatsApp(e.telefono)) + '">' + U.esc(e.telefono) + '</a>' : '') + (c ? ' · contacto: ' + U.esc(c.nombre) : '') + (e.desde ? ' · desde ' + U.esc(U.fechaCorta(e.desde)) : '') + '</p>' +
      '<div class="kpis">' + kpi('Vendido', U.soles(x.vendido), { chico: true, sub: U.entero(x.n) + ' ventas' }) + kpi('Comisión', U.soles(x.comision), { chico: true, id: 'embComision' }) + kpi('Pagado', U.soles(x.pagado), { chico: true, id: 'embPagado' }) + kpi('Saldo por pagar', U.soles(x.saldo), { chico: true, id: 'embSaldo', clase: x.saldo < 0 ? 'mal' : '' }) + '</div>' +
      '<h4>Ventas por mes</h4>';
    if (x.meses.length) {
      h += '<div class="tabla-scroll"><table class="tabla compacta"><thead><tr><th>Mes</th><th class="num">Ventas</th><th class="num">Vendido</th><th class="num">Tasa</th><th class="num">Comisión</th></tr></thead><tbody>' +
        x.meses.map(function (m) { return '<tr><td>' + U.esc(/^\d{4}-\d{2}$/.test(m.mes) ? U.nombreMes(m.mes) : m.mes) + '</td><td class="num">' + U.entero(m.n) + '</td><td class="num">' + U.soles(m.vendido) + '</td><td class="num">' + U.pct(m.tasa, 0) + '</td><td class="num">' + U.soles(m.comision) + '</td></tr>'; }).join('') +
        '<tr class="total"><td>Total</td><td class="num">' + U.entero(x.n) + '</td><td class="num">' + U.soles(x.vendido) + '</td><td></td><td class="num">' + U.soles(x.comision) + '</td></tr></tbody></table></div>' +
        '<details class="ayuda"><summary>Ver las ' + U.entero(x.n) + ' ventas atribuidas</summary><div class="tabla-scroll"><table class="tabla compacta"><thead><tr><th>Fecha</th><th>Contacto</th><th>Detalle</th><th>Origen</th><th class="num">Total</th></tr></thead><tbody>' +
        x.ventas.slice().sort(function (a, b) { return fechaEfectiva(a) < fechaEfectiva(b) ? 1 : -1; }).map(function (v) { return '<tr><td>' + U.esc(U.fechaCorta(fechaEfectiva(v))) + '</td><td>' + U.esc(nombreContacto(v) || '—') + '</td><td>' + U.esc(resumenItems(v) || '—') + '</td><td>' + U.esc(v.codigoOrigen || (v.embajadorId ? 'asignado' : '—')) + '</td><td class="num">' + U.soles(v.total) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
    } else h += '<p class="texto2">Sin ventas atribuidas en el trimestre. Se atribuyen las ventas pagadas o entregadas con el código <code>' + U.esc(e.codigo || '—') + '</code> en "Código de origen" o con el embajador asignado.</p>';
    h += '<h4>Pagos realizados</h4>';
    if (pagos.length) h += '<div class="tabla-scroll"><table class="tabla compacta" id="embPagos"><thead><tr><th>Fecha</th><th class="num">Monto</th><th>Nota</th><th></th></tr></thead><tbody>' + pagos.map(function (p, i) { return '<tr><td>' + U.esc(U.fechaCorta(p.fecha) || '—') + '</td><td class="num">' + U.soles(p.monto) + '</td><td>' + U.esc(p.nota || '') + '</td><td class="acciones-fila"><button type="button" class="btn chico peligro" data-quitar-pago="' + i + '">Quitar</button></td></tr>'; }).join('') + '<tr class="total"><td>Total pagado</td><td class="num">' + U.soles(x.pagado) + '</td><td></td><td></td></tr></tbody></table></div>';
    else h += '<p class="texto2">Sin pagos registrados.</p>';
    h += '<form id="formPago" class="form-grid" autocomplete="off">' + UI.campo('Fecha del pago', UI.inp('fecha', U.hoyISO(), 'type="date"')) + UI.campo('Monto (S/)', UI.inp('monto', '', 'type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="0.00"')) + UI.campo('Nota', UI.inp('nota', '', 'placeholder="Yape, transferencia, efectivo…"')) + '<div class="acciones ancho"><button type="submit" class="btn">Registrar pago</button></div></form>' +
      '<p class="texto3">' + U.esc(textoReglaComision()) + '</p>' +
      '<div class="acciones final"><button type="button" class="btn peligro izq" data-vta="emb-eliminar">Eliminar</button><button type="button" class="btn" data-vta="emb-editar">Editar</button><button type="button" class="btn primario" data-vta="cerrar">Cerrar</button></div></div>';
    UI.abrirModal(h, { ancho: 'ancho', sinFoco: true });
    var m = UI.$('modalContenido');
    UI.qs('#formPago', m).onsubmit = function (ev) {
      ev.preventDefault(); var f = UI.leerForm(this); var monto = Number(f.monto);
      if (!(monto > 0)) { UI.toast('Escriba un monto mayor a cero', 'alerta'); return; }
      if (!Array.isArray(e.pagos)) e.pagos = [];
      e.pagos.push({ fecha: U.isoDe(f.fecha) || U.hoyISO(), monto: r2(monto), nota: String(f.nota || '').trim() });
      DB.upsert('embajadores', e); UI.toast('Pago registrado: ' + U.soles(monto)); detalleEmbajador(e.id); render();
    };
    UI.qsa('[data-quitar-pago]', m).forEach(function (b) {
      b.onclick = function () { var i = +b.getAttribute('data-quitar-pago'); var p = e.pagos[i]; if (!p) return; UI.confirmar('¿Quitar el pago de ' + U.soles(p.monto) + ' del ' + U.fechaCorta(p.fecha) + '?', function () { e.pagos.splice(i, 1); DB.upsert('embajadores', e); UI.toast('Pago quitado'); detalleEmbajador(e.id); render(); }, 'Quitar'); };
    });
    UI.qs('[data-vta="emb-eliminar"]', m).onclick = function () { eliminarEmbajador(e); };
    UI.qs('[data-vta="emb-editar"]', m).onclick = function () { formEmbajador(e); };
    UI.qs('[data-vta="cerrar"]', m).onclick = UI.cerrarModal;
  }
  function formEmbajador(original) {
    var nuevo = !original || !original.id;
    var e = original ? U.clonar(original) : { nombre: '', ciudad: '', codigo: '', telefono: '', contactoId: '', estado: 'candidato', desde: U.hoyISO(), pagos: [] };
    var c = e.contactoId ? DB.buscar('contactos', e.contactoId) : null;
    var ciudades = ((R.segmentoDe('piloto') || {}).ciudades || []).slice();
    DB.tabla('embajadores').forEach(function (x) { if (x.ciudad && ciudades.indexOf(x.ciudad) < 0) ciudades.push(x.ciudad); });
    var h = '<div class="ventas-modal"><h3>' + (nuevo ? 'Nuevo embajador' : 'Editar embajador') + '</h3><form id="formEmbajador" class="form-grid" autocomplete="off">' +
      UI.campo('Nombre', UI.inp('nombre', e.nombre, 'required placeholder="Nombre y apellido"')) +
      UI.campo('Ciudad', UI.inp('ciudad', e.ciudad, 'list="listaCiudadesEmb" placeholder="Chiclayo, Santa Cruz, Cusco…"') + '<datalist id="listaCiudadesEmb">' + ciudades.map(function (x) { return '<option value="' + U.attr(x) + '">'; }).join('') + '</datalist>') +
      '<div class="campo"><span>Código</span>' + UI.inp('codigo', e.codigo, 'placeholder="CIX-ANA" style="text-transform:uppercase" autocapitalize="characters"') + '<small id="embSugerencia"></small></div>' +
      UI.campo('Teléfono (WhatsApp)', UI.inp('telefono', e.telefono, 'inputmode="tel" placeholder="+51 9xx xxx xxx"')) +
      UI.campo('Contacto vinculado', '<input name="buscarContacto" list="listaContactosEmb" placeholder="Nombre o teléfono del contacto" value="' + U.attr(c ? (c.nombre || '') + (c.telefono ? ' · ' + c.telefono : '') : '') + '">' + listaContactosHtml('listaContactosEmb'), 'Opcional: la persona en Contactos. Déjelo vacío para desvincular.') +
      UI.campo('Estado', '<select name="estado">' + UI.opciones(ESTADOS_EMBAJADOR, e.estado || 'candidato') + '</select>') +
      UI.campo('Desde', UI.inp('desde', e.desde, 'type="date"')) +
      '<div class="acciones ancho">' + (nuevo ? '' : '<button type="button" class="btn peligro izq" data-vta="emb-eliminar">Eliminar</button>') + '<button type="button" class="btn" data-vta="cerrar">Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></form></div>';
    UI.abrirModal(h, { ancho: 'ancho' });
    var form = UI.$('formEmbajador');
    var inNombre = UI.qs('[name="nombre"]', form), inCiudad = UI.qs('[name="ciudad"]', form), inCodigo = UI.qs('[name="codigo"]', form), hint = UI.$('embSugerencia');
    var codigoTocado = !!String(e.codigo || '').trim(); // con código propio no se pisa la sugerencia
    function actualizarSugerencia() {
      var s = sugerirCodigo(inCiudad.value, inNombre.value);
      if (!codigoTocado) inCodigo.value = s;
      var distinta = s && normCodigo(inCodigo.value) !== normCodigo(s);
      hint.innerHTML = s ? 'Sugerencia: <b>' + U.esc(s) + '</b>' + (distinta ? ' <button type="button" class="btn chico" data-usar-sugerencia>Usar</button>' : '') : 'Formato CIUDAD-NOMBRE, por ejemplo CIX-ANA (ciudad y primer nombre).';
      var usar = UI.qs('[data-usar-sugerencia]', hint); if (usar) usar.onclick = function () { inCodigo.value = s; codigoTocado = true; actualizarSugerencia(); };
    }
    inNombre.oninput = actualizarSugerencia; inCiudad.oninput = actualizarSugerencia;
    inCodigo.oninput = function () { codigoTocado = inCodigo.value.trim() !== ''; actualizarSugerencia(); };
    actualizarSugerencia();
    form.onsubmit = function (ev) {
      ev.preventDefault(); var f = UI.leerForm(form); var obj = U.clonar(e);
      obj.nombre = String(f.nombre || '').trim(); if (!obj.nombre) { UI.toast('Escriba el nombre del embajador', 'alerta'); return; }
      obj.ciudad = String(f.ciudad || '').trim(); obj.codigo = normCodigo(f.codigo); obj.estado = f.estado || 'candidato'; obj.desde = U.isoDe(f.desde);
      obj.telefono = U.normTelefono(f.telefono) || String(f.telefono || '').trim();
      var txtContacto = String(f.buscarContacto || '').trim(); var cc = resolverContacto(txtContacto);
      if (!txtContacto) obj.contactoId = ''; else if (cc) obj.contactoId = cc.id;
      if (!obj.telefono && cc && cc.telefono) obj.telefono = cc.telefono;
      if (!obj.codigo) { UI.toast('Escriba un código, por ejemplo ' + (sugerirCodigo(obj.ciudad, obj.nombre) || 'CIX-ANA'), 'alerta'); return; }
      var dup = DB.tabla('embajadores').filter(function (x) { return x.id !== obj.id && normCodigo(x.codigo) === obj.codigo; })[0];
      if (dup) { UI.toast('Ya existe el código ' + dup.codigo + ' (' + dup.nombre + '). Elija otro código.', 'alerta', 5000); return; }
      if (!Array.isArray(obj.pagos)) obj.pagos = [];
      DB.upsert('embajadores', obj); UI.cerrarModal(); UI.toast(nuevo ? 'Embajador creado: ' + obj.codigo : 'Embajador guardado'); render();
    };
    UI.qs('[data-vta="cerrar"]', form).onclick = UI.cerrarModal;
    var btnEl = UI.qs('[data-vta="emb-eliminar"]', form); if (btnEl) btnEl.onclick = function () { eliminarEmbajador(original); };
  }
  function eliminarEmbajador(e) {
    if (!e || !e.id) return;
    UI.confirmar('¿Eliminar al embajador ' + (e.nombre || '') + ' (' + (e.codigo || 'sin código') + ')? Las ventas con su código quedan registradas; se pierde la lista de pagos.', function () { DB.eliminar('embajadores', e.id); UI.toast('Embajador eliminado'); render(); }, 'Eliminar');
  }
  function exportarEmbajadores() {
    var filas = rankingEmbajadores().map(function (x, i) { var e = x.e; var c = e.contactoId ? DB.buscar('contactos', e.contactoId) : null; return { puesto: i + 1, nombre: e.nombre, ciudad: e.ciudad, codigo: e.codigo, estado: e.estado, telefono: e.telefono, contacto: c ? c.nombre : '', desde: e.desde, ventas: x.n, vendido: x.vendido, comision: x.comision, pagado: x.pagado, saldo: x.saldo }; });
    U.descargar('embajadores-' + U.hoyISO() + '.csv', U.aCSV(filas, COLUMNAS_EMB_CSV), 'text/csv;charset=utf-8');
    UI.toast(U.entero(filas.length) + ' embajadores exportados a CSV');
  }

  /* =========================== Eventos (delegación en la sección) =========================== */
  function enlazar() {
    if (estado.enlazado) return; estado.enlazado = true; var r = raiz();
    r.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-vta]'); if (!el) return;
      var acc = el.getAttribute('data-vta'), id = el.getAttribute('data-id');
      switch (acc) {
        case 'pestana': fijarPestana(el.getAttribute('data-tab')); render(); break;
        case 'nueva-venta': V.ventas.formVenta(null, { alGuardar: render }); break;
        case 'editar-venta': { var v = DB.buscar('ventas', id); if (v) V.ventas.formVenta(v, { alGuardar: render }); else UI.toast('La venta ya no existe', 'alerta'); break; }
        case 'ficha': { var c = DB.buscar('contactos', id); if (!c) { UI.toast('El contacto ya no existe', 'alerta'); break; } if (typeof UI.fichaContacto === 'function') UI.fichaContacto(c); else UI.formContacto(c); break; }
        case 'exportar-ventas': exportarVentas(); break;
        case 'limpiar-filtros': DB.datos.ui.filtros.ventas = null; DB.guardarPronto(); renderVentas(false); break;
        case 'calc-elegir': { var s = estadoCalc(); if (el.getAttribute('data-tipo') === 'experiencia') { s.modo = 'experiencia'; s.experiencia = id; } else { s.modo = 'paquete'; s.paquete = id; } DB.guardarPronto(); renderCalculadora(); break; }
        case 'calc-cotizar': { var vc = ventaDesdeCalculadora(); if (!vc) { UI.toast('Indique el número de personas', 'alerta'); break; } V.ventas.formVenta(vc, { alGuardar: render }); break; }
        case 'calc-copiar': { var txt = resumenCotizacion(); if (!txt) { UI.toast('Indique el número de personas', 'alerta'); break; } UI.copiar(txt).then(function (ok) { UI.toast(ok ? 'Resumen copiado. Péguelo en WhatsApp.' : 'No se pudo copiar en este navegador', ok ? '' : 'alerta'); }); break; }
        case 'emb-nuevo': formEmbajador(null); break;
        case 'emb-detalle': detalleEmbajador(id); break;
        case 'emb-editar': { var e = DB.buscar('embajadores', id); if (e) formEmbajador(e); break; }
        case 'emb-exportar': exportarEmbajadores(); break;
      }
    });
    // Texto: solo la tabla o el resultado, con un pequeño retardo, para no perder el foco
    r.addEventListener('input', function (ev) {
      var el = ev.target; if (!el || el.tagName !== 'INPUT') return;
      if (el.closest('.ventas-filtros')) { filtros()[el.name] = el.value; DB.guardarPronto(); clearTimeout(estado.timerTexto); estado.timerTexto = setTimeout(function () { pintarTablaVentas(); }, 150); }
      else if (el.closest('#calcForm')) { if (el.name === 'personas') { estadoCalc().personas = el.value; DB.guardarPronto(); actualizarCalc(); } }
    });
    r.addEventListener('change', function (ev) {
      var el = ev.target; if (!el || el.tagName !== 'SELECT') return;
      if (el.closest('.ventas-filtros')) { filtros()[el.name] = el.value; DB.guardarPronto(); pintarTablaVentas(); }
      else if (el.closest('#calcForm')) { var s = estadoCalc(); if (el.name === 'modo') s.modo = el.value; else if (el.name === 'paquete') s.paquete = el.value; else if (el.name === 'experiencia') s.experiencia = el.value; else if (el.name === 'breca') s.breca = el.value === 'true'; DB.guardarPronto(); actualizarCalc(); }
    });
  }

  /* =========================== Registro =========================== */
  V.registrarPantalla('ventas', render);
  V.modulos = V.modulos || {};
  V.modulos.ventas = { render: render, ventasDelTrimestre: ventasDelTrimestre, fechaEfectiva: fechaEfectiva, precioPaquete: precioPaquete, precioExperiencia: precioExperiencia, calculo: calculo, ventaDesdeCalculadora: ventaDesdeCalculadora, resumenCotizacion: resumenCotizacion, comisionPorMes: comisionPorMes, resumenEmbajador: resumenEmbajador, rankingEmbajadores: rankingEmbajadores, sugerirCodigo: sugerirCodigo, normCodigo: normCodigo };
})();
