# CRM B2C · The Pisco Room · Bodegas Viñas de Oro

CRM operativo del canal B2C (pisco premium y The Pisco Room, Westin Lima) para ejecutar el plan de captación del Q4 2026: meta S/ 200,000 entre el 01/10 y el 31/12/2026, mix 60/40 botellas/experiencias. Responsable: Joaquín Díaz.

Funciona abriendo **un solo archivo** (`crm-vdo.html`) en el navegador de la laptop o del celular. Sin servidor, sin instalaciones, sin internet. Los datos viven en el navegador (localStorage) y se respaldan en JSON.

## Cómo abrirlo

1. Descarga `crm-vdo.html` (o clona este repositorio).
2. Ábrelo con doble clic en Chrome, Edge o Safari. En el celular: cópialo a Archivos o Drive y ábrelo con el navegador.
3. La primera vez carga datos de prueba (etiquetados "prueba"). Bórralos en **Ajustes → Datos y respaldo → Borrar datos de prueba** cuando ya tengas tus contactos.

Los datos quedan guardados en ese navegador y ese archivo. Si abres el CRM desde otra ruta o en otro navegador, empieza vacío: restaura ahí tu respaldo JSON.

## Cómo importar tus contactos

**Ajustes → Datos y respaldo → Elegir archivo CSV.** El asistente detecta las columnas (nombre, teléfono, correo, empresa, cargo, ciudad, notas), normaliza los teléfonos a +51 y evita duplicados por teléfono o correo.

- **Agenda de Google / celular:** contacts.google.com → Exportar → Google CSV. Las columnas `First Name`, `Last Name`, `Phone 1 - Value`, `E-mail 1 - Value`, `Organization Name` y `Organization Title` se reconocen solas.
- **WhatsApp Business:** los contactos están en la agenda del celular; exporta la agenda. Elige el segmento "Recontacto WhatsApp Business" y marca consentimiento "Sí" (ya nos escribieron).
- **Base Breca (134 contactos):** cualquier CSV con columnas nombre, empresa, cargo, correo y celular; funciona con coma o punto y coma. Elige el segmento "Grupo Breca".
- **Base del Centro de Mando (registro web):** `datos/centro-de-mando.json` trae los 752 contactos, 42 pedidos, 9 alianzas y el maestro de SKU. Cárgalo con **Restaurar o fusionar un respaldo → Fusionar**.

Si una fila ya existe (mismo teléfono o correo), por defecto solo se completan los datos vacíos; también puedes sobrescribir u omitir.

## Respaldo diario

Al cerrar el día: **Ajustes → Datos y respaldo → Descargar respaldo**. Guarda el archivo `vdo-crm-respaldo-AAAA-MM-DD.json` en Drive o OneDrive. Para recuperarlo: **Restaurar o fusionar un respaldo → Reemplazar todo**. También puedes exportar cada tabla a CSV (contactos, ventas, interacciones, etc.) para Excel.

## Rutina diaria sugerida

1. **HOY** (mañana): la cola trae a quién escribir, con el mensaje ya armado según segmento, toque y ola. Botón **Copiar y abrir WhatsApp** (o correo), se envía desde el teléfono y se marca **Enviado**. Cuando contestan: **Respondió**; si compran: **Registrar venta**. La alerta de corte dice si el ritmo alcanza.
2. **PIPELINE** (mediodía): se mueven las tarjetas de etapa; las cuentas corporativas y eventos llevan su próximo paso con fecha.
3. **VENTAS** (cuando entra un pedido): registrar, marcar pagado/entregado, código de origen del embajador o campaña. **Calculadora** para cotizar grupos.
4. **Cierre del día** en HOY: resumen de enviados, respuestas y venta contra la meta del día. Luego **respaldo JSON** (Ajustes).
5. **Viernes**: **REPORTE** genera el texto del comité; copiar o abrir correo. **MÉTRICAS** muestra las tasas reales contra el plan por segmento y los cortes de control.

## Qué hace cada pantalla

