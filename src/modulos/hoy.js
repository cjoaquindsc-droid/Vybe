/* ============================================================================
   hoy.js · Pantalla HOY (parte 2) · Bodegas Viñas de Oro / The Pisco Room
   Cola del día con mensajes ya armados: copiar y abrir WhatsApp o correo,
   marcar enviado / respondió / compró, posponer, dormir, perdido, cuentas,
   KPIs del día, cuotas por segmento, cierre del día y próximos 7 días.
   El CRM no envía nada: arma el texto, lo copia y abre wa.me o mailto.
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, E = V.embudo, DB = V.DB, cfg = V.cfg;

  // Secciones de la cola, en el orden en que se pintan
  var SECCIONES = [
    { id: 'vencidos', titulo: 'Vencidos', tipos: null },
    { id: 'responder', titulo: 'Responder y cerrar', tipos: ['responder', 'cobro', 'entrega'] },
    { id: 'seguimientos', titulo: 'Seguimientos', tipos: ['seguimiento', 'cerrar_conversacion'] },
    { id: 'postventa', titulo: 'Post-venta', tipos: ['postventa'] },
    { id: 'cuentas', titulo: 'Cuentas y eventos', tipos: ['cuenta'] },
    { id: 'nuevos', titulo: 'Nuevos toques', tipos: ['inicial'] }
  ];
  // Tarjetas visibles por sección antes de "Ver más" (nuevos: por segmento)
  var LIMITES = { vencidos: 20, responder: 40, seguimientos: 30, postventa: 30, cuentas: 30, nuevos: 10 };
  var PASO_VER_MAS = 20;
  // Variables de plantilla que el usuario puede completar desde la tarjeta
  var VARIABLES = [
    { campo: 'ocasion', etiqueta: 'Ocasión', placeholder: 'cumpleaños, regalo, evento…' },
    { campo: 'empresa', etiqueta: 'Empresa', placeholder: 'nombre de la empresa' },
    { campo: 'personas', etiqueta: 'Personas', placeholder: '0', tipo: 'number' },
    { campo: 'ciudad', etiqueta: 'Ciudad', placeholder: 'Lima' }
  ];
  var ETIQUETA_ESTADO = { pendiente: 'Pendiente', en_curso: 'En curso', cumplido: 'Cumplido', no_cumplido: 'No cumplido' };
  var ETIQUETA_TIPO = { hito: 'Hito', corte: 'Corte', alerta: 'Fecha clave', periodo: 'Periodo' };

  // Estado de la pantalla (no se persiste): items de la cola por clave, límites de "ver más"
  var estado = { items: {}, limites: {}, enlazado: false };

  /* =========================== Utilidades =========================== */
  function horaAhora() { return U.ahoraISO().slice(11, 16); }
  function claveDe(item) { return item.tipo === 'cuenta' ? 'k:' + item.cuenta.id : 'c:' + (item.contacto ? item.contacto.id : ''); }
  function raiz() { return UI.$('p-hoy'); }
  function tarjetaPorClave(clave) { return UI.qsa('.hoy-card', raiz()).filter(function (el) { return el.getAttribute('data-clave') === clave; })[0] || null; }
  function etiquetaEstado(e) { return ETIQUETA_ESTADO[e] || (e || 'Pendiente'); }
  function clasePill(e) { return e === 'cumplido' ? ' ok' : e === 'no_cumplido' ? ' alerta' : ''; }

  // Resumen del día del núcleo, con "enviados" = interacciones de hoy que tienen toque
  // (el núcleo cuenta también un "compró" sin toque; eso no es un envío)
  function resumenHoy(fecha) {
    var r = E.resumenDia(fecha);
    r.enviados = DB.tabla('interacciones').filter(function (i) { return String(i.fecha || '').slice(0, 10) === fecha && String(i.toque == null ? '' : i.toque) !== ''; }).length;
    return r;
  }
  // Enviados de hoy con toque 1, por segmento del contacto
  function enviadosPorSegmento(fecha) {
    var porId = {}; DB.tabla('contactos').forEach(function (c) { porId[c.id] = c; });
    var m = {};
    DB.tabla('interacciones').forEach(function (i) {
      if (String(i.fecha || '').slice(0, 10) !== fecha || String(i.toque) !== '1') return;
      var c = porId[i.contactoId]; var seg = c ? (c.segmento || '') : '';
      m[seg] = (m[seg] || 0) + 1;
    });
    return m;
  }
  function ultimaVentaDe(contactoId) {
    return DB.tabla('ventas').filter(function (v) { return v.contactoId === contactoId && v.estado !== 'perdido'; })
      .sort(function (a, b) { return String(b.fecha || '') > String(a.fecha || '') ? 1 : String(b.fecha || '') < String(a.fecha || '') ? -1 : 0; })[0] || null;
  }
  // Barra de progreso: relleno dorado sobre pista del mismo tono; verde al llegar a la meta
  function barra(valor, meta) {
    var p = meta > 0 ? Math.min(1, valor / meta) : (valor > 0 ? 1 : 0);
    var ok = meta > 0 && valor >= meta;
    return '<div class="hoy-barra' + (ok ? ' ok' : '') + '" role="progressbar" aria-valuenow="' + Math.round(p * 100) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>';
  }

  /* =========================== Mensajes =========================== */
  function plantillasDe(c) { return DB.tabla('plantillas').filter(function (p) { return p.activa !== false && (p.segmento === c.segmento || p.segmento === '*'); }); }
  function opcionesPlantillas(lista, sel) {
    var h = '<option value=""' + (!sel ? ' selected' : '') + '>— sin plantilla (mensaje libre) —</option>';
    lista.forEach(function (p) { h += '<option value="' + U.attr(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + U.esc(p.nombre) + (p.canal === 'correo' ? ' · correo' : '') + (p.masivo ? ' · con leyendas' : '') + '</option>'; });
    return h;
  }
  // Canal del botón principal: correo si la plantilla es de correo o no hay teléfono
  function canalDe(c, pl) { return (pl && pl.canal === 'correo') || !c.telefono ? 'correo' : 'whatsapp'; }
  function urlDe(c, canal, texto, asunto) { return canal === 'correo' ? R.urlCorreo(c.correo || '', asunto || '', texto || '') : R.urlWhatsApp(c.telefono, texto || ''); }
  // Variables extra para propuesta, cobro, entrega y post-venta: producto y total de la última venta
  function extraDe(item, c) {
    var extra = {}; var v = ultimaVentaDe(c.id);
    if (v) {
      var prod = (v.items || []).map(function (i) { return ((Number(i.cantidad) || 0) > 1 ? i.cantidad + ' × ' : '') + (i.nombre || ''); }).filter(Boolean).join(', ');
      if (prod) extra.producto = prod;
      if (Number(v.total) > 0) extra.total = U.soles(v.total).replace('S/ ', '');
      if (item.tipo === 'entrega' && v.fechaEntrega) extra.ocasion = 'el ' + U.fechaCorta(v.fechaEntrega);
    }
    if (!extra.producto) extra.producto = item.tipo === 'postventa' ? 'su pedido' : '[PRODUCTO Y CANTIDAD]';
    if (!extra.total) extra.total = '[TOTAL]';
    return extra;
  }
  function mensajeDe(item, pl, c) {
    if (!pl) return { texto: '', asunto: '' };
    try { return R.armarMensaje(pl, c, extraDe(item, c)); } catch (e) { return { texto: '', asunto: '' }; }
  }
  function variablesUsadas(pl) {
    if (!pl) return [];
    var usadas = {};
    String((pl.texto || '') + ' ' + (pl.asunto || '')).replace(/\{(\w+)\}/g, function (m, k) { usadas[k] = true; return m; });
    return VARIABLES.filter(function (v) { return usadas[v.campo]; });
  }
  function faltaVariable(c, campo) {
    if (campo === 'empresa') return !c.empresa && !c.subsegmento;
    var v = c[campo]; return v == null || v === '' || v === 0;
  }
  function variablesHtml(c, pl) {
    var faltan = variablesUsadas(pl).filter(function (v) { return faltaVariable(c, v.campo); });
    if (!faltan.length) return '';
    return '<div class="hoy-vars">' + faltan.map(function (v) {
      return '<label class="campo"><span>' + U.esc(v.etiqueta) + ' <small>falta en la ficha</small></span><input data-var="' + U.attr(v.campo) + '" type="' + (v.tipo || 'text') + '" placeholder="' + U.attr(v.placeholder) + '" value="" autocomplete="off"></label>';
    }).join('') + '</div>';
  }

  /* =========================== Textos de la tarjeta =========================== */
  function toqueTexto(item, c) {
    var max = cfg().reglas.maxToques;
    if (item.tipo === 'inicial' || item.tipo === 'seguimiento') return 'toque ' + item.toque + ' de ' + max;
    if (item.tipo === 'cerrar_conversacion') return 'toque ' + (Number(c.toques) || max) + ' de ' + max;
    return Number(c.toques) ? 'toque ' + c.toques + ' de ' + max : '';
  }
  function motivoDe(item, c, hoy) {
    var m;
    switch (item.tipo) {
      case 'inicial': m = (c.estado === 'dormido' ? 'Vuelve de dormido · ' : '') + 'Nuevo toque de la ola ' + R.olaDe(hoy); break;
      case 'seguimiento': m = 'Sin respuesta al toque ' + (Number(c.toques) || 1) + ' · toca el ' + item.toque; break;
      case 'cerrar_conversacion': m = 'Sin respuesta tras el último toque · cerrar la conversación'; break;
      case 'responder': m = 'Respondió · armar la propuesta con total y link de pago'; break;
      case 'cobro': m = 'Propuesta enviada · recordar el pago'; break;
      case 'entrega': { var v = ultimaVentaDe(c.id); m = 'Pago confirmado · coordinar la entrega' + (v && v.fechaEntrega ? ' del ' + U.fechaCorta(v.fechaEntrega) : ''); break; }
      case 'postventa': m = 'Post-venta · agradecer, pedir foto y dar el código ' + (c.codigoReferido || 'de referido'); break;
      default: m = item.tipo;
    }
    if (item.vencido) m = 'Vencido desde el ' + U.fechaCorta(c.proximoToque) + ' · ' + m;
    return m;
  }

  /* =========================== Tarjetas =========================== */
  function tarjetaHtml(item, hoy) {
    if (item.tipo === 'cuenta') return tarjetaCuentaHtml(item);
    var c = item.contacto, pl = item.plantilla || null, clave = claveDe(item);
    var canal = canalDe(c, pl), msg = mensajeDe(item, pl, c), toque = toqueTexto(item, c);
    var cierre = item.tipo === 'cerrar_conversacion';
    var h = '<article class="hoy-card' + (item.vencido ? ' vencida' : '') + (cierre ? ' cierre' : '') + '" data-clave="' + U.attr(clave) + '" data-id="' + U.attr(c.id) + '" data-tipo="' + U.attr(item.tipo) + '" data-plantilla="' + U.attr(pl ? pl.id : '') + '">' +
      '<div class="hoy-card-cab"><b class="hoy-nombre">' + U.esc(c.nombre || '(sin nombre)') + '</b><span class="chip seg-' + U.esc(c.segmento || '') + '">' + U.esc(R.nombreSegmento(c.segmento)) + '</span><span class="pill chica">' + U.esc(R.nombreEtapa(c.etapa)) + '</span>' +
      (toque ? '<span class="pill chica">' + U.esc(toque) + '</span>' : '') + (c.perfil ? '<span class="pill chica">perfil ' + U.esc(c.perfil) + '</span>' : '') + (c.prueba ? '<span class="pill chica">prueba</span>' : '') + '</div>' +
      '<div class="texto3 hoy-card-datos">' + U.esc(c.telefono || 'sin teléfono') + (c.correo ? ' · ' + U.esc(c.correo) : '') + (c.empresa ? ' · ' + U.esc(c.empresa) : '') + (c.cargo ? ' · ' + U.esc(c.cargo) : '') + (c.ciudad ? ' · ' + U.esc(c.ciudad) : '') + '</div>' +
      '<div class="hoy-motivo' + (item.vencido ? ' mal' : '') + '">' + U.esc(motivoDe(item, c, hoy)) + '</div>';
    if (cierre) {
      h += '<p class="texto2">Ya recibió sus ' + U.esc(cfg().reglas.maxToques) + ' toques sin responder. Duerma la conversación (vuelve en la siguiente ola) o márquela como perdida.</p>';
    } else {
      h += '<div class="hoy-plantilla"><select data-campo="plantilla" aria-label="Plantilla">' + opcionesPlantillas(plantillasDe(c), pl ? pl.id : '') + '</select></div>' + variablesHtml(c, pl);
      if (canal === 'correo') h += '<input data-campo="asunto" value="' + U.attr(msg.asunto) + '" placeholder="Asunto del correo" aria-label="Asunto">';
      h += '<textarea data-campo="mensaje" rows="5" aria-label="Mensaje" placeholder="Escriba el mensaje…">' + U.esc(msg.texto) + '</textarea>';
    }
    h += '<div class="acciones hoy-acciones">';
    if (!cierre) h += '<a class="btn primario" data-accion-hoy="abrir" target="_blank" rel="noopener" href="' + U.attr(urlDe(c, canal, msg.texto, msg.asunto)) + '">' + (canal === 'correo' ? 'Copiar y abrir correo' : 'Copiar y abrir WhatsApp') + '</a><button type="button" class="btn" data-accion-hoy="enviado">Marcar enviado</button>';
    h += '<button type="button" class="btn" data-accion-hoy="respondio">Respondió</button>' +
      '<button type="button" class="btn" data-accion-hoy="venta">' + (item.tipo === 'postventa' ? 'Recompra / Registrar venta' : 'Compró / Registrar venta') + '</button>' +
      '<span class="hoy-mas"><button type="button" class="btn chico" data-accion-hoy="posponer" data-dias="1">+1 día</button><button type="button" class="btn chico" data-accion-hoy="posponer" data-dias="2">+2 días</button>' +
      '<button type="button" class="btn chico' + (cierre ? ' primario' : '') + '" data-accion-hoy="dormir">Dormir</button><button type="button" class="btn chico peligro" data-accion-hoy="perdido">Perdido</button><button type="button" class="btn chico" data-accion-hoy="ficha">Ficha</button></span></div>' +
      '<div class="hoy-inline" hidden></div></article>';
    return h;
  }
  function tarjetaCuentaHtml(item) {
    var k = item.cuenta, c = item.contacto;
    return '<article class="hoy-card hoy-card-cuenta' + (item.vencido ? ' vencida' : '') + '" data-clave="' + U.attr(claveDe(item)) + '" data-id="' + U.attr(k.id) + '" data-tipo="cuenta">' +
      '<div class="hoy-card-cab"><b class="hoy-nombre">' + U.esc(k.empresa || '(cuenta sin nombre)') + '</b><span class="chip seg-' + U.esc(k.segmento || '') + '">' + U.esc(R.nombreSegmento(k.segmento)) + '</span><span class="pill chica">' + U.esc(k.estado || 'contactado') + '</span>' + (k.prueba ? '<span class="pill chica">prueba</span>' : '') + '</div>' +
      '<div class="texto3 hoy-card-datos">' + (c ? U.esc(c.nombre) + (c.telefono ? ' · ' + U.esc(c.telefono) : '') : 'Sin contacto asociado') + (k.personas ? ' · ' + U.esc(k.personas) + ' personas' : '') + (k.fechaEvento ? ' · evento ' + U.esc(U.fechaCorta(k.fechaEvento)) : '') + (Number(k.monto) ? ' · ' + U.soles(k.monto) : '') + '</div>' +
      '<div class="hoy-motivo' + (item.vencido ? ' mal' : '') + '">' + (item.vencido ? 'Vencido desde el ' + U.esc(U.fechaCorta(k.fechaProximoPaso)) + ' · ' : '') + 'Próximo paso: <b>' + U.esc(k.proximoPaso || '(sin detalle)') + '</b> · ' + U.esc(U.fechaCorta(k.fechaProximoPaso)) + '</div>' +
      '<div class="acciones hoy-acciones"><button type="button" class="btn primario" data-accion-hoy="hecho">Hecho</button><button type="button" class="btn" data-accion-hoy="ver-cuenta">Ver cuenta</button>' +
      (c && c.telefono ? '<a class="btn" target="_blank" rel="noopener" href="' + U.attr(R.urlWhatsApp(c.telefono)) + '">WhatsApp</a>' : '') + '</div><div class="hoy-inline" hidden></div></article>';
  }

  /* =========================== Bloques de la pantalla =========================== */
  function cabeceraHtml(hoy, dia) {
    var ola = dia ? dia.ola : R.olaDe(hoy);
    var olaInfo = cfg().olas.filter(function (o) { return o.n === ola; })[0];
    var nombreOla = olaInfo ? olaInfo.nombre : 'Ola ' + ola;
    var h = '<div class="cabecera-pantalla"><h2>Hoy</h2><p class="sub">' + U.esc(U.fechaLarga(hoy)) + ' · ' + U.esc(horaAhora()) + ', hora de Lima</p>' + (dia && dia.esCorte ? '<span class="pill alerta">Corte de control</span>' : '') + '</div>';
    if (dia) {
      h += '<div class="tarjeta oro hoy-dia"><div class="fila-sup"><span class="etiqueta">' + U.esc(nombreOla) + '</span>' + (dia.esCorte ? '<span class="pill alerta">Corte de control</span>' : '') + '<span class="pill' + clasePill(dia.estado) + '">Día ' + U.esc(etiquetaEstado(dia.estado).toLowerCase()) + '</span></div>' +
        '<h3>Foco del día</h3><p>' + U.esc(dia.foco || '—') + '</p>' + (dia.hito ? '<p><b>Hito:</b> ' + U.esc(dia.hito) + '</p>' : '') + (dia.periodo ? '<p class="texto2">Periodo: ' + U.esc(dia.periodo) + '</p>' : '') + '</div>';
    } else {
      h += '<div class="tarjeta hoy-dia"><div class="fila-sup"><span class="etiqueta">' + U.esc(nombreOla) + '</span></div><p><b>Hoy no es día de atención</b> del calendario (domingo, 25/12 o fuera del 07/10 al 31/12). Igual le mostramos los vencidos y pendientes para que nada se pierda.</p></div>';
    }
    return h;
  }
  function kpiHtml(etiqueta, valor, sub, actual, meta) {
    return '<div class="kpi hoy-kpi' + (meta != null && meta > 0 && actual < meta * 0.5 ? ' flojo' : '') + '"><span class="lab">' + U.esc(etiqueta) + '</span><span class="val">' + valor + '</span>' + (sub ? '<span class="hoy-sub">' + U.esc(sub) + '</span>' : '') + (meta != null ? barra(actual, meta) : '') + '</div>';
  }
  function resumenHtml(hoy, dia) {
    var r = resumenHoy(hoy);
    var h = '<div class="tarjeta"><h3>Avance del día</h3><div class="kpis hoy-kpis">' +
      kpiHtml('Enviados hoy', U.entero(r.enviados) + ' <small>/ ' + U.entero(r.cuotaContactos) + '</small>', 'cuota de contactos del día', r.enviados, r.cuotaContactos) +
      kpiHtml('Venta del día', U.soles(r.ventaDia), 'meta del día ' + U.soles(r.metaDia) + ' (proyección)', r.ventaDia, r.metaDia) +
      kpiHtml('Vs. cuota oficial', U.pct(r.cuotaDia ? r.ventaDia / r.cuotaDia : null, 0), 'cuota oficial del día ' + U.soles(r.cuotaDia), r.ventaDia, r.cuotaDia) +
      kpiHtml('Respondieron', U.entero(r.respondieron), r.enviados ? U.pct(r.respondieron / r.enviados, 0) + ' de los enviados' : 'de los enviados de hoy', null) +
      kpiHtml('Compraron', U.entero(r.compraron), 'ventas pagadas o entregadas hoy', null) + '</div>';
    var env = enviadosPorSegmento(hoy);
    var segs = cfg().segmentos.filter(function (s) { return (dia && Number(dia.cuotas[s.codigo]) > 0) || env[s.codigo]; });
    h += '<h4>Cuotas por segmento · enviados hoy con toque 1</h4>';
    if (!segs.length) h += '<p class="texto3">Hoy no hay cuotas de contactos.</p>';
    else h += '<div class="hoy-cuotas">' + segs.map(function (s) {
      var cuota = dia ? Number(dia.cuotas[s.codigo]) || 0 : 0, n = env[s.codigo] || 0;
      return '<div class="hoy-cuota" data-seg="' + U.attr(s.codigo) + '"><div class="hoy-cuota-fila"><span class="chip seg-' + U.esc(s.codigo) + '">' + U.esc(s.nombre) + '</span><span class="num">' + U.entero(n) + ' / ' + U.entero(cuota) + '</span></div>' + barra(n, cuota) + '</div>';
    }).join('') + '</div>';
    return h + '</div>';
  }
  function listaHtml(items, claveLimite, hoy) {
    var lim = estado.limites[claveLimite] || LIMITES[claveLimite.split(':')[0]] || 20;
    var h = '<div class="hoy-lista">' + items.slice(0, lim).map(function (it) { return tarjetaHtml(it, hoy); }).join('') + '</div>';
    if (items.length > lim) h += '<div class="acciones"><button type="button" class="btn chico" data-accion-hoy="ver-mas" data-limite="' + U.attr(claveLimite) + '">Ver ' + Math.min(PASO_VER_MAS, items.length - lim) + ' más · ' + (items.length - lim) + ' sin mostrar</button></div>';
    return h;
  }
  function gruposInicialHtml(items, hoy, dia) {
    var env = enviadosPorSegmento(hoy); var porSeg = {};
    items.forEach(function (it) { var s = it.contacto.segmento || ''; (porSeg[s] = porSeg[s] || []).push(it); });
    var orden = cfg().segmentos.map(function (s) { return s.codigo; });
    Object.keys(porSeg).forEach(function (k) { if (orden.indexOf(k) < 0) orden.push(k); });
    return orden.filter(function (seg) { return porSeg[seg]; }).map(function (seg) {
      var cuota = dia ? Number(dia.cuotas[seg]) || 0 : 0, n = env[seg] || 0;
      return '<div class="hoy-grupo" data-seg="' + U.attr(seg) + '"><h4><span class="chip seg-' + U.esc(seg) + '">' + U.esc(R.nombreSegmento(seg)) + '</span><span class="hoy-xy" data-xy>' + U.entero(n) + ' de ' + U.entero(cuota) + ' enviados</span><span class="texto3" data-en-cola>' + porSeg[seg].length + ' en cola</span></h4>' + listaHtml(porSeg[seg], 'nuevos:' + seg, hoy) + '</div>';
    }).join('');
  }
  function colaHtml(cola, hoy, dia) {
    if (!cola.length) return '<div class="tarjeta hoy-cola-tarjeta"><div class="fila-sup"><h3>Cola del día</h3><span class="hoy-cont" data-total>0</span></div><p class="texto2">Nada pendiente por ahora. Los nuevos toques salen de los contactos sin próximo toque que cumplen las reglas de recontacto; importe más contactos o revise el pipeline.</p></div>';
    var h = '<div class="tarjeta hoy-cola-tarjeta"><div class="fila-sup"><h3>Cola del día</h3><span class="hoy-cont" data-total>' + cola.length + '</span></div>';
    SECCIONES.forEach(function (s) {
      var items = cola.filter(function (it) { return s.id === 'vencidos' ? it.vencido : (!it.vencido && s.tipos.indexOf(it.tipo) >= 0); });
      if (!items.length) return;
      h += '<section class="hoy-seccion" data-seccion="' + s.id + '"><h3 class="hoy-seccion-titulo">' + U.esc(s.titulo) + ' <span class="hoy-cont" data-contador>' + items.length + '</span></h3>' +
        (s.id === 'nuevos' ? gruposInicialHtml(items, hoy, dia) : listaHtml(items, s.id, hoy)) + '</section>';
    });
    return h + '</div>';
  }
  // Enviados hoy que aún no responden: para marcar respuestas o compras que llegan durante el día
  function enviadosHoyHtml(hoy) {
    var porId = {}; DB.tabla('contactos').forEach(function (c) { porId[c.id] = c; });
    var lista = DB.tabla('interacciones').filter(function (i) { return String(i.fecha || '').slice(0, 10) === hoy && i.resultado === 'enviado' && porId[i.contactoId]; })
      .sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    if (!lista.length) return '';
    var h = '<details class="tarjeta hoy-enviados"><summary><h3>Enviados hoy, esperando respuesta</h3><span class="hoy-cont">' + lista.length + '</span><span class="texto3">Si alguien responde o compra durante el día, márquelo aquí.</span></summary><div class="tabla-scroll"><table class="tabla compacta"><tbody>';
    lista.slice(0, 150).forEach(function (i) {
      var c = porId[i.contactoId];
      h += '<tr data-id="' + U.attr(c.id) + '"><td class="num">' + U.esc(String(i.fecha).slice(11, 16)) + '</td><td><b>' + U.esc(c.nombre) + '</b><br><small class="texto3">' + U.esc(R.nombreSegmento(c.segmento)) + (i.toque !== '' ? ' · toque ' + U.esc(i.toque) : '') + ' · ' + U.esc(i.canal || '') + '</small></td>' +
        '<td class="acciones-fila"><button type="button" class="btn chico" data-accion-hoy="respondio-lista">Respondió</button><button type="button" class="btn chico" data-accion-hoy="venta-lista">Compró</button></td></tr>';
    });
    return h + '</tbody></table></div></details>';
  }
  function pieHtml(hoy, dia, cola) {
    var r = resumenHoy(hoy); var vencidos = cola.filter(function (it) { return it.vencido; }).length;
    var ultimoCierre = dia ? String(dia.notas || '').split('\n').filter(function (l) { return /^Cierre \d{2}:\d{2}:/.test(l); }).pop() : '';
    return '<h3>Cierre del día</h3><div class="hoy-pie-cifras">' +
      '<div><span class="lab">Enviados</span><b>' + U.entero(r.enviados) + '</b> <span class="texto2">/ cuota ' + U.entero(r.cuotaContactos) + '</span>' + barra(r.enviados, r.cuotaContactos) + '</div>' +
      '<div><span class="lab">Venta del día</span><b>' + U.soles(r.ventaDia) + '</b> <span class="texto2">/ meta ' + U.soles(r.metaDia) + '</span>' + barra(r.ventaDia, r.metaDia) + '</div></div>' +
      '<p class="texto3">Pendientes en la cola: ' + cola.length + (vencidos ? ' (' + vencidos + ' vencidos)' : '') + '. El día se da por cumplido con venta ≥ meta y enviados ≥ 70 % de la cuota; antes de las 18:00 queda "en curso".</p>' +
      (ultimoCierre ? '<p class="texto3">' + U.esc(ultimoCierre) + '</p>' : '') +
      '<div class="acciones">' + (dia ? '<button type="button" class="btn primario" data-accion-hoy="cerrar-dia">Cerrar el día</button>' : '') + '<button type="button" class="btn" data-accion-hoy="resumen-dia">Resumen copiable</button>' +
      (dia ? '<span class="pill' + clasePill(dia.estado) + '">' + U.esc(etiquetaEstado(dia.estado)) + '</span>' : '<span class="texto3">Hoy no es día de atención: no hay estado que fijar.</span>') + '</div>';
  }
  function alertaCorteHtml(hoy) {
    if (!(V.metricas && typeof V.metricas.alertaCorte === 'function')) return '';
    try {
      var a = V.metricas.alertaCorte(hoy); if (!a) return '';
      return (Array.isArray(a) ? a : [a]).map(function (x) {
        var txt = typeof x === 'string' ? x : (x && (x.texto || x.mensaje || x.titulo)) || ''; if (!txt) return '';
        var nivel = (x && typeof x === 'object' && (x.nivel || x.tipo)) || 'aviso';
        return '<p class="hoy-alerta ' + U.esc(nivel) + '">' + U.esc(txt) + '</p>';
      }).join('');
    } catch (e) { return ''; }
  }
  function proximosHtml(hoy) {
    var hasta = U.sumarDias(hoy, 7); var lista = [];
    cfg().fechasClave.forEach(function (f) { var fin = f.hasta || f.fecha; if (fin >= hoy && f.fecha <= hasta) lista.push({ fecha: f.fecha, hasta: f.hasta, texto: f.texto, tipo: f.tipo || 'hito' }); });
    cfg().cortes.forEach(function (c) { if (c.fecha >= hoy && c.fecha <= hasta && !lista.some(function (x) { return x.fecha === c.fecha && /corte/i.test(x.texto); })) lista.push({ fecha: c.fecha, texto: c.nombre, tipo: 'corte' }); });
    lista.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    var h = '<h3>Próximos 7 días</h3>' + alertaCorteHtml(hoy);
    if (!lista.length) return h + '<p class="texto2">Sin fechas clave ni cortes hasta el ' + U.esc(U.fechaCorta(hasta)) + '.</p>';
    return h + '<ul class="hoy-proximos">' + lista.map(function (x) {
      var enCurso = x.fecha < hoy;
      return '<li' + (x.fecha === hoy || enCurso ? ' class="hoy-es-hoy"' : '') + '><span class="hoy-fecha">' + (enCurso ? 'en curso' : U.esc(U.fechaCorta(x.fecha))) + (x.hasta && x.hasta !== x.fecha ? ' → ' + U.esc(U.fechaCorta(x.hasta)) : '') + '</span><span class="pill chica' + (x.tipo === 'corte' ? ' alerta' : '') + '">' + U.esc(ETIQUETA_TIPO[x.tipo] || x.tipo) + '</span><span>' + U.esc(x.texto) + '</span></li>';
    }).join('') + '</ul>';
  }

  /* =========================== Render =========================== */
  function render() {
    var r = raiz(); if (!r) return;
    var borradores = capturarBorradores(r);
    var hoy = U.hoyISO(); var dia = R.diaCalendario(hoy); var cola = E.colaDelDia(hoy);
    estado.items = {}; cola.forEach(function (it) { estado.items[claveDe(it)] = it; });
    r.innerHTML = cabeceraHtml(hoy, dia) +
      '<div id="hoy-resumen">' + resumenHtml(hoy, dia) + '</div>' +
      '<div id="hoy-cola">' + colaHtml(cola, hoy, dia) + '</div>' +
      '<div id="hoy-enviados">' + enviadosHoyHtml(hoy) + '</div>' +
      '<div class="grid-2 hoy-abajo"><div class="tarjeta hoy-pie" id="hoy-pie">' + pieHtml(hoy, dia, cola) + '</div><div class="tarjeta" id="hoy-proximos">' + proximosHtml(hoy) + '</div></div>';
    aplicarBorradores(r, borradores, hoy);
    enlazar(r);
  }
  // Lo escrito en las tarjetas (mensaje editado, plantilla elegida, formulario abierto) sobrevive a un re-render
  function capturarBorradores(r) {
    var m = {};
    UI.qsa('.hoy-card', r).forEach(function (card) {
      var ta = UI.qs('[data-campo="mensaje"]', card), sel = UI.qs('[data-campo="plantilla"]', card), as = UI.qs('[data-campo="asunto"]', card), inline = UI.qs('.hoy-inline', card);
      var b = { editado: card.getAttribute('data-editado') === '1', abierta: card.classList.contains('abierta'), plantilla: sel ? sel.value : null, mensaje: ta ? ta.value : null, asunto: as ? as.value : null,
        inlineModo: inline && !inline.hidden ? inline.getAttribute('data-modo') : '', inlineTexto: '', inlineFecha: '' };
      if (b.inlineModo) { var t = UI.qs('[data-inline="texto"]', inline), f = UI.qs('[data-inline="fecha"]', inline); b.inlineTexto = t ? t.value : ''; b.inlineFecha = f ? f.value : ''; }
      // la plantilla cuenta como borrador solo si el usuario la cambió respecto a la que se pintó
      if (b.editado || b.abierta || b.inlineModo || (sel && b.plantilla !== (card.getAttribute('data-plantilla') || ''))) m[card.getAttribute('data-clave')] = b;
    });
    return m;
  }
  function aplicarBorradores(r, borradores, hoy) {
    Object.keys(borradores).forEach(function (clave) {
      var b = borradores[clave]; var item = estado.items[clave]; var card = tarjetaPorClave(clave); if (!item || !card) return;
      var sel = UI.qs('[data-campo="plantilla"]', card);
      if (sel && b.plantilla != null && b.plantilla !== sel.value) { item.plantilla = b.plantilla ? DB.buscar('plantillas', b.plantilla) : null; card = reemplazarTarjeta(card, item, hoy); }
      if (b.editado) {
        var ta = UI.qs('[data-campo="mensaje"]', card), as = UI.qs('[data-campo="asunto"]', card);
        if (ta && b.mensaje != null) ta.value = b.mensaje; if (as && b.asunto != null) as.value = b.asunto;
        card.setAttribute('data-editado', '1'); actualizarEnlace(card);
      }
      if (b.abierta) card.classList.add('abierta');
      if (b.inlineModo) { abrirInline(card, b.inlineModo, true); var t = UI.qs('[data-inline="texto"]', card), f = UI.qs('[data-inline="fecha"]', card); if (t) t.value = b.inlineTexto; if (f) f.value = b.inlineFecha; }
    });
  }
  function reemplazarTarjeta(card, item, hoy) {
    var tmp = document.createElement('div'); tmp.innerHTML = tarjetaHtml(item, hoy || U.hoyISO());
    var nueva = tmp.firstElementChild; card.parentNode.replaceChild(nueva, card); return nueva;
  }
  function quitarTarjeta(card) {
    var r = raiz(); var seccion = card.closest('.hoy-seccion'), grupo = card.closest('.hoy-grupo');
    card.parentNode.removeChild(card);
    if (grupo && !UI.qs('.hoy-card', grupo)) grupo.parentNode.removeChild(grupo);
    else if (grupo) { var ec = UI.qs('[data-en-cola]', grupo); if (ec) ec.textContent = UI.qsa('.hoy-card', grupo).length + ' en cola'; }
    if (seccion) { var n = UI.qsa('.hoy-card', seccion).length; if (!n) seccion.parentNode.removeChild(seccion); else { var cont = UI.qs('[data-contador]', seccion); if (cont) cont.textContent = n; } }
    var total = UI.qs('#hoy-cola [data-total]', r); if (total) total.textContent = UI.qsa('#hoy-cola .hoy-card', r).length;
    if (!UI.qsa('#hoy-cola .hoy-card', r).length) render();
  }
  // KPIs, cuotas, "X de Y", lista de enviados y pie: lo que cambia con cada acción sin tocar las tarjetas
  function refrescarResumenes(hoy, cola) {
    var r = raiz(); var dia = R.diaCalendario(hoy);
    var res = UI.$('hoy-resumen'); if (res) res.innerHTML = resumenHtml(hoy, dia);
    var pie = UI.$('hoy-pie'); if (pie) pie.innerHTML = pieHtml(hoy, dia, cola);
    var env = UI.$('hoy-enviados'); if (env) { var abierto = !!UI.qs('details[open]', env); env.innerHTML = enviadosHoyHtml(hoy); var d = UI.qs('details', env); if (d && abierto) d.open = true; }
    var porSeg = enviadosPorSegmento(hoy);
    UI.qsa('#hoy-cola .hoy-grupo', r).forEach(function (g) { var seg = g.getAttribute('data-seg'); var xy = UI.qs('[data-xy]', g); if (xy) xy.textContent = U.entero(porSeg[seg] || 0) + ' de ' + U.entero(dia ? Number(dia.cuotas[seg]) || 0 : 0) + ' enviados'; });
  }
  // Tras una acción: la tarjeta desaparece, cambia o, si cambió de sección o entraron items nuevos, se redibuja todo conservando borradores
  function trasAccion(clave) {
    var hoy = U.hoyISO(); var cola = E.colaDelDia(hoy);
    var nuevos = {}; cola.forEach(function (it) { nuevos[claveDe(it)] = it; });
    var antes = estado.items[clave], ahora = nuevos[clave];
    var hayNuevos = Object.keys(nuevos).some(function (k) { return !estado.items[k]; });
    estado.items = nuevos;
    var card = tarjetaPorClave(clave);
    if (hayNuevos || (ahora && (!antes || !card || ahora.tipo !== antes.tipo || ahora.vencido !== antes.vencido))) { render(); return; }
    if (!ahora) { if (card) quitarTarjeta(card); }
    else reemplazarTarjeta(card, ahora, hoy);
    refrescarResumenes(hoy, cola);
  }

  /* =========================== Acciones =========================== */
  function plantillaElegida(card, item) { var sel = UI.qs('[data-campo="plantilla"]', card); if (!sel) return item.plantilla || null; return sel.value ? DB.buscar('plantillas', sel.value) : null; }
  function actualizarEnlace(card) {
    var item = estado.items[card.getAttribute('data-clave')]; var c = DB.buscar('contactos', card.getAttribute('data-id')); if (!item || !c) return;
    var a = UI.qs('a[data-accion-hoy="abrir"]', card); if (!a) return;
    var pl = plantillaElegida(card, item); var canal = canalDe(c, pl);
    var ta = UI.qs('[data-campo="mensaje"]', card), as = UI.qs('[data-campo="asunto"]', card);
    a.setAttribute('href', urlDe(c, canal, ta ? ta.value : '', as ? as.value : ''));
  }
  function copiarMensaje(card, ev) {
    var ta = UI.qs('[data-campo="mensaje"]', card); var texto = ta ? ta.value.trim() : '';
    if (!texto) { ev.preventDefault(); UI.toast('Escriba el mensaje antes de copiarlo', 'alerta'); return; }
    actualizarEnlace(card); card.classList.add('abierta');
    UI.copiar(texto).then(function (ok) { UI.toast(ok ? 'Mensaje copiado · cuando lo envíe, pulse "Marcar enviado"' : 'No se pudo copiar; el texto va en el enlace', ok ? '' : 'alerta'); });
  }
  function cambiarPlantilla(card, id) {
    var clave = card.getAttribute('data-clave'); var item = estado.items[clave]; if (!item) return;
    item.plantilla = id ? DB.buscar('plantillas', id) : null;
    var nueva = reemplazarTarjeta(card, item); var sel = UI.qs('[data-campo="plantilla"]', nueva); if (sel) sel.focus();
  }
  // Completar una variable desde la tarjeta: se guarda en el contacto y rearma el mensaje (si no fue editado a mano)
  function guardarVariable(card, input) {
    var item = estado.items[card.getAttribute('data-clave')]; var c = DB.buscar('contactos', card.getAttribute('data-id')); if (!item || !c) return;
    var campo = input.getAttribute('data-var'); var v = input.value;
    c[campo] = campo === 'personas' ? (v === '' ? '' : Number(v)) : v;
    DB.upsert('contactos', c);
    if (card.getAttribute('data-editado') !== '1') {
      var msg = mensajeDe(item, plantillaElegida(card, item), c);
      var ta = UI.qs('[data-campo="mensaje"]', card), as = UI.qs('[data-campo="asunto"]', card);
      if (ta) ta.value = msg.texto; if (as) as.value = msg.asunto;
    }
    actualizarEnlace(card);
  }
  function abrirInline(card, modo, forzar) {
    var caja = UI.qs('.hoy-inline', card); if (!caja) return;
    if (!forzar && !caja.hidden && caja.getAttribute('data-modo') === modo) { cerrarInline(card); return; }
    caja.setAttribute('data-modo', modo); caja.hidden = false;
    if (modo === 'respondio') caja.innerHTML = '<label class="campo"><span>¿Qué respondió?</span><textarea data-inline="texto" rows="2" placeholder="Copie o resuma la respuesta (opcional)"></textarea></label><div class="acciones"><button type="button" class="btn primario" data-accion-hoy="guardar-respuesta">Guardar respuesta</button><button type="button" class="btn chico" data-accion-hoy="cancelar-inline">Cancelar</button></div>';
    else if (modo === 'perdido') caja.innerHTML = '<label class="campo"><span>Motivo de pérdida</span><input data-inline="texto" placeholder="precio, fecha, sin interés…"></label><div class="acciones"><button type="button" class="btn peligro" data-accion-hoy="guardar-perdido">Marcar perdido</button><button type="button" class="btn chico" data-accion-hoy="cancelar-inline">Cancelar</button></div>';
    else if (modo === 'hecho') caja.innerHTML = '<div class="form-grid"><label class="campo"><span>Siguiente paso (opcional)</span><input data-inline="texto" placeholder="llamar, enviar cotización, visitar…"></label><label class="campo"><span>Fecha del siguiente paso (opcional)</span><input data-inline="fecha" type="date"><small>Sin fecha no vuelve a aparecer en Hoy; la encontrará en Pipeline.</small></label></div><div class="acciones"><button type="button" class="btn primario" data-accion-hoy="guardar-hecho">Guardar</button><button type="button" class="btn chico" data-accion-hoy="cancelar-inline">Cancelar</button></div>';
    var foco = UI.qs('[data-inline="texto"]', caja); if (foco && !forzar) foco.focus();
  }
  function cerrarInline(card) { var caja = UI.qs('.hoy-inline', card); if (caja) { caja.hidden = true; caja.innerHTML = ''; caja.removeAttribute('data-modo'); } }
  function textoInline(card, nombre) { var el = UI.qs('[data-inline="' + nombre + '"]', card); return el ? el.value.trim() : ''; }
  // Si el contacto ya tiene una cotización abierta se edita esa (para marcarla pagada) en vez de duplicar la venta
  function abrirVenta(c) {
    var abierta = DB.tabla('ventas').filter(function (v) { return v.contactoId === c.id && (v.estado === 'cotizado' || v.estado === 'link_enviado'); })
      .sort(function (a, b) { return String(b.fecha || '') > String(a.fecha || '') ? 1 : -1; })[0] || null;
    V.ventas.formVenta(abierta, { contacto: c, alGuardar: render });
  }
  // Pide un texto en un modal (para la lista de enviados, donde no hay tarjeta)
  function pedirTextoModal(titulo, placeholder, textoBoton, cb) {
    UI.abrirModal('<h3>' + U.esc(titulo) + '</h3><textarea id="hoy-modal-texto" rows="3" placeholder="' + U.attr(placeholder) + '"></textarea><div class="acciones"><button type="button" class="btn" data-accion="cerrar">Cancelar</button><button type="button" class="btn primario" id="hoy-modal-ok">' + U.esc(textoBoton) + '</button></div>');
    UI.$('hoy-modal-ok').onclick = function () { var t = UI.$('hoy-modal-texto').value.trim(); UI.cerrarModal(); cb(t); };
  }

  function accionContacto(acc, el, card, item) {
    var clave = card.getAttribute('data-clave'); var c = DB.buscar('contactos', card.getAttribute('data-id')); if (!c) { render(); return; }
    var pl = plantillaElegida(card, item); var ta = UI.qs('[data-campo="mensaje"]', card);
    switch (acc) {
      case 'enviado': {
        var canal = canalDe(c, pl);
        E.marcarEnviado(c, { canal: canal, plantilla: pl, mensaje: ta ? ta.value : '', toque: item.toque });
        UI.toast('Marcado como enviado' + (c.proximoToque ? ' · próximo toque el ' + U.fechaCorta(c.proximoToque) : ''));
        trasAccion(clave); break;
      }
      case 'respondio': abrirInline(card, 'respondio'); break;
      case 'guardar-respuesta': { var resp = textoInline(card, 'texto'); cerrarInline(card); E.marcarRespondio(c, resp); UI.toast('Respuesta registrada · pasa a Calificar'); trasAccion(clave); break; }
      case 'venta': abrirVenta(c); break;
      case 'posponer': { var n = parseInt(el.getAttribute('data-dias'), 10) || 1; c.proximoToque = U.sumarDias(U.hoyISO(), n); DB.upsert('contactos', c); UI.toast('Pospuesto al ' + U.fechaCorta(c.proximoToque)); trasAccion(clave); break; }
      case 'dormir':
        // Sin ola registrada, el núcleo lo volvería a proponer hoy mismo: se anota la ola actual para que vuelva en la siguiente
        if (!c.ultimaOla) c.ultimaOla = U.hoyISO();
        E.marcarDormido(c, item.tipo === 'cerrar_conversacion' ? 'sin respuesta tras ' + (c.toques || cfg().reglas.maxToques) + ' toques' : 'pausado desde la cola del día'); UI.toast('Dormido · vuelve en la siguiente ola'); trasAccion(clave); break;
      case 'perdido': abrirInline(card, 'perdido'); break;
      case 'guardar-perdido': { var motivo = textoInline(card, 'texto'); if (!motivo) { UI.toast('Indique el motivo de pérdida', 'alerta'); return; } cerrarInline(card); E.marcarPerdido(c, motivo); UI.toast('Marcado como perdido'); trasAccion(clave); break; }
      case 'ficha': if (typeof V.ui.fichaContacto === 'function') V.ui.fichaContacto(c); else UI.formContacto(c); break;
      case 'cancelar-inline': cerrarInline(card); break;
    }
  }
  function accionCuenta(acc, card) {
    var clave = card.getAttribute('data-clave'); var k = DB.buscar('cuentas', card.getAttribute('data-id')); if (!k) { render(); return; }
    switch (acc) {
      case 'hecho': abrirInline(card, 'hecho'); break;
      case 'guardar-hecho': {
        var paso = textoInline(card, 'texto'), fecha = U.isoDe(textoInline(card, 'fecha')); cerrarInline(card);
        k.notas = ((k.notas || '') + '\n' + U.fechaCorta(U.hoyISO()) + ': hecho · ' + (k.proximoPaso || 'paso sin detalle')).trim();
        k.proximoPaso = paso; k.fechaProximoPaso = fecha;
        DB.upsert('cuentas', k); UI.toast(paso ? 'Paso cumplido · siguiente: ' + paso + (fecha ? ' el ' + U.fechaCorta(fecha) : '') : 'Paso cumplido'); trasAccion(clave); break;
      }
      case 'ver-cuenta': UI.navegar('pipeline'); break;
      case 'cancelar-inline': cerrarInline(card); break;
    }
  }
  function accion(acc, el, card, fila) {
    if (acc === 'ver-mas') { var k = el.getAttribute('data-limite'); estado.limites[k] = (estado.limites[k] || LIMITES[k.split(':')[0]] || 20) + PASO_VER_MAS; render(); return; }
    if (acc === 'cerrar-dia') { cerrarDia(); return; }
    if (acc === 'resumen-dia') { mostrarResumen(U.hoyISO()); return; }
    if (acc === 'respondio-lista' || acc === 'venta-lista') {
      var c0 = fila ? DB.buscar('contactos', fila.getAttribute('data-id')) : null; if (!c0) return;
      if (acc === 'venta-lista') abrirVenta(c0);
      else pedirTextoModal('¿Qué respondió ' + (U.primerNombre(c0.nombre) || c0.nombre) + '?', 'Copie o resuma la respuesta (opcional)', 'Guardar respuesta', function (t) { E.marcarRespondio(c0, t); UI.toast('Respuesta registrada · pasa a Calificar'); render(); });
      return;
    }
    if (!card) return;
    var item = estado.items[card.getAttribute('data-clave')]; if (!item) { render(); return; }
    if (item.tipo === 'cuenta') accionCuenta(acc, card); else accionContacto(acc, el, card, item);
  }
  // Los eventos se enlazan una sola vez sobre la sección, que el núcleo nunca reemplaza
  function enlazar(r) {
    if (estado.enlazado) return; estado.enlazado = true;
    r.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-accion-hoy]'); if (!el) return;
      var card = el.closest('.hoy-card'); var fila = el.closest('tr[data-id]');
      if (el.getAttribute('data-accion-hoy') === 'abrir') { if (card) copiarMensaje(card, ev); return; } // el enlace abre WhatsApp o el correo
      ev.preventDefault(); accion(el.getAttribute('data-accion-hoy'), el, card, fila);
    });
    r.addEventListener('input', function (ev) {
      var el = ev.target; var card = el.closest('.hoy-card'); if (!card) return;
      var campo = el.getAttribute('data-campo');
      if (campo === 'mensaje' || campo === 'asunto') { card.setAttribute('data-editado', '1'); actualizarEnlace(card); }
      else if (el.hasAttribute('data-var')) guardarVariable(card, el);
    });
    r.addEventListener('change', function (ev) {
      var el = ev.target; var card = el.closest('.hoy-card'); if (!card) return;
      if (el.getAttribute('data-campo') === 'plantilla') cambiarPlantilla(card, el.value);
    });
  }

  /* =========================== Cierre del día =========================== */
  function textoResumen(hoy) {
    var dia = R.diaCalendario(hoy); var r = resumenHoy(hoy); var env = enviadosPorSegmento(hoy); var cola = E.colaDelDia(hoy);
    var vencidos = cola.filter(function (it) { return it.vencido; }).length;
    var l = ['HOY · ' + U.fechaLarga(hoy) + (dia ? ' · Ola ' + dia.ola : ' · sin atención')];
    if (dia && dia.foco) l.push('Foco: ' + dia.foco);
    l.push('Enviados: ' + r.enviados + ' de ' + r.cuotaContactos + (r.cuotaContactos ? ' (' + U.pct(r.enviados / r.cuotaContactos, 0) + ')' : ''));
    l.push('Respondieron: ' + r.respondieron + ' · Compraron: ' + r.compraron);
    l.push('Venta del día: ' + U.soles(r.ventaDia) + ' · meta ' + U.soles(r.metaDia) + ' · cuota oficial ' + U.soles(r.cuotaDia));
    var segs = cfg().segmentos.filter(function (s) { return (dia && Number(dia.cuotas[s.codigo]) > 0) || env[s.codigo]; });
    if (segs.length) l.push('Por segmento: ' + segs.map(function (s) { return s.nombre + ' ' + (env[s.codigo] || 0) + '/' + (dia ? Number(dia.cuotas[s.codigo]) || 0 : 0); }).join(' · '));
    l.push('Pendientes en la cola: ' + cola.length + (vencidos ? ' (' + vencidos + ' vencidos)' : ''));
    if (dia) l.push('Estado del día: ' + etiquetaEstado(dia.estado));
    return l.join('\n');
  }
  function mostrarResumen(hoy) {
    var txt = textoResumen(hoy);
    UI.abrirModal('<h3>Resumen del día</h3><textarea id="hoy-resumen-texto" rows="11" readonly>' + U.esc(txt) + '</textarea><div class="acciones"><button type="button" class="btn primario" id="hoy-copiar-resumen">Copiar</button><button type="button" class="btn" data-accion="cerrar">Cerrar</button></div>', { sinFoco: true });
    UI.$('hoy-copiar-resumen').onclick = function () { UI.copiar(txt).then(function (ok) { UI.toast(ok ? 'Resumen copiado' : 'No se pudo copiar; seleccione el texto', ok ? '' : 'alerta'); }); };
  }
  // Fija el estado del día del calendario con una nota automática y muestra el resumen copiable
  function cerrarDia() {
    var hoy = U.hoyISO(); var dia = R.diaCalendario(hoy);
    if (!dia) { UI.toast('Hoy no es día de atención del calendario', 'alerta'); return; }
    var r = resumenHoy(hoy);
    var cumpleVenta = r.ventaDia >= r.metaDia, cumpleEnvios = r.enviados >= Math.ceil(0.7 * r.cuotaContactos);
    var nuevo = cumpleVenta && cumpleEnvios ? 'cumplido' : (horaAhora() < '18:00' ? 'en_curso' : 'no_cumplido');
    var nota = 'Cierre ' + horaAhora() + ': enviados ' + r.enviados + ' de ' + r.cuotaContactos + ' · respondieron ' + r.respondieron + ' · compraron ' + r.compraron + ' · venta ' + U.soles(r.ventaDia) + ' de ' + U.soles(r.metaDia);
    var lineas = String(dia.notas || '').split('\n').filter(function (l) { return l && !/^Cierre \d{2}:\d{2}:/.test(l); });
    lineas.push(nota); dia.notas = lineas.join('\n'); dia.estado = nuevo;
    DB.upsert('calendario', dia);
    UI.toast('Día ' + etiquetaEstado(nuevo).toLowerCase() + (nuevo === 'en_curso' ? ' · aún falta y es antes de las 18:00' : ''));
    render();
    mostrarResumen(hoy);
  }

  V.registrarPantalla('hoy', render);
  V.hoy = { render: render, textoResumen: textoResumen, cerrarDia: cerrarDia, resumenHoy: resumenHoy };
})();
