/* ============================================================================
   crm-datos.js · Datos precargados del CRM B2C
   Bodegas Viñas de Oro · The Pisco Room (Westin Lima)
   Fuentes: "Plan de captación B2C · Q4 2026 · S/ 200,000 con mix 60/40"
   (05/10/2026) y especificación de Joaquín Díaz (07/10/2026).
   Lo marcado estado:'por_confirmar' o 'pendiente' no viene cerrado en el plan.
   ========================================================================== */
window.VDO_DATOS = (function () {
  'use strict';

  var EMPRESA = {
    nombre: 'Bodegas Viñas de Oro',
    marca: 'The Pisco Room by Viñas de Oro',
    responsable: 'Joaquín Díaz',
    cargo: 'Digital Sales & Partnerships',
    firma: 'Joaquín Díaz · The Pisco Room by Viñas de Oro',
    telefonoEmpresa: '+51 979 572 979',
    correo: 'cdiaz@bvo.com.pe',
    lugar: 'The Pisco Room · Hotel Westin Lima, primer nivel, San Isidro',
    recojo: 'Amador Merino Reyna 551, San Isidro',
    zonaHoraria: 'America/Lima',
    periodo: { desde: '2026-10-01', hasta: '2026-12-31' },
    calendario: { desde: '2026-10-07', hasta: '2026-12-31', diasLibres: ['2026-12-25'] }
  };

  /* ---------- Segmentos ---------- */
  var SEGMENTOS = [
    { codigo: 'boca', nombre: 'Boca a boca', num: '1', detalle: 'Red personal · 100 contactos', grupo: 'consumidor', cadencia: 'consumidor', trato: 'tu', color: '#d4af37' },
    { codigo: 'recontacto', nombre: 'Recontacto WhatsApp Business', num: '1', detalle: 'Unos 1,000 que ya nos escribieron', grupo: 'consumidor', cadencia: 'consumidor', trato: 'usted', color: '#b58d2a' },
    { codigo: 'corporativo', nombre: 'Corporativo', num: '2', detalle: 'BCP, Yape, Interbank, Scotiabank, Pacífico, Mibanco, Prima AFP', grupo: 'empresa', cadencia: 'empresa', trato: 'usted', color: '#8fa3bf',
      empresas: ['BCP', 'Yape', 'Interbank', 'Scotiabank', 'Pacífico', 'Mibanco', 'Prima AFP'] },
    { codigo: 'breca', nombre: 'Grupo Breca', num: '3', detalle: '134 colaboradores en Perú (Melón, en Chile, se excluye)', grupo: 'consumidor', cadencia: 'consumidor', trato: 'usted', color: '#c97c3a',
      empresas: ['Rímac', 'Centria', 'Intursa', 'Urbanova', 'Tasa', 'Minsur', 'FBM', 'Safresco', 'IRM Soluciones', 'Breca corporativo', 'BBVA', 'Clínica Internacional', 'Melón (Chile · excluida)'] },
    { codigo: 'pyme', nombre: 'Empresas pequeñas y medianas', num: '4', detalle: 'Decisores que regalan a 5–10 clientes', grupo: 'empresa', cadencia: 'empresa', trato: 'usted', color: '#7fb3a0' },
    { codigo: 'grupos', nombre: 'Grupos corporativos 20–40 personas', num: '5', detalle: 'Agencias de eventos (Ancona, Gestión Humana) y alianzas', grupo: 'empresa', cadencia: 'empresa', trato: 'usted', color: '#a98ccf',
      empresas: ['Ancona', 'Gestión Humana', 'Universitario (socios)', 'Club Toyota', 'BCP (beneficios)'] },
    { codigo: 'piloto', nombre: 'Piloto Chiclayo y Santa Cruz', num: 'P', detalle: 'Embajadores y hotel', grupo: 'consumidor', cadencia: 'consumidor', trato: 'tu', color: '#e0c36a',
      subsegmentos: ['Embajador', 'Candidato a embajador', 'Hotel', 'Cliente de embajador'], ciudades: ['Chiclayo', 'Santa Cruz', 'Cusco', 'Ica', 'Trujillo', 'Arequipa', 'Piura'] }
  ];

  var ETAPAS = [
    { codigo: 'atraer', nombre: 'Atraer', detalle: 'Está en la base, aún sin mensaje de esta ola' },
    { codigo: 'iniciar', nombre: 'Iniciar', detalle: 'Primer mensaje enviado, esperando respuesta' },
    { codigo: 'calificar', nombre: 'Calificar', detalle: 'Respondió: ocasión y número de personas' },
    { codigo: 'proponer', nombre: 'Proponer', detalle: 'Total en soles + link de pago enviado' },
    { codigo: 'cerrar', nombre: 'Cerrar', detalle: 'Pago confirmado y fecha de entrega' },
    { codigo: 'fidelizar', nombre: 'Fidelizar', detalle: 'Agradecimiento, foto y código de referido' }
  ];
  var ESTADOS_CONTACTO = ['activo', 'dormido', 'perdido', 'b2b'];

  var CADENCIAS = { consumidor: [0, 2, 5], empresa: [0, 3, 7] };

  var REGLAS = {
    maxToques: 3,
    diasBloqueo: 7,            // no escribir a nadie contactado en los últimos 7 días
    diasEntreOlas: 21,         // máximo un mensaje de ola por persona cada tres semanas
    umbralBotellasB2B: 12,     // más de 12 botellas → derivar a B2B (pedidos de botellas; las experiencias de grupo son B2C)
    umbralSolesB2B: 1500,      // más de S/ 1,500 en botellas → derivar a B2B
    umbralB2BEstado: 'por_confirmar', // el PDF lo deja como propuesta a confirmar con Renato
    comisionBase: 0.10,
    comisionAlta: 0.15,
    umbralComisionMes: 1500,
    deliveryGratisDesde: 400,
    delivery: 15,
    descuentoBrecaExperiencias: 0.25,
    descuentoBrecaBase: 'por_confirmar', // sobre qué precio aplica el 25 % (pregunta abierta del plan)
    diasPostVenta: 3,          // mensaje de post-venta al tercer día de la entrega
    leyendasEnMasivos: true
  };

  var LEYENDAS = ['Tomar bebidas alcohólicas en exceso es dañino', 'Venta prohibida a menores de 18 años'];

  /* ---------- Precios de octubre 2026 ---------- */
  var PRODUCTOS = [
    { id: 'silver700', nombre: 'Silver 700 ml', linea: 'botellas', ml: 700, b2c: 74.90, supermercado: 99.90, breca: 67.40, codigo: '50006033', estado: 'vigente', nota: 'El plan del 05/10 lo ancla en S/ 69.90; precio de octubre confirmado por Joaquín en S/ 74.90' },
    { id: 'gold700', nombre: 'Gold 700 ml', linea: 'botellas', ml: 700, b2c: 89.90, supermercado: 119.90, breca: 80.90, codigo: '50006041', estado: 'vigente' },
    { id: 'tasting', nombre: 'Tasting Box (3 × 150 ml)', linea: 'botellas', ml: 450, b2c: 69.90, supermercado: null, breca: 62.90, codigo: '50006222', estado: 'vigente' },
    { id: 'minigold', nombre: 'Mini Gold 50 ml', linea: 'botellas', ml: 50, b2c: 19.90, supermercado: null, breca: 17.90, codigo: '50006052', estado: 'vigente', notaBreca: 'Precio Breca de setiembre; octubre por confirmar' },
    { id: 'ede500', nombre: 'Edición Especial 500 ml', linea: 'botellas', ml: 500, b2c: 99.90, supermercado: null, breca: 89.90, codigo: '50006058', estado: 'vigente', notaBreca: 'Precio Breca de setiembre; octubre por confirmar' },
    { id: 'blue710', nombre: 'Blue 710 ml', linea: 'botellas', ml: 710, b2c: 399.90, supermercado: null, breca: 379.90, codigo: '50006752', estado: 'vigente' }
  ];

  var PACKS = [
    { id: 'tripack', nombre: 'Tripack Silver (3 × 700 ml)', botellas: 3, precio: 189.90, anaquel: 299.70, estado: 'por_confirmar', fuente: 'Plan p.11, pieza Catálogo de bolsillo (desde el 12/10)' },
    { id: 'sixpack', nombre: 'Sixpack Silver (6 × 700 ml)', botellas: 6, precio: 334.90, anaquel: 599.40, estado: 'por_confirmar', fuente: 'Plan p.11, pieza Catálogo de bolsillo (desde el 12/10)' },
    { id: 'fivepack', nombre: 'Five Pack Gold (5 × 700 ml)', botellas: 5, precio: 399.90, anaquel: null, estado: 'por_confirmar', fuente: 'Catálogo de setiembre' }
  ];

  // codigo = módulo principal del ERP (maestro del Centro de Mando); los que no coinciden con un módulo quedan por confirmar
  var EXPERIENCIAS = [
    { id: 'catador', nombre: 'Experto Catador', precio: 150, codigo: '', nota: 'Módulo del ERP por confirmar' },
    { id: 'coctelero', nombre: 'Experto Coctelero', precio: 200, codigo: '', nota: 'Módulo del ERP por confirmar' },
    { id: 'arte_pisco', nombre: 'El Arte del Pisco', precio: 290, codigo: '', nota: 'Módulo del ERP por confirmar' },
    { id: 'arte_cocteleria', nombre: 'El Arte de la Coctelería', precio: 330, codigo: '', nota: 'Módulo del ERP por confirmar' },
    { id: 'master', nombre: 'Master of Pisco', precio: 420, codigo: '70001141' }
  ];

  var PAQUETES_GRUPO = [
    { id: 'esencial', nombre: 'Esencial', precio30: 9090, personasBase: 30, incluye: 'Salón del Westin incluido', estado: 'por_confirmar' },
    { id: 'coctelero', nombre: 'Coctelero', precio30: 10290, personasBase: 30, incluye: 'Salón del Westin incluido', estado: 'por_confirmar' },
    { id: 'signature', nombre: 'Signature', precio30: 12990, personasBase: 30, incluye: 'Salón del Westin incluido', estado: 'por_confirmar' }
  ];

  /* ---------- Olas y ganchos (sin bajar precio) ---------- */
  var OLAS = [
    { n: 1, nombre: 'Ola 1 · Montar', desde: '2026-10-07', hasta: '2026-10-24' },
    { n: 2, nombre: 'Ola 2 · Escalar (grabado)', desde: '2026-10-26', hasta: '2026-11-20' },
    { n: 3, nombre: 'Ola 3 · Cosechar (regalo listo)', desde: '2026-11-23', hasta: '2026-12-23' },
    { n: 4, nombre: 'Cierre del trimestre', desde: '2026-12-24', hasta: '2026-12-31' }
  ];

  var GANCHOS = [
    { id: 'ola1_minigold', ola: 1, desde: '2026-10-07', hasta: '2026-10-24', nombre: 'Mini Gold de regalo desde S/ 300',
      texto: 'Mini Gold 50 ml de regalo en compras desde S/ 300', condicion: 'Compras de botellas desde S/ 300; sin descuento', estado: 'pendiente' },
    { id: 'ola1_sala', ola: 1, desde: '2026-10-07', hasta: '2026-10-24', nombre: 'Sala exclusiva de cortesía (mar–jue, 2+)',
      texto: 'sala exclusiva de cortesía de martes a jueves para 2 o más personas', condicion: 'Reservas de martes a jueves para 2 o más; sujeto a disponibilidad', estado: 'pendiente' },
    { id: 'ola2_grabado', ola: 2, desde: '2026-10-26', hasta: '2026-11-20', nombre: 'Grabado del nombre sin costo (cierre 20/11)',
      texto: 'grabado del nombre sin costo en Gold y Blue; los pedidos con grabado para entrega en diciembre se cierran el 20 de noviembre', condicion: 'Precio y capacidad del grabado por confirmar con Canchari', estado: 'pendiente' },
    { id: 'ola3_regalo', ola: 3, desde: '2026-11-23', hasta: '2026-12-23', nombre: 'Regalo listo con entrega antes del 23/12',
      texto: 'regalo listo, con botella con nombre y tarjeta, entregado antes del 23 de diciembre', condicion: 'Entregas en Lima hasta el 23/12', estado: 'pendiente' }
  ];

  /* ---------- Metas ---------- */
  var METAS = {
    total: 200000,
    cuotaOficial: { '2026-10': 35000, '2026-11': 38000, '2026-12': 55000 },
    proyeccion: { '2026-10': 50000, '2026-11': 65000, '2026-12': 85000 },
    mix: { botellas: 0.60, experiencia: 0.40 },
    proyeccionLinea: {
      botellas: { '2026-10': 30000, '2026-11': 39000, '2026-12': 51000 },
      experiencia: { '2026-10': 20000, '2026-11': 26000, '2026-12': 34000 }
    },
    lineasPlan: [
      { codigo: 'B1', nombre: 'Lima directo: entrantes, recontacto, recompra y referidos', linea: 'botellas', meses: { '2026-10': 12000, '2026-11': 13500, '2026-12': 16500 }, ticket: 250 },
      { codigo: 'B2', nombre: 'Provincias: red de embajadores', linea: 'botellas', meses: { '2026-10': 4000, '2026-11': 9000, '2026-12': 13000 }, ticket: 200 },
      { codigo: 'B3', nombre: 'Colaboradores Breca', linea: 'botellas', meses: { '2026-10': 6500, '2026-11': 6500, '2026-12': 7000 }, ticket: 300 },
      { codigo: 'B4', nombre: 'Regalo de fin de año (personas y empresas pequeñas)', linea: 'botellas', meses: { '2026-10': 5000, '2026-11': 7000, '2026-12': 10500 }, ticket: 750 },
      { codigo: 'B5', nombre: 'Botella al cierre del tour', linea: 'botellas', meses: { '2026-10': 2500, '2026-11': 3000, '2026-12': 4000 }, ticket: 90 },
      { codigo: 'A1', nombre: 'Recontacto y entrantes de Lima', linea: 'experiencia', meses: { '2026-10': 12000, '2026-11': 14000, '2026-12': 16000 }, ticket: 215 },
      { codigo: 'A2', nombre: 'Colaboradores Breca (25 %)', linea: 'experiencia', meses: { '2026-10': 3000, '2026-11': 4000, '2026-12': 5000 }, ticket: 215 },
      { codigo: 'A3', nombre: 'Grupos de alianzas y empresas', linea: 'experiencia', meses: { '2026-10': 3000, '2026-11': 5000, '2026-12': 8000 }, ticket: 215 },
      { codigo: 'A4', nombre: 'Experiencia para regalar', linea: 'experiencia', meses: { '2026-10': 2000, '2026-11': 3000, '2026-12': 5000 }, ticket: 215 }
    ],
    pesoDia: [0, 1, 1, 1, 1, 1, 0.7], // domingo..sábado (domingo no se atiende)
    ventaPrevia: { '2026-10': 0 }       // venta del 01 al 06/10 por descontar (pregunta abierta del plan)
  };

  /* ---------- Tasas del plan (respuesta y compra sobre personas contactadas) ---------- */
  var TASAS_PLAN = {
    recontacto: { respuesta: 0.15, compra: 0.03, fuente: 'Especificación' },
    boca: { respuesta: 0.40, compra: 0.065, fuente: 'Especificación (el plan p.4 usa 35 % y ~5 % para Personal 1:1)' },
    breca: { respuesta: 0.40, compra: 0.10, fuente: 'Plan p.4, Breca uno a uno' },
    corporativo: { respuesta: 0.25, compra: 0.05, fuente: 'Plan p.4, prospección de regalo (25 % / 20 %)' },
    pyme: { respuesta: 0.25, compra: 0.05, fuente: 'Plan p.4, prospección de regalo (25 % / 20 %)' },
    grupos: { respuesta: 0.25, compra: 0.0625, fuente: 'Supuesto: 25 % de las conversaciones cierran (plan p.5, alianzas)' },
    piloto: { respuesta: 0.05, compra: 0.015, fuente: 'Plan p.4, embajadores (5 % / 30 %)' }
  };

  /* ---------- Cortes de control y fechas clave ---------- */
  var CORTES = [
    { fecha: '2026-10-19', nombre: 'Corte de control con origen', fuente: 'Plan (Gantt)' },
    { fecha: '2026-10-31', nombre: 'Corte de octubre', fuente: 'Especificación' },
    { fecha: '2026-11-07', nombre: 'Corte tras Cyber Wow', fuente: 'Especificación' },
    { fecha: '2026-11-09', nombre: 'Corte de embajadores (se queda quien vendió)', fuente: 'Plan (Gantt)' },
    { fecha: '2026-11-16', nombre: 'Corte previo al cierre de grabado', fuente: 'Especificación' },
    { fecha: '2026-11-30', nombre: 'Corte de noviembre', fuente: 'Especificación' },
    { fecha: '2026-12-14', nombre: 'Corte previo a gratificación', fuente: 'Especificación' },
    { fecha: '2026-12-31', nombre: 'Cierre del trimestre', fuente: 'Especificación' }
  ];

  var FECHAS_CLAVE = [
    { fecha: '2026-10-08', texto: 'Master of Pisco con Universitario (convenio socios adherentes)', tipo: 'hito' },
    { fecha: '2026-10-12', texto: 'Kit y grupo de embajadores · sale el Catálogo de bolsillo', tipo: 'hito' },
    { fecha: '2026-10-19', texto: 'Corte de control con origen · arranca la pieza Regalo con nombre', tipo: 'corte' },
    { fecha: '2026-10-26', hasta: '2026-10-31', texto: 'Pieza Canción Criolla: Tripack para la noche del 31', tipo: 'periodo' },
    { fecha: '2026-10-31', texto: 'Canción Criolla', tipo: 'alerta' },
    { fecha: '2026-11-02', hasta: '2026-11-05', texto: 'Cyber Wow (Mini Gold de regalo desde S/ 300, sin descuento)', tipo: 'alerta' },
    { fecha: '2026-11-02', texto: 'Ola 2 de embajadores', tipo: 'hito' },
    { fecha: '2026-11-06', texto: 'Último despacho a Chiclayo y Santa Cruz', tipo: 'alerta' },
    { fecha: '2026-11-09', texto: 'Corte de embajadores', tipo: 'corte' },
    { fecha: '2026-11-12', texto: 'Evento Ancona / Lenovo', tipo: 'alerta' },
    { fecha: '2026-11-13', hasta: '2026-11-14', texto: 'Visita del Papa · activación del hotel', tipo: 'alerta' },
    { fecha: '2026-11-20', texto: 'Cierre de grabado: último día para pedidos con nombre', tipo: 'alerta' },
    { fecha: '2026-12-01', hasta: '2026-12-23', texto: 'Entregas de regalo', tipo: 'periodo' },
    { fecha: '2026-12-15', texto: 'Gratificación', tipo: 'alerta' },
    { fecha: '2026-12-23', texto: 'Últimas entregas', tipo: 'alerta' },
    { fecha: '2026-12-24', texto: 'Nochebuena', tipo: 'hito' },
    { fecha: '2026-12-31', texto: 'Cierre del trimestre', tipo: 'corte' }
  ];

  /* ---------- Calendario: foco por semana y volumen por ola ---------- */
  var SEMANAS = [
    { desde: '2026-10-07', hasta: '2026-10-10', foco: 'Montar: retomar la cola del corte del 04/10 y arrancar G2 Crítica y Alta (20 por día). Lista de 30 candidatos a embajador. Pedir a RR. HH. de cada empresa Breca que difunda el beneficio. Brief de las piezas 1 y 3.' },
    { desde: '2026-10-12', hasta: '2026-10-17', foco: 'Kit y grupo de embajadores (12/10). Sale el Catálogo de bolsillo en estados y grupos. G2 Media y recompra. Arranca la venta de embajadores en Chiclayo, Cusco e Ica.' },
    { desde: '2026-10-19', hasta: '2026-10-24', foco: 'Corte de control con origen (19/10): recalibrar tasas. Arranca la pieza Regalo con nombre y la prospección de regalo de fin de año. Cierre de la ola 1.' },
    { desde: '2026-10-26', hasta: '2026-10-31', foco: 'Ola 2: grabado del nombre. Pieza Canción Criolla (Tripack para la noche del 31). Prospección de regalo a empresas pequeñas y corporativo.' },
    { desde: '2026-11-02', hasta: '2026-11-07', foco: 'Cyber Wow (02 al 05/11): Mini Gold de regalo desde S/ 300, sin descuento. Ola 2 de embajadores. Último despacho a Chiclayo y Santa Cruz el 06/11.' },
    { desde: '2026-11-09', hasta: '2026-11-14', foco: 'Corte de embajadores (09/11). Evento Ancona / Lenovo (12/11). Visita del Papa y activación del hotel (13 y 14/11). Empujar pedidos con grabado.' },
    { desde: '2026-11-16', hasta: '2026-11-21', foco: 'Última semana de grabado: cierre el 20/11. Confirmar nombres, cantidades y pagos de todos los pedidos con nombre.' },
    { desde: '2026-11-23', hasta: '2026-11-28', foco: 'Ola 3: regalo listo. Tarjeta digital de experiencia para regalar. Confirmar entregas de diciembre y capacidad de Canchari.' },
    { desde: '2026-11-30', hasta: '2026-12-05', foco: 'Arrancan las entregas de regalo. Corte de noviembre (30/11). Recontacto de compradores de octubre con la experiencia para regalar.' },
    { desde: '2026-12-07', hasta: '2026-12-12', foco: 'Entregas de regalo y reservas de la sala para diciembre. Mensaje de gratificación (15/12) a red personal y Breca.' },
    { desde: '2026-12-14', hasta: '2026-12-19', foco: 'Corte previo a gratificación (14/12). Gratificación (15/12): última ola de botellas y experiencias para regalar. Confirmar últimas entregas.' },
    { desde: '2026-12-21', hasta: '2026-12-24', foco: 'Últimas entregas (23/12) y Nochebuena. Solo pedidos con entrega confirmada.' },
    { desde: '2026-12-26', hasta: '2026-12-31', foco: 'Cierre del trimestre: agradecimientos, fotos y códigos de referido. Reporte final y plan de enero.' }
  ];

  // Contactos por día según la ola (lunes a viernes; sábado a la mitad)
  var VOLUMEN_OLA = {
    1: { recontacto: 100, boca: 30, breca: 38, corporativo: 6, pyme: 10, grupos: 3, piloto: 5 },
    2: { recontacto: 60, boca: 20, breca: 30, corporativo: 8, pyme: 20, grupos: 4, piloto: 8 },
    3: { recontacto: 60, boca: 20, breca: 25, corporativo: 4, pyme: 15, grupos: 2, piloto: 8 },
    4: { recontacto: 30, boca: 15, breca: 10, corporativo: 0, pyme: 0, grupos: 0, piloto: 4 }
  };

  /* ---------- Plantillas (variables: {nombre} {empresa} {ocasion} {codigo} {gancho} {ciudad} {personas} {producto}
       {precio_silver} {precio_gold} {precio_blue} {precio_breca_silver} {precio_breca_gold} {precio_breca_blue} {firma} {link}) ---------- */
  var PLANTILLAS = [
    // Recontacto WhatsApp Business (ya nos escribieron · usted)
    { id: 'recontacto_t1', segmento: 'recontacto', toque: 1, ola: 0, canal: 'whatsapp', masivo: true, nombre: 'Recontacto · toque 1',
      texto: 'Hola {nombre}, le saluda Joaquín de The Pisco Room by Viñas de Oro. Nos escribió hace unas semanas y quería retomar la conversación con una novedad de este mes: {gancho}. ¿Le gustaría que le arme una propuesta para {ocasion}? Le envío el total en soles y el link de pago en un solo mensaje.' },
    { id: 'recontacto_t2', segmento: 'recontacto', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Recontacto · toque 2 (+2 días)',
      texto: '{nombre}, le escribo de nuevo por si el mensaje anterior quedó entre los pendientes. Para {ocasion}, lo que más piden es el Silver 700 ml a S/ {precio_silver} (S/ 99.90 en supermercado) y la experiencia El Arte del Pisco para dos en la sala del Westin. ¿Prefiere botellas o la sala?' },
    { id: 'recontacto_t3', segmento: 'recontacto', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Recontacto · toque 3 (+5 días, último)',
      texto: '{nombre}, este es mi último mensaje por ahora, para no insistir. Si en algún momento quiere reservar la sala en el Westin o separar botellas con entrega en Lima, me escribe por aquí y lo atiendo yo mismo. Gracias por su tiempo.' },

    // Boca a boca · red personal (tú)
    { id: 'boca_t1', segmento: 'boca', toque: 1, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Red personal · toque 1',
      texto: 'Hola {nombre}, ¿cómo estás? Te cuento algo que estoy armando en The Pisco Room, la sala de Viñas de Oro en el Westin: {gancho}. Si tienes algo que celebrar o alguien a quien regalar en estos meses, te armo una propuesta. Usa mi código {codigo} y te paso el total con link de pago.' },
    { id: 'boca_t2', segmento: 'boca', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Red personal · toque 2 (+2 días)',
      texto: '{nombre}, te dejo dos ideas concretas por si te sirven: el Silver 700 ml a S/ {precio_silver} (S/ 99.90 en supermercado) y la experiencia El Arte del Pisco para dos en la sala. ¿Te armo alguna?' },
    { id: 'boca_t3', segmento: 'boca', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Red personal · toque 3 (+5 días, último)',
      texto: '{nombre}, no quiero saturarte. Si más adelante te animas, me escribes y lo coordino yo. Y si conoces a alguien que quiera conocer la sala, pásale mi código {codigo}: cada amigo que compre con tu código te gana una Mini Gold 50 ml.' },

    // Grupo Breca (colaboradores · usted)
    { id: 'breca_t1', segmento: 'breca', toque: 1, ola: 0, canal: 'whatsapp', masivo: true, nombre: 'Breca · toque 1',
      texto: 'Buenos días {nombre}, le saluda Joaquín Díaz de Viñas de Oro, empresa del grupo. Como colaborador de {empresa} tiene precio de colaborador en nuestras botellas (Silver 700 ml a S/ {precio_breca_silver}, Gold a S/ {precio_breca_gold}, Blue a S/ {precio_breca_blue}) y 25 % en las experiencias de The Pisco Room en el Westin. ¿Quiere que le arme una propuesta para {ocasion}? Le envío el total y el link de pago, con entrega en su oficina el día de reparto de la semana.' },
    { id: 'breca_t2', segmento: 'breca', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Breca · toque 2 (+2 días)',
      texto: '{nombre}, le recuerdo el beneficio de colaborador de {empresa}: botellas con precio de colaborador y 25 % en la sala. Si me confirma hoy, su pedido entra en el reparto de la semana a su oficina. ¿Le armo algo para {ocasion}?' },
    { id: 'breca_t3', segmento: 'breca', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Breca · toque 3 (+5 días, último)',
      texto: '{nombre}, último mensaje por mi parte. El beneficio de colaborador queda abierto todo el trimestre: cuando quiera usarlo, me escribe por aquí con su nombre y empresa y lo atiendo yo. Gracias.' },

    // Corporativo (correo + WhatsApp · usted)
    { id: 'corporativo_t1_correo', segmento: 'corporativo', toque: 1, ola: 0, canal: 'correo', masivo: false, nombre: 'Corporativo · toque 1 (correo)',
      asunto: 'Regalos de fin de año con nombre · {empresa}',
      texto: 'Estimado/a {nombre}:\n\nLe escribo de Bodegas Viñas de Oro. Para {empresa} proponemos un regalo de fin de año que no se repite: Gold 700 ml o Blue 710 ml con el nombre de quien lo recibe grabado en la botella, entregado en caja y con tarjeta. {gancho}.\n\nReferencia de precios: Gold a S/ {precio_gold} y Blue a S/ {precio_blue} por botella. Los pedidos con grabado para entrega en diciembre se cierran el 20 de noviembre.\n\n¿Le parece una llamada de 15 minutos esta semana para ver cantidades y nombres? Con ese dato le envío la propuesta con el total en soles.\n\nSaludos cordiales,\n{firma}' },
    { id: 'corporativo_t1', segmento: 'corporativo', toque: 1, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Corporativo · toque 1 (WhatsApp)',
      texto: 'Hola {nombre}, le saluda Joaquín Díaz de Viñas de Oro. Le envié un correo con la propuesta de regalos de fin de año con nombre grabado para {empresa} (Gold a S/ {precio_gold}, Blue a S/ {precio_blue}). Los pedidos con grabado se cierran el 20 de noviembre. ¿Tiene 15 minutos esta semana para ver cantidades?' },
    { id: 'corporativo_t2', segmento: 'corporativo', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Corporativo · toque 2 (+3 días)',
      texto: '{nombre}, retomo la propuesta de regalos para {empresa}. Si me indica cuántas personas tiene en la lista, le envío hoy mismo el total en soles con el link de pago o la orden de compra, según prefiera.' },
    { id: 'corporativo_t3', segmento: 'corporativo', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Corporativo · toque 3 (+7 días, último)',
      texto: '{nombre}, cierro el tema por ahora para no insistir. Si {empresa} decide regalar botellas con nombre este año, el cierre de grabado es el 20 de noviembre; me escribe y lo armamos en el día. Gracias por su tiempo.' },

    // Pymes (decisores · usted)
    { id: 'pyme_t1', segmento: 'pyme', toque: 1, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Pymes · toque 1',
      texto: 'Hola {nombre}, le saluda Joaquín Díaz de Viñas de Oro. Para {empresa} armamos regalos de fin de año con nombre grabado: Gold 700 ml a S/ {precio_gold} y Blue a S/ {precio_blue}, una botella personalizada para cada cliente. {gancho}. ¿Cuántas personas tiene en su lista? Con ese número le envío el total y el link de pago.' },
    { id: 'pyme_t2', segmento: 'pyme', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Pymes · toque 2 (+3 días)',
      texto: '{nombre}, le dejo una referencia para decidir rápido: 10 Gold grabados para sus clientes son S/ {total_10_gold}, con entrega en su oficina. Los pedidos con grabado se cierran el 20 de noviembre. ¿Le armo la propuesta con sus nombres?' },
    { id: 'pyme_t3', segmento: 'pyme', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Pymes · toque 3 (+7 días, último)',
      texto: '{nombre}, último mensaje por mi parte. Si más adelante quiere regalar botellas con nombre a sus clientes, me escribe y lo coordino en el día. Gracias.' },

    // Grupos corporativos y alianzas (usted)
    { id: 'grupos_t1', segmento: 'grupos', toque: 1, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Grupos · toque 1',
      texto: 'Hola {nombre}, le saluda Joaquín de The Pisco Room, la sala de Viñas de Oro en el Westin Lima. Para grupos de {personas} personas armamos una experiencia privada de pisco y coctelería con salón del hotel incluido, cotizada por persona y con fecha cerrada. ¿Tiene en mente una fecha y un número aproximado? Le envío la propuesta con el total en soles.' },
    { id: 'grupos_t1_correo', segmento: 'grupos', toque: 1, ola: 0, canal: 'correo', masivo: false, nombre: 'Grupos · toque 1 (correo)',
      asunto: 'Experiencia privada en The Pisco Room para {empresa}',
      texto: 'Estimado/a {nombre}:\n\nEn The Pisco Room, la sala de Viñas de Oro en el Hotel Westin Lima, recibimos grupos de {personas} personas con una experiencia privada de pisco y coctelería, salón del hotel incluido. La propuesta se cotiza por persona y por paquete, con fecha y hora cerradas.\n\nSi me indica la fecha tentativa, el número de personas y la ocasión, le envío la cotización con el total en soles y el link de pago.\n\nSaludos cordiales,\n{firma}' },
    { id: 'grupos_t2', segmento: 'grupos', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Grupos · toque 2 (+3 días)',
      texto: '{nombre}, retomo la propuesta para su grupo. Tengo fechas disponibles en las próximas semanas; si me confirma personas y fecha tentativa, le envío la cotización cerrada hoy. Las fechas de diciembre se reservan con anticipación.' },
    { id: 'grupos_t3', segmento: 'grupos', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Grupos · toque 3 (+7 días, último)',
      texto: '{nombre}, cierro el tema por ahora. Si su equipo decide celebrar en la sala, me escribe con la fecha y el número de personas y lo armamos. Gracias por su tiempo.' },

    // Piloto Chiclayo y Santa Cruz (tú)
    { id: 'piloto_candidato_t1', segmento: 'piloto', toque: 1, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Piloto · candidato a embajador · toque 1',
      texto: 'Hola {nombre}, ¿cómo estás? Te escribo de Viñas de Oro. Estamos llevando el pisco premium a {ciudad} con una red de embajadores: personas con buena red que recomiendan y ganan 10 % por cada venta con su código (15 % desde S/ 1,500 al mes), con kit de arranque y piezas con su nombre. Pensé en ti. ¿Conversamos 10 minutos esta semana?' },
    { id: 'piloto_cliente_t1', segmento: 'piloto', toque: 1, ola: 0, canal: 'whatsapp', masivo: true, nombre: 'Piloto · cliente de embajador · toque 1',
      texto: 'Hola {nombre}, te escribe Joaquín de Viñas de Oro. Ya tenemos entrega de pisco premium en {ciudad}: Silver 700 ml a S/ {precio_silver} (S/ 99.90 en supermercado), Gold a S/ {precio_gold} y Blue a S/ {precio_blue}. Pedidos con el código {codigo}, pago con link seguro y entrega confirmada. ¿Te armo un pedido para {ocasion}?' },
    { id: 'piloto_t2', segmento: 'piloto', toque: 2, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Piloto · toque 2 (+2 días)',
      texto: '{nombre}, te escribo de nuevo por si quedó pendiente. El último despacho a {ciudad} antes de fin de año tiene fecha, así que si quieres separar botellas te paso el total y el link de pago hoy. Código {codigo}.' },
    { id: 'piloto_t3', segmento: 'piloto', toque: 3, ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Piloto · toque 3 (+5 días, último)',
      texto: '{nombre}, último mensaje por ahora. Cuando quieras pedir, me escribes con el código {codigo} y lo coordino. Gracias.' },

    // Fidelizar y referidos (todos los segmentos)
    { id: 'postventa', segmento: '*', toque: 'post', ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Post-venta (al tercer día de la entrega)',
      texto: '{nombre}, gracias por su compra. ¿Cómo le fue con {producto}? Si nos comparte una foto con su botella o en la sala, la publicamos con su permiso. Le dejo su código de referido {codigo}: cada amigo que compre con él le gana una Mini Gold 50 ml.' },
    { id: 'confirmacion_pago', segmento: '*', toque: 'cierre', ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Confirmación de pago y entrega',
      texto: '{nombre}, pago recibido, muchas gracias. Su pedido de {producto} queda programado para {ocasion}. Le aviso por aquí cuando esté en camino. Cualquier cambio, me escribe.' },
    { id: 'propuesta', segmento: '*', toque: 'propuesta', ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Propuesta con total y link de pago',
      texto: '{nombre}, le resumo la propuesta para {ocasion}: {producto}. Total: S/ {total}. Puede pagar con este link seguro: {link}. En cuanto llegue el pago le confirmo la fecha de entrega.' },
    { id: 'recordatorio_cotizacion', segmento: '*', toque: 'recordatorio', ola: 0, canal: 'whatsapp', masivo: false, nombre: 'Recordatorio de cotización (3 horas después)',
      texto: '{nombre}, le dejo el link de pago a la mano por si decide cerrar hoy: {link}. Total S/ {total}. Si prefiere otra opción, me dice y la ajusto.' }
  ];

  /* ---------- Datos de prueba (borrables con un botón; marcados prueba:true) ---------- */
  var DATOS_PRUEBA = {
    contactos: [
      { id: 'c_prueba_01', prueba: true, nombre: 'María Fernanda Rojas', telefono: '+51 987 654 321', correo: 'mf.rojas@ejemplo.pe', empresa: '', cargo: '', ciudad: 'Lima', segmento: 'recontacto', subsegmento: 'G2 Alta', origen: 'WhatsApp Business', perfil: 'A', consentimiento: true, ultimoContacto: '2026-09-28', proximoToque: '2026-10-07', etapa: 'atraer', estado: 'activo', toques: 0, notas: 'Preguntó por la sala para un cumpleaños en octubre.', referidoPor: '', codigoReferido: 'MFR-07', ocasion: 'cumpleaños', personas: 2 },
      { id: 'c_prueba_02', prueba: true, nombre: 'Luis Alberto Paredes', telefono: '+51 998 111 222', correo: '', empresa: '', cargo: '', ciudad: 'Lima', segmento: 'boca', subsegmento: 'Red personal', origen: 'Agenda personal', perfil: 'A', consentimiento: true, ultimoContacto: '', proximoToque: '2026-10-07', etapa: 'atraer', estado: 'activo', toques: 0, notas: 'Amigo de la universidad. Le gusta el Blue.', referidoPor: '', codigoReferido: 'LAP-11', ocasion: 'regalo', personas: 1 },
      { id: 'c_prueba_03', prueba: true, nombre: 'Carla Huamán', telefono: '+51 955 333 444', correo: 'chuaman@rimac.ejemplo', empresa: 'Rímac', cargo: 'Analista', ciudad: 'Lima', segmento: 'breca', subsegmento: 'Rímac', origen: 'Base Breca', perfil: 'B', consentimiento: false, ultimoContacto: '', proximoToque: '2026-10-07', etapa: 'atraer', estado: 'activo', toques: 0, notas: '', referidoPor: '', codigoReferido: '', ocasion: 'regalo de fin de año', personas: 1 },
      { id: 'c_prueba_04', prueba: true, nombre: 'Jorge Salinas', telefono: '+51 944 555 666', correo: 'jsalinas@bcp.ejemplo', empresa: 'BCP', cargo: 'Jefe de Bienestar', ciudad: 'Lima', segmento: 'corporativo', subsegmento: 'BCP', origen: 'LinkedIn', perfil: 'A', consentimiento: false, ultimoContacto: '2026-10-05', proximoToque: '2026-10-08', etapa: 'iniciar', estado: 'activo', toques: 1, notas: 'Correo enviado el 05/10 con propuesta de regalos.', referidoPor: '', codigoReferido: '', ocasion: 'regalos a clientes', personas: 40 },
      { id: 'c_prueba_05', prueba: true, nombre: 'Patricia Vega', telefono: '+51 933 777 888', correo: 'pvega@estudiovega.ejemplo', empresa: 'Estudio Vega Abogados', cargo: 'Socia', ciudad: 'Lima', segmento: 'pyme', subsegmento: 'Estudio', origen: 'Referido', perfil: 'A', consentimiento: false, ultimoContacto: '2026-10-02', proximoToque: '2026-10-05', etapa: 'calificar', estado: 'activo', toques: 1, notas: 'Quiere regalar a 8 clientes. Pidió precios con grabado.', referidoPor: 'Luis Alberto Paredes', codigoReferido: '', ocasion: 'regalo a clientes', personas: 8 },
      { id: 'c_prueba_06', prueba: true, nombre: 'Renzo Castillo', telefono: '+51 922 999 000', correo: 'rcastillo@ancona.ejemplo', empresa: 'Ancona', cargo: 'Productor de eventos', ciudad: 'Lima', segmento: 'grupos', subsegmento: 'Ancona', origen: 'Alianza', perfil: 'A', consentimiento: true, ultimoContacto: '2026-10-06', proximoToque: '2026-10-09', etapa: 'proponer', estado: 'activo', toques: 2, notas: 'Evento Lenovo del 12/11, 30 personas. Cotización enviada.', referidoPor: '', codigoReferido: '', ocasion: 'evento corporativo', personas: 30 },
      { id: 'c_prueba_07', prueba: true, nombre: 'Ana Lucía Torres', telefono: '+51 911 222 333', correo: '', empresa: '', cargo: 'Bartender', ciudad: 'Chiclayo', segmento: 'piloto', subsegmento: 'Embajador', origen: 'Candidato', perfil: 'B', consentimiento: true, ultimoContacto: '2026-10-06', proximoToque: '2026-10-12', etapa: 'cerrar', estado: 'activo', toques: 1, notas: 'Acepta ser embajadora. Kit el 12/10.', referidoPor: '', codigoReferido: 'CIX-ANA', ocasion: '', personas: 0 },
      { id: 'c_prueba_08', prueba: true, nombre: 'Diego Mendoza', telefono: '+51 900 444 555', correo: 'dmendoza@ejemplo.pe', empresa: '', cargo: '', ciudad: 'Lima', segmento: 'recontacto', subsegmento: 'Ya vivió la experiencia', origen: 'WhatsApp Business', perfil: 'A', consentimiento: true, ultimoContacto: '2026-09-20', proximoToque: '2026-09-25', etapa: 'fidelizar', estado: 'activo', toques: 3, notas: 'Compró 2 Blue en setiembre. Pedir foto y referido.', referidoPor: '', codigoReferido: 'DM-20', ocasion: '', personas: 0 }
    ],
    interacciones: [
      { id: 'i_prueba_01', prueba: true, contactoId: 'c_prueba_04', fecha: '2026-10-05T10:15:00', canal: 'correo', toque: 1, ola: 1, plantillaId: 'corporativo_t1_correo', mensaje: 'Propuesta de regalos de fin de año con nombre', respuesta: '', resultado: 'enviado', codigoOrigen: 'CORP-BCP' },
      { id: 'i_prueba_02', prueba: true, contactoId: 'c_prueba_05', fecha: '2026-10-02T16:40:00', canal: 'whatsapp', toque: 1, ola: 1, plantillaId: 'pyme_t1', mensaje: 'Regalos con nombre para 8 clientes', respuesta: 'Me interesa, ¿cuánto sale con grabado?', resultado: 'respondio', codigoOrigen: 'REF-LAP' },
      { id: 'i_prueba_03', prueba: true, contactoId: 'c_prueba_06', fecha: '2026-10-06T11:00:00', canal: 'whatsapp', toque: 2, ola: 1, plantillaId: 'grupos_t2', mensaje: 'Cotización Signature 30 personas', respuesta: 'La reviso con el cliente', resultado: 'respondio', codigoOrigen: 'ANCONA' }
    ],
    ventas: [
      { id: 'v_prueba_01', prueba: true, contactoId: 'c_prueba_08', fecha: '2026-09-23', linea: 'botellas', items: [{ productoId: 'blue710', nombre: 'Blue 710 ml', cantidad: 2, precio: 399.90, total: 799.80 }], botellas: 2, personas: 0, total: 799.80, gancho: '', codigoOrigen: 'RECONTACTO-G2', estado: 'entregado', fechaCierre: '2026-09-23', motivoPerdida: '', segmento: 'recontacto', derivarB2B: false, embajadorId: '', notas: 'Recojo en el Westin.' },
      { id: 'v_prueba_02', prueba: true, contactoId: 'c_prueba_06', fecha: '2026-10-06', linea: 'experiencia', items: [{ productoId: 'signature', nombre: 'Paquete Signature · 30 personas', cantidad: 1, precio: 12990, total: 12990 }], botellas: 0, personas: 30, total: 12990, gancho: '', codigoOrigen: 'ANCONA', estado: 'cotizado', fechaCierre: '', motivoPerdida: '', segmento: 'grupos', derivarB2B: false, embajadorId: '', notas: 'Evento Lenovo 12/11. Paquete por confirmar.' },
      { id: 'v_prueba_03', prueba: true, contactoId: 'c_prueba_01', fecha: '2026-10-06', linea: 'experiencia', items: [{ productoId: 'arte_pisco', nombre: 'El Arte del Pisco', cantidad: 2, precio: 290, total: 580 }], botellas: 0, personas: 2, total: 580, gancho: 'ola1_sala', codigoOrigen: 'RECONTACTO-G2', estado: 'link_enviado', fechaCierre: '', motivoPerdida: '', segmento: 'recontacto', derivarB2B: false, embajadorId: '', notas: 'Cumpleaños, sábado 17/10 4 p. m.' }
    ],
    embajadores: [
      { id: 'e_prueba_01', prueba: true, nombre: 'Ana Lucía Torres', ciudad: 'Chiclayo', codigo: 'CIX-ANA', telefono: '+51 911 222 333', contactoId: 'c_prueba_07', estado: 'activo', desde: '2026-10-12', pagos: [] },
      { id: 'e_prueba_02', prueba: true, nombre: 'Hotel Santa Cruz (recepción)', ciudad: 'Santa Cruz', codigo: 'SCZ-HOTEL', telefono: '', contactoId: '', estado: 'candidato', desde: '', pagos: [] }
    ],
    cuentas: [
      { id: 'k_prueba_01', prueba: true, empresa: 'Ancona · evento Lenovo', segmento: 'grupos', contactos: ['c_prueba_06'], paquete: 'signature', personas: 30, fechaEvento: '2026-11-12', monto: 12990, estado: 'cotizacion', notas: 'Salón del Westin. Confirmar paquete y fecha de pago.', proximoPaso: 'Llamar a Renzo', fechaProximoPaso: '2026-10-09' },
      { id: 'k_prueba_02', prueba: true, empresa: 'BCP · regalos de fin de año', segmento: 'corporativo', contactos: ['c_prueba_04'], paquete: '', personas: 40, fechaEvento: '', monto: 3596, estado: 'contactado', notas: '40 Gold grabados a S/ 89.90.', proximoPaso: 'Seguimiento por WhatsApp', fechaProximoPaso: '2026-10-08' }
    ]
  };

  return {
    EMPRESA: EMPRESA, SEGMENTOS: SEGMENTOS, ETAPAS: ETAPAS, ESTADOS_CONTACTO: ESTADOS_CONTACTO, CADENCIAS: CADENCIAS, REGLAS: REGLAS,
    LEYENDAS: LEYENDAS, PRODUCTOS: PRODUCTOS, PACKS: PACKS, EXPERIENCIAS: EXPERIENCIAS, PAQUETES_GRUPO: PAQUETES_GRUPO,
    OLAS: OLAS, GANCHOS: GANCHOS, METAS: METAS, TASAS_PLAN: TASAS_PLAN, CORTES: CORTES, FECHAS_CLAVE: FECHAS_CLAVE,
    SEMANAS: SEMANAS, VOLUMEN_OLA: VOLUMEN_OLA, PLANTILLAS: PLANTILLAS, DATOS_PRUEBA: DATOS_PRUEBA
  };
})();