- **HOY**: cola del día ordenada (vencidos primero), mensaje listo por contacto, acciones del embudo, próximos 7 días, cierre del día. Respeta las reglas: 3 toques, 7 días de bloqueo, 3 semanas entre olas, consentimiento para el número de empresa.
- **CALENDARIO**: 07/10 a 31/12 (lunes a sábado, sin 25/12) con foco, hito, ola, meta y cuota del día y cuotas de contactos por segmento. Todo editable; "Volver al plan" restaura el valor original.
- **CONTACTOS**: lista con filtros, edición rápida, importación CSV y ficha completa (historial, ventas, acciones).
- **PIPELINE**: kanban Atraer → Iniciar → Calificar → Proponer → Cerrar → Fidelizar, arrastrar o mover con ◀ ▶; "Fuera del embudo" (dormidos, perdidos, B2B); kanban de cuentas corporativas y eventos.
- **VENTAS**: registro, cuota oficial vs proyección, mix 60/40, derivadas a B2B aparte; calculadora de grupos (paquete o experiencia × personas, 25 % Breca); embajadores con comisión, pagos y saldo.
- **MÉTRICAS**: periodo trimestre/mes/semana/ola; respuesta y compra por segmento contra el plan; embudo; ticket y mix; venta por código, gancho y ola; ranking de embajadores; cortes de control con brecha y ritmo requerido. Exporta CSV.
- **PLANTILLAS**: biblioteca por segmento y toque con variables `{nombre}` `{empresa}` `{ocasion}` `{codigo}` `{gancho}` `{precio_*}`; vista previa con un contacto real; leyendas legales automáticas en masivos; restaurar las del plan; exportar e importar JSON.
- **REPORTE**: texto semanal (ventas, avance del trimestre, actividad y tasas, calendario, pendientes, próxima semana); copiar, abrir correo, descargar .txt, historial.
- **AJUSTES**: datos y respaldo, precios, metas, reglas, ganchos (activar los "pendientes de aprobación").

## Estructura del repositorio

```
crm-vdo.html                 ← el archivo que se abre (ensamblado, no editar a mano)
src/crm-markup.html          ← estructura de pantallas
src/crm-estilos.css          ← estilo The Pisco Room (negro, dorado, versales)
src/crm-datos.js             ← datos precargados del plan: segmentos, precios, ganchos, metas, calendario, plantillas
src/crm-logica.js            ← almacén, reglas, embudo, importación, formularios compartidos, CONTACTOS y AJUSTES
src/modulos/<pantalla>.js|css← una pantalla por módulo: hoy, calendario, pipeline, ventas, metricas, plantillas, reporte
src/dev.html                 ← versión para desarrollar (enlaza los archivos sueltos)
herramientas/ensamblar.py    ← genera crm-vdo.html desde src/
herramientas/convertir-centro-de-mando.py ← convierte la base del registro web al formato del CRM
datos/centro-de-mando.json   ← base real del Centro de Mando (contactos, pedidos, alianzas, SKU)
pruebas/e2e.js               ← pruebas del núcleo en Chromium (Playwright)
pruebas/modulos/<pantalla>.js← pruebas de cada pantalla
docs/modelo-de-datos.md      ← tablas y campos
docs/MODULOS.md              ← contrato para escribir o modificar una pantalla
docs/pendientes-y-supuestos.md ← lo que falta confirmar con el negocio y lo que se asumió
```

Para regenerar el archivo único tras editar `src/`: `python3 herramientas/ensamblar.py`. Para correr las pruebas: `NODE_PATH=$(npm root -g) node pruebas/e2e.js` y `node pruebas/modulos/<pantalla>.js` (requiere Node 22 y Playwright con Chromium; correrlas una por una, no en paralelo).

## Estado de construcción

| Parte | Contenido | Estado |
|---|---|---|
| 1 | Modelo de datos, importación CSV/JSON, respaldo, Ajustes (precios, ganchos, metas, reglas), Contactos básico | Lista |
| 2 | HOY (cola del día con mensajes listos, marcar enviado/respondió/compró, cierre del día) y CALENDARIO editable | Lista |
| 3 | CONTACTOS completo, ficha del contacto y PIPELINE (kanban de personas y de cuentas) | Lista |
| 4 | VENTAS, calculadora de grupos, EMBAJADORES | Lista |
| 5 | MÉTRICAS, PLANTILLAS editables, REPORTE SEMANAL | Lista |
| 6 | Guía final, pendientes y supuestos | Lista |

## Reglas precargadas (resumen)

- Precios B2C de octubre: Silver 700 ml S/ 74.90 (supermercado S/ 99.90), Gold 700 ml S/ 89.90 (S/ 119.90), Tasting Box S/ 69.90, Mini Gold 50 ml S/ 19.90, Edición Especial 500 ml S/ 99.90, Blue 710 ml S/ 399.90. Breca: Silver S/ 67.40, Gold S/ 80.90, Tasting Box S/ 62.90, Blue S/ 379.90; el 25 % Breca aplica solo a experiencias.
- Experiencias por persona: Experto Catador S/ 150, Experto Coctelero S/ 200, El Arte del Pisco S/ 290, El Arte de la Coctelería S/ 330, Master of Pisco S/ 420.
- Packs y paquetes de grupos marcados "por confirmar"; ganchos de cada ola "pendiente de aprobación" hasta que se activen en Ajustes.
- Tres toques por conversación (consumidor 0/2/5 días; empresa 0/3/7); sin respuesta al tercero pasa a dormido. Nadie recibe un mensaje de ola si fue contactado en los últimos 7 días, ni más de uno cada tres semanas. En recontacto solo se escribe a quien escribió primero.
- Más de 12 botellas o más de S/ 1,500 se deriva a B2B y no suma a la cuota.
- Toda pieza o mensaje masivo lleva "Tomar bebidas alcohólicas en exceso es dañino" y "Venta prohibida a menores de 18 años".
