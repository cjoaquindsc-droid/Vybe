/* ============================================================================
   reporte.js · Pantalla REPORTE SEMANAL (parte 5) · resumen en texto plano para
   el comité de los viernes: ventas, avance contra meta, actividad y tasas,
   calendario, pendientes y próxima semana. Copiable como texto y correo.
   ========================================================================== */
(function () {
  'use strict';
  var V = window.VDO, U = V.util, UI = V.ui, R = V.reglas, DB = V.DB, cfg = V.cfg;
  var estado = { enlazado: false };
  function lunesDe(iso) { var d = U.diaSemana(iso); return U.sumarDias(iso, d === 0 ? -6 : 1 - d); }
  function cuenta(v) { return ['pagado', 'entregado'].indexOf(v.estado) >= 0 && !v.derivarB2B; }
  function fechaVenta(v) { return U.isoDe(v.fechaCierre) || U.isoDe(v.fecha) || ''; }
  function en(f, a, b) { return !!f && f >= a && f <= b; }
  function linea(c) { return (c || '-').repeat(44); }
  function pctTxt(x) { return x == null ? '–' : U.pct(x, 1); }

  function generar(lunes) {
    lunes = U.isoDe(lunes) || lunesDe(U.hoyISO()); var sabado = U.sumarDias(lunes, 5); var hoy = U.hoyISO(); var corte = sabado < hoy ? sabado : hoy;
    var P = cfg().empresa.periodo; var M = cfg().metas; var cal = DB.tabla('calendario'); var porId = {}; DB.tabla('contactos').forEach(function (c) { porId[c.id] = c; });
    var vs = DB.tabla('ventas').filter(function (v) { return cuenta(v) && en(fechaVenta(v), lunes, sabado); });
    var b2b = DB.tabla('ventas').filter(function (v) { return v.derivarB2B && v.estado !== 'perdido' && en(fechaVenta(v), lunes, sabado); });
    var tot = vs.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0);
    function grupo(lista, clave) { var m = {}; lista.forEach(function (v) { var k = clave(v) || '(sin dato)'; if (!m[k]) m[k] = { n: 0, t: 0 }; m[k].n++; m[k].t += Number(v.total) || 0; }); return Object.keys(m).sort(function (a, b) { return m[b].t - m[a].t; }).map(function (k) { return '  - ' + k + ': ' + m[k].n + ' venta' + (m[k].n === 1 ? '' : 's') + ' · ' + U.soles(m[k].t); }).join('\n') || '  - sin ventas'; }
    var vBot = vs.filter(function (v) { return v.linea !== 'experiencia'; }).reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0), vExp = tot - vBot;
    var acum = DB.tabla('ventas').filter(function (v) { return cuenta(v) && en(fechaVenta(v), P.desde, corte); }).reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0);
    var metaAcum = cal.filter(function (d) { return d.fecha <= corte; }).reduce(function (s, d) { return s + (Number(d.metaDia) || 0); }, 0), cuotaAcum = cal.filter(function (d) { return d.fecha <= corte; }).reduce(function (s, d) { return s + (Number(d.cuotaDia) || 0); }, 0);
    var mes = corte.slice(0, 7); var realMes = DB.tabla('ventas').filter(function (v) { return cuenta(v) && fechaVenta(v).slice(0, 7) === mes; }).reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0);
    var metaTotal = Number(M.total) || 200000; var restantes = cal.filter(function (d) { return d.fecha > corte; }).length; var reqDia = restantes ? Math.max(0, metaTotal - acum) / restantes : 0;
    var inter = DB.tabla('interacciones').filter(function (i) { return en(String(i.fecha || '').slice(0, 10), lunes, sabado); });
    var tocados = {}, iniciales = 0, respuestas = 0; inter.forEach(function (i) { if (i.contactoId) tocados[i.contactoId] = 1; if (String(i.toque) === '1') iniciales++; if (i.resultado === 'respondio' || i.resultado === 'compro') respuestas++; });
    var met = V.metricas && V.metricas.datos ? V.metricas.datos({ desde: lunes, hasta: sabado, nombre: 'semana' }) : null;
    var tasas = cfg().segmentos.map(function (s) { var x = met ? met.porSeg[s.codigo] : null; var p = cfg().tasasPlan[s.codigo] || {}; if (!x || !x.contactados) return '  - ' + s.nombre + ': sin contactos nuevos (plan ' + U.pct(p.respuesta || 0, 0) + ' / ' + U.pct(p.compra || 0, 1) + ')'; return '  - ' + s.nombre + ': ' + x.contactados + ' contactados · respuesta ' + pctTxt(x.respondieron / x.contactados) + ' (plan ' + U.pct(p.respuesta || 0, 0) + ') · compra ' + pctTxt(x.compraron / x.contactados) + ' (plan ' + U.pct(p.compra || 0, 1) + ')'; }).join('\n');
    var dias = cal.filter(function (d) { return d.fecha >= lunes && d.fecha <= sabado; });
    var calTxt = dias.map(function (d) { return '  - ' + U.fechaCorta(d.fecha) + ' (' + V.DIAS[d.dow].slice(0, 3) + '): ' + (d.estado || 'pendiente').replace('_', ' ') + ' · meta ' + U.soles(d.metaDia) + (d.hito ? ' · ' + d.hito : '') + '\n    ' + String(d.foco || '').slice(0, 110) + (String(d.foco || '').length > 110 ? '…' : ''); }).join('\n') || '  - sin días de atención';
    var vencidos = DB.tabla('contactos').filter(function (c) { return c.estado === 'activo' && c.proximoToque && c.proximoToque < corte; }).sort(function (a, b) { return a.proximoToque < b.proximoToque ? -1 : 1; });
    var abiertas = DB.tabla('ventas').filter(function (v) { return (v.estado === 'cotizado' || v.estado === 'link_enviado') && !v.derivarB2B; });
    var cuentasVenc = DB.tabla('cuentas').filter(function (k) { return k.fechaProximoPaso && k.fechaProximoPaso < corte && ['cerrado', 'perdido'].indexOf(k.estado) < 0; });
    var dormidos = DB.tabla('contactos').filter(function (c) { return c.estado === 'dormido' && String(c.notas || '').indexOf(': dormido') >= 0 && en(U.isoDe(String(c.updatedAt || '').slice(0, 10)), lunes, sabado); }).length;
    var embSin = DB.tabla('embajadores').filter(function (e) { return e.estado === 'activo' && !DB.tabla('ventas').some(function (v) { return cuenta(v) && fechaVenta(v).slice(0, 7) === mes && (v.embajadorId === e.id || (e.codigo && String(v.codigoOrigen || '').toUpperCase() === String(e.codigo).toUpperCase())); }); });
    var lun2 = U.sumarDias(lunes, 7), sab2 = U.sumarDias(lunes, 12);
    var fechas = cfg().fechasClave.filter(function (f) { return en(f.fecha, lun2, sab2) || (f.hasta && f.fecha <= sab2 && f.hasta >= lun2); }).map(function (f) { return '  - ' + U.fechaCorta(f.fecha) + (f.hasta ? ' al ' + U.fechaCorta(f.hasta) : '') + ': ' + f.texto; }).concat(cfg().cortes.filter(function (c) { return en(c.fecha, lun2, sab2); }).map(function (c) { return '  - ' + U.fechaCorta(c.fecha) + ': corte · ' + c.nombre; })).join('\n') || '  - sin fechas clave';
    var cuotasProx = {}; cal.filter(function (d) { return d.fecha >= lun2 && d.fecha <= sab2; }).forEach(function (d) { Object.keys(d.cuotas || {}).forEach(function (k) { cuotasProx[k] = (cuotasProx[k] || 0) + (Number(d.cuotas[k]) || 0); }); });
    var al = V.metricas && V.metricas.alertaCorte ? V.metricas.alertaCorte() : null;
    var t = [];
    t.push('REPORTE SEMANAL B2C · semana del ' + U.fechaCorta(lunes) + ' al ' + U.fechaCorta(sabado) + ' · ' + (cfg().empresa.responsable || 'Joaquín Díaz'));
    t.push('Generado el ' + U.fechaCorta(hoy) + ' · datos al ' + U.fechaCorta(corte));
    t.push(linea('='));
    t.push('1. VENTAS DE LA SEMANA');
    t.push('  Total: ' + vs.length + ' venta' + (vs.length === 1 ? '' : 's') + ' · ' + U.soles(tot) + ' · ticket promedio ' + U.soles(vs.length ? tot / vs.length : 0));
    t.push('  Mix: botellas ' + U.soles(vBot) + ' (' + (tot ? U.pct(vBot / tot, 0) : '–') + ') · experiencia ' + U.soles(vExp) + ' (' + (tot ? U.pct(vExp / tot, 0) : '–') + ') · objetivo ' + U.pct(M.mix.botellas, 0) + ' / ' + U.pct(M.mix.experiencia, 0));
    t.push('  Por segmento:\n' + grupo(vs, function (v) { var c = porId[v.contactoId]; return R.nombreSegmento((c && c.segmento) || v.segmento); }));
    t.push('  Por código de origen:\n' + grupo(vs, function (v) { return String(v.codigoOrigen || '').toUpperCase(); }));
    t.push('  Derivadas a B2B (no suman): ' + b2b.length + ' · ' + U.soles(b2b.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0)));
    t.push(linea());
    t.push('2. AVANCE DEL TRIMESTRE (al ' + U.fechaCorta(corte) + ')');
    t.push('  Acumulado: ' + U.soles(acum) + ' · cuota oficial acumulada ' + U.soles(cuotaAcum) + ' (' + pctTxt(cuotaAcum ? acum / cuotaAcum : null) + ') · proyección acumulada ' + U.soles(metaAcum) + ' (' + pctTxt(metaAcum ? acum / metaAcum : null) + ') · brecha vs proyección ' + U.soles(acum - metaAcum));
    t.push('  Mes de ' + U.nombreMes(mes) + ': ' + U.soles(realMes) + ' de cuota ' + U.soles(M.cuotaOficial[mes] || 0) + ' (' + pctTxt(M.cuotaOficial[mes] ? realMes / M.cuotaOficial[mes] : null) + ') y proyección ' + U.soles(M.proyeccion[mes] || 0) + ' (' + pctTxt(M.proyeccion[mes] ? realMes / M.proyeccion[mes] : null) + ')');
    t.push('  Para cerrar el trimestre en ' + U.soles(metaTotal) + ': ' + U.soles(reqDia) + ' por día de atención en los ' + restantes + ' días que quedan' + (al ? ' · ' + al.texto : ''));
    t.push(linea());
    t.push('3. ACTIVIDAD DE LA SEMANA');
    t.push('  Contactos tocados: ' + Object.keys(tocados).length + ' · mensajes: ' + inter.length + ' · toques iniciales: ' + iniciales + ' · respuestas: ' + respuestas);
    t.push('  Tasas por segmento (real vs plan):\n' + tasas);
    t.push(linea());
    t.push('4. CALENDARIO DE LA SEMANA\n' + calTxt);
    t.push(linea());
    t.push('5. PENDIENTES');
    t.push('  Toques vencidos: ' + vencidos.length + (vencidos.length ? '\n' + vencidos.slice(0, 10).map(function (c) { return '    - ' + c.nombre + ' (' + R.nombreSegmento(c.segmento) + ') · ' + U.diasEntre(c.proximoToque, corte) + ' días de atraso'; }).join('\n') : ''));
    t.push('  Cotizaciones abiertas: ' + abiertas.length + ' · ' + U.soles(abiertas.reduce(function (s, v) { return s + (Number(v.total) || 0); }, 0)) + (abiertas.length ? '\n' + abiertas.slice(0, 10).map(function (v) { var c = porId[v.contactoId]; return '    - ' + ((c && c.nombre) || v.clienteNombre || 'sin contacto') + ' · ' + U.soles(v.total) + ' · ' + v.estado.replace('_', ' '); }).join('\n') : ''));
    t.push('  Cuentas con próximo paso vencido: ' + cuentasVenc.length + (cuentasVenc.length ? '\n' + cuentasVenc.slice(0, 10).map(function (k) { return '    - ' + k.empresa + ' · ' + (k.proximoPaso || 'sin paso') + ' · ' + U.fechaCorta(k.fechaProximoPaso); }).join('\n') : ''));
    t.push('  Contactos dormidos esta semana: ' + dormidos + ' · embajadores activos sin ventas en el mes: ' + (embSin.length ? embSin.map(function (e) { return e.nombre; }).join(', ') : 'ninguno'));
    t.push(linea());
    t.push('6. PRÓXIMA SEMANA (' + U.fechaCorta(lun2) + ' al ' + U.fechaCorta(sab2) + ')');
    t.push('  Fechas clave y cortes:\n' + fechas);
    t.push('  Contactos planificados: ' + Object.keys(cuotasProx).filter(function (k) { return cuotasProx[k]; }).map(function (k) { return R.nombreSegmento(k) + ' ' + cuotasProx[k]; }).join(' · '));
    return t.join('\n');
  }

  function render() {
    enlazar(); var ui = DB.datos.ui; var lunes = U.isoDe(ui.reporteSemana) || lunesDe(U.hoyISO()); var hist = Array.isArray(ui.reportes) ? ui.reportes : [];
    var texto = generar(lunes); estado.texto = texto; estado.lunes = lunes;
    UI.$('p-reporte').innerHTML = '<div class="cabecera-pantalla"><h2>Reporte semanal</h2><p class="sub">Para el comité de los viernes · semana del ' + U.esc(U.fechaCorta(lunes)) + ' al ' + U.esc(U.fechaCorta(U.sumarDias(lunes, 5))) + '</p><nav class="subnav"><button type="button" class="btn chico" data-rep="semana" data-v="-7">◀ Semana anterior</button><button type="button" class="btn chico" data-rep="hoy">Esta semana</button><button type="button" class="btn chico" data-rep="semana" data-v="7">Semana siguiente ▶</button></nav></div>' +
      '<div class="tarjeta rep-barra"><div class="form-grid"><label class="campo"><span>Correo destinatario</span><input id="repCorreo" value="' + U.attr(ui.reporteCorreo || '') + '" placeholder="comite@bvo.com.pe" inputmode="email"></label></div><div class="acciones"><button type="button" class="btn primario" data-rep="copiar">Copiar como texto</button><a class="btn" id="repMail" target="_blank" rel="noopener" href="' + U.attr(R.urlCorreo(ui.reporteCorreo || '', 'Reporte semanal B2C · semana del ' + U.fechaCorta(lunes), texto)) + '">Abrir correo</a><button type="button" class="btn" data-rep="txt">Descargar .txt</button><button type="button" class="btn" data-rep="guardar">Guardar en el historial</button><button type="button" class="btn chico" data-rep="generar">Regenerar</button></div></div>' +
      '<div class="tarjeta"><pre class="rep-texto" id="repTexto">' + U.esc(texto) + '</pre></div>' +
      '<div class="tarjeta"><h3>Historial <span class="texto3">· ' + hist.length + '</span></h3>' + (hist.length ? '<ul class="rep-hist">' + hist.map(function (r, i) { return '<li><b>Semana del ' + U.esc(U.fechaCorta(r.semana)) + '</b> · generado ' + U.esc(U.fechaHora(r.generado)) + ' <span class="acciones"><button type="button" class="btn chico" data-rep="ver" data-i="' + i + '">Ver</button><button type="button" class="btn chico" data-rep="copiar-hist" data-i="' + i + '">Copiar</button><button type="button" class="btn chico peligro" data-rep="borrar" data-i="' + i + '">Borrar</button></span></li>'; }).join('') + '</ul>' : '<p class="texto3">Aún no hay reportes guardados.</p>') + '</div>';
  }
  function enlazar() {
    if (estado.enlazado) return; estado.enlazado = true; var r = UI.$('p-reporte');
    r.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-rep]'); if (!b) return; var acc = b.getAttribute('data-rep'); var ui = DB.datos.ui; var hist = Array.isArray(ui.reportes) ? ui.reportes : (ui.reportes = []);
      if (acc === 'semana') { ui.reporteSemana = U.sumarDias(estado.lunes, Number(b.getAttribute('data-v'))); DB.guardarPronto(); render(); }
      else if (acc === 'hoy') { ui.reporteSemana = lunesDe(U.hoyISO()); DB.guardarPronto(); render(); }
      else if (acc === 'generar') render();
      else if (acc === 'copiar') UI.copiar(estado.texto).then(function (ok) { UI.toast(ok ? 'Reporte copiado' : 'No se pudo copiar', ok ? '' : 'alerta'); });
      else if (acc === 'txt') U.descargar('reporte-semanal-' + estado.lunes + '.txt', estado.texto, 'text/plain;charset=utf-8');
      else if (acc === 'guardar') { hist.unshift({ semana: estado.lunes, generado: U.ahoraISO(), texto: estado.texto }); if (hist.length > 20) hist.length = 20; DB.guardarPronto(); UI.toast('Reporte guardado'); render(); }
      else if (acc === 'ver') { var x = hist[Number(b.getAttribute('data-i'))]; if (x) UI.abrirModal('<h3>Semana del ' + U.esc(U.fechaCorta(x.semana)) + '</h3><pre class="rep-texto">' + U.esc(x.texto) + '</pre><div class="acciones"><button type="button" class="btn primario" data-accion="cerrar">Cerrar</button></div>', { ancho: 'ancho', sinFoco: true }); }
      else if (acc === 'copiar-hist') { var y = hist[Number(b.getAttribute('data-i'))]; if (y) UI.copiar(y.texto).then(function (ok) { UI.toast(ok ? 'Reporte copiado' : 'No se pudo copiar', ok ? '' : 'alerta'); }); }
      else if (acc === 'borrar') { hist.splice(Number(b.getAttribute('data-i')), 1); DB.guardarPronto(); render(); }
    });
    r.addEventListener('input', function (ev) { if (ev.target.id === 'repCorreo') { DB.datos.ui.reporteCorreo = ev.target.value.trim(); DB.guardarPronto(); var a = UI.$('repMail'); if (a) a.href = R.urlCorreo(DB.datos.ui.reporteCorreo, 'Reporte semanal B2C · semana del ' + U.fechaCorta(estado.lunes), estado.texto); } });
  }
  V.reporte = { generar: generar };
  V.registrarPantalla('reporte', render);
})();
