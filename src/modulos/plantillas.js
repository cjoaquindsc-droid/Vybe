/* ============================================================================
   plantillas.js · Pantalla PLANTILLAS (parte 5) · biblioteca editable de mensajes
   por segmento, toque, ola y canal, con variables, vista previa, cobertura,
   duplicar, restaurar las del plan e importar/exportar JSON.
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, E = V.embudo, DB = V.DB, cfg = V.cfg;
  var VARIABLES = ['nombre', 'nombre_completo', 'empresa', 'ocasion', 'codigo', 'gancho', 'ciudad', 'personas', 'producto', 'total', 'link', 'precio_silver', 'precio_gold', 'precio_blue', 'precio_breca_silver', 'precio_breca_gold', 'precio_breca_blue', 'total_10_gold', 'firma'];
  var TOQUES = [['1', 'Toque 1 (inicial)'], ['2', 'Toque 2'], ['3', 'Toque 3 (último)'], ['post', 'Post-venta'], ['propuesta', 'Propuesta'], ['recordatorio', 'Recordatorio de cotización'], ['cierre', 'Confirmación de pago y entrega'], ['confirmacion', 'Confirmación de reserva']];
  var estado = { enlazado: false, timer: null };
  var MUESTRA = { id: '_muestra', nombre: 'María Fernanda Rojas', telefono: '+51 987 654 321', empresa: 'Rímac', segmento: 'recontacto', ciudad: 'Lima', ocasion: 'un cumpleaños', personas: 2, codigoReferido: 'MFR-07' };

  function filtros() { var f = DB.datos.ui.filtros.plantillas; if (!f || typeof f !== 'object') { f = { segmento: '', toque: '', ola: '', canal: '', activa: '', texto: '' }; DB.datos.ui.filtros.plantillas = f; } return f; }
  function nombreToque(t) { var x = TOQUES.filter(function (p) { return p[0] === String(t); })[0]; return x ? x[1] : String(t); }
  function contactoMuestra(id) { if (!id || id === '_muestra') return MUESTRA; return DB.buscar('contactos', id) || MUESTRA; }
  function variablesDesconocidas(texto) { var m = String(texto || '').match(/\{(\w+)\}/g) || []; return m.map(function (x) { return x.slice(1, -1); }).filter(function (k, i, a) { return VARIABLES.indexOf(k) < 0 && a.indexOf(k) === i; }); }
  function lista() {
    var f = filtros(); var t = U.normTexto(f.texto);
    return DB.tabla('plantillas').filter(function (p) {
      if (f.segmento && p.segmento !== f.segmento) return false;
      if (f.toque && String(p.toque) !== f.toque) return false;
      if (f.ola !== '' && String(p.ola || 0) !== String(f.ola)) return false;
      if (f.canal && p.canal !== f.canal) return false;
      if (f.activa === 'si' && p.activa === false) return false; if (f.activa === 'no' && p.activa !== false) return false;
      if (t && U.normTexto([p.nombre, p.texto, p.asunto].join(' ')).indexOf(t) < 0) return false;
      return true;
    });
  }
  function cobertura() {
    var segs = cfg().segmentos; var toques = ['1', '2', '3', 'post'];
    var h = '<table class="tabla compacta pl-cobertura"><thead><tr><th>Segmento</th>' + toques.map(function (t) { return '<th>' + (t === 'post' ? 'Post' : 'T' + t) + '</th>'; }).join('') + '</tr></thead><tbody>';
    segs.forEach(function (s) { h += '<tr><td>' + U.esc(s.nombre) + '</td>' + toques.map(function (t) { var hay = DB.tabla('plantillas').some(function (p) { return p.activa !== false && String(p.toque) === t && (p.segmento === s.codigo || (t === 'post' && p.segmento === '*')); }); return '<td class="' + (hay ? 'pl-ok' : 'pl-falta') + '" data-cob="' + U.attr(s.codigo + ':' + t) + '">' + (hay ? '✓' : '·') + '</td>'; }).join('') + '</tr>'; });
    return h + '</tbody></table><p class="texto3">✓ hay plantilla activa; · falta (se usará la de "Todos" si existe).</p>';
  }
  function render() {
    enlazar(); var f = filtros(); var l = lista(); var raiz = UI.$('p-plantillas');
    var grupos = {}; l.forEach(function (p) { (grupos[p.segmento] = grupos[p.segmento] || []).push(p); });
    var orden = cfg().segmentos.map(function (s) { return s.codigo; }).concat(['*']).concat(Object.keys(grupos).filter(function (k) { return k !== '*' && !cfg().segmentos.some(function (s) { return s.codigo === k; }); }));
    var h = '<div class="cabecera-pantalla"><h2>Plantillas</h2><p class="sub" id="plConteo">' + U.entero(l.length) + ' de ' + U.entero(DB.tabla('plantillas').length) + '</p><div class="acciones"><button type="button" class="btn primario" data-pl="nueva">Nueva plantilla</button><button type="button" class="btn" data-pl="restaurar">Restaurar las del plan</button><button type="button" class="btn" data-pl="exportar">Exportar JSON</button><button type="button" class="btn" data-pl="importar">Importar JSON</button><input type="file" id="plArchivo" accept=".json,application/json" hidden></div></div>' +
      '<div class="tarjeta filtros pl-filtros"><input type="search" name="texto" placeholder="Buscar en nombre o texto" value="' + U.attr(f.texto) + '"><select name="segmento">' + UI.opcionesSegmentos(f.segmento, 'Todos los segmentos').replace('</select>', '') + '<option value="*"' + (f.segmento === '*' ? ' selected' : '') + '>Todos (*)</option></select>' +
      '<select name="toque">' + UI.opciones(TOQUES.map(function (t) { return { valor: t[0], texto: t[1] }; }), f.toque, 'Todos los toques') + '</select><select name="ola">' + UI.opciones([{ valor: '0', texto: 'Cualquier ola' }, { valor: '1', texto: 'Ola 1' }, { valor: '2', texto: 'Ola 2' }, { valor: '3', texto: 'Ola 3' }], f.ola, 'Todas las olas') + '</select><select name="canal">' + UI.opciones([{ valor: 'whatsapp', texto: 'WhatsApp' }, { valor: 'correo', texto: 'Correo' }], f.canal, 'Todos los canales') + '</select><select name="activa">' + UI.opciones([{ valor: 'si', texto: 'Activas' }, { valor: 'no', texto: 'Inactivas' }], f.activa, 'Activas e inactivas') + '</select></div>' +
      '<div class="pl-grid"><div id="plLista">';
    orden.forEach(function (seg) {
      var ps = grupos[seg]; if (!ps || !ps.length) return;
      h += '<div class="tarjeta"><h3>' + U.esc(seg === '*' ? 'Todos los segmentos' : R.nombreSegmento(seg)) + ' <span class="texto3">· ' + ps.length + '</span></h3>' + ps.map(function (p) {
        return '<div class="pl-item' + (p.activa === false ? ' inactiva' : '') + '" data-id="' + U.attr(p.id) + '"><div class="pl-cab"><b>' + U.esc(p.nombre) + '</b><span class="pill">' + U.esc(nombreToque(p.toque)) + '</span>' + (p.ola ? '<span class="pill">ola ' + U.esc(p.ola) + '</span>' : '') + '<span class="pill">' + U.esc(p.canal) + '</span>' + (p.masivo ? '<span class="pill">leyendas</span>' : '') + (p.activa === false ? '<span class="pill alerta">inactiva</span>' : '') + '</div><p class="pl-texto">' + U.esc(String(p.texto || '').slice(0, 220)) + (String(p.texto || '').length > 220 ? '…' : '') + '</p><div class="acciones"><button type="button" class="btn chico" data-pl="editar" data-id="' + U.attr(p.id) + '">Editar</button><button type="button" class="btn chico" data-pl="probar" data-id="' + U.attr(p.id) + '">Probar</button><button type="button" class="btn chico" data-pl="duplicar" data-id="' + U.attr(p.id) + '">Duplicar</button><button type="button" class="btn chico" data-pl="activar" data-id="' + U.attr(p.id) + '">' + (p.activa === false ? 'Activar' : 'Desactivar') + '</button></div></div>';
      }).join('') + '</div>';
    });
    if (!l.length) h += '<div class="tarjeta"><p class="texto2">Sin plantillas con estos filtros.</p></div>';
    h += '</div><div class="tarjeta pl-lateral"><h3>Cobertura</h3>' + cobertura() + '</div></div>';
    raiz.innerHTML = h;
  }
  function vistaPrevia(p, contactoId) {
    var c = contactoMuestra(contactoId); var m = R.armarMensaje(p, c, { fecha: U.hoyISO() });
    return (m.asunto ? '<p><b>Asunto:</b> ' + U.esc(m.asunto) + '</p>' : '') + '<pre class="texto-plantilla">' + U.esc(m.texto) + '</pre><p class="texto3">' + m.texto.length + ' caracteres · contacto: ' + U.esc(c.nombre) + '</p>';
  }
  function selectorContacto(sel) { var cs = DB.tabla('contactos').slice().sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre)); }).slice(0, 60); return '<select id="plContacto"><option value="_muestra">Contacto de muestra</option>' + cs.map(function (c) { return '<option value="' + U.attr(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + U.esc(c.nombre) + ' · ' + U.esc(R.nombreSegmento(c.segmento)) + '</option>'; }).join('') + '</select>'; }
  function probar(p) {
    UI.abrirModal('<h3>Probar · ' + U.esc(p.nombre) + '</h3><div class="campo"><span>Ver con el contacto</span>' + selectorContacto('') + '</div><div id="plPrevia">' + vistaPrevia(p, '_muestra') + '</div><div class="acciones"><button type="button" class="btn" data-plm="copiar">Copiar</button><a class="btn" id="plWa" target="_blank" rel="noopener">Abrir WhatsApp</a><button type="button" class="btn primario" data-plm="cerrar">Cerrar</button></div>', { ancho: 'ancho', sinFoco: true });
    var m = UI.$('modalContenido');
    function refrescarWa() { var c = contactoMuestra(UI.$('plContacto').value); var t = R.armarMensaje(p, c, { fecha: U.hoyISO() }).texto; var a = UI.$('plWa'); if (c.telefono) { a.href = R.urlWhatsApp(c.telefono, t); a.hidden = false; } else a.hidden = true; }
    UI.$('plContacto').onchange = function () { UI.$('plPrevia').innerHTML = vistaPrevia(p, this.value); refrescarWa(); }; refrescarWa();
    UI.qs('[data-plm="copiar"]', m).onclick = function () { UI.copiar(R.armarMensaje(p, contactoMuestra(UI.$('plContacto').value), { fecha: U.hoyISO() }).texto).then(function (ok) { UI.toast(ok ? 'Mensaje copiado' : 'No se pudo copiar', ok ? '' : 'alerta'); }); };
    UI.qs('[data-plm="cerrar"]', m).onclick = UI.cerrarModal;
  }
  function editor(original) {
    var p = original ? U.clonar(original) : { id: '', nombre: '', segmento: 'recontacto', toque: '1', ola: 0, canal: 'whatsapp', asunto: '', texto: '', masivo: false, activa: true };
    var toqueConocido = TOQUES.some(function (t) { return t[0] === String(p.toque); });
    var h = '<h3>' + (original ? 'Editar plantilla' : 'Nueva plantilla') + '</h3><div class="pl-editor"><form id="plForm" class="form-grid" autocomplete="off">' +
      UI.campo('Nombre', UI.inp('nombre', p.nombre, 'required')) +
      UI.campo('Segmento', '<select name="segmento">' + UI.opcionesSegmentos(p.segmento).replace('</select>', '') + '<option value="*"' + (p.segmento === '*' ? ' selected' : '') + '>Todos (*)</option></select>') +
      UI.campo('Toque', '<select name="toque">' + UI.opciones(TOQUES.map(function (t) { return { valor: t[0], texto: t[1] }; }).concat([{ valor: '_otro', texto: 'Otro (escribir)' }]), toqueConocido ? String(p.toque) : '_otro') + '</select><input name="toqueOtro" placeholder="nombre del toque" value="' + U.attr(toqueConocido ? '' : p.toque) + '"' + (toqueConocido ? ' hidden' : '') + '>') +
      UI.campo('Ola', '<select name="ola">' + UI.opciones([{ valor: '0', texto: 'Cualquier ola' }, { valor: '1', texto: 'Ola 1' }, { valor: '2', texto: 'Ola 2' }, { valor: '3', texto: 'Ola 3' }], String(p.ola || 0)) + '</select>') +
      UI.campo('Canal', '<select name="canal">' + UI.opciones([{ valor: 'whatsapp', texto: 'WhatsApp' }, { valor: 'correo', texto: 'Correo' }], p.canal) + '</select>') +
      '<div class="campo" id="plAsuntoCampo"' + (p.canal === 'correo' ? '' : ' hidden') + '><span>Asunto (correo)</span>' + UI.inp('asunto', p.asunto) + '</div>' +
      '<div class="campo ancho"><span>Texto</span><div class="pl-vars">' + VARIABLES.map(function (v) { return '<button type="button" class="btn chico" data-var="' + v + '">{' + v + '}</button>'; }).join('') + '</div><textarea name="texto" rows="9">' + U.esc(p.texto) + '</textarea><small id="plAviso"></small></div>' +
      '<label class="pl-check"><input type="checkbox" name="masivo"' + (p.masivo ? ' checked' : '') + '> Mensaje masivo (agrega las leyendas legales)</label><label class="pl-check"><input type="checkbox" name="activa"' + (p.activa !== false ? ' checked' : '') + '> Activa</label>' +
      '<div class="acciones ancho">' + (original ? '<button type="button" class="btn peligro izq" data-plm="eliminar">Eliminar</button>' : '') + '<button type="button" class="btn" data-plm="cerrar">Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></form>' +
      '<div class="pl-previa"><h4>Vista previa</h4><div class="campo"><span>Contacto</span>' + selectorContacto('') + '</div><div id="plPrevia"></div></div></div>';
    UI.abrirModal(h, { ancho: 'ancho' });
    var m = UI.$('modalContenido'); var form = UI.$('plForm'); var ta = UI.qs('[name="texto"]', form);
    function leer() { var f = UI.leerForm(form); var t = f.toque === '_otro' ? String(f.toqueOtro || '').trim() || 'otro' : f.toque; return { id: p.id, nombre: String(f.nombre || '').trim(), segmento: f.segmento, toque: /^\d$/.test(t) ? Number(t) : t, ola: Number(f.ola) || 0, canal: f.canal, asunto: f.canal === 'correo' ? String(f.asunto || '') : '', texto: f.texto, masivo: !!f.masivo, activa: !!f.activa }; }
    function refrescar() {
      var q = leer(); var desc = variablesDesconocidas(q.texto + ' ' + q.asunto); var aviso = UI.$('plAviso');
      aviso.innerHTML = (desc.length ? '<span class="mal">Variables desconocidas: ' + U.esc(desc.map(function (x) { return '{' + x + '}'; }).join(', ')) + '</span> · ' : '') + q.texto.length + ' caracteres';
      UI.$('plPrevia').innerHTML = vistaPrevia(q, UI.$('plContacto').value);
      UI.$('plAsuntoCampo').hidden = q.canal !== 'correo'; UI.qs('[name="toqueOtro"]', form).hidden = UI.qs('[name="toque"]', form).value !== '_otro';
    }
    form.addEventListener('input', refrescar); form.addEventListener('change', refrescar); UI.$('plContacto').onchange = refrescar;
    UI.qsa('[data-var]', form).forEach(function (b) { b.onclick = function () { var v = '{' + b.getAttribute('data-var') + '}'; var s = ta.selectionStart || 0, e = ta.selectionEnd || 0; ta.value = ta.value.slice(0, s) + v + ta.value.slice(e); ta.focus(); ta.selectionStart = ta.selectionEnd = s + v.length; refrescar(); }; });
    UI.qs('[data-plm="cerrar"]', form).onclick = UI.cerrarModal;
    var del = UI.qs('[data-plm="eliminar"]', form); if (del) del.onclick = function () {
      var hermanas = DB.tabla('plantillas').filter(function (x) { return x.id !== p.id && x.segmento === p.segmento && String(x.toque) === String(p.toque) && x.activa !== false; }).length;
      if (window.confirm('¿Eliminar la plantilla "' + p.nombre + '"?' + (!hermanas ? ' Es la única de su segmento y toque: los mensajes usarán la de "Todos" o quedarán sin plantilla.' : ''))) { DB.eliminar('plantillas', p.id); UI.cerrarModal(); UI.toast('Plantilla eliminada'); render(); }
    };
    form.onsubmit = function (ev) {
      ev.preventDefault(); var q = leer();
      if (!q.nombre || !q.texto.trim()) { UI.toast('Escriba el nombre y el texto', 'alerta'); return; }
      var desc = variablesDesconocidas(q.texto + ' ' + q.asunto); if (desc.length && !window.confirm('Hay variables desconocidas (' + desc.join(', ') + '). ¿Guardar igual?')) return;
      if (!q.id) q.id = 'pl_' + U.normTexto(q.segmento === '*' ? 'todos' : q.segmento) + '_' + String(q.toque) + '_' + Date.now().toString(36);
      DB.upsert('plantillas', q); UI.cerrarModal(); UI.toast('Plantilla guardada'); render();
    };
    refrescar();
  }
  function duplicar(p) { var q = U.clonar(p); q.id = p.id + '_copia_' + Date.now().toString(36); q.nombre = p.nombre + ' (copia)'; delete q.createdAt; delete q.updatedAt; DB.upsert('plantillas', q); UI.toast('Plantilla duplicada'); render(); }
  function restaurar() {
    UI.confirmar('Se vuelven a cargar las ' + window.VDO_DATOS.PLANTILLAS.length + ' plantillas del plan: las que tengan el mismo identificador se reemplazan; las que usted creó se conservan. ¿Continuar?', function () {
      var n = 0; window.VDO_DATOS.PLANTILLAS.forEach(function (p) { var q = U.clonar(p); q.activa = true; var ex = DB.buscar('plantillas', q.id); if (ex) { q.createdAt = ex.createdAt; } DB.upsert('plantillas', q); n++; }); UI.toast(n + ' plantillas restauradas'); render();
    }, 'Restaurar');
  }
  function exportar() { U.descargar('plantillas-' + U.hoyISO() + '.json', JSON.stringify({ formato: 'vdo-plantillas', generado: U.ahoraISO(), plantillas: DB.tabla('plantillas') }, null, 1), 'application/json'); UI.toast('Plantillas exportadas'); }
  function importar(texto) {
    var json; try { json = JSON.parse(texto); } catch (e) { UI.toast('El archivo no es un JSON válido', 'alerta'); return; }
    var arr = Array.isArray(json) ? json : (json && Array.isArray(json.plantillas) ? json.plantillas : null);
    if (!arr) { UI.toast('El JSON debe ser un arreglo de plantillas o {plantillas: [...]}', 'alerta'); return; }
    var n = 0; arr.forEach(function (p) { if (!p || typeof p !== 'object' || !p.texto) return; var q = { id: p.id || 'pl_imp_' + Date.now().toString(36) + n, nombre: p.nombre || 'Sin nombre', segmento: p.segmento || '*', toque: p.toque == null ? '1' : p.toque, ola: Number(p.ola) || 0, canal: p.canal === 'correo' ? 'correo' : 'whatsapp', asunto: p.asunto || '', texto: String(p.texto), masivo: !!p.masivo, activa: p.activa !== false }; DB.upsert('plantillas', q); n++; });
    UI.toast(n + ' plantillas importadas'); render();
  }
  function enlazar() {
    if (estado.enlazado) return; estado.enlazado = true; var r = UI.$('p-plantillas');
    r.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pl]'); if (!b) return; var acc = b.getAttribute('data-pl'); var p = b.getAttribute('data-id') ? DB.buscar('plantillas', b.getAttribute('data-id')) : null;
      if (acc === 'nueva') editor(null); else if (acc === 'editar' && p) editor(p); else if (acc === 'probar' && p) probar(p); else if (acc === 'duplicar' && p) duplicar(p);
      else if (acc === 'activar' && p) { p.activa = p.activa === false; DB.upsert('plantillas', p); render(); }
      else if (acc === 'restaurar') restaurar(); else if (acc === 'exportar') exportar(); else if (acc === 'importar') UI.$('plArchivo').click();
    });
    r.addEventListener('change', function (ev) {
      var el = ev.target; if (el.id === 'plArchivo') { var f = el.files && el.files[0]; if (!f) return; var lector = new FileReader(); lector.onload = function () { importar(String(lector.result)); el.value = ''; }; lector.readAsText(f, 'utf-8'); return; }
      if (el.name && el.closest('.pl-filtros')) { filtros()[el.name] = el.value; DB.guardarPronto(); render(); }
    });
    r.addEventListener('input', function (ev) { var el = ev.target; if (el.name === 'texto' && el.closest('.pl-filtros')) { filtros().texto = el.value; DB.guardarPronto(); clearTimeout(estado.timer); estado.timer = setTimeout(function () { var v = el.value; render(); var nuevo = UI.qs('.pl-filtros input[name="texto"]', r); if (nuevo) { nuevo.focus(); nuevo.value = v; } }, 250); } });
  }
  V.plantillas = { variablesDesconocidas: variablesDesconocidas, VARIABLES: VARIABLES, importar: importar };
  V.registrarPantalla('plantillas', render);
})();
