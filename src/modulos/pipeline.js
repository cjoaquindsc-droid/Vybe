/* ============================================================================
   pipeline.js · Pantalla PIPELINE (parte 3) · Bodegas Viñas de Oro / The Pisco Room
   1) Personas: kanban por etapa del embudo con filtros, mover con botones o
      arrastrar, franja de dormidos / perdidos / B2B.
   2) Cuentas y eventos: kanban por estado de cuenta con formulario completo.
   3) Ficha del contacto (V.ui.fichaContacto) con embudo, datos, acciones,
      interacciones, ventas y cuentas; se abre también desde Contactos.
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, E = V.embudo, DB = V.DB, cfg = V.cfg;
  var ESTADOS_CUENTA = [
    { codigo: 'contactado', nombre: 'Contactado' }, { codigo: 'respondio', nombre: 'Respondió' }, { codigo: 'reunion', nombre: 'Reunión' },
    { codigo: 'cotizacion', nombre: 'Cotización' }, { codigo: 'cerrado', nombre: 'Cerrado' }, { codigo: 'perdido', nombre: 'Perdido' }
  ];
  var NOMBRE_ESTADO_VENTA = { cotizado: 'Cotizado', link_enviado: 'Link enviado', pagado: 'Pagado', entregado: 'Entregado', perdido: 'Perdido' };
  var LIMITE_COL = 60;
  var estado = { enlazado: false, mostrar: {}, arrastrando: null, timer: null };

  function raiz() { return UI.$('p-pipeline'); }
  function esObj(o) { return o != null && typeof o === 'object' && !Array.isArray(o); }
  function filtros() {
    var f = DB.datos.ui.filtros.pipeline;
    if (!esObj(f)) { f = { tab: 'personas', texto: '', segmento: '', perfil: '', vencidos: false, textoCuentas: '', segmentoCuentas: '' }; DB.datos.ui.filtros.pipeline = f; }
    return f;
  }
  function etapas() { return cfg().etapas; }
  function contactoDe(id) { return id ? DB.buscar('contactos', id) : null; }
  function ventasDe(cid) { return DB.tabla('ventas').filter(function (v) { return v.contactoId === cid; }); }
  function abiertasDe(cid) { return ventasDe(cid).filter(function (v) { return v.estado === 'cotizado' || v.estado === 'link_enviado'; }).reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0); }
  function cuentasDe(cid) { return DB.tabla('cuentas').filter(function (k) { return Array.isArray(k.contactos) && k.contactos.indexOf(cid) >= 0; }); }
  function nombreEstadoCuenta(c) { var e = ESTADOS_CUENTA.filter(function (x) { return x.codigo === c; })[0]; return e ? e.nombre : (c || '—'); }
  function chipSeg(c) { return '<span class="chip seg-' + U.esc(c.segmento) + '">' + U.esc(R.nombreSegmento(c.segmento)) + '</span>'; }

  /* =========================== Render general =========================== */
  function render() {
    enlazar();
    var f = filtros(); var tab = f.tab === 'cuentas' ? 'cuentas' : 'personas';
    raiz().innerHTML = '<div class="cabecera-pantalla"><h2>Pipeline</h2><p class="sub" id="pipeConteo"></p><nav class="subnav"><button type="button" class="btn chico' + (tab === 'personas' ? ' activa' : '') + '" data-pipe="tab" data-tab="personas">Personas</button><button type="button" class="btn chico' + (tab === 'cuentas' ? ' activa' : '') + '" data-pipe="tab" data-tab="cuentas">Cuentas y eventos</button></nav></div><div id="pipeCuerpo"></div>';
    if (tab === 'cuentas') renderCuentas(); else renderPersonas();
  }

  /* =========================== 1) Personas =========================== */
  function contactosFiltrados() {
    var f = filtros(); var t = U.normTexto(f.texto); var dig = String(f.texto || '').replace(/\D/g, ''); var hoy = U.hoyISO();
    return DB.tabla('contactos').filter(function (c) {
      if (f.segmento && c.segmento !== f.segmento) return false;
      if (f.perfil && c.perfil !== f.perfil) return false;
      if (f.vencidos && !(c.proximoToque && c.proximoToque < hoy)) return false;
      if (t && U.normTexto([c.nombre, c.empresa, c.correo, c.subsegmento].join(' ')).indexOf(t) < 0 && !(dig.length >= 4 && U.telefonoDigitos(c.telefono).indexOf(dig) >= 0)) return false;
      return true;
    });
  }
  function tarjetaContacto(c, i, n) {
    var hoy = U.hoyISO(); var venc = c.proximoToque && c.proximoToque < hoy; var abiertas = abiertasDe(c.id);
    return '<div class="pipe-card' + (venc ? ' vencida' : '') + '" draggable="true" data-id="' + U.attr(c.id) + '">' +
      '<div class="pipe-card-cab"><b class="pipe-nombre">' + U.esc(c.nombre || '(sin nombre)') + '</b>' + chipSeg(c) + (c.prueba ? '<span class="pill chica">prueba</span>' : '') + '</div>' +
      '<div class="pipe-dato texto3">' + U.esc(c.telefono || c.correo || 'sin teléfono') + (c.empresa ? ' · ' + U.esc(c.empresa) : '') + '</div>' +
      '<div class="pipe-dato' + (venc ? ' mal' : c.proximoToque === hoy ? ' bien' : '') + '">' + (c.proximoToque ? 'Próximo toque ' + U.esc(U.fechaCorta(c.proximoToque)) + (venc ? ' · vencido' : '') : 'Sin próximo toque') + (c.toques ? ' · toque ' + U.esc(c.toques) + ' de 3' : '') + '</div>' +
      (c.ocasion || c.personas ? '<div class="pipe-dato">' + U.esc(c.ocasion || '') + (c.personas ? (c.ocasion ? ' · ' : '') + U.esc(c.personas) + ' personas' : '') + '</div>' : '') +
      (abiertas ? '<div class="pipe-abierto">Abierto: ' + U.soles(abiertas) + '</div>' : '') +
      '<div class="pipe-card-acciones"><button type="button" class="btn chico pipe-mover" data-pipe="mover" data-id="' + U.attr(c.id) + '" data-dir="-1" title="Etapa anterior"' + (i === 0 ? ' disabled' : '') + '>◀</button><button type="button" class="btn chico pipe-mover" data-pipe="mover" data-id="' + U.attr(c.id) + '" data-dir="1" title="Etapa siguiente"' + (i === n - 1 ? ' disabled' : '') + '>▶</button>' +
      (c.telefono ? '<a class="btn chico" target="_blank" rel="noopener" href="' + U.attr(R.urlWhatsApp(c.telefono)) + '">WhatsApp</a>' : '') + '<button type="button" class="btn chico" data-pipe="ficha" data-id="' + U.attr(c.id) + '">Ficha</button></div></div>';
  }
  function renderPersonas() {
    var f = filtros(); var cuerpo = UI.$('pipeCuerpo'); var lista = contactosFiltrados(); var ets = etapas(); var hoy = U.hoyISO();
    var activos = lista.filter(function (c) { return (c.estado || 'activo') === 'activo'; });
    var porEtapa = {}; ets.forEach(function (e) { porEtapa[e.codigo] = []; });
    activos.forEach(function (c) { (porEtapa[c.etapa] || porEtapa.atraer).push(c); });
    Object.keys(porEtapa).forEach(function (k) { porEtapa[k].sort(function (a, b) { var pa = a.proximoToque || '9999', pb = b.proximoToque || '9999'; return pa < pb ? -1 : pa > pb ? 1 : String(a.nombre).localeCompare(String(b.nombre)); }); });
    var otros = { dormido: lista.filter(function (c) { return c.estado === 'dormido'; }), perdido: lista.filter(function (c) { return c.estado === 'perdido'; }), b2b: lista.filter(function (c) { return c.estado === 'b2b'; }) };
    UI.$('pipeConteo').textContent = U.entero(activos.length) + ' activos en el embudo · ' + U.entero(otros.dormido.length) + ' dormidos · ' + U.entero(otros.perdido.length) + ' perdidos · ' + U.entero(otros.b2b.length) + ' B2B';
    var h = '<div class="tarjeta filtros pipe-filtros"><input type="search" name="texto" placeholder="Buscar nombre, empresa, teléfono o correo" value="' + U.attr(f.texto) + '">' +
      '<select name="segmento">' + UI.opcionesSegmentos(f.segmento, 'Todos los segmentos') + '</select>' +
      '<select name="perfil">' + UI.opciones([{ valor: 'A', texto: 'Perfil A' }, { valor: 'B', texto: 'Perfil B' }], f.perfil, 'Todos los perfiles') + '</select>' +
      '<label class="pipe-check"><input type="checkbox" name="vencidos"' + (f.vencidos ? ' checked' : '') + '> Solo toques vencidos</label>' +
      '<button type="button" class="btn chico primario" data-pipe="nuevo-contacto">Nuevo contacto</button></div>' +
      '<div class="pipe-tabs-movil">' + ets.map(function (e) { return '<button type="button" class="btn chico" data-pipe="ir-col" data-etapa="' + U.attr(e.codigo) + '">' + U.esc(e.nombre) + ' <span class="pipe-cont">' + porEtapa[e.codigo].length + '</span></button>'; }).join('') + '</div>' +
      '<div class="pipe-tablero" id="pipeTablero">';
    ets.forEach(function (e, i) {
      var col = porEtapa[e.codigo]; var suma = col.reduce(function (s, c) { return s + abiertasDe(c.id); }, 0); var venc = col.filter(function (c) { return c.proximoToque && c.proximoToque < hoy; }).length;
      var lim = estado.mostrar[e.codigo] || LIMITE_COL;
      h += '<div class="pipe-col" data-etapa="' + U.attr(e.codigo) + '"><div class="pipe-col-cab"><h3>' + U.esc(e.nombre) + ' <span class="pipe-cont">' + col.length + '</span></h3><div class="pipe-col-suma' + (suma ? '' : ' vacia') + '">' + (suma ? 'Abierto ' + U.soles(suma) : 'Sin oportunidades abiertas') + '</div><div class="pipe-col-detalle">' + U.esc(e.detalle || '') + (venc ? ' · <span class="mal">' + venc + ' vencidos</span>' : '') + '</div></div><div class="pipe-col-cuerpo">';
      if (!col.length) h += '<div class="pipe-vacia">Nadie en esta etapa</div>';
      h += col.slice(0, lim).map(function (c) { return tarjetaContacto(c, i, ets.length); }).join('');
      if (col.length > lim) h += '<button type="button" class="btn chico pipe-ver-mas" data-pipe="ver-mas" data-etapa="' + U.attr(e.codigo) + '">Ver ' + (col.length - lim) + ' más</button>';
      h += '</div></div>';
    });
    h += '</div>';
    h += '<details class="pipe-otros tarjeta"><summary><h3>Fuera del embudo</h3><span class="chip">' + otros.dormido.length + ' dormidos</span><span class="chip">' + otros.perdido.length + ' perdidos</span><span class="chip">' + otros.b2b.length + ' derivados a B2B</span></summary>' +
      '<div class="tabla-scroll"><table class="tabla compacta pipe-tabla"><thead><tr><th>Contacto</th><th>Segmento</th><th>Estado</th><th>Último contacto</th><th>Nota</th><th></th></tr></thead><tbody>' +
      ['dormido', 'perdido', 'b2b'].map(function (k) { return otros[k].slice(0, 200).map(function (c) { return '<tr data-id="' + U.attr(c.id) + '"><td data-label="Contacto"><b>' + U.esc(c.nombre) + '</b><br><small class="texto3">' + U.esc(c.telefono || '') + '</small></td><td data-label="Segmento">' + chipSeg(c) + '</td><td data-label="Estado"><span class="pill">' + U.esc(c.estado) + '</span></td><td data-label="Último contacto">' + U.esc(U.fechaCorta(c.ultimoContacto) || '—') + '</td><td data-label="Nota" class="celda-larga"><span class="pipe-nota-corta">' + U.esc(String(c.notas || '').split('\n').pop().slice(0, 90)) + '</span></td><td class="acciones-fila"><button type="button" class="btn chico" data-pipe="reactivar" data-id="' + U.attr(c.id) + '">Reactivar</button><button type="button" class="btn chico" data-pipe="ficha" data-id="' + U.attr(c.id) + '">Ficha</button></td></tr>'; }).join(''); }).join('') +
      (!otros.dormido.length && !otros.perdido.length && !otros.b2b.length ? '<tr><td colspan="6" class="vacio">Nadie fuera del embudo</td></tr>' : '') + '</tbody></table></div><p class="texto3 pad">Dormidos: sin respuesta tras tres toques; vuelven a la cola en la siguiente ola. Reactivar los devuelve a Atraer para escribirles ya.</p></details>';
    cuerpo.innerHTML = h;
    enlazarArrastre();
  }
  function moverEtapa(c, etapa) {
    if (!c || !etapa || c.etapa === etapa) return;
    c.etapa = etapa; if (c.estado !== 'activo') c.estado = 'activo';
    if (etapa === 'fidelizar') c.yaCompro = true;
    DB.upsert('contactos', c); UI.toast(U.primerNombre(c.nombre) + ' → ' + R.nombreEtapa(etapa));
  }
  function moverDir(id, dir) {
    var c = contactoDe(id); if (!c) return; var ets = etapas().map(function (e) { return e.codigo; });
    var i = ets.indexOf(c.etapa || 'atraer') + dir; if (i < 0 || i >= ets.length) return;
    moverEtapa(c, ets[i]); renderPersonas();
  }
  function enlazarArrastre() {
    var tab = UI.$('pipeTablero'); if (!tab) return;
    tab.addEventListener('dragstart', function (ev) { var card = ev.target.closest('.pipe-card'); if (!card) return; estado.arrastrando = card.getAttribute('data-id'); card.classList.add('arrastrando'); try { ev.dataTransfer.setData('text/plain', estado.arrastrando); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { } });
    tab.addEventListener('dragend', function (ev) { var card = ev.target.closest('.pipe-card'); if (card) card.classList.remove('arrastrando'); UI.qsa('.pipe-col.destino', tab).forEach(function (x) { x.classList.remove('destino'); }); });
    tab.addEventListener('dragover', function (ev) { var col = ev.target.closest('.pipe-col'); if (!col || !estado.arrastrando) return; ev.preventDefault(); UI.qsa('.pipe-col.destino', tab).forEach(function (x) { if (x !== col) x.classList.remove('destino'); }); col.classList.add('destino'); });
    tab.addEventListener('dragleave', function (ev) { var col = ev.target.closest('.pipe-col'); if (col && !col.contains(ev.relatedTarget)) col.classList.remove('destino'); });
    tab.addEventListener('drop', function (ev) { var col = ev.target.closest('.pipe-col'); if (!col) return; ev.preventDefault(); var id = estado.arrastrando || (ev.dataTransfer && ev.dataTransfer.getData('text/plain')); estado.arrastrando = null; var c = contactoDe(id); if (c) { moverEtapa(c, col.getAttribute('data-etapa')); renderPersonas(); } });
  }

  /* =========================== 2) Cuentas y eventos =========================== */
  function cuentasFiltradas() {
    var f = filtros(); var t = U.normTexto(f.textoCuentas);
    return DB.tabla('cuentas').filter(function (k) {
      if (f.segmentoCuentas && k.segmento !== f.segmentoCuentas) return false;
      if (t) { var nombres = (k.contactos || []).map(function (id) { var c = contactoDe(id); return c ? c.nombre : ''; }).join(' '); if (U.normTexto([k.empresa, k.notas, k.proximoPaso, nombres].join(' ')).indexOf(t) < 0) return false; }
      return true;
    });
  }
  function tarjetaCuenta(k, i, n) {
    var hoy = U.hoyISO(); var venc = k.fechaProximoPaso && k.fechaProximoPaso < hoy && ['cerrado', 'perdido'].indexOf(k.estado) < 0;
    var nombres = (k.contactos || []).map(function (id) { var c = contactoDe(id); return c ? c.nombre : ''; }).filter(Boolean);
    return '<div class="pipe-card' + (venc ? ' vencida' : '') + '" data-cuenta="' + U.attr(k.id) + '">' +
      '<div class="pipe-card-cab"><b class="pipe-nombre">' + U.esc(k.empresa || '(sin nombre)') + '</b>' + (k.segmento ? '<span class="chip seg-' + U.esc(k.segmento) + '">' + U.esc(R.nombreSegmento(k.segmento)) + '</span>' : '') + (k.prueba ? '<span class="pill chica">prueba</span>' : '') + '</div>' +
      '<div class="pipe-dato">' + (k.personas ? U.esc(k.personas) + ' personas' : 'Personas por definir') + (k.fechaEvento ? ' · evento ' + U.esc(U.fechaCorta(k.fechaEvento)) : '') + (k.paquete ? ' · ' + U.esc(nombrePaquete(k.paquete)) : '') + '</div>' +
      (Number(k.monto) ? '<div class="pipe-abierto">' + U.soles(k.monto) + '</div>' : '') +
      (k.proximoPaso ? '<div class="pipe-dato' + (venc ? ' mal' : '') + '">Próximo paso: ' + U.esc(k.proximoPaso) + (k.fechaProximoPaso ? ' · ' + U.esc(U.fechaCorta(k.fechaProximoPaso)) + (venc ? ' (vencido)' : '') : '') + '</div>' : '') +
      (nombres.length ? '<div class="pipe-dato texto3">' + U.esc(nombres.join(', ')) + '</div>' : '') +
      '<div class="pipe-card-acciones"><button type="button" class="btn chico pipe-mover" data-pipe="mover-cuenta" data-id="' + U.attr(k.id) + '" data-dir="-1"' + (i === 0 ? ' disabled' : '') + '>◀</button><button type="button" class="btn chico pipe-mover" data-pipe="mover-cuenta" data-id="' + U.attr(k.id) + '" data-dir="1"' + (i === n - 1 ? ' disabled' : '') + '>▶</button><button type="button" class="btn chico" data-pipe="editar-cuenta" data-id="' + U.attr(k.id) + '">Editar</button><button type="button" class="btn chico" data-pipe="venta-cuenta" data-id="' + U.attr(k.id) + '">Venta</button></div></div>';
  }
  function nombrePaquete(id) { if (!id) return ''; var p = cfg().paquetesGrupo.filter(function (x) { return x.id === id; })[0]; if (p) return 'Paquete ' + p.nombre; var e = cfg().experiencias.filter(function (x) { return x.id === id; })[0]; return e ? e.nombre : id; }
  function renderCuentas() {
    var f = filtros(); var cuerpo = UI.$('pipeCuerpo'); var lista = cuentasFiltradas();
    var porEstado = {}; ESTADOS_CUENTA.forEach(function (e) { porEstado[e.codigo] = []; });
    lista.forEach(function (k) { (porEstado[k.estado] || porEstado.contactado).push(k); });
    var abiertas = lista.filter(function (k) { return ['cerrado', 'perdido'].indexOf(k.estado) < 0; });
    UI.$('pipeConteo').textContent = U.entero(abiertas.length) + ' cuentas abiertas · ' + U.soles(abiertas.reduce(function (s, k) { return s + (Number(k.monto) || 0); }, 0)) + ' en juego';
    var h = '<div class="tarjeta filtros pipe-filtros pipe-filtros-cuentas"><input type="search" name="textoCuentas" placeholder="Buscar empresa, contacto o paso" value="' + U.attr(f.textoCuentas) + '"><select name="segmentoCuentas">' + UI.opciones(['corporativo', 'pyme', 'grupos', 'breca'].map(function (s) { return { valor: s, texto: R.nombreSegmento(s) }; }), f.segmentoCuentas, 'Todos los segmentos') + '</select><button type="button" class="btn chico primario" data-pipe="nueva-cuenta">Nueva cuenta</button></div>' +
      '<div class="pipe-tabs-movil">' + ESTADOS_CUENTA.map(function (e) { return '<button type="button" class="btn chico" data-pipe="ir-col" data-etapa="' + U.attr(e.codigo) + '">' + U.esc(e.nombre) + ' <span class="pipe-cont">' + porEstado[e.codigo].length + '</span></button>'; }).join('') + '</div><div class="pipe-tablero" id="pipeTablero">';
    ESTADOS_CUENTA.forEach(function (e, i) {
      var col = porEstado[e.codigo]; var suma = col.reduce(function (s, k) { return s + (Number(k.monto) || 0); }, 0);
      h += '<div class="pipe-col" data-etapa="' + U.attr(e.codigo) + '"><div class="pipe-col-cab"><h3>' + U.esc(e.nombre) + ' <span class="pipe-cont">' + col.length + '</span></h3><div class="pipe-col-suma' + (suma ? '' : ' vacia') + '">' + (suma ? U.soles(suma) : 'Sin monto') + '</div></div><div class="pipe-col-cuerpo">' + (col.length ? col.map(function (k) { return tarjetaCuenta(k, i, ESTADOS_CUENTA.length); }).join('') : '<div class="pipe-vacia">Sin cuentas</div>') + '</div></div>';
    });
    cuerpo.innerHTML = h + '</div><p class="texto3">Las cuentas con próximo paso vencido aparecen en HOY. Registre la venta desde la cuenta para que el contacto principal pase a Cerrar.</p>';
  }
  function moverCuenta(id, dir) {
    var k = DB.buscar('cuentas', id); if (!k) return; var codigos = ESTADOS_CUENTA.map(function (e) { return e.codigo; });
    var i = codigos.indexOf(k.estado || 'contactado') + dir; if (i < 0 || i >= codigos.length) return;
    k.estado = codigos[i]; DB.upsert('cuentas', k); renderCuentas();
  }
  function formCuenta(original) {
    var k = original ? U.clonar(original) : { empresa: '', segmento: 'corporativo', contactos: [], paquete: '', personas: '', fechaEvento: '', monto: '', estado: 'contactado', notas: '', proximoPaso: '', fechaProximoPaso: '' };
    var paquetes = [{ valor: '', texto: 'Sin paquete' }].concat(cfg().paquetesGrupo.map(function (p) { return { valor: p.id, texto: 'Paquete ' + p.nombre + ' · ' + U.soles(p.precio30) + ' (30 personas)' + (p.estado === 'por_confirmar' ? ' · por confirmar' : '') }; })).concat(cfg().experiencias.map(function (e) { return { valor: e.id, texto: e.nombre + ' · ' + U.soles(e.precio) + ' por persona' }; }));
    var h = '<h3>' + (original ? 'Editar cuenta' : 'Nueva cuenta o evento') + '</h3><form id="formCuenta" class="form-grid" autocomplete="off">' +
      UI.campo('Empresa o evento', UI.inp('empresa', k.empresa, 'required')) +
      UI.campo('Segmento', '<select name="segmento">' + UI.opciones(['corporativo', 'pyme', 'grupos', 'breca'].map(function (s) { return { valor: s, texto: R.nombreSegmento(s) }; }), k.segmento) + '</select>') +
      '<div class="campo ancho"><span>Contactos</span><div class="pipe-chips" id="cuentaChips"></div><div class="pipe-buscador"><input id="cuentaBuscar" placeholder="Escriba un nombre o teléfono para agregar"><div class="pipe-sugerencias" id="cuentaSug" hidden></div></div>' +
      '<div class="pipe-nuevo" id="cuentaNuevo" hidden><div class="form-grid">' + UI.campo('Nombre', '<input id="nuevoNombre">') + UI.campo('Teléfono', '<input id="nuevoTel" inputmode="tel">') + UI.campo('Cargo', '<input id="nuevoCargo">') + '</div><div class="acciones"><button type="button" class="btn chico primario" id="nuevoCrear">Crear y agregar</button><button type="button" class="btn chico" id="nuevoCancelar">Cancelar</button></div></div>' +
      '<small><button type="button" class="pipe-enlace" id="cuentaNuevoBtn">Crear un contacto nuevo</button></small></div>' +
      UI.campo('Paquete o experiencia', '<select name="paquete">' + UI.opciones(paquetes, k.paquete) + '</select>') +
      UI.campo('Personas', UI.inp('personas', k.personas, 'type="number" min="0" inputmode="numeric"')) +
      UI.campo('Fecha del evento', UI.inp('fechaEvento', k.fechaEvento, 'type="date"')) +
      UI.campo('Monto (S/)', UI.inp('monto', k.monto, 'type="number" step="0.01" min="0" inputmode="decimal"') + '<small><button type="button" class="pipe-enlace" id="cuentaSugerir">Sugerir monto según paquete y personas</button></small>') +
      UI.campo('Estado', '<select name="estado">' + UI.opciones(ESTADOS_CUENTA.map(function (e) { return { valor: e.codigo, texto: e.nombre }; }), k.estado) + '</select>') +
      UI.campo('Próximo paso', UI.inp('proximoPaso', k.proximoPaso, 'placeholder="Llamar, enviar propuesta, reunión…"')) +
      UI.campo('Fecha del próximo paso', UI.inp('fechaProximoPaso', k.fechaProximoPaso, 'type="date"')) +
      '<label class="campo ancho"><span>Notas</span><textarea name="notas" rows="3">' + U.esc(k.notas || '') + '</textarea></label>' +
      '<div class="acciones ancho">' + (original ? '<button type="button" class="btn peligro izq" id="cuentaEliminar">Eliminar</button>' : '') + '<button type="button" class="btn" data-accion="cerrar">Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></form>';
    UI.abrirModal(h, { ancho: 'ancho' });
    var m = UI.$('modalContenido'); var form = UI.$('formCuenta');
    var seleccion = (k.contactos || []).slice();
    function pintarChips() { UI.$('cuentaChips').innerHTML = seleccion.map(function (id) { var c = contactoDe(id); return c ? '<span class="pipe-chip-contacto">' + U.esc(c.nombre) + (c.cargo ? '<small>' + U.esc(c.cargo) + '</small>' : '') + '<button type="button" data-quitar="' + U.attr(id) + '" aria-label="Quitar">×</button></span>' : ''; }).join('') || '<small class="texto3">Sin contactos todavía</small>'; }
    pintarChips();
    UI.$('cuentaChips').addEventListener('click', function (ev) { var b = ev.target.closest('[data-quitar]'); if (!b) return; seleccion = seleccion.filter(function (x) { return x !== b.getAttribute('data-quitar'); }); pintarChips(); });
    var buscar = UI.$('cuentaBuscar'), sug = UI.$('cuentaSug');
    buscar.addEventListener('input', function () {
      var t = U.normTexto(buscar.value); var dig = buscar.value.replace(/\D/g, ''); if (t.length < 2 && dig.length < 4) { sug.hidden = true; return; }
      var res = DB.tabla('contactos').filter(function (c) { return seleccion.indexOf(c.id) < 0 && (U.normTexto([c.nombre, c.empresa].join(' ')).indexOf(t) >= 0 || (dig.length >= 4 && U.telefonoDigitos(c.telefono).indexOf(dig) >= 0)); }).slice(0, 8);
      sug.innerHTML = res.length ? res.map(function (c) { return '<button type="button" data-elegir="' + U.attr(c.id) + '">' + U.esc(c.nombre) + '<small>' + U.esc([c.empresa, c.cargo, c.telefono].filter(Boolean).join(' · ')) + '</small></button>'; }).join('') : '<div class="pipe-sin">Sin coincidencias. Puede crear un contacto nuevo.</div>';
      sug.hidden = false;
    });
    sug.addEventListener('click', function (ev) { var b = ev.target.closest('[data-elegir]'); if (!b) return; seleccion.push(b.getAttribute('data-elegir')); pintarChips(); buscar.value = ''; sug.hidden = true; });
    UI.$('cuentaNuevoBtn').onclick = function () { UI.$('cuentaNuevo').hidden = false; UI.$('nuevoNombre').focus(); };
    UI.$('nuevoCancelar').onclick = function () { UI.$('cuentaNuevo').hidden = true; };
    UI.$('nuevoCrear').onclick = function () {
      var nombre = UI.$('nuevoNombre').value.trim(); if (!nombre) { UI.toast('Escriba el nombre', 'alerta'); return; }
      var tel = U.normTelefono(UI.$('nuevoTel').value);
      var dup = tel ? DB.tabla('contactos').filter(function (x) { return U.telefonoDigitos(x.telefono) === U.telefonoDigitos(tel); })[0] : null;
      var c = dup || DB.upsert('contactos', { nombre: nombre, telefono: tel, correo: '', empresa: UI.qs('[name="empresa"]', form).value.trim(), cargo: UI.$('nuevoCargo').value.trim(), ciudad: 'Lima', segmento: UI.qs('[name="segmento"]', form).value, subsegmento: UI.qs('[name="empresa"]', form).value.trim(), origen: 'Cuenta', perfil: 'A', consentimiento: false, etapa: 'atraer', estado: 'activo', toques: 0, notas: '' });
      if (dup) UI.toast('Ya existía: ' + dup.nombre);
      if (seleccion.indexOf(c.id) < 0) seleccion.push(c.id); pintarChips(); UI.$('cuentaNuevo').hidden = true; UI.$('nuevoNombre').value = ''; UI.$('nuevoTel').value = ''; UI.$('nuevoCargo').value = '';
    };
    UI.$('cuentaSugerir').onclick = function () {
      var pid = UI.qs('[name="paquete"]', form).value; var n = Number(UI.qs('[name="personas"]', form).value) || 0;
      var p = cfg().paquetesGrupo.filter(function (x) { return x.id === pid; })[0]; var e = cfg().experiencias.filter(function (x) { return x.id === pid; })[0];
      var monto = p ? Math.round((Number(p.precio30) || 0) * (n || p.personasBase || 30) / (p.personasBase || 30) / 10) * 10 : e ? Math.round((Number(e.precio) || 0) * n * 100) / 100 : 0;
      if (!monto) { UI.toast('Elija un paquete o experiencia y el número de personas', 'alerta'); return; }
      UI.qs('[name="monto"]', form).value = monto;
    };
    var elim = UI.$('cuentaEliminar'); if (elim) elim.onclick = function () { if (window.confirm('¿Eliminar la cuenta ' + (k.empresa || '') + '?')) { DB.eliminar('cuentas', original.id); UI.cerrarModal(); UI.toast('Cuenta eliminada'); render(); } };
    UI.qs('[data-accion="cerrar"]', form).onclick = UI.cerrarModal;
    form.onsubmit = function (ev) {
      ev.preventDefault(); var f = UI.leerForm(form);
      var nueva = original ? U.clonar(original) : {};
      ['empresa', 'segmento', 'paquete', 'estado', 'proximoPaso', 'notas'].forEach(function (x) { nueva[x] = String(f[x] || '').trim(); });
      nueva.personas = f.personas === '' ? '' : Number(f.personas); nueva.monto = f.monto === '' ? 0 : Number(f.monto); nueva.fechaEvento = U.isoDe(f.fechaEvento); nueva.fechaProximoPaso = U.isoDe(f.fechaProximoPaso); nueva.contactos = seleccion.slice();
      if (!nueva.empresa) { UI.toast('Escriba el nombre de la empresa o evento', 'alerta'); return; }
      DB.upsert('cuentas', nueva); UI.cerrarModal(); UI.toast('Cuenta guardada'); render();
    };
  }

  /* =========================== 3) Ficha del contacto =========================== */
  function fichaContacto(id) {
    var c = (id && typeof id === 'object') ? contactoDe(id.id) : contactoDe(id); if (!c) { UI.toast('No se encontró el contacto', 'alerta'); return; }
    var hoy = U.hoyISO(); var ets = etapas(); var idx = ets.map(function (e) { return e.codigo; }).indexOf(c.etapa || 'atraer');
    var inter = DB.tabla('interacciones').filter(function (i) { return i.contactoId === c.id; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    var ventas = ventasDe(c.id).sort(function (a, b) { return (a.fechaCierre || a.fecha) < (b.fechaCierre || b.fecha) ? 1 : -1; }); var cuentas = cuentasDe(c.id);
    var venc = c.proximoToque && c.proximoToque < hoy; var permiso = R.puedeIniciarOla(c, hoy);
    function dato(lab, val, cls) { return '<div class="pipe-dato-f"><span class="lab">' + U.esc(lab) + '</span><span class="val' + (cls ? ' ' + cls : '') + '">' + (val || '—') + '</span></div>'; }
    var h = '<div class="pipe-ficha" data-id="' + U.attr(c.id) + '"><div class="pipe-ficha-cab"><h3>' + U.esc(c.nombre || '(sin nombre)') + '</h3>' + chipSeg(c) + (c.subsegmento ? '<span class="pill">' + U.esc(c.subsegmento) + '</span>' : '') + (c.perfil ? '<span class="pill">Perfil ' + U.esc(c.perfil) + '</span>' : '') + ((c.estado || 'activo') !== 'activo' ? '<span class="pill alerta">' + U.esc(c.estado) + '</span>' : '') + (c.prueba ? '<span class="pill chica">prueba</span>' : '') + '</div>' +
      '<div class="pipe-embudo">' + ets.map(function (e, i) { return '<div class="pipe-paso' + (i < idx ? ' hecho' : i === idx ? ' actual' : '') + '" title="' + U.attr(e.detalle || '') + '">' + U.esc(e.nombre) + '</div>'; }).join('') + '</div>' +
      '<div class="pipe-datos">' + dato('Teléfono', c.telefono ? U.esc(c.telefono) + '<a class="btn chico" target="_blank" rel="noopener" href="' + U.attr(R.urlWhatsApp(c.telefono)) + '">WhatsApp</a>' : '') + dato('Correo', c.correo ? '<a href="' + U.attr(R.urlCorreo(c.correo, '', '')) + '">' + U.esc(c.correo) + '</a>' : '') + dato('Empresa · cargo', U.esc([c.empresa, c.cargo].filter(Boolean).join(' · '))) + dato('Ciudad', U.esc(c.ciudad)) + dato('Origen', U.esc(c.origen)) + dato('Consentimiento', c.consentimiento ? 'Sí, escribió primero' : 'No') + dato('Ocasión · personas', U.esc([c.ocasion, c.personas ? c.personas + ' personas' : ''].filter(Boolean).join(' · '))) + dato('Código de referido', U.esc(c.codigoReferido)) + dato('Referido por', U.esc(c.referidoPor)) + dato('Total comprado', c.totalInvertido ? U.soles(c.totalInvertido) : '') + '</div>' +
      '<div class="pipe-ficha-estado"><div class="pipe-datos">' + dato('Estado', U.esc(c.estado || 'activo')) + dato('Próximo toque', c.proximoToque ? U.esc(U.fechaCorta(c.proximoToque)) + (venc ? ' · vencido' : c.proximoToque === hoy ? ' · hoy' : '') : 'sin fecha', venc ? 'mal' : c.proximoToque === hoy ? 'bien' : '') + dato('Toques en la conversación', U.esc(String(c.toques || 0)) + ' de 3' + (c.respondio ? ' · respondió' : '') + (c.cierrePendiente ? ' · esperando respuesta al tercero' : '')) + dato('Último contacto', U.esc(U.fechaCorta(c.ultimoContacto))) + dato('¿Puede recibir un mensaje de ola?', permiso.ok ? 'Sí' : U.esc(permiso.motivo), permiso.ok ? 'bien' : 'mal') + '</div>' +
      '<div class="acciones pipe-ficha-acciones"><button type="button" class="btn primario" data-f="editar">Editar</button><button type="button" class="btn" data-f="venta">Registrar venta</button><label class="pipe-mover-etapa">Mover a <select data-f="etapa">' + UI.opcionesEtapas(c.etapa || 'atraer') + '</select></label>' + (c.estado === 'activo' ? '<button type="button" class="btn" data-f="dormir">Dormir</button><button type="button" class="btn peligro" data-f="perdido">Perdido</button>' : '<button type="button" class="btn" data-f="reactivar">Reactivar</button>') + '</div><div class="pipe-ficha-inline" id="fichaInline" hidden></div></div>' +
      (c.notas ? '<div class="pipe-notas">' + U.esc(c.notas) + '</div>' : '') +
      '<div class="pipe-ficha-sec"><h4>Interacciones <span class="pipe-cont">' + inter.length + '</span></h4>' + (inter.length ? '<ul class="pipe-lista">' + inter.slice(0, 30).map(function (i) { return '<li><small class="texto3">' + U.esc(U.fechaHora(i.fecha)) + '</small><span class="pill">' + U.esc(i.canal) + (i.toque !== '' && i.toque != null ? ' · toque ' + U.esc(i.toque) : '') + '</span><span class="pill' + (i.resultado === 'compro' ? ' ok' : i.resultado === 'respondio' ? ' ok' : '') + '">' + U.esc(i.resultado) + '</span><span class="texto2">' + U.esc(String(i.mensaje || '').slice(0, 110)) + (i.respuesta ? ' → <b>' + U.esc(String(i.respuesta).slice(0, 110)) + '</b>' : '') + '</span></li>'; }).join('') + '</ul>' : '<p class="texto3">Sin interacciones registradas.</p>') + '</div>' +
      '<div class="pipe-ficha-sec"><h4>Ventas y oportunidades <span class="pipe-cont">' + ventas.length + '</span></h4>' + (ventas.length ? '<ul class="pipe-lista">' + ventas.map(function (v) { return '<li><small class="texto3">' + U.esc(U.fechaCorta(v.fechaCierre || v.fecha)) + '</small><span>' + U.esc((v.items || []).map(function (it) { return it.nombre + ' × ' + it.cantidad; }).join(', ') || v.linea) + '</span><b>' + U.soles(v.total) + '</b><span class="pill' + (['pagado', 'entregado'].indexOf(v.estado) >= 0 ? ' ok' : v.estado === 'perdido' ? ' alerta' : '') + '">' + U.esc(NOMBRE_ESTADO_VENTA[v.estado] || v.estado) + '</span>' + (v.derivarB2B ? '<span class="pill alerta">B2B</span>' : '') + '<span class="pipe-lista-acc"><button type="button" class="btn chico" data-f="editar-venta" data-id="' + U.attr(v.id) + '">Editar</button></span></li>'; }).join('') + '</ul>' : '<p class="texto3">Sin ventas registradas.</p>') + '</div>' +
      (cuentas.length ? '<div class="pipe-ficha-sec"><h4>Cuentas y eventos</h4><ul class="pipe-lista">' + cuentas.map(function (k) { return '<li><b>' + U.esc(k.empresa) + '</b><span class="pill">' + U.esc(nombreEstadoCuenta(k.estado)) + '</span>' + (k.monto ? '<span>' + U.soles(k.monto) + '</span>' : '') + '<span class="pipe-lista-acc"><button type="button" class="btn chico" data-f="cuenta" data-id="' + U.attr(k.id) + '">Abrir</button></span></li>'; }).join('') + '</ul></div>' : '') +
      '<div class="acciones final"><button type="button" class="btn primario" data-f="cerrar">Cerrar</button></div></div>';
    UI.abrirModal(h, { ancho: 'ancho', sinFoco: true });
    var m = UI.$('modalContenido');
    function pedirMotivo(titulo, cb) { var box = UI.$('fichaInline'); box.hidden = false; box.innerHTML = '<label class="campo"><span>' + U.esc(titulo) + '</span><input id="fichaMotivo" placeholder="motivo (opcional)"></label><div class="acciones"><button type="button" class="btn primario" id="fichaOk">Confirmar</button><button type="button" class="btn" id="fichaNo">Cancelar</button></div>'; UI.$('fichaOk').onclick = function () { cb(UI.$('fichaMotivo').value.trim()); }; UI.$('fichaNo').onclick = function () { box.hidden = true; }; UI.$('fichaMotivo').focus(); }
    m.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-f]'); if (!b || b.tagName === 'SELECT') return; var acc = b.getAttribute('data-f');
      if (acc === 'cerrar') UI.cerrarModal();
      else if (acc === 'editar') UI.formContacto(c);
      else if (acc === 'venta') V.ventas.formVenta(null, { contacto: c, alGuardar: function () { fichaContacto(c.id); } });
      else if (acc === 'editar-venta') { var v = DB.buscar('ventas', b.getAttribute('data-id')); if (v) V.ventas.formVenta(v, { alGuardar: function () { fichaContacto(c.id); } }); }
      else if (acc === 'cuenta') { var k = DB.buscar('cuentas', b.getAttribute('data-id')); if (k) formCuenta(k); }
      else if (acc === 'dormir') pedirMotivo('Dormir hasta la siguiente ola', function (mot) { E.marcarDormido(c, mot); UI.toast('Dormido'); fichaContacto(c.id); V.ui.refrescar(); });
      else if (acc === 'perdido') pedirMotivo('Marcar como perdido', function (mot) { E.marcarPerdido(c, mot); UI.toast('Perdido'); fichaContacto(c.id); V.ui.refrescar(); });
      else if (acc === 'reactivar') { c.estado = 'activo'; c.etapa = c.etapa === 'fidelizar' ? 'fidelizar' : 'atraer'; c.toques = 0; c.cierrePendiente = false; c.proximoToque = hoy; DB.upsert('contactos', c); UI.toast('Reactivado: vuelve a la cola de hoy'); fichaContacto(c.id); V.ui.refrescar(); }
    });
    UI.qs('select[data-f="etapa"]', m).onchange = function () { moverEtapa(c, this.value); fichaContacto(c.id); V.ui.refrescar(); };
  }

  /* =========================== Eventos =========================== */
  function enlazar() {
    if (estado.enlazado) return; estado.enlazado = true;
    var r = raiz();
    r.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pipe]'); if (!b) return; var acc = b.getAttribute('data-pipe'); var id = b.getAttribute('data-id');
      if (acc === 'tab') { filtros().tab = b.getAttribute('data-tab'); DB.guardarPronto(); render(); }
      else if (acc === 'mover') moverDir(id, +b.getAttribute('data-dir'));
      else if (acc === 'mover-cuenta') moverCuenta(id, +b.getAttribute('data-dir'));
      else if (acc === 'ficha') fichaContacto(id);
      else if (acc === 'ver-mas') { estado.mostrar[b.getAttribute('data-etapa')] = (estado.mostrar[b.getAttribute('data-etapa')] || LIMITE_COL) + LIMITE_COL; renderPersonas(); }
      else if (acc === 'ir-col') { var col = UI.qs('.pipe-col[data-etapa="' + b.getAttribute('data-etapa') + '"]', r); if (col) col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }); UI.qsa('.pipe-tabs-movil .btn', r).forEach(function (x) { x.classList.toggle('activa', x === b); }); }
      else if (acc === 'reactivar') { var c = contactoDe(id); if (c) { c.estado = 'activo'; c.etapa = c.etapa === 'fidelizar' ? 'fidelizar' : 'atraer'; c.toques = 0; c.cierrePendiente = false; c.proximoToque = U.hoyISO(); DB.upsert('contactos', c); UI.toast('Reactivado'); renderPersonas(); } }
      else if (acc === 'nuevo-contacto') UI.formContacto(null);
      else if (acc === 'nueva-cuenta') formCuenta(null);
      else if (acc === 'editar-cuenta') { var k = DB.buscar('cuentas', id); if (k) formCuenta(k); }
      else if (acc === 'venta-cuenta') { var k2 = DB.buscar('cuentas', id); if (k2) V.ventas.formVenta(null, { cuentaId: k2.id, contacto: k2.contactos && k2.contactos.length ? contactoDe(k2.contactos[0]) : null, alGuardar: render }); }
    });
    function filtroCambio(ev) {
      var el = ev.target; if (!el.name || !el.closest('.pipe-filtros')) return; var f = filtros();
      f[el.name] = el.type === 'checkbox' ? el.checked : el.value; DB.guardarPronto();
      clearTimeout(estado.timer); estado.timer = setTimeout(function () { if (f.tab === 'cuentas') renderCuentas(); else renderPersonas(); }, el.type === 'search' ? 180 : 0);
    }
    r.addEventListener('input', filtroCambio); r.addEventListener('change', filtroCambio);
    // En Contactos, el nombre abre la ficha
    var pc = UI.$('p-contactos'); if (pc) pc.addEventListener('click', function (ev) { var b = ev.target.closest('tr[data-id] td:first-child b'); if (b) { var tr = b.closest('tr[data-id]'); fichaContacto(tr.getAttribute('data-id')); } });
  }

  V.ui.fichaContacto = fichaContacto;
  V.registrarAccion('ver-contacto', function (el) { fichaContacto(el.getAttribute('data-id')); });
  V.registrarPantalla('pipeline', render);
  V.modulos = V.modulos || {}; V.modulos.pipeline = { render: render, fichaContacto: fichaContacto, formCuenta: formCuenta, moverEtapa: moverEtapa, ESTADOS_CUENTA: ESTADOS_CUENTA };
  enlazar();
})();
