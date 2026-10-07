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
- **Base del Centro de Mando (registro web):** `datos/centro-de-mando.json` trae los 729 contactos, 42 pedidos, 9 alianzas y el maestro de SKU. Cárgalo con **Restaurar o fusionar un respaldo → Fusionar**.

Si una fila ya existe (mismo teléfono o correo), por defecto solo se completan los datos vacíos; también puedes sobrescribir u omitir.

## Respaldo diario

Al cerrar el día: **Ajustes → Datos y respaldo → Descargar respaldo**. Guarda el archivo `vdo-crm-respaldo-AAAA-MM-DD.json` en Drive o OneDrive. Para recuperarlo: **Restaurar o fusionar un respaldo → Reemplazar todo**. También puedes exportar cada tabla a CSV (contactos, ventas, interacciones, etc.) para Excel.

## Estructura del repositorio

```
crm-vdo.html                 ← el archivo que se abre (ensamblado, no editar a mano)
src/crm-markup.html          ← estructura de pantallas
src/crm-estilos.css          ← estilo The Pisco Room (negro, dorado, versales)
src/crm-datos.js             ← datos precargados del plan: segmentos, precios, ganchos, metas, calendario, plantillas
src/crm-logica.js            ← almacén, reglas, importación, pantallas
src/dev.html                 ← versión para desarrollar (enlaza los archivos sueltos)
herramientas/ensamblar.py    ← genera crm-vdo.html desde src/
herramientas/convertir-centro-de-mando.py ← convierte la base del registro web al formato del CRM
datos/centro-de-mando.json   ← base real del Centro de Mando (contactos, pedidos, alianzas, SKU)
pruebas/e2e.js               ← pruebas en Chromium (Playwright)
docs/modelo-de-datos.md      ← tablas y campos
```

Para regenerar el archivo único tras editar `src/`: `python3 herramientas/ensamblar.py`. Para correr las pruebas: `NODE_PATH=$(npm root -g) node pruebas/e2e.js` (requiere Playwright con Chromium).

## Estado de construcción

| Parte | Contenido | Estado |
|---|---|---|
| 1 | Modelo de datos, importación CSV/JSON, respaldo, Ajustes (precios, ganchos, metas, reglas), Contactos básico | Lista |
| 2 | HOY (cola del día con mensajes listos, marcar enviado/respondió/compró, cierre del día) y CALENDARIO editable | Lista |
| 3 | CONTACTOS completo y PIPELINE (kanban) | Pendiente |
| 4 | VENTAS, calculadora de grupos, EMBAJADORES | Pendiente |
| 5 | MÉTRICAS, PLANTILLAS editables, REPORTE SEMANAL | Pendiente |
| 6 | Guía final, pendientes y supuestos | Pendiente |

## Reglas precargadas (resumen)

- Precios B2C de octubre: Silver 700 ml S/ 74.90 (supermercado S/ 99.90), Gold 700 ml S/ 89.90 (S/ 119.90), Tasting Box S/ 69.90, Mini Gold 50 ml S/ 19.90, Edición Especial 500 ml S/ 99.90, Blue 710 ml S/ 399.90. Breca: Silver S/ 67.40, Gold S/ 80.90, Tasting Box S/ 62.90, Blue S/ 379.90; el 25 % Breca aplica solo a experiencias.
- Experiencias por persona: Experto Catador S/ 150, Experto Coctelero S/ 200, El Arte del Pisco S/ 290, El Arte de la Coctelería S/ 330, Master of Pisco S/ 420.
- Packs y paquetes de grupos marcados "por confirmar"; ganchos de cada ola "pendiente de aprobación" hasta que se activen en Ajustes.
- Tres toques por conversación (consumidor 0/2/5 días; empresa 0/3/7); sin respuesta al tercero pasa a dormido. Nadie recibe un mensaje de ola si fue contactado en los últimos 7 días, ni más de uno cada tres semanas. En recontacto solo se escribe a quien escribió primero.
- Más de 12 botellas o más de S/ 1,500 se deriva a B2B y no suma a la cuota.
- Toda pieza o mensaje masivo lleva "Tomar bebidas alcohólicas en exceso es dañino" y "Venta prohibida a menores de 18 años".
