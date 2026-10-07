/* ============================================================================
   crm-logica.js · Lógica del CRM B2C · Bodegas Viñas de Oro / The Pisco Room
   Sin servidor, sin dependencias. Datos en localStorage (clave vdo-crm-v1).
   ========================================================================== */
(function () {
  'use strict';
  var D = window.VDO_DATOS;
  var CLAVE = 'vdo-crm-v1';
  var VERSION_ESQUEMA = 1;
  var TABLAS = ['contactos', 'interacciones', 'ventas', 'embajadores', 'cuentas', 'calendario', 'plantillas'];
  // Campos del contacto que una importación nunca debe pisar (los maneja el embudo)
  var CAMPOS_PROTEGIDOS = { id: 1, createdAt: 1, fila: 1, _campos: 1, prueba: 1, etapa: 1, estado: 1, toques: 1, proximoToque: 1, inicioConversacion: 1, ultimaOla: 1, codigoReferido: 1 };

  /* =========================== Utilidades =========================== */
  function $(id) { return document.getElementById(id); }
  function qs(sel, el) { return (el || document).querySelector(sel); }
  function qsa(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function attr(s) { return esc(s).replace(/\n/g, '&#10;'); }
  function esObjeto(o) { return o != null && typeof o === 'object' && !Array.isArray(o); }

  function hoyISO() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: D.EMPRESA.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  }
  function ahoraISO() {
    try {
      var p = new Intl.DateTimeFormat('en-CA', { timeZone: D.EMPRESA.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var m = {}; p.forEach(function (x) { m[x.type] = x.value; });
      if (m.hour === '24') m.hour = '00';
      return m.year + '-' + m.month + '-' + m.day + 'T' + m.hour + ':' + m.minute;
    } catch (e) { return new Date().toISOString().slice(0, 16); }
  }
  function esISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function fechaValida(iso) { if (!esISO(iso)) return false; var d = new Date(iso + 'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso; }
  function isoDe(txt) {
    var s = String(txt || '').trim();
    if (!s) return '';
    var r = '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) r = s.slice(0, 10);
    else { var m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/); if (m) { var a = m[3].length === 2 ? '20' + m[3] : m[3]; r = a + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); } }
    return fechaValida(r) ? r : '';
  }
  function fechaCorta(iso) { if (!esISO(iso)) return iso || ''; return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); }
  function fechaHora(isoDT) { if (!isoDT) return ''; return fechaCorta(isoDT.slice(0, 10)) + (isoDT.length > 10 ? ' ' + isoDT.slice(11, 16) : ''); }
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechaLarga(iso) { if (!fechaValida(iso)) return ''; var d = new Date(iso + 'T12:00:00'); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
  function diaSemana(iso) { return new Date(iso + 'T12:00:00').getDay(); }
  function sumarDias(iso, n) { if (!fechaValida(iso)) return ''; var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function diasEntre(a, b) { a = isoDe(a); b = isoDe(b); if (!a || !b) return null; return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000); }
  function mesDe(iso) { return esISO(iso) ? iso.slice(0, 7) : ''; }
  function nombreMes(ym) { if (!ym) return ''; var m = parseInt(ym.slice(5, 7), 10); return MESES[m - 1] + ' ' + ym.slice(0, 4); }

  function soles(n) {
    n = Number(n) || 0; var neg = n < 0; n = Math.abs(n);
    var partes = n.toFixed(2).split('.');
    partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + 'S/ ' + partes[0] + '.' + partes[1];
  }
  function entero(n) { return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pct(x, dec) { if (x == null || isNaN(x)) return '–'; return (x * 100).toFixed(dec == null ? 1 : dec).replace('.', ',') + ' %'; }
  function numero(s) {
    if (typeof s === 'number') return s;
    var t = String(s || '').replace(/S\/\.?/i, '').replace(/\s/g, '');
    if (!t) return 0;
    if (t.indexOf(',') > -1 && t.indexOf('.') > -1) { t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''); }
    else if (t.indexOf(',') > -1) { t = /,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, ''); }
    var n = parseFloat(t); return isNaN(n) ? 0 : n;
  }
  function primerValor(s) { s = String(s || '').trim(); if (s.indexOf(':::') > -1) s = s.split(':::')[0].trim(); return s; }
  function normTelefono(t) {
    var s = primerValor(t); if (!s) return '';
    var d = s.replace(/\D/g, ''); if (!d) return '';
    if (d.slice(0, 2) === '00') d = d.slice(2);
    if (d[0] === '0' && (d.length === 9 || d.length === 10)) d = d.slice(1); // prefijo troncal: (01) 445 1234, (056) 123456
    if (d.length < 7) return '';
    if (d.length === 9 && d[0] === '9') return '+51' + d;
    if (d.length === 11 && d.slice(0, 2) === '51') return '+' + d;
    if (d.length === 12 && d.slice(0, 3) === '051') return '+' + d.slice(1);
    if (d.length === 7) return '+511' + d;
    if (d.length === 8) return '+51' + d;
    if (d.length >= 10) return '+' + d;
    return '+51' + d;
  }
  function telefonoDigitos(t) { return normTelefono(t).replace(/\D/g, ''); }
  function normCorreo(c) { var s = primerValor(c).toLowerCase(); return s; }
  function correoValido(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c || ''); }
  function normTexto(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function nuevoId(prefijo) { return prefijo + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function primerNombre(n) { var p = String(n || '').trim().split(/\s+/); var x = p[0] || ''; if (!x || /^[+\d@(]/.test(x)) return ''; return x; }
  function vacio(v) { return v == null || v === '' || (Array.isArray(v) && !v.length); }
  function completarObjeto(obj, defaults) {
    Object.keys(defaults).forEach(function (k) {
      if (obj[k] == null) obj[k] = clonar(defaults[k]);
      else if (esObjeto(defaults[k]) && esObjeto(obj[k])) completarObjeto(obj[k], defaults[k]);
    });
    return obj;
  }

  /* =========================== Almacén =========================== */
  var DB = {
    datos: null,
    _timer: null,
    _falloGuardado: false,
    cargar: function () {
      var raw = null;
      try { raw = localStorage.getItem(CLAVE); } catch (e) { raw = null; }
      var parsed = null;
      if (raw) {
        try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        if (!esObjeto(parsed)) { try { localStorage.setItem(CLAVE + '-corrupto-' + Date.now(), raw); } catch (e) { } parsed = null; }
      }
      this.datos = parsed;
      if (!this.datos) { this.datos = DB.vacio(); this.datos.ui.primeraVez = true; }
      this.migrar();
      return this.datos;
    },
    vacio: function () {
      var d = { version: VERSION_ESQUEMA, creado: ahoraISO(), actualizado: ahoraISO(), config: DB.configInicial(), ui: { pantalla: 'hoy', filtros: {} } };
      TABLAS.forEach(function (t) { d[t] = []; });
      d.plantillas = clonar(D.PLANTILLAS).map(function (p) { p.activa = true; return p; });
      d.calendario = generarCalendario(d.config);
      return d;
    },
    configInicial: function () {
      return clonar({
        empresa: D.EMPRESA, segmentos: D.SEGMENTOS, etapas: D.ETAPAS, cadencias: D.CADENCIAS, reglas: D.REGLAS, leyendas: D.LEYENDAS,
        productos: D.PRODUCTOS, packs: D.PACKS, experiencias: D.EXPERIENCIAS, paquetesGrupo: D.PAQUETES_GRUPO, olas: D.OLAS, ganchos: D.GANCHOS,
        metas: D.METAS, tasasPlan: D.TASAS_PLAN, cortes: D.CORTES, fechasClave: D.FECHAS_CLAVE, skuMaestro: []
      });
    },
    migrar: function () {
      var d = this.datos;
      TABLAS.forEach(function (t) { if (!Array.isArray(d[t])) d[t] = []; d[t] = d[t].filter(esObjeto); });
      if (!esObjeto(d.config)) d.config = DB.configInicial();
      completarObjeto(d.config, DB.configInicial());
      if (!esObjeto(d.ui)) d.ui = {};
      if (!esObjeto(d.ui.filtros)) d.ui.filtros = {};
      if (!d.ui.pantalla) d.ui.pantalla = 'hoy';
      if (!d.plantillas.length) d.plantillas = clonar(D.PLANTILLAS).map(function (p) { p.activa = true; return p; });
      if (!d.calendario.length || d.calendario.some(function (x) { return !fechaValida(x.fecha) || !esObjeto(x.cuotas); })) d.calendario = generarCalendario(d.config);
      d.contactos.forEach(function (c) {
        if (!c.id) c.id = nuevoId('c'); if (!c.estado) c.estado = 'activo'; if (!c.etapa) c.etapa = 'atraer';
        if (c.telefono) c.telefono = normTelefono(c.telefono) || c.telefono; if (c.telefono2) c.telefono2 = normTelefono(c.telefono2) || c.telefono2;
        if (c.correo) c.correo = normCorreo(c.correo);
      });
      d.version = VERSION_ESQUEMA;
    },
    guardar: function () {
      this.datos.actualizado = ahoraISO();
      try {
        localStorage.setItem(CLAVE, JSON.stringify(this.datos)); setEstado('Guardado ' + this.datos.actualizado.slice(11, 16)); this._falloGuardado = false; return true;
      } catch (e) {
        var motivo = (e && (e.name === 'QuotaExceededError' || e.code === 22)) ? 'el navegador no tiene espacio para guardar' : (e && e.message) || 'error desconocido';
        setEstado('NO GUARDADO: ' + motivo, true);
        if (!this._falloGuardado) toast('No se pudo guardar en este navegador (' + motivo + '). Descarga un respaldo JSON ahora para no perder los cambios.', 'alerta', 9000);
        this._falloGuardado = true; return false;
      }
    },
    guardarPronto: function () { var self = this; clearTimeout(this._timer); setEstado('Guardando…'); this._timer = setTimeout(function () { self._timer = null; self.guardar(); }, 250); },
    tabla: function (n) { return this.datos[n]; },
    buscar: function (n, id) { var t = this.datos[n]; for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; },
    upsert: function (n, obj) {
      var t = this.datos[n]; var ahora = ahoraISO();
      if (!obj.id) obj.id = nuevoId(n.slice(0, 1));
      if (!obj.createdAt) obj.createdAt = ahora;
      obj.updatedAt = ahora;
      for (var i = 0; i < t.length; i++) if (t[i].id === obj.id) { t[i] = obj; this.guardarPronto(); return obj; }
      t.push(obj); this.guardarPronto(); return obj;
    },
    eliminar: function (n, id) { this.datos[n] = this.datos[n].filter(function (x) { return x.id !== id; }); this.guardarPronto(); },
    exportar: function () {
      var d = this.datos; var salida = { formato: 'vdo-crm-respaldo', version: VERSION_ESQUEMA, generado: ahoraISO(), fuente: 'CRM B2C Viñas de Oro', tablas: {}, config: d.config, ui: d.ui };
      TABLAS.forEach(function (t) { salida.tablas[t] = d[t]; });
      return salida;
    },
    importar: function (json, modo) {
      // modo: 'reemplazar' | 'fusionar'
      if (!esObjeto(json) || json.formato !== 'vdo-crm-respaldo' || !esObjeto(json.tablas)) throw new Error('El archivo no es un respaldo de este CRM (falta formato vdo-crm-respaldo).');
      var resumen = {};
      if (modo === 'reemplazar') {
        var anterior = this.datos;
        try {
          var nuevo = DB.vacio();
          TABLAS.forEach(function (t) { nuevo[t] = Array.isArray(json.tablas[t]) ? json.tablas[t].filter(esObjeto) : []; resumen[t] = nuevo[t].length; });
          if (esObjeto(json.config)) nuevo.config = json.config;
          if (esObjeto(json.ui)) nuevo.ui = json.ui;
          this.datos = nuevo; this.migrar();
        } catch (e) { this.datos = anterior; throw new Error('El respaldo tiene un formato inesperado y no se aplicó: ' + e.message); }
      } else {
        var d = this.datos;
        var entrantesC = Array.isArray(json.tablas.contactos) ? json.tablas.contactos.filter(esObjeto) : [];
        var rc = fusionarContactos(entrantesC, 'respaldo');
        resumen.contactos = { nuevos: rc.nuevos, actualizados: rc.duplicadosActualizados };
        var mapa = rc.mapa; // id entrante → id final (cuando el contacto ya existía con otro id)
        function remap(id) { return (id && mapa[id]) || id; }
        TABLAS.forEach(function (t) {
          if (t === 'contactos') return;
          var entrantes = Array.isArray(json.tablas[t]) ? json.tablas[t].filter(esObjeto) : [];
          var r = { nuevos: 0, actualizados: 0, conservados: 0 };
          var idx = {}; d[t].forEach(function (x, i) { idx[x.id] = i; });
          entrantes.forEach(function (x) {
            x = clonar(x);
            if (x.contactoId) x.contactoId = remap(x.contactoId);
            if (Array.isArray(x.contactos)) x.contactos = x.contactos.map(remap);
            if (x.id == null) x.id = nuevoId(t.slice(0, 1));
            if (idx[x.id] != null) {
              var local = d[t][idx[x.id]];
              if (String(x.updatedAt || '') > String(local.updatedAt || '')) { d[t][idx[x.id]] = x; r.actualizados++; } else r.conservados++;
            } else { idx[x.id] = d[t].length; d[t].push(x); r.nuevos++; }
          });
          resumen[t] = r;
        });
        if (esObjeto(json.config) && Array.isArray(json.config.skuMaestro) && json.config.skuMaestro.length) d.config.skuMaestro = json.config.skuMaestro;
        this.migrar();
      }
      this.guardar();
      return resumen;
    },
    borrarPrueba: function () {
      var d = this.datos; var n = 0;
      TABLAS.forEach(function (t) { var antes = d[t].length; d[t] = d[t].filter(function (x) { return !x.prueba; }); n += antes - d[t].length; });
      this.guardar(); return n;
    },
    cargarPrueba: function () {
      var d = this.datos; var n = 0;
      Object.keys(D.DATOS_PRUEBA).forEach(function (t) {
        D.DATOS_PRUEBA[t].forEach(function (x) { if (!DB.buscar(t, x.id)) { var c = clonar(x); c.createdAt = ahoraISO(); c.updatedAt = c.createdAt; if (c.telefono) c.telefono = normTelefono(c.telefono) || c.telefono; d[t].push(c); n++; } });
      });
      this.guardar(); return n;
    },
    restablecer: function () { this.datos = DB.vacio(); this.datos.ui.primeraVez = false; this.guardar(); }
  };

  /* =========================== Calendario =========================== */
  function generarCalendario(config) {
    var E = config.empresa.calendario, M = config.metas, olas = config.olas;
    var dias = [];
    var fecha = E.desde;
    while (fecha && fecha <= E.hasta) {
      var dow = diaSemana(fecha);
      if (dow !== 0 && E.diasLibres.indexOf(fecha) < 0) dias.push({ fecha: fecha, dow: dow, mes: mesDe(fecha) });
      fecha = sumarDias(fecha, 1);
    }
    var sumaPeso = {};
    dias.forEach(function (d) { var p = M.pesoDia[d.dow]; sumaPeso[d.mes] = (sumaPeso[d.mes] || 0) + p; });
    return dias.map(function (d) {
      var peso = M.pesoDia[d.dow];
      var ola = olaDe(d.fecha, olas);
      var semana = D.SEMANAS.filter(function (s) { return d.fecha >= s.desde && d.fecha <= s.hasta; })[0];
      var hitos = [];
      function agregarHito(t) { var n = normTexto(t); if (!hitos.some(function (h) { return normTexto(h).indexOf(n) >= 0 || n.indexOf(normTexto(h)) >= 0; })) hitos.push(t); }
      config.fechasClave.forEach(function (f) { if (f.fecha === d.fecha || (f.hasta && d.fecha >= f.fecha && d.fecha <= f.hasta && f.tipo !== 'periodo')) agregarHito(f.texto); });
      config.cortes.forEach(function (c) { if (c.fecha === d.fecha && !hitos.some(function (h) { return /corte/i.test(h); })) agregarHito(c.nombre); });
      var periodos = config.fechasClave.filter(function (f) { return f.hasta && f.tipo === 'periodo' && d.fecha >= f.fecha && d.fecha <= f.hasta; }).map(function (f) { return f.texto; });
      var vol = D.VOLUMEN_OLA[ola] || D.VOLUMEN_OLA[1];
      var factor = d.dow === 6 ? 0.5 : 1;
      var cuotas = {};
      Object.keys(vol).forEach(function (k) { var v = vol[k]; if (k === 'piloto' && d.fecha < '2026-10-12') v = 0; cuotas[k] = Math.round(v * factor); });
      var metaMes = (M.proyeccion[d.mes] || 0) - ((M.ventaPrevia && M.ventaPrevia[d.mes]) || 0);
      var cuotaMes = M.cuotaOficial[d.mes] || 0;
      return {
        id: d.fecha, fecha: d.fecha, dow: d.dow, ola: ola, foco: semana ? semana.foco : '', hito: hitos.join(' · '), periodo: periodos.join(' · '),
        metaDia: Math.round(metaMes * peso / sumaPeso[d.mes]), cuotaDia: Math.round(cuotaMes * peso / sumaPeso[d.mes]),
        cuotas: cuotas, estado: 'pendiente', notas: '', esCorte: config.cortes.some(function (c) { return c.fecha === d.fecha; })
      };
    });
  }
  function olaDe(fecha, olas) {
    olas = olas || DB.datos.config.olas; fecha = String(fecha || '').slice(0, 10);
    for (var i = 0; i < olas.length; i++) if (fecha >= olas[i].desde && fecha <= olas[i].hasta) return olas[i].n;
    var ultima = null; // hueco entre olas (p. ej. sábado 21/11): se queda en la ola anterior
    for (var j = 0; j < olas.length; j++) if (olas[j].desde <= fecha) ultima = olas[j].n;
    return ultima == null ? olas[0].n : ultima;
  }
  function diaCalendario(fecha) { return DB.buscar('calendario', fecha); }

  /* =========================== Reglas de negocio =========================== */
  function cfg() { return DB.datos.config; }
  function segmentoDe(codigo) { return cfg().segmentos.filter(function (s) { return s.codigo === codigo; })[0] || null; }
  function nombreSegmento(codigo) { var s = segmentoDe(codigo); return s ? s.nombre : (codigo || '—'); }
  function nombreEtapa(codigo) { var e = cfg().etapas.filter(function (x) { return x.codigo === codigo; })[0]; return e ? e.nombre : (codigo || '—'); }
  function cadenciaDe(contacto) { var s = segmentoDe(contacto.segmento); var c = cfg().cadencias; return c[(s && s.cadencia) || 'consumidor'] || c.consumidor; }
  function tratoDe(contacto) { var s = segmentoDe(contacto.segmento); return (s && s.trato) || 'usted'; }
  function proximoToqueTras(contacto, fechaEnvio, toqueEnviado) {
    var cad = cadenciaDe(contacto); fechaEnvio = isoDe(fechaEnvio) || hoyISO();
    toqueEnviado = Math.max(1, parseInt(toqueEnviado, 10) || 1);
    if (toqueEnviado >= cfg().reglas.maxToques || cad[toqueEnviado] == null) return '';
    var inicio = isoDe(contacto.inicioConversacion) || fechaEnvio;
    var objetivo = sumarDias(inicio, cad[toqueEnviado]);
    if (!objetivo || objetivo <= fechaEnvio) objetivo = sumarDias(fechaEnvio, Math.max(1, cad[toqueEnviado] - (cad[toqueEnviado - 1] || 0)));
    return objetivo;
  }
  function puedeIniciarOla(contacto, hoy) {
    var R = cfg().reglas; hoy = hoy || hoyISO();
    if (contacto.estado === 'perdido') return { ok: false, motivo: 'Marcado como perdido' };
    if (contacto.estado === 'b2b') return { ok: false, motivo: 'Derivado a B2B' };
    var dUlt = diasEntre(contacto.ultimoContacto, hoy);
    if (dUlt != null && dUlt < R.diasBloqueo) return { ok: false, motivo: 'Contactado hace menos de ' + R.diasBloqueo + ' días' };
    var dOla = diasEntre(contacto.ultimaOla, hoy);
    if (dOla != null && dOla < R.diasEntreOlas) return { ok: false, motivo: 'Ya recibió un mensaje de ola hace menos de 3 semanas' };
    var olaHoy = olaDe(hoy), olaUltima = isoDe(contacto.ultimaOla) ? olaDe(contacto.ultimaOla) : null;
    if ((contacto.estado === 'dormido' || (Number(contacto.toques) || 0) >= R.maxToques) && olaUltima === olaHoy) return { ok: false, motivo: 'Ya agotó sus toques en esta ola; vuelve en la siguiente' };
    if (contacto.segmento === 'recontacto' && !contacto.consentimiento) return { ok: false, motivo: 'Sin consentimiento: no escribió primero' };
    return { ok: true, motivo: '' };
  }
  // Umbral B2C/B2B: aplica a pedidos de botellas (las experiencias de grupo son parte del canal B2C)
  function derivarB2B(venta) { var R = cfg().reglas; if ((venta.linea || 'botellas') !== 'botellas') return false; return (Number(venta.botellas) || 0) > R.umbralBotellasB2B || (Number(venta.total) || 0) > R.umbralSolesB2B; }
  function ganchosDe(fecha) { fecha = fecha || hoyISO(); return cfg().ganchos.filter(function (g) { return fecha >= g.desde && fecha <= g.hasta; }); }
  function ganchoTexto(fecha) {
    var gs = ganchosDe(fecha); var activos = gs.filter(function (g) { return g.estado === 'activo'; });
    if (activos.length) return activos.map(function (g) { return g.texto; }).join(' y ');
    return '';
  }
  function precioDe(id, campo) { var p = cfg().productos.filter(function (x) { return x.id === id; })[0]; return p ? p[campo || 'b2c'] : null; }
  function f2(n) { return (Number(n) || 0).toFixed(2); }

  /* =========================== Mensajes =========================== */
  function variablesDe(contacto, extra) {
    var c = contacto || {}; var fecha = (extra && extra.fecha) || hoyISO(); var ciudad = c.ciudad || 'su ciudad';
    var mes = MESES[parseInt(fecha.slice(5, 7), 10) - 1] || 'este mes';
    var v = {
      nombre: primerNombre(c.nombre), nombre_completo: c.nombre || '', empresa: c.empresa || (c.subsegmento || 'su empresa'), ocasion: c.ocasion || 'esta temporada',
      codigo: c.codigoReferido || c.codigoOrigen || 'VDO', ciudad: ciudad, personas: c.personas || 'su grupo', producto: '', total: '', link: '[LINK DE PAGO]',
      gancho: ganchoTexto(fecha) || ('una selección de ' + mes + ' con precio exclusivo'),
      precio_silver: f2(precioDe('silver700', 'b2c')), precio_gold: f2(precioDe('gold700', 'b2c')), precio_blue: f2(precioDe('blue710', 'b2c')),
      precio_breca_silver: f2(precioDe('silver700', 'breca')), precio_breca_gold: f2(precioDe('gold700', 'breca')), precio_breca_blue: f2(precioDe('blue710', 'breca')),
      total_10_gold: f2(10 * (precioDe('gold700', 'b2c') || 0)), firma: cfg().empresa.firma
    };
    if (extra) Object.keys(extra).forEach(function (k) { if (extra[k] != null && extra[k] !== '') v[k] = extra[k]; });
    return v;
  }
  function rellenar(texto, vars) {
    var t = String(texto || '').replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    // sin nombre: "Hola , le saluda" → "Hola, le saluda" · "Buenos días , " → "Buenos días, "
    return t.replace(/(Hola|Buenos días|Buenas tardes|Estimado\/a|Estimado|Estimada)\s+,/g, '$1,').replace(/^\s*,\s*/, '').replace(/\n\s*,\s*/g, '\n').replace(/[ \t]{2,}/g, ' ');
  }
  function conLeyendas(texto, plantilla) {
    if (plantilla && plantilla.masivo && cfg().reglas.leyendasEnMasivos) return texto + '\n\n' + cfg().leyendas.join('. ') + '.';
    return texto;
  }
  function armarMensaje(plantilla, contacto, extra) {
    var vars = variablesDe(contacto, extra);
    return { texto: conLeyendas(rellenar(plantilla.texto, vars), plantilla), asunto: rellenar(plantilla.asunto || '', vars) };
  }
  function urlWhatsApp(telefono, texto) { var d = telefonoDigitos(telefono); return 'https://wa.me/' + d + (texto ? '?text=' + encodeURIComponent(texto) : ''); }
  function urlCorreo(correo, asunto, texto) { return 'mailto:' + encodeURIComponent(correo || '') + '?subject=' + encodeURIComponent(asunto || '') + '&body=' + encodeURIComponent(texto || ''); }
  function copiar(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return copiarFallback(texto); });
    return Promise.resolve(copiarFallback(texto));
  }
  function copiarFallback(texto) {
    var ta = document.createElement('textarea'); ta.value = texto; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } document.body.removeChild(ta); return ok;
  }

  /* =========================== CSV =========================== */
  function detectarDelimitador(linea) {
    var c = { ',': 0, ';': 0, '\t': 0, '|': 0 }; var enComillas = false;
    for (var i = 0; i < linea.length; i++) { var ch = linea[i]; if (ch === '"') enComillas = !enComillas; else if (!enComillas && c[ch] != null) c[ch]++; }
    var mejor = ','; Object.keys(c).forEach(function (k) { if (c[k] > c[mejor]) mejor = k; });
    return mejor;
  }
  function parseCSV(texto, delim) {
    texto = String(texto || '').replace(/^﻿/, '');
    var primera = texto.split(/\r?\n/)[0] || '';
    delim = delim || detectarDelimitador(primera);
    var filas = [], fila = [], campo = '', enComillas = false;
    for (var i = 0; i < texto.length; i++) {
      var ch = texto[i], sig = texto[i + 1];
      if (enComillas) {
        if (ch === '"' && sig === '"') { campo += '"'; i++; }
        else if (ch === '"') enComillas = false;
        else campo += ch;
      } else {
        if (ch === '"') enComillas = true;
        else if (ch === delim) { fila.push(campo); campo = ''; }
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && sig === '\n') i++; fila.push(campo); filas.push(fila); fila = []; campo = ''; }
        else campo += ch;
      }
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    filas = filas.filter(function (f) { return f.some(function (x) { return String(x).trim() !== ''; }); });
    if (!filas.length) return { cabeceras: [], filas: [], delim: delim };
    var cab = filas[0].map(function (h) { return String(h).trim(); });
    return { cabeceras: cab, filas: filas.slice(1), delim: delim };
  }
  var CAMPOS_IMPORT = [
    { campo: 'nombre', etiqueta: 'Nombre', pistas: ['nombre completo', 'nombre', 'name', 'first name', 'given name', 'nombres', 'contacto', 'cliente', 'display name'] },
    { campo: 'apellido', etiqueta: 'Apellido (se une al nombre)', pistas: ['apellidos', 'apellido', 'last name', 'family name', 'surname'] },
    { campo: 'telefono', etiqueta: 'Teléfono / WhatsApp', pistas: ['phone 1 - value', 'teléfono', 'telefono', 'celular', 'móvil', 'movil', 'whatsapp', 'mobile phone', 'mobile', 'phone', 'número', 'numero', 'tel'] },
    { campo: 'telefono2', etiqueta: 'Teléfono 2', pistas: ['phone 2 - value', 'teléfono 2', 'telefono 2', 'celular 2', 'otro teléfono', 'home phone', 'business phone'] },
    { campo: 'correo', etiqueta: 'Correo', pistas: ['e-mail 1 - value', 'correo', 'email', 'e-mail', 'e-mail address', 'mail', 'correo electrónico'] },
    { campo: 'empresa', etiqueta: 'Empresa', pistas: ['organization 1 - name', 'organization name', 'empresa', 'compañía', 'compania', 'company', 'organización', 'organizacion'] },
    { campo: 'cargo', etiqueta: 'Cargo', pistas: ['organization 1 - title', 'organization title', 'job title', 'cargo', 'puesto', 'posición', 'position'] },
    { campo: 'ciudad', etiqueta: 'Ciudad', pistas: ['ciudad', 'city', 'distrito', 'address 1 - city', 'home city', 'business city', 'sede', 'ubicación'] },
    { campo: 'segmento', etiqueta: 'Segmento (código o nombre)', pistas: ['segmento', 'segment'] },
    { campo: 'subsegmento', etiqueta: 'Subsegmento', pistas: ['subsegmento', 'área', 'area', 'grupo'] },
    { campo: 'perfil', etiqueta: 'Perfil (A/B)', pistas: ['perfil', 'nse', 'nivel'] },
    { campo: 'consentimiento', etiqueta: 'Consentimiento (Sí/No)', pistas: ['consentimiento', 'escribió primero', 'escribio primero', 'opt-in', 'optin'] },
    { campo: 'ocasion', etiqueta: 'Ocasión', pistas: ['ocasión', 'ocasion', 'motivo', 'interés', 'interes'] },
    { campo: 'notas', etiqueta: 'Notas', pistas: ['notas', 'notes', 'observaciones', 'comentarios', 'historial'] },
    { campo: 'referidoPor', etiqueta: 'Referido por', pistas: ['referido por', 'referido', 'referred by'] },
    { campo: 'ultimoContacto', etiqueta: 'Último contacto (fecha)', pistas: ['último contacto', 'ultimo contacto', 'last contact', 'fecha último'] }
  ];
  function adivinarMapeo(cabeceras) {
    var mapeo = {}; var usadas = {};
    var normCab = cabeceras.map(normTexto);
    CAMPOS_IMPORT.forEach(function (c) {
      for (var p = 0; p < c.pistas.length; p++) {
        var pista = normTexto(c.pistas[p]);
        for (var i = 0; i < normCab.length; i++) { if (!usadas[i] && normCab[i] === pista) { mapeo[c.campo] = i; usadas[i] = true; return; } }
      }
    });
    CAMPOS_IMPORT.forEach(function (c) {
      if (mapeo[c.campo] != null) return;
      for (var p = 0; p < c.pistas.length; p++) {
        var pista = normTexto(c.pistas[p]); if (pista.length < 4) continue;
        for (var i = 0; i < normCab.length; i++) { if (!usadas[i] && normCab[i].indexOf(pista) === 0 && !/^(phonetic|name prefix|name suffix|file as)/.test(normCab[i])) { mapeo[c.campo] = i; usadas[i] = true; return; } }
      }
    });
    return mapeo;
  }
  function segmentoDesdeTexto(txt) {
    var t = normTexto(txt); if (!t) return '';
    var segs = cfg().segmentos;
    for (var i = 0; i < segs.length; i++) { if (t === segs[i].codigo || normTexto(segs[i].nombre).indexOf(t) === 0 || t.indexOf(segs[i].codigo) === 0) return segs[i].codigo; }
    if (/breca/.test(t)) return 'breca'; if (/corp/.test(t)) return 'corporativo'; if (/pyme|empresa/.test(t)) return 'pyme'; if (/grupo|evento|alianza/.test(t)) return 'grupos';
    if (/recontacto|whatsapp|wa/.test(t)) return 'recontacto'; if (/boca|red|personal|amigo/.test(t)) return 'boca'; if (/piloto|chiclayo|santa cruz|embajador/.test(t)) return 'piloto';
    return '';
  }
  function siNo(txt) { var t = normTexto(txt); return /^(si|s|yes|y|true|1|x|ok)$/.test(t); }
  function filasAContactos(parsed, mapeo, defectos) {
    return parsed.filas.map(function (f, n) {
      var presentes = [];
      function v(campo) { var i = mapeo[campo]; if (i == null || i === '' || i < 0) return ''; var val = String(f[i] == null ? '' : f[i]).trim(); if (val) presentes.push(campo); return val; }
      var nombre = v('nombre'); var ap = v('apellido');
      if (ap && normTexto(nombre).indexOf(normTexto(ap)) < 0) nombre = (nombre + ' ' + ap).trim();
      var tel1 = v('telefono'), tel2 = v('telefono2');
      var telefonos = [];
      [tel1, tel2].forEach(function (t) { String(t || '').split(':::').forEach(function (x) { var nt = normTelefono(x); if (nt && telefonos.indexOf(nt) < 0) telefonos.push(nt); }); });
      var correos = String(v('correo') || '').split(':::').map(function (x) { return normCorreo(x); }).filter(correoValido);
      var perfil = v('perfil').toUpperCase().charAt(0); if (perfil !== 'A' && perfil !== 'B') perfil = '';
      var cons = v('consentimiento');
      var c = {
        nombre: nombre, telefono: telefonos[0] || '', telefono2: telefonos[1] || '', correo: correos[0] || '',
        empresa: v('empresa'), cargo: v('cargo'), ciudad: v('ciudad') || defectos.ciudad || '', segmento: segmentoDesdeTexto(v('segmento')) || defectos.segmento,
        subsegmento: v('subsegmento') || defectos.subsegmento || '', origen: defectos.origen, perfil: perfil || (defectos.perfil || ''),
        consentimiento: cons ? siNo(cons) : !!defectos.consentimiento, ocasion: v('ocasion'), notas: v('notas'), referidoPor: v('referidoPor'), ultimoContacto: isoDe(v('ultimoContacto')),
        proximoToque: defectos.proximoToque || '', etapa: 'atraer', estado: 'activo', toques: 0, codigoReferido: '', personas: '', fila: n + 2
      };
      if (telefonos.length) { presentes.push('telefono'); if (telefonos[1]) presentes.push('telefono2'); }
      if (correos.length) presentes.push('correo');
      if (!c.nombre && c.telefono) c.nombre = c.telefono;
      c._campos = presentes.filter(function (x, i, a) { return a.indexOf(x) === i && x !== 'apellido'; });
      return c;
    });
  }
  function indiceContactos() {
    var porTel = {}, porCorreo = {};
    DB.tabla('contactos').forEach(function (c) { indexar(porTel, porCorreo, c); });
    return { porTel: porTel, porCorreo: porCorreo };
  }
  function indexar(porTel, porCorreo, c) {
    var t = telefonoDigitos(c.telefono); if (t) porTel[t] = c;
    var t2 = telefonoDigitos(c.telefono2); if (t2) porTel[t2] = c;
    var e = normCorreo(c.correo); if (correoValido(e)) porCorreo[e] = c;
  }
  function fusionarContactos(entrantes, politica) {
    // politica: 'completar' (rellena vacíos del existente) | 'sobrescribir' | 'omitir' | 'respaldo' (gana el más reciente por updatedAt)
    var idx = indiceContactos(); var r = { nuevos: 0, duplicadosActualizados: 0, omitidos: 0, sinDato: 0, actualizados: 0, detalle: [], mapa: {} };
    var ahora = ahoraISO();
    entrantes.forEach(function (c) {
      var t = telefonoDigitos(c.telefono), e = normCorreo(c.correo);
      var existente = (t && idx.porTel[t]) || (correoValido(e) && idx.porCorreo[e]) || (c.id && DB.buscar('contactos', c.id)) || null;
      if (!t && !correoValido(e)) r.sinDato++;
      if (existente) {
        if (c.id && c.id !== existente.id) r.mapa[c.id] = existente.id;
        if (politica === 'omitir') { r.omitidos++; r.detalle.push({ tipo: 'omitido', nombre: c.nombre, con: existente.nombre }); return; }
        var modo = politica;
        if (politica === 'respaldo') modo = String(c.updatedAt || '') > String(existente.updatedAt || '') ? 'respaldo-nuevo' : 'completar';
        var campos = Array.isArray(c._campos) ? c._campos : Object.keys(c);
        campos.forEach(function (k) {
          if (modo === 'respaldo-nuevo' ? (k === 'id' || k === 'createdAt' || k === 'fila' || k === '_campos') : CAMPOS_PROTEGIDOS[k]) return;
          if (c[k] == null || c[k] === '') return;
          if (modo === 'completar' ? vacio(existente[k]) : true) existente[k] = c[k];
        });
        if (modo === 'completar' && c.notas && existente.notas && existente.notas.indexOf(c.notas) < 0 && campos.indexOf('notas') >= 0) existente.notas = existente.notas + '\n' + c.notas;
        if (existente.prueba && !c.prueba) existente.prueba = false; // una persona real nunca queda marcada como dato de prueba
        existente.updatedAt = ahora; r.duplicadosActualizados++; r.detalle.push({ tipo: 'duplicado', nombre: c.nombre, con: existente.nombre });
        indexar(idx.porTel, idx.porCorreo, existente);
      } else {
        var nuevo = clonar(c); delete nuevo.fila; delete nuevo._campos; if (!nuevo.id) nuevo.id = nuevoId('c'); nuevo.createdAt = nuevo.createdAt || ahora; nuevo.updatedAt = ahora;
        if (!nuevo.telefono) nuevo.telefono = ''; if (!nuevo.correo) nuevo.correo = ''; if (!nuevo.estado) nuevo.estado = 'activo'; if (!nuevo.etapa) nuevo.etapa = 'atraer';
        DB.tabla('contactos').push(nuevo); r.nuevos++;
        indexar(idx.porTel, idx.porCorreo, nuevo);
      }
    });
    DB.guardarPronto();
    return r;
  }
  function aCSV(filas, columnas) {
    function celda(v) { if (v == null) v = ''; if (typeof v === 'object') v = JSON.stringify(v); v = String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var lineas = [columnas.map(celda).join(',')];
    filas.forEach(function (f) { lineas.push(columnas.map(function (c) { return celda(f[c]); }).join(',')); });
    return '﻿' + lineas.join('\r\n');
  }
  function descargar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo || 'application/octet-stream' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function columnasDe(tabla) {
    var cols = {}; tabla.forEach(function (f) { Object.keys(f).forEach(function (k) { cols[k] = true; }); });
    var pref = ['id', 'nombre', 'telefono', 'correo', 'empresa', 'cargo', 'ciudad', 'segmento', 'subsegmento', 'origen', 'perfil', 'consentimiento', 'ultimoContacto', 'proximoToque', 'etapa', 'estado', 'toques', 'notas', 'referidoPor', 'codigoReferido', 'fecha', 'total', 'linea'];
    var out = pref.filter(function (k) { return cols[k]; }); Object.keys(cols).forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }

  /* =========================== UI base =========================== */
  function setEstado(txt, error) { var el = $('estadoGuardado'); if (!el) return; el.textContent = txt; el.classList.toggle('error', !!error); }
  var toastTimer = null;
  function toast(msg, tipo, ms) { var t = $('toast'); t.textContent = msg; t.className = 'toast' + (tipo ? ' ' + tipo : ''); t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3200); }
  function abrirModal(html, opciones) {
    var m = $('modal'); $('modalContenido').innerHTML = html; m.hidden = false; m.className = 'modal' + (opciones && opciones.ancho ? ' ' + opciones.ancho : ''); document.body.classList.add('con-modal');
    var foco = qs('input,select,textarea,button', $('modalContenido')); if (foco && !(opciones && opciones.sinFoco)) setTimeout(function () { foco.focus(); }, 30);
  }
  function cerrarModal() { $('modal').hidden = true; $('modalContenido').innerHTML = ''; document.body.classList.remove('con-modal'); }
  function confirmar(texto, onOk, textoBoton) {
    abrirModal('<h3>Confirmar</h3><p>' + esc(texto) + '</p><div class="acciones"><button class="btn" data-accion="cancelar">Cancelar</button><button class="btn peligro" data-accion="ok">' + esc(textoBoton || 'Sí, continuar') + '</button></div>');
    qs('[data-accion="ok"]', $('modalContenido')).onclick = function () { cerrarModal(); onOk(); };
    qs('[data-accion="cancelar"]', $('modalContenido')).onclick = cerrarModal;
  }
  function opciones(lista, valor, vacioTxt) {
    var h = vacioTxt != null ? '<option value="">' + esc(vacioTxt) + '</option>' : '';
    lista.forEach(function (o) { var v = typeof o === 'string' ? o : o.valor, t = typeof o === 'string' ? o : o.texto; h += '<option value="' + attr(v) + '"' + (String(v) === String(valor == null ? '' : valor) ? ' selected' : '') + '>' + esc(t) + '</option>'; });
    return h;
  }
  function opcionesSegmentos(valor, vacioTxt) { return opciones(cfg().segmentos.map(function (s) { return { valor: s.codigo, texto: s.num + ' · ' + s.nombre }; }), valor, vacioTxt); }
  function opcionesEtapas(valor, vacioTxt) { return opciones(cfg().etapas.map(function (e) { return { valor: e.codigo, texto: e.nombre }; }), valor, vacioTxt); }
  function campo(etiqueta, inputHtml, ayuda) { return '<label class="campo"><span>' + esc(etiqueta) + '</span>' + inputHtml + (ayuda ? '<small>' + esc(ayuda) + '</small>' : '') + '</label>'; }
  function inp(nombre, valor, extra) { return '<input name="' + attr(nombre) + '" value="' + attr(valor == null ? '' : valor) + '" ' + (extra || '') + '>'; }
  function leerForm(form) { var o = {}; qsa('[name]', form).forEach(function (el) { if (el.type === 'checkbox') o[el.name] = el.checked; else o[el.name] = el.value; }); return o; }

  /* =========================== Navegación =========================== */
  var PANTALLAS = {
    hoy: { titulo: 'Hoy', render: renderHoy },
    calendario: { titulo: 'Calendario', render: renderCalendario },
    contactos: { titulo: 'Contactos', render: function () { renderContactos(false); } },
    pipeline: { titulo: 'Pipeline', render: renderPipeline },
    ventas: { titulo: 'Ventas', render: renderVentas },
    metricas: { titulo: 'Métricas', render: renderMetricas },
    plantillas: { titulo: 'Plantillas', render: renderPlantillas },
    reporte: { titulo: 'Reporte', render: renderReporte },
    ajustes: { titulo: 'Ajustes', render: renderAjustes }
  };
  function navegar(nombre, sub) {
    if (!PANTALLAS[nombre]) nombre = 'hoy';
    if (DB.datos.ui.pantalla !== nombre || (sub && DB.datos.ui.sub !== sub)) { DB.datos.ui.pantalla = nombre; if (sub) DB.datos.ui.sub = sub; DB.guardarPronto(); }
    qsa('.pantalla').forEach(function (s) { s.hidden = s.id !== 'p-' + nombre; });
    qsa('[data-pantalla]').forEach(function (b) { b.classList.toggle('activa', b.getAttribute('data-pantalla') === nombre); });
    renderSeguro(nombre);
    window.scrollTo(0, 0);
  }
  function renderSeguro(nombre) {
    try { PANTALLAS[nombre].render(); }
    catch (e) { $('p-' + nombre).innerHTML = '<div class="tarjeta borde-alerta"><h3>Esta pantalla no se pudo dibujar</h3><p>' + esc(e.message) + '</p><p class="texto2">Descarga un respaldo desde Ajustes → Datos y respaldo y, si persiste, restablece el CRM.</p><div class="acciones"><button class="btn" data-ir="ajustes" data-sub="datos">Ir a Ajustes</button></div></div>'; console.error(e); }
  }
  function refrescar() { var p = DB.datos.ui.pantalla || 'hoy'; if (PANTALLAS[p]) renderSeguro(p); }

  /* =========================== HOY (base; se completa en la parte 2) =========================== */
  function renderHoy() {
    var hoy = hoyISO(); var dia = diaCalendario(hoy); var cont = DB.tabla('contactos');
    var vencidos = cont.filter(function (c) { return c.estado === 'activo' && c.proximoToque && c.proximoToque < hoy; }).length;
    var paraHoy = cont.filter(function (c) { return c.estado === 'activo' && c.proximoToque === hoy; }).length;
    var ventasHoy = DB.tabla('ventas').filter(function (v) { return (v.fechaCierre || v.fecha) === hoy && ['pagado', 'entregado'].indexOf(v.estado) >= 0 && !v.derivarB2B; });
    var totalHoy = ventasHoy.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0);
    var html = '<div class="cabecera-pantalla"><h2>Hoy</h2><p class="sub">' + esc(fechaLarga(hoy)) + ' · hora de Lima</p></div>';
    if (dia) {
      html += '<div class="tarjeta oro"><div class="fila-sup"><span class="etiqueta">Ola ' + esc(dia.ola) + '</span>' + (dia.esCorte ? '<span class="pill alerta">Corte de control</span>' : '') + '</div>' +
        '<h3>Foco del día</h3><p>' + esc(dia.foco || '—') + '</p>' + (dia.hito ? '<p><b>Hito:</b> ' + esc(dia.hito) + '</p>' : '') + (dia.periodo ? '<p class="texto2">' + esc(dia.periodo) + '</p>' : '') +
        '<div class="kpis"><div class="kpi"><span class="lab">Meta del día (proyección)</span><span class="val">' + soles(dia.metaDia) + '</span></div><div class="kpi"><span class="lab">Cuota oficial del día</span><span class="val">' + soles(dia.cuotaDia) + '</span></div><div class="kpi"><span class="lab">Venta de hoy</span><span class="val">' + soles(totalHoy) + '</span></div></div>' +
        '<div class="cuotas">' + Object.keys(dia.cuotas).filter(function (k) { return dia.cuotas[k] > 0; }).map(function (k) { return '<span class="chip"><b>' + esc(dia.cuotas[k]) + '</b> ' + esc(nombreSegmento(k)) + '</span>'; }).join('') + '</div></div>';
    } else {
      html += '<div class="tarjeta"><p>Hoy no es un día de atención del calendario (domingo, 25/12 o fuera del 07/10 al 31/12).</p></div>';
    }
    html += '<div class="grid-2"><div class="tarjeta"><h3>Seguimientos</h3><div class="kpis"><div class="kpi"><span class="lab">Para hoy</span><span class="val">' + paraHoy + '</span></div><div class="kpi' + (vencidos ? ' mal' : '') + '"><span class="lab">Vencidos</span><span class="val">' + vencidos + '</span></div><div class="kpi"><span class="lab">Contactos</span><span class="val">' + entero(cont.length) + '</span></div></div>' +
      '<p class="texto2">La cola del día con mensajes armados, botones de copiar y abrir WhatsApp, y el registro de enviado / respondió / compró llegan en la parte 2.</p><div class="acciones"><button class="btn" data-ir="contactos" data-filtro="vencidos">Ver vencidos</button><button class="btn" data-ir="ajustes" data-sub="datos">Importar contactos</button></div></div>' +
      '<div class="tarjeta"><h3>Estado de la base</h3>' + resumenBase() + '</div></div>';
    $('p-hoy').innerHTML = html;
  }
  function resumenBase() {
    var d = DB.datos; var porSeg = {};
    d.contactos.forEach(function (c) { porSeg[c.segmento || ''] = (porSeg[c.segmento || ''] || 0) + 1; });
    var h = '<table class="tabla compacta"><tbody>';
    cfg().segmentos.forEach(function (s) { h += '<tr><td>' + esc(s.num + ' · ' + s.nombre) + '</td><td class="num">' + entero(porSeg[s.codigo] || 0) + '</td></tr>'; });
    h += '<tr><td>Sin segmento</td><td class="num">' + entero(porSeg[''] || 0) + '</td></tr>';
    h += '<tr class="total"><td>Total contactos</td><td class="num">' + entero(d.contactos.length) + '</td></tr>';
    h += '<tr><td>Ventas registradas</td><td class="num">' + entero(d.ventas.length) + '</td></tr><tr><td>Cuentas / eventos</td><td class="num">' + entero(d.cuentas.length) + '</td></tr><tr><td>Embajadores</td><td class="num">' + entero(d.embajadores.length) + '</td></tr><tr><td>Plantillas</td><td class="num">' + entero(d.plantillas.length) + '</td></tr></tbody></table>';
    return h;
  }

  /* =========================== Placeholders (partes siguientes) =========================== */
  function placeholder(id, titulo, parte, detalle) { $(id).innerHTML = '<div class="cabecera-pantalla"><h2>' + esc(titulo) + '</h2></div><div class="tarjeta"><p><b>En construcción · parte ' + parte + '.</b> ' + esc(detalle) + '</p></div>'; }
  function renderCalendario() {
    var cal = DB.tabla('calendario'); var hoy = hoyISO();
    var html = '<div class="cabecera-pantalla"><h2>Calendario</h2><p class="sub">Del 07/10 al 31/12 · lunes a sábado, sin el 25/12 · ' + cal.length + ' días de atención. Vista completa y edición en la parte 2.</p></div>';
    html += '<div class="tarjeta"><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Fecha</th><th>Ola</th><th>Foco</th><th>Hito</th><th class="num">Meta del día</th><th class="num">Cuota oficial</th><th>Estado</th></tr></thead><tbody>';
    cal.slice(0, 400).forEach(function (d) {
      html += '<tr' + (d.fecha === hoy ? ' class="hoy"' : '') + '><td data-label="Fecha">' + esc(fechaCorta(d.fecha)) + '<br><small>' + DIAS[d.dow] + '</small></td><td data-label="Ola">' + esc(d.ola) + '</td><td data-label="Foco" class="celda-larga">' + esc(d.foco) + '</td><td data-label="Hito">' + esc(d.hito || '') + '</td><td data-label="Meta" class="num">' + soles(d.metaDia) + '</td><td data-label="Cuota" class="num">' + soles(d.cuotaDia) + '</td><td data-label="Estado"><span class="pill">' + esc(d.estado) + '</span></td></tr>';
    });
    html += '</tbody></table></div></div>';
    $('p-calendario').innerHTML = html;
  }
  function renderPipeline() { placeholder('p-pipeline', 'Pipeline', 3, 'Tablero por etapa con filtro por segmento.'); }
  function renderVentas() { placeholder('p-ventas', 'Ventas', 4, 'Registro de ventas, calculadora de grupos, avance contra cuota y proyección, mix 60/40 y embajadores.'); }
  function renderMetricas() { placeholder('p-metricas', 'Métricas', 5, 'Tasas reales contra el plan, ticket, venta por código, ranking y alertas en los cortes.'); }
  function renderPlantillas() {
    var pl = DB.tabla('plantillas');
    var html = '<div class="cabecera-pantalla"><h2>Plantillas</h2><p class="sub">' + pl.length + ' plantillas precargadas. La edición completa llega en la parte 5; aquí puedes ver el texto de cada una.</p></div><div class="tarjeta">';
    pl.forEach(function (p) { html += '<details class="plantilla"><summary><b>' + esc(p.nombre) + '</b> <span class="texto3">· ' + esc(p.segmento === '*' ? 'todos' : nombreSegmento(p.segmento)) + ' · ' + esc(p.canal) + (p.masivo ? ' · lleva leyendas' : '') + '</span></summary>' + (p.asunto ? '<p><b>Asunto:</b> ' + esc(p.asunto) + '</p>' : '') + '<pre class="texto-plantilla">' + esc(p.texto) + '</pre></details>'; });
    $('p-plantillas').innerHTML = html + '</div>';
  }
  function renderReporte() { placeholder('p-reporte', 'Reporte semanal', 5, 'Resumen para el comité de los viernes, copiable como texto y correo.'); }

  /* =========================== CONTACTOS =========================== */
  function filtrosContactos() { var f = DB.datos.ui.filtros.contactos; if (!esObjeto(f)) { f = { texto: '', segmento: '', etapa: '', ciudad: '', perfil: '', toque: '', origen: '', estado: 'activo' }; DB.datos.ui.filtros.contactos = f; } return f; }
  function contactosFiltrados() {
    var f = filtrosContactos(); var hoy = hoyISO(); var t = normTexto(f.texto); var dig = String(f.texto || '').replace(/\D/g, '');
    return DB.tabla('contactos').filter(function (c) {
      if (f.estado && (c.estado || 'activo') !== f.estado) return false;
      if (f.segmento && c.segmento !== f.segmento) return false;
      if (f.etapa && c.etapa !== f.etapa) return false;
      if (f.ciudad && normTexto(c.ciudad) !== normTexto(f.ciudad)) return false;
      if (f.perfil && c.perfil !== f.perfil) return false;
      if (f.origen && normTexto(c.origen) !== normTexto(f.origen)) return false;
      if (f.toque === 'hoy' && c.proximoToque !== hoy) return false;
      if (f.toque === 'vencidos' && !(c.proximoToque && c.proximoToque < hoy)) return false;
      if (f.toque === 'semana' && !(c.proximoToque && c.proximoToque >= hoy && c.proximoToque <= sumarDias(hoy, 7))) return false;
      if (f.toque === 'sin' && c.proximoToque) return false;
      if (t) { var pajar = normTexto([c.nombre, c.empresa, c.correo, c.notas, c.subsegmento, c.cargo].join(' ')); if (pajar.indexOf(t) < 0 && !(dig.length >= 4 && telefonoDigitos(c.telefono).indexOf(dig) >= 0)) return false; }
      return true;
    }).sort(function (a, b) { var pa = a.proximoToque || '9999', pb = b.proximoToque || '9999'; return pa < pb ? -1 : pa > pb ? 1 : String(a.nombre).localeCompare(String(b.nombre)); });
  }
  function valoresUnicos(campoNombre) { var m = {}; DB.tabla('contactos').forEach(function (c) { var v = String(c[campoNombre] || '').trim(); if (v) m[v] = true; }); return Object.keys(m).sort(); }
  function renderContactos(soloTabla) {
    var raiz = $('p-contactos'); var f = filtrosContactos();
    if (!soloTabla || !qs('.filtros', raiz)) {
      raiz.innerHTML = '<div class="cabecera-pantalla"><h2>Contactos</h2><p class="sub" id="contactosConteo"></p><div class="acciones"><button class="btn primario" data-accion="nuevo-contacto">Nuevo contacto</button><button class="btn" data-ir="ajustes" data-sub="datos">Importar CSV</button><button class="btn" data-accion="exportar-contactos">Exportar CSV</button></div></div>' +
        '<div class="tarjeta filtros"><input type="search" name="texto" placeholder="Buscar nombre, empresa, teléfono, correo o nota" value="' + attr(f.texto) + '">' +
        '<select name="segmento">' + opcionesSegmentos(f.segmento, 'Todos los segmentos') + '</select>' +
        '<select name="etapa">' + opcionesEtapas(f.etapa, 'Todas las etapas') + '</select>' +
        '<select name="ciudad">' + opciones(valoresUnicos('ciudad'), f.ciudad, 'Todas las ciudades') + '</select>' +
        '<select name="perfil">' + opciones([{ valor: 'A', texto: 'Perfil A · alto poder adquisitivo' }, { valor: 'B', texto: 'Perfil B · pyme' }], f.perfil, 'Todos los perfiles') + '</select>' +
        '<select name="toque">' + opciones([{ valor: 'hoy', texto: 'Toque hoy' }, { valor: 'vencidos', texto: 'Toques vencidos' }, { valor: 'semana', texto: 'Próximos 7 días' }, { valor: 'sin', texto: 'Sin próximo toque' }], f.toque, 'Próximo toque: todos') + '</select>' +
        '<select name="origen">' + opciones(valoresUnicos('origen'), f.origen, 'Todos los orígenes') + '</select>' +
        '<select name="estado">' + opciones([{ valor: 'activo', texto: 'Activos' }, { valor: 'dormido', texto: 'Dormidos' }, { valor: 'perdido', texto: 'Perdidos' }, { valor: 'b2b', texto: 'Derivados a B2B' }], f.estado, 'Todos los estados') + '</select>' +
        '<button class="btn chico" data-accion="limpiar-filtros">Limpiar</button></div>' +
        '<div class="tarjeta sin-padding"><div class="tabla-scroll"><table class="tabla contactos"><thead><tr><th>Contacto</th><th>Segmento</th><th>Etapa</th><th>Próximo toque</th><th>Último contacto</th><th>Perfil</th><th>Ciudad</th><th></th></tr></thead><tbody id="contactosCuerpo"></tbody></table></div><p class="texto2 pad" id="contactosNota" hidden></p></div>';
    }
    var lista = contactosFiltrados(); var hoy = hoyISO();
    $('contactosConteo').textContent = entero(lista.length) + ' de ' + entero(DB.tabla('contactos').length);
    var html = '';
    if (!lista.length) html += '<tr><td colspan="8" class="vacio">Sin contactos con estos filtros. Importa tu agenda desde Ajustes → Datos o crea uno nuevo.</td></tr>';
    lista.slice(0, 500).forEach(function (c) {
      var venc = c.proximoToque && c.proximoToque < hoy, esHoy = c.proximoToque === hoy;
      html += '<tr data-id="' + attr(c.id) + '"><td data-label="Contacto"><b>' + esc(c.nombre || '(sin nombre)') + '</b>' + (c.prueba ? ' <span class="pill chica">prueba</span>' : '') + '<br><small>' + esc(c.telefono || '') + (c.correo ? ' · ' + esc(c.correo) : '') + (c.empresa ? ' · ' + esc(c.empresa) : '') + '</small></td>' +
        '<td data-label="Segmento"><span class="chip seg-' + esc(c.segmento) + '">' + esc(nombreSegmento(c.segmento)) + '</span>' + (c.subsegmento ? '<br><small>' + esc(c.subsegmento) + '</small>' : '') + '</td>' +
        '<td data-label="Etapa">' + esc(nombreEtapa(c.etapa)) + ((c.estado || 'activo') !== 'activo' ? '<br><small class="texto3">' + esc(c.estado) + '</small>' : '') + '</td>' +
        '<td data-label="Próximo toque" class="' + (venc ? 'mal' : esHoy ? 'bien' : '') + '">' + esc(fechaCorta(c.proximoToque) || '—') + (c.toques ? '<br><small>toque ' + esc(c.toques) + ' de 3</small>' : '') + '</td>' +
        '<td data-label="Último contacto">' + esc(fechaCorta(c.ultimoContacto) || '—') + '</td><td data-label="Perfil">' + esc(c.perfil || '—') + '</td><td data-label="Ciudad">' + esc(c.ciudad || '—') + '</td>' +
        '<td class="acciones-fila">' + (c.telefono ? '<a class="btn chico" target="_blank" rel="noopener" href="' + attr(urlWhatsApp(c.telefono)) + '">WhatsApp</a>' : '') + '<button class="btn chico" data-accion="editar-contacto" data-id="' + attr(c.id) + '">Editar</button></td></tr>';
    });
    $('contactosCuerpo').innerHTML = html;
    var nota = $('contactosNota'); nota.hidden = lista.length <= 500; nota.textContent = 'Se muestran los primeros 500. Afina los filtros para ver el resto.';
  }
  function formContacto(c) {
    c = c || { segmento: 'recontacto', etapa: 'atraer', estado: 'activo', consentimiento: false, perfil: '', toques: 0 };
    var s = segmentoDe(c.segmento); var subs = (s && s.subsegmentos) || (s && s.empresas) || [];
    var h = '<h3>' + (c.id ? 'Editar contacto' : 'Nuevo contacto') + '</h3><form id="formContacto" class="form-grid">' +
      campo('Nombre', inp('nombre', c.nombre, 'required')) + campo('Teléfono (WhatsApp)', inp('telefono', c.telefono, 'inputmode="tel" placeholder="+51 9xx xxx xxx"')) + campo('Correo', inp('correo', c.correo, 'inputmode="email"')) +
      campo('Empresa', inp('empresa', c.empresa)) + campo('Cargo', inp('cargo', c.cargo)) + campo('Ciudad', inp('ciudad', c.ciudad || 'Lima')) +
      campo('Segmento', '<select name="segmento">' + opcionesSegmentos(c.segmento) + '</select>') + campo('Subsegmento', inp('subsegmento', c.subsegmento, 'list="listaSub"') + '<datalist id="listaSub">' + subs.map(function (x) { return '<option value="' + attr(x) + '">'; }).join('') + '</datalist>') +
      campo('Origen', inp('origen', c.origen, 'placeholder="Agenda, WhatsApp Business, Breca, LinkedIn…"')) +
      campo('Perfil', '<select name="perfil">' + opciones([{ valor: 'A', texto: 'A · alto poder adquisitivo' }, { valor: 'B', texto: 'B · pyme' }], c.perfil, 'Sin definir') + '</select>') +
      campo('Consentimiento (escribió primero)', '<select name="consentimiento">' + opciones([{ valor: 'true', texto: 'Sí' }, { valor: 'false', texto: 'No' }], c.consentimiento ? 'true' : 'false') + '</select>') +
      campo('Etapa', '<select name="etapa">' + opcionesEtapas(c.etapa) + '</select>') +
      campo('Estado', '<select name="estado">' + opciones([{ valor: 'activo', texto: 'Activo' }, { valor: 'dormido', texto: 'Dormido (vuelve en la siguiente ola)' }, { valor: 'perdido', texto: 'Perdido' }, { valor: 'b2b', texto: 'Derivado a B2B' }], c.estado || 'activo') + '</select>') +
      campo('Último contacto', inp('ultimoContacto', c.ultimoContacto, 'type="date"')) + campo('Próximo toque', inp('proximoToque', c.proximoToque, 'type="date"')) +
      campo('Toques en esta conversación', inp('toques', c.toques || 0, 'type="number" min="0" max="3"')) +
      campo('Ocasión', inp('ocasion', c.ocasion, 'placeholder="cumpleaños, regalo a clientes, evento…"')) + campo('Personas', inp('personas', c.personas, 'type="number" min="0"')) +
      campo('Referido por', inp('referidoPor', c.referidoPor)) + campo('Código de referido propio', inp('codigoReferido', c.codigoReferido, 'placeholder="ej. MFR-07"')) +
      '<label class="campo ancho"><span>Notas</span><textarea name="notas" rows="3">' + esc(c.notas || '') + '</textarea></label>' +
      '<div class="acciones ancho">' + (c.id ? '<button type="button" class="btn peligro izq" data-accion="eliminar-contacto" data-id="' + attr(c.id) + '">Eliminar</button>' : '') + '<button type="button" class="btn" data-accion="cerrar">Cancelar</button><button type="submit" class="btn primario">Guardar</button></div></form>';
    abrirModal(h, { ancho: 'ancho' });
    var form = $('formContacto');
    form.onsubmit = function (ev) {
      ev.preventDefault(); var v = leerForm(form);
      var original = c.id ? DB.buscar('contactos', c.id) : null;
      var obj = original ? clonar(original) : {}; // se trabaja sobre una copia: nada cambia hasta pasar la validación
      Object.keys(v).forEach(function (k) { obj[k] = v[k]; });
      obj.consentimiento = v.consentimiento === 'true'; obj.toques = Math.max(0, Math.min(3, parseInt(v.toques, 10) || 0)); obj.telefono = normTelefono(v.telefono); obj.correo = normCorreo(v.correo); obj.personas = v.personas === '' ? '' : Number(v.personas);
      obj.ultimoContacto = isoDe(v.ultimoContacto); obj.proximoToque = isoDe(v.proximoToque);
      if (!obj.estado) obj.estado = 'activo';
      var dup = DB.tabla('contactos').filter(function (x) { return x.id !== obj.id && ((obj.telefono && telefonoDigitos(x.telefono) === telefonoDigitos(obj.telefono)) || (correoValido(obj.correo) && normCorreo(x.correo) === obj.correo)); })[0];
      if (dup) { toast('Ya existe otro contacto con ese teléfono o correo: ' + dup.nombre, 'alerta'); return; }
      DB.upsert('contactos', obj); cerrarModal(); toast('Contacto guardado'); refrescar();
    };
    qs('[data-accion="cerrar"]', form).onclick = cerrarModal;
    var btnEl = qs('[data-accion="eliminar-contacto"]', form);
    if (btnEl) btnEl.onclick = function () { if (window.confirm('¿Eliminar a ' + (c.nombre || 'este contacto') + '? Sus interacciones y ventas quedan, pero sin contacto asociado.')) { DB.eliminar('contactos', c.id); cerrarModal(); toast('Contacto eliminado'); refrescar(); } };
    qs('[name="segmento"]', form).onchange = function () { var s2 = segmentoDe(this.value); var dl = $('listaSub'); dl.innerHTML = ((s2 && (s2.subsegmentos || s2.empresas)) || []).map(function (x) { return '<option value="' + attr(x) + '">'; }).join(''); };
  }

  /* =========================== AJUSTES =========================== */
  function renderAjustes() {
    var sub = DB.datos.ui.sub || 'datos'; if (['datos', 'precios', 'metas', 'reglas'].indexOf(sub) < 0) sub = 'datos';
    var html = '<div class="cabecera-pantalla"><h2>Ajustes</h2><nav class="subnav">' + ['datos|Datos y respaldo', 'precios|Precios y ganchos', 'metas|Metas y tasas', 'reglas|Reglas y segmentos'].map(function (x) { var p = x.split('|'); return '<button class="btn chico' + (sub === p[0] ? ' activa' : '') + '" data-sub="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</nav></div>';
    if (sub === 'datos') html += ajustesDatos(); else if (sub === 'precios') html += ajustesPrecios(); else if (sub === 'metas') html += ajustesMetas(); else html += ajustesReglas();
    $('p-ajustes').innerHTML = html;
    qsa('.subnav [data-sub]', $('p-ajustes')).forEach(function (b) { b.onclick = function () { DB.datos.ui.sub = b.getAttribute('data-sub'); DB.guardarPronto(); renderAjustes(); }; });
    enlazarAjustes(sub);
  }
  function ajustesDatos() {
    var d = DB.datos; var prueba = TABLAS.reduce(function (n, t) { return n + d[t].filter(function (x) { return x.prueba; }).length; }, 0);
    var tam = 0; try { tam = (localStorage.getItem(CLAVE) || '').length; } catch (e) { }
    return '<div class="grid-2">' +
      '<div class="tarjeta"><h3>Importar contactos desde CSV</h3><p class="texto2">Agenda de Google o del celular, base de WhatsApp Business o base Breca. Detecta columnas, normaliza teléfonos a +51 y evita duplicados por teléfono o correo.</p><div class="acciones"><button class="btn primario" data-accion="importar-csv">Elegir archivo CSV</button></div>' +
      '<details class="ayuda"><summary>Cómo exportar mi agenda</summary><ul><li><b>Google Contacts:</b> contacts.google.com → Exportar → Google CSV.</li><li><b>iPhone:</b> iCloud.com → Contactos → exportar vCard y convertir a CSV, o usar la app Contactos de Google.</li><li><b>WhatsApp Business:</b> los contactos viven en la agenda del celular; exporta la agenda. Las etiquetas de WhatsApp no se exportan: usa la columna Segmento o elige el segmento al importar.</li><li><b>Base Breca:</b> cualquier CSV con columnas nombre, empresa, cargo, correo y celular.</li></ul></details></div>' +
      '<div class="tarjeta"><h3>Respaldo completo (JSON)</h3><p class="texto2">Descarga todo (contactos, interacciones, ventas, embajadores, cuentas, calendario, plantillas y configuración). Hazlo al final de cada día.</p><div class="acciones"><button class="btn primario" data-accion="exportar-json">Descargar respaldo</button><button class="btn" data-accion="importar-json">Restaurar o fusionar un respaldo</button></div><p class="texto3">Último guardado: ' + esc(fechaHora(d.actualizado)) + ' · ' + (tam / 1024).toFixed(0) + ' KB en este navegador.</p></div>' +
      '<div class="tarjeta"><h3>Exportar a CSV por tabla</h3><div class="acciones">' + TABLAS.map(function (t) { return '<button class="btn chico" data-accion="exportar-csv" data-tabla="' + t + '">' + t + ' (' + entero(d[t].length) + ')</button>'; }).join('') + '</div></div>' +
      '<div class="tarjeta"><h3>Base del Centro de Mando</h3><p class="texto2">El archivo <code>datos/centro-de-mando.json</code> del repositorio trae los 729 contactos, 42 pedidos, alianzas y el maestro de SKU del registro web. Cárgalo con "Restaurar o fusionar un respaldo" en modo fusionar.</p></div>' +
      '<div class="tarjeta"><h3>Datos de prueba</h3><p class="texto2">' + (prueba ? prueba + ' registros de prueba cargados (marcados con la etiqueta "prueba").' : 'No hay datos de prueba cargados.') + '</p><div class="acciones">' + (prueba ? '<button class="btn peligro" data-accion="borrar-prueba">Borrar datos de prueba</button>' : '<button class="btn" data-accion="cargar-prueba">Cargar datos de prueba</button>') + '</div></div>' +
      '<div class="tarjeta borde-alerta"><h3>Zona de cuidado</h3><p class="texto2">Borra todo y vuelve a los datos precargados del plan. Descarga un respaldo antes.</p><div class="acciones"><button class="btn peligro" data-accion="restablecer">Restablecer todo</button></div></div></div>';
  }
  function ajustesPrecios() {
    var c = cfg();
    var h = '<div class="tarjeta"><h3>Botellas · precios de octubre 2026</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Producto</th><th class="num">B2C</th><th class="num">Supermercado</th><th class="num">Breca</th><th>Estado</th></tr></thead><tbody>';
    c.productos.forEach(function (p, i) { h += '<tr><td data-label="Producto"><b>' + esc(p.nombre) + '</b>' + (p.nota ? '<br><small class="texto3">' + esc(p.nota) + '</small>' : '') + '</td><td data-label="B2C" class="num"><input data-tabla="productos" data-i="' + i + '" data-campo="b2c" type="number" step="0.01" value="' + attr(p.b2c) + '"></td><td data-label="Supermercado" class="num"><input data-tabla="productos" data-i="' + i + '" data-campo="supermercado" type="number" step="0.01" value="' + attr(p.supermercado == null ? '' : p.supermercado) + '"></td><td data-label="Breca" class="num"><input data-tabla="productos" data-i="' + i + '" data-campo="breca" type="number" step="0.01" value="' + attr(p.breca == null ? '' : p.breca) + '"></td><td data-label="Estado"><select data-tabla="productos" data-i="' + i + '" data-campo="estado">' + opciones([{ valor: 'vigente', texto: 'Vigente' }, { valor: 'por_confirmar', texto: 'Por confirmar' }], p.estado) + '</select></td></tr>'; });
    h += '</tbody></table></div><p class="texto3">El 25 % Breca aplica solo a experiencias, no a botellas. Sobre qué precio aplica sigue por confirmar.</p></div>';
    h += '<div class="tarjeta"><h3>Packs</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Pack</th><th class="num">Precio</th><th class="num">Anaquel</th><th>Estado</th><th>Fuente</th></tr></thead><tbody>';
    c.packs.forEach(function (p, i) { h += '<tr><td data-label="Pack">' + esc(p.nombre) + '</td><td data-label="Precio" class="num"><input data-tabla="packs" data-i="' + i + '" data-campo="precio" type="number" step="0.01" value="' + attr(p.precio == null ? '' : p.precio) + '"></td><td data-label="Anaquel" class="num"><input data-tabla="packs" data-i="' + i + '" data-campo="anaquel" type="number" step="0.01" value="' + attr(p.anaquel == null ? '' : p.anaquel) + '"></td><td data-label="Estado"><select data-tabla="packs" data-i="' + i + '" data-campo="estado">' + opciones([{ valor: 'vigente', texto: 'Vigente' }, { valor: 'por_confirmar', texto: 'Por confirmar' }], p.estado) + '</select></td><td data-label="Fuente"><small class="texto3">' + esc(p.fuente || '') + '</small></td></tr>'; });
    h += '</tbody></table></div></div>';
    h += '<div class="tarjeta"><h3>Experiencias · por persona</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Experiencia</th><th class="num">Precio</th><th class="num">Con 25 % Breca</th></tr></thead><tbody>';
    c.experiencias.forEach(function (p, i) { h += '<tr><td data-label="Experiencia">' + esc(p.nombre) + '</td><td data-label="Precio" class="num"><input data-tabla="experiencias" data-i="' + i + '" data-campo="precio" type="number" step="0.01" value="' + attr(p.precio) + '"></td><td data-label="Breca" class="num">' + soles(p.precio * (1 - c.reglas.descuentoBrecaExperiencias)) + '</td></tr>'; });
    h += '</tbody></table></div></div>';
    h += '<div class="tarjeta"><h3>Paquetes para grupos (30 personas, salón del Westin incluido)</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Paquete</th><th class="num">Precio (30 p.)</th><th class="num">Por persona</th><th>Estado</th></tr></thead><tbody>';
    c.paquetesGrupo.forEach(function (p, i) { h += '<tr><td data-label="Paquete">' + esc(p.nombre) + '</td><td data-label="Precio" class="num"><input data-tabla="paquetesGrupo" data-i="' + i + '" data-campo="precio30" type="number" step="1" value="' + attr(p.precio30) + '"></td><td data-label="Por persona" class="num">' + soles(p.precio30 / p.personasBase) + '</td><td data-label="Estado"><select data-tabla="paquetesGrupo" data-i="' + i + '" data-campo="estado">' + opciones([{ valor: 'vigente', texto: 'Vigente' }, { valor: 'por_confirmar', texto: 'Por confirmar' }], p.estado) + '</select></td></tr>'; });
    h += '</tbody></table></div></div>';
    h += '<div class="tarjeta"><h3>Ganchos por ola (sin bajar precio)</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Ola</th><th>Gancho</th><th>Vigencia</th><th>Condición</th><th>Estado</th></tr></thead><tbody>';
    c.ganchos.forEach(function (g, i) { h += '<tr><td data-label="Ola">' + esc(g.ola) + '</td><td data-label="Gancho"><b>' + esc(g.nombre) + '</b><br><textarea data-tabla="ganchos" data-i="' + i + '" data-campo="texto" rows="2">' + esc(g.texto) + '</textarea></td><td data-label="Vigencia">' + esc(fechaCorta(g.desde)) + ' – ' + esc(fechaCorta(g.hasta)) + '</td><td data-label="Condición"><small>' + esc(g.condicion || '') + '</small></td><td data-label="Estado"><select data-tabla="ganchos" data-i="' + i + '" data-campo="estado">' + opciones([{ valor: 'pendiente', texto: 'Pendiente de aprobación' }, { valor: 'activo', texto: 'Activo' }, { valor: 'inactivo', texto: 'Inactivo' }], g.estado) + '</select></td></tr>'; });
    h += '</tbody></table></div><p class="texto3">Mientras un gancho esté pendiente, los mensajes usan la variable {gancho} con un texto neutro.</p></div>';
    return h;
  }
  function ajustesMetas() {
    var M = cfg().metas; var meses = ['2026-10', '2026-11', '2026-12'];
    var h = '<div class="tarjeta"><h3>Metas mensuales</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Mes</th><th class="num">Cuota oficial</th><th class="num">Proyección (plan)</th><th class="num">Venta previa a descontar</th></tr></thead><tbody>';
    meses.forEach(function (m) { h += '<tr><td data-label="Mes">' + esc(nombreMes(m)) + '</td><td data-label="Cuota" class="num"><input data-meta="cuotaOficial" data-mes="' + m + '" type="number" step="1" value="' + attr(M.cuotaOficial[m]) + '"></td><td data-label="Proyección" class="num"><input data-meta="proyeccion" data-mes="' + m + '" type="number" step="1" value="' + attr(M.proyeccion[m]) + '"></td><td data-label="Previa" class="num"><input data-meta="ventaPrevia" data-mes="' + m + '" type="number" step="1" value="' + attr((M.ventaPrevia && M.ventaPrevia[m]) || 0) + '"></td></tr>'; });
    h += '<tr class="total"><td>Trimestre</td><td class="num">' + soles(meses.reduce(function (s, m) { return s + (M.cuotaOficial[m] || 0); }, 0)) + '</td><td class="num">' + soles(meses.reduce(function (s, m) { return s + (M.proyeccion[m] || 0); }, 0)) + '</td><td></td></tr></tbody></table></div>' +
      '<p class="texto3">Mix objetivo: ' + pct(M.mix.botellas, 0) + ' botellas / ' + pct(M.mix.experiencia, 0) + ' experiencia. Al cambiar metas, pulsa "Recalcular calendario" para repartir la meta del día.</p><div class="acciones"><button class="btn" data-accion="recalcular-calendario">Recalcular metas del calendario</button></div></div>';
    h += '<div class="tarjeta"><h3>Tasas del plan por segmento</h3><div class="tabla-scroll"><table class="tabla edit"><thead><tr><th>Segmento</th><th class="num">Respuesta</th><th class="num">Compra</th><th>Fuente</th></tr></thead><tbody>';
    cfg().segmentos.forEach(function (s) { var t = cfg().tasasPlan[s.codigo] || { respuesta: 0, compra: 0 }; h += '<tr><td data-label="Segmento">' + esc(s.nombre) + '</td><td data-label="Respuesta" class="num"><input data-tasa="respuesta" data-seg="' + s.codigo + '" type="number" step="0.1" value="' + attr((t.respuesta * 100).toFixed(1)) + '"> %</td><td data-label="Compra" class="num"><input data-tasa="compra" data-seg="' + s.codigo + '" type="number" step="0.1" value="' + attr((t.compra * 100).toFixed(1)) + '"> %</td><td data-label="Fuente"><small class="texto3">' + esc(t.fuente || '') + '</small></td></tr>'; });
    h += '</tbody></table></div></div>';
    h += '<div class="tarjeta"><h3>Cortes de control</h3><p>' + cfg().cortes.map(function (c) { return '<span class="chip">' + esc(fechaCorta(c.fecha)) + ' · ' + esc(c.nombre) + '</span>'; }).join(' ') + '</p></div>';
    return h;
  }
  function ajustesReglas() {
    var R = cfg().reglas, C = cfg().cadencias;
    var h = '<div class="tarjeta"><h3>Reglas de contacto</h3><div class="form-grid">' +
      campo('Máximo de toques por conversación', '<input data-regla="maxToques" type="number" min="1" value="' + esc(R.maxToques) + '">') +
      campo('Días de bloqueo tras un contacto', '<input data-regla="diasBloqueo" type="number" min="0" value="' + esc(R.diasBloqueo) + '">') +
      campo('Días mínimos entre mensajes de ola', '<input data-regla="diasEntreOlas" type="number" min="0" value="' + esc(R.diasEntreOlas) + '">') +
      campo('Cadencia consumidor (días desde el primer toque)', '<input data-cadencia="consumidor" value="' + attr(C.consumidor.join(', ')) + '">') +
      campo('Cadencia empresa (corporativo, pymes, grupos)', '<input data-cadencia="empresa" value="' + attr(C.empresa.join(', ')) + '">') +
      campo('Umbral B2B · botellas (más de)', '<input data-regla="umbralBotellasB2B" type="number" min="0" value="' + esc(R.umbralBotellasB2B) + '">') +
      campo('Umbral B2B · soles (más de)', '<input data-regla="umbralSolesB2B" type="number" min="0" value="' + esc(R.umbralSolesB2B) + '">') +
      campo('Comisión base de embajadores', '<input data-regla="comisionBase" type="number" step="0.01" min="0" value="' + esc(R.comisionBase) + '">') +
      campo('Comisión alta', '<input data-regla="comisionAlta" type="number" step="0.01" min="0" value="' + esc(R.comisionAlta) + '">') +
      campo('Umbral mensual para comisión alta (S/)', '<input data-regla="umbralComisionMes" type="number" min="0" value="' + esc(R.umbralComisionMes) + '">') +
      campo('Leyendas en mensajes masivos', '<select data-regla="leyendasEnMasivos">' + opciones([{ valor: 'true', texto: 'Sí, siempre' }, { valor: 'false', texto: 'No' }], String(R.leyendasEnMasivos)) + '</select>') +
      '</div><p class="texto3">Leyendas: ' + esc(cfg().leyendas.join(' · ')) + '. Umbral B2B: aplica a pedidos de botellas; propuesta del plan, por confirmar con Renato.</p></div>';
    h += '<div class="tarjeta"><h3>Segmentos</h3><div class="tabla-scroll"><table class="tabla"><thead><tr><th>Segmento</th><th>Detalle</th><th>Cadencia</th><th>Trato</th></tr></thead><tbody>' + cfg().segmentos.map(function (s) { return '<tr><td data-label="Segmento"><span class="chip seg-' + esc(s.codigo) + '">' + esc(s.num + ' · ' + s.nombre) + '</span></td><td data-label="Detalle">' + esc(s.detalle) + (s.empresas ? '<br><small class="texto3">' + esc(s.empresas.join(', ')) + '</small>' : '') + '</td><td data-label="Cadencia">' + esc(s.cadencia) + '</td><td data-label="Trato">' + esc(s.trato) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    return h;
  }
  function enlazarAjustes(sub) {
    var raiz = $('p-ajustes');
    qsa('input[data-tabla],select[data-tabla],textarea[data-tabla]', raiz).forEach(function (el) {
      el.onchange = function () {
        var t = cfg()[el.getAttribute('data-tabla')], i = +el.getAttribute('data-i'), k = el.getAttribute('data-campo');
        var v = el.value; if (el.type === 'number') { if (v !== '' && isNaN(Number(v))) { toast('Escribe un número', 'alerta'); return; } v = v === '' ? null : Number(v); }
        t[i][k] = v; DB.guardarPronto(); toast('Guardado');
      };
    });
    qsa('input[data-meta]', raiz).forEach(function (el) { el.onchange = function () { var n = Number(el.value); if (el.value === '' || isNaN(n) || n < 0) { toast('Escribe un monto válido', 'alerta'); return; } var M = cfg().metas; var k = el.getAttribute('data-meta'); if (!M[k]) M[k] = {}; M[k][el.getAttribute('data-mes')] = n; DB.guardarPronto(); toast('Guardado · recalcula el calendario'); }; });
    qsa('input[data-tasa]', raiz).forEach(function (el) { el.onchange = function () { var n = Number(el.value); if (el.value === '' || isNaN(n) || n < 0 || n > 100) { toast('Escribe un porcentaje entre 0 y 100', 'alerta'); return; } var T = cfg().tasasPlan; var s = el.getAttribute('data-seg'); if (!T[s]) T[s] = { respuesta: 0, compra: 0 }; T[s][el.getAttribute('data-tasa')] = n / 100; DB.guardarPronto(); toast('Guardado'); }; });
    qsa('[data-regla]', raiz).forEach(function (el) { el.onchange = function () { var k = el.getAttribute('data-regla'); var v = el.value; if (k === 'leyendasEnMasivos') v = v === 'true'; else { v = Number(v); if (el.value === '' || isNaN(v) || v < 0) { toast('Escribe un número válido', 'alerta'); el.value = cfg().reglas[k]; return; } } cfg().reglas[k] = v; DB.guardarPronto(); toast('Guardado'); }; });
    qsa('[data-cadencia]', raiz).forEach(function (el) { el.onchange = function () { var arr = el.value.split(/[,\s;]+/).filter(function (x) { return x !== ''; }).map(Number).filter(function (x) { return !isNaN(x) && x >= 0; }); if (arr.length >= 3 && arr[0] === 0 && arr[1] > 0 && arr[2] > arr[1]) { cfg().cadencias[el.getAttribute('data-cadencia')] = arr; DB.guardarPronto(); toast('Guardado'); } else { toast('Escribe tres números crecientes empezando en 0, por ejemplo 0, 2, 5', 'alerta'); el.value = cfg().cadencias[el.getAttribute('data-cadencia')].join(', '); } }; });
  }

  /* =========================== Importador CSV (asistente) =========================== */
  var importState = null;
  function asistenteCSV(texto, nombreArchivo) {
    var parsed = parseCSV(texto);
    if (!parsed.cabeceras.length) { toast('El archivo está vacío o no se pudo leer.', 'alerta'); return; }
    importState = { parsed: parsed, nombre: nombreArchivo, mapeo: adivinarMapeo(parsed.cabeceras), defectos: { segmento: 'recontacto', subsegmento: '', origen: nombreArchivo || 'CSV', perfil: '', consentimiento: false, ciudad: '' }, politica: 'completar' };
    var sugeridoSeg = /breca/i.test(nombreArchivo) ? 'breca' : /whats/i.test(nombreArchivo) ? 'recontacto' : /google|contact|agenda|iphone|celular/i.test(nombreArchivo) ? 'boca' : 'recontacto';
    importState.defectos.segmento = sugeridoSeg; importState.defectos.consentimiento = sugeridoSeg === 'recontacto';
    renderAsistente();
  }
  function vistaPreviaHtml() {
    var st = importState; var vista = filasAContactos(st.parsed, st.mapeo, st.defectos).slice(0, 5);
    return '<h4>Vista previa (5 primeras filas)</h4><div class="tabla-scroll"><table class="tabla compacta"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Correo</th><th>Empresa</th><th>Cargo</th><th>Ciudad</th><th>Segmento</th></tr></thead><tbody>' + vista.map(function (c) { return '<tr><td>' + esc(c.nombre) + '</td><td>' + esc(c.telefono) + '</td><td>' + esc(c.correo) + '</td><td>' + esc(c.empresa) + '</td><td>' + esc(c.cargo) + '</td><td>' + esc(c.ciudad) + '</td><td>' + esc(nombreSegmento(c.segmento)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function renderAsistente() {
    var st = importState, p = st.parsed;
    var colOpc = p.cabeceras.map(function (c, i) { return { valor: String(i), texto: c }; });
    var h = '<h3>Importar contactos · ' + esc(st.nombre) + '</h3><p class="texto2">' + entero(p.filas.length) + ' filas · ' + p.cabeceras.length + ' columnas · separador "' + (p.delim === '\t' ? 'tabulador' : p.delim) + '". Revisa a qué campo va cada columna.</p>';
    h += '<div class="form-grid">';
    CAMPOS_IMPORT.forEach(function (c) { h += campo(c.etiqueta, '<select data-mapeo="' + c.campo + '">' + opciones(colOpc, st.mapeo[c.campo] == null ? '' : String(st.mapeo[c.campo]), '— no importar —') + '</select>'); });
    h += '</div><h4>Valores para toda la carga (si el archivo no trae la columna; solo para contactos nuevos)</h4><div class="form-grid">' +
      campo('Segmento', '<select data-defecto="segmento">' + opcionesSegmentos(st.defectos.segmento) + '</select>') +
      campo('Subsegmento', '<input data-defecto="subsegmento" value="' + attr(st.defectos.subsegmento) + '">') +
      campo('Origen', '<input data-defecto="origen" value="' + attr(st.defectos.origen) + '">') +
      campo('Ciudad', '<input data-defecto="ciudad" value="' + attr(st.defectos.ciudad) + '" placeholder="Lima">') +
      campo('Perfil', '<select data-defecto="perfil">' + opciones([{ valor: 'A', texto: 'A · alto poder adquisitivo' }, { valor: 'B', texto: 'B · pyme' }], st.defectos.perfil, 'Sin definir') + '</select>') +
      campo('Consentimiento (ya nos escribieron)', '<select data-defecto="consentimiento">' + opciones([{ valor: 'true', texto: 'Sí, escribieron primero' }, { valor: 'false', texto: 'No' }], String(st.defectos.consentimiento)) + '</select>') +
      campo('Si ya existe (mismo teléfono o correo)', '<select data-politica>' + opciones([{ valor: 'completar', texto: 'Completar datos vacíos (recomendado)' }, { valor: 'sobrescribir', texto: 'Sobrescribir con las columnas del archivo' }, { valor: 'omitir', texto: 'Omitir la fila' }], st.politica) + '</select>') +
      '</div><div id="vistaPrevia">' + vistaPreviaHtml() + '</div>';
    h += '<div class="acciones"><button class="btn" data-accion="cerrar">Cancelar</button><button class="btn primario" data-accion="ejecutar-import">Importar ' + entero(p.filas.length) + ' filas</button></div>';
    abrirModal(h, { ancho: 'ancho', sinFoco: true });
    var m = $('modalContenido');
    qsa('[data-mapeo]', m).forEach(function (el) { el.onchange = function () { var v = el.value; if (v === '') delete st.mapeo[el.getAttribute('data-mapeo')]; else st.mapeo[el.getAttribute('data-mapeo')] = +v; $('vistaPrevia').innerHTML = vistaPreviaHtml(); }; });
    qsa('[data-defecto]', m).forEach(function (el) { var f = function () { var k = el.getAttribute('data-defecto'); st.defectos[k] = k === 'consentimiento' ? el.value === 'true' : el.value; $('vistaPrevia').innerHTML = vistaPreviaHtml(); }; el.oninput = f; el.onchange = f; });
    qs('[data-politica]', m).onchange = function () { st.politica = this.value; };
    qs('[data-accion="cerrar"]', m).onclick = cerrarModal;
    qs('[data-accion="ejecutar-import"]', m).onclick = function () {
      if (st.mapeo.nombre == null && st.mapeo.telefono == null) { toast('Elige al menos la columna de nombre o de teléfono.', 'alerta'); return; }
      var contactos = filasAContactos(p, st.mapeo, st.defectos);
      var r = fusionarContactos(contactos, st.politica);
      cerrarModal(); refrescar();
      abrirModal('<h3>Importación terminada</h3><ul class="lista-resumen"><li><b>' + entero(r.nuevos) + '</b> contactos nuevos</li><li><b>' + entero(r.duplicadosActualizados) + '</b> ya existían y se ' + (st.politica === 'sobrescribir' ? 'sobrescribieron' : 'completaron') + '</li><li><b>' + entero(r.omitidos) + '</b> omitidos por duplicado</li><li><b>' + entero(r.sinDato) + '</b> filas sin teléfono ni correo válidos (se importaron igual; revísalas)</li></ul>' + (r.detalle.length ? '<details><summary>Ver duplicados (' + r.detalle.length + ')</summary><ul>' + r.detalle.slice(0, 200).map(function (x) { return '<li>' + esc(x.nombre) + ' → ' + esc(x.con) + (x.tipo === 'omitido' ? ' (omitido)' : '') + '</li>'; }).join('') + '</ul></details>' : '') + '<div class="acciones"><button class="btn primario" data-accion="cerrar">Listo</button></div>');
      qs('[data-accion="cerrar"]', $('modalContenido')).onclick = function () { cerrarModal(); navegar('contactos'); };
    };
  }

  /* =========================== Acciones globales =========================== */
  function leerArchivo(input, cb) {
    var f = input.files && input.files[0]; if (!f) return;
    function leer(codificacion, luego) {
      var lector = new FileReader();
      lector.onload = function () { luego(String(lector.result)); };
      lector.onerror = function () { toast('No se pudo leer el archivo', 'alerta'); };
      lector.readAsText(f, codificacion);
    }
    leer('utf-8', function (texto) {
      if (texto.indexOf('�') >= 0 && /\.(csv|txt|tsv)$/i.test(f.name)) { leer('windows-1252', function (t2) { cb(t2, f.name); input.value = ''; }); } // CSV guardado por Excel en ANSI
      else { cb(texto, f.name); input.value = ''; }
    });
  }
  function importarJSONDialogo(texto, nombre) {
    var json; try { json = JSON.parse(texto); } catch (e) { toast('El archivo no es un JSON válido', 'alerta'); return; }
    if (!esObjeto(json) || json.formato !== 'vdo-crm-respaldo' || !esObjeto(json.tablas)) { toast('No es un respaldo de este CRM', 'alerta'); return; }
    var tot = Object.keys(json.tablas).map(function (t) { return t + ': ' + entero((json.tablas[t] || []).length); }).join(' · ');
    abrirModal('<h3>Restaurar o fusionar · ' + esc(nombre) + '</h3><p class="texto2">Generado ' + esc(fechaHora(json.generado || '')) + (json.fuente ? ' · ' + esc(json.fuente) : '') + '</p><p>' + esc(tot) + '</p>' +
      '<div class="acciones col"><button class="btn primario" data-modo="fusionar">Fusionar con lo que tengo (añade y completa; evita duplicados por teléfono o correo; gana el registro más reciente)</button><button class="btn peligro" data-modo="reemplazar">Reemplazar todo con este respaldo</button><button class="btn" data-accion="cerrar">Cancelar</button></div>');
    var m = $('modalContenido');
    qs('[data-accion="cerrar"]', m).onclick = cerrarModal;
    qsa('[data-modo]', m).forEach(function (b) {
      b.onclick = function () {
        var modo = b.getAttribute('data-modo');
        var correr = function () { try { var r = DB.importar(json, modo); cerrarModal(); toast(modo === 'reemplazar' ? 'Respaldo restaurado' : 'Respaldo fusionado'); navegar('contactos'); console.log('Importación', r); } catch (e) { toast(e.message, 'alerta', 7000); } };
        if (modo === 'reemplazar') confirmar('Esto borra todo lo que hay en este navegador y lo reemplaza por el respaldo. ¿Continuar?', correr, 'Reemplazar'); else correr();
      };
    });
  }
  function accionGlobal(accion, el) {
    switch (accion) {
      case 'nuevo-contacto': formContacto(null); break;
      case 'editar-contacto': formContacto(DB.buscar('contactos', el.getAttribute('data-id'))); break;
      case 'exportar-contactos': { var t = DB.tabla('contactos'); descargar('contactos-' + hoyISO() + '.csv', aCSV(t, columnasDe(t)), 'text/csv;charset=utf-8'); break; }
      case 'exportar-csv': { var tb = el.getAttribute('data-tabla'); var tt = DB.tabla(tb); descargar(tb + '-' + hoyISO() + '.csv', aCSV(tt, columnasDe(tt)), 'text/csv;charset=utf-8'); break; }
      case 'exportar-json': descargar('vdo-crm-respaldo-' + hoyISO() + '.json', JSON.stringify(DB.exportar(), null, 1), 'application/json'); toast('Respaldo descargado'); break;
      case 'importar-json': $('archivoJson').click(); break;
      case 'importar-csv': $('archivoCsv').click(); break;
      case 'borrar-prueba': confirmar('¿Borrar los datos de prueba? Tus datos reales no se tocan.', function () { var n = DB.borrarPrueba(); toast(n + ' registros de prueba borrados'); refrescar(); }, 'Borrar'); break;
      case 'cargar-prueba': { var n = DB.cargarPrueba(); toast(n + ' registros de prueba cargados'); refrescar(); break; }
      case 'restablecer': confirmar('Esto borra TODO (contactos, ventas, calendario editado) y vuelve a los datos precargados. ¿Descargaste un respaldo?', function () { DB.restablecer(); toast('CRM restablecido'); navegar('hoy'); }, 'Sí, borrar todo'); break;
      case 'recalcular-calendario': {
        var nuevo = generarCalendario(cfg()); var actual = DB.tabla('calendario');
        nuevo.forEach(function (d) { var viejo = actual.filter(function (x) { return x.fecha === d.fecha; })[0]; if (viejo) { d.estado = viejo.estado; d.notas = viejo.notas; if (viejo.focoEditado) { d.foco = viejo.foco; d.focoEditado = true; } if (viejo.cuotasEditadas) { d.cuotas = viejo.cuotas; d.cuotasEditadas = true; } } });
        DB.datos.calendario = nuevo; DB.guardar(); toast('Calendario recalculado'); break;
      }
      case 'limpiar-filtros': DB.datos.ui.filtros.contactos = null; DB.guardarPronto(); renderContactos(false); break;
      case 'cerrar': cerrarModal(); break;
    }
  }

  /* =========================== Arranque =========================== */
  function iniciar() {
    DB.cargar();
    if (DB.datos.ui.primeraVez) { DB.cargarPrueba(); DB.datos.ui.primeraVez = false; DB.guardar(); }
    $('hoyFecha').textContent = fechaCorta(hoyISO());
    document.body.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-pantalla],[data-ir],[data-accion]');
      if (!el) return;
      if (el.hasAttribute('data-pantalla')) { navegar(el.getAttribute('data-pantalla')); return; }
      if (el.hasAttribute('data-ir')) { var filtro = el.getAttribute('data-filtro'); if (filtro) { DB.datos.ui.filtros.contactos = null; filtrosContactos().toque = filtro; } navegar(el.getAttribute('data-ir'), el.getAttribute('data-sub')); return; }
      var acc = el.getAttribute('data-accion'); if (!acc) return;
      var enModal = !!el.closest('#modalContenido');
      if (!enModal || acc === 'cerrar') { ev.preventDefault(); accionGlobal(acc, el); }
    });
    $('p-contactos').addEventListener('input', function (ev) { var el = ev.target; if (!el.name || !el.closest('.filtros')) return; var f = filtrosContactos(); f[el.name] = el.value; DB.guardarPronto(); clearTimeout(window._tf); window._tf = setTimeout(function () { renderContactos(true); }, el.type === 'search' ? 150 : 0); });
    $('p-contactos').addEventListener('change', function (ev) { var el = ev.target; if (!el.name || !el.closest('.filtros')) return; var f = filtrosContactos(); f[el.name] = el.value; DB.guardarPronto(); renderContactos(true); });
    $('archivoCsv').addEventListener('change', function () { leerArchivo(this, asistenteCSV); });
    $('archivoJson').addEventListener('change', function () { leerArchivo(this, importarJSONDialogo); });
    qs('.modal-cerrar').onclick = cerrarModal;
    var fondoPulsado = false;
    $('modal').addEventListener('mousedown', function (ev) { fondoPulsado = ev.target === $('modal'); });
    $('modal').addEventListener('click', function (ev) { if (ev.target === $('modal') && fondoPulsado) cerrarModal(); fondoPulsado = false; });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('modal').hidden) cerrarModal(); });
    window.addEventListener('beforeunload', function () { if (DB._timer) { clearTimeout(DB._timer); DB._timer = null; DB.guardar(); } });
    window.addEventListener('storage', function (ev) {
      if (ev.key !== CLAVE || !ev.newValue) return;
      if (DB._timer) { toast('Hay otra pestaña del CRM abierta con cambios. Cierra una para no perder datos.', 'alerta', 8000); return; }
      try { var otro = JSON.parse(ev.newValue); if (esObjeto(otro)) { DB.datos = otro; DB.migrar(); refrescar(); toast('Datos actualizados desde otra pestaña'); } } catch (e) { }
    });
    navegar(DB.datos.ui.pantalla || 'hoy');
  }

  window.VDO = {
    DB: DB, util: { hoyISO: hoyISO, ahoraISO: ahoraISO, isoDe: isoDe, fechaValida: fechaValida, fechaCorta: fechaCorta, fechaLarga: fechaLarga, soles: soles, numero: numero, normTelefono: normTelefono, telefonoDigitos: telefonoDigitos, normCorreo: normCorreo, correoValido: correoValido, sumarDias: sumarDias, diasEntre: diasEntre, parseCSV: parseCSV, adivinarMapeo: adivinarMapeo, aCSV: aCSV, nuevoId: nuevoId, esc: esc },
    reglas: { puedeIniciarOla: puedeIniciarOla, derivarB2B: derivarB2B, proximoToqueTras: proximoToqueTras, cadenciaDe: cadenciaDe, olaDe: olaDe, ganchosDe: ganchosDe, armarMensaje: armarMensaje, urlWhatsApp: urlWhatsApp, urlCorreo: urlCorreo, variablesDe: variablesDe, rellenar: rellenar },
    importar: { fusionarContactos: fusionarContactos, filasAContactos: filasAContactos, asistenteCSV: asistenteCSV, importarJSONDialogo: importarJSONDialogo },
    ui: { navegar: navegar, refrescar: refrescar, toast: toast, abrirModal: abrirModal, cerrarModal: cerrarModal, copiar: copiar, formContacto: formContacto },
    generarCalendario: generarCalendario
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
