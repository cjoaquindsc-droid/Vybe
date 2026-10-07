# Pendientes y supuestos · CRM B2C Viñas de Oro

Última actualización: 07/10/2026. Lo que el plan (PDF del 05/10) no cierra o contradice a la especificación quedó precargado como dato editable y marcado aquí.

## Supuestos tomados (editables en Ajustes)

| Tema | Lo que hace el CRM | Por qué |
|---|---|---|
| Silver 700 ml | S/ 74.90 B2C (supermercado S/ 99.90) | Confirmado por Joaquín el 07/10. El plan y el maestro de setiembre decían S/ 69.90. |
| Mini Gold de regalo (ola 1) | Desde S/ 300 | Confirmado por Joaquín; el plan lo fija en S/ 300 (p. 9 y 11). |
| Umbral B2C/B2B | Más de 12 botellas o más de S/ 1,500 **en pedidos de botellas** se marca "derivar a B2B" y no suma. Las experiencias de grupo (S/ 9,000 a 13,000) sí son B2C. | El plan habla de "pedidos" de botellas y los grupos de la sala son la línea A3 del canal B2C. Por confirmar con Renato (pregunta abierta del plan). |
| Cadencia Breca | Consumidor: inicial, +2 y +5 días | Son colaboradores que compran a título personal; el plan trata "Breca uno a uno" como trato personal. |
| Precios Breca de Mini Gold y Edición Especial | S/ 17.90 y S/ 89.90 (setiembre) | La especificación solo trae Silver, Gold, Tasting Box y Blue para Breca en octubre. |
| 25 % Breca | Solo en experiencias, sobre el precio por persona de catálogo | El plan deja abierto sobre qué precio aplica. |
| Packs (Tripack, Sixpack, Five Pack) | Precios del plan (S/ 189.90 y S/ 334.90) y de setiembre (S/ 399.90), marcados "por confirmar" | La especificación dice que no tienen precio vigente de octubre. |
| Paquetes de grupo (Esencial, Coctelero, Signature) | S/ 9,090, 10,290 y 12,990 para 30 personas, "por confirmar"; la calculadora prorratea por persona | No aparecen en el plan, que cotiza grupos por persona × tarifa. |
| Ganchos | Todos "pendiente de aprobación"; mientras tanto {gancho} usa un texto neutro | Pedido de Joaquín. El grabado sin costo depende del precio de Canchari. |
| Metas | Cuota oficial 35/38/55 mil y proyección 50/65/85 mil; la meta del día se reparte de la proyección por días de atención (lunes a viernes peso 1, sábado 0.7) | La cuota oficial no está en el plan; la proyección sí. |
| Venta previa del 01 al 06/10 | S/ 0 a descontar (editable en Ajustes → Metas) | Pregunta abierta del plan. |
| Cuotas diarias de contactos | Ola 1: recontacto 100, red personal 30, Breca 38, corporativo 6, pymes 10, grupos 3, piloto 5 desde el 12/10; olas 2 a 4 ajustadas por fase; sábados a la mitad | El ejemplo viene de la especificación; el desglose por día no está en el PDF. |
| Tasas del plan | Recontacto 15 %/3 %, red personal 40 %/6,5 %, Breca 40 %/10 %, corporativo y pymes 25 %/5 %, grupos 25 %/6,25 %, piloto 5 %/1,5 % | Las tres primeras de la especificación; el resto derivado del embudo del plan (p. 4). |
| Comisión de embajadores | 10 % de lo vendido en el mes; si el mes supera S/ 1,500 se aplica 15 % a todo el mes | El plan dice "15 % desde S/ 1,500 vendidos en el mes" sin precisar si es marginal. |
| Piloto | Segmento "Piloto Chiclayo y Santa Cruz" con ciudades editables; el plan arranca octubre con Chiclayo, Cusco e Ica | Santa Cruz y el hotel no están en el PDF. |
| Experiencias y módulos del ERP | Solo Master of Pisco tiene código (70001141); los demás quedan por confirmar | Los módulos del maestro (Cata y Maridaje, Cocktail Masterclass, Historia y Legado) no coinciden uno a uno con las cinco experiencias. |
| Consentimiento | Los contactos del Centro de Mando por WhatsApp o Instagram se importan con consentimiento = sí (nos escribieron); los de correo y los de la base Breca, no | Regla del número de empresa. |
| Dormidos | Quien recibe el tercer toque y no responde en la ventana siguiente pasa a dormido automáticamente; vuelve a la cola cuando empieza otra ola y han pasado 3 semanas | Especificación. |

## Pendientes que dependen de Joaquín o del negocio

- Pestañas del plan que no llegaron (Piloto Chiclayo, Plan de acción diario y subpestañas 0 a 5): el calendario y las plantillas se derivaron del PDF; si existen, se pueden cargar editando el calendario y las plantillas desde la app o enviándolas para precargarlas.
- Confirmar con Renato el umbral B2C/B2B y que las ventas derivadas no se cuenten dos veces.
- Precio y capacidad semanal del grabado (Canchari) antes de activar el gancho de la ola 2.
- Sobre qué precio aplica el 25 % Breca y quién difunde en cada empresa.
- Precio de octubre de los packs y de los paquetes de grupo.
- Lista final de embajadores y sus códigos (el CRM sugiere CIUDAD-NOMBRE).
- Link de pago (Izipay) por venta: el CRM deja el marcador [LINK DE PAGO] en los mensajes; se pega a mano.

## Limitaciones conocidas

- Los datos viven en el navegador donde se abre el archivo. Laptop y celular no se sincronizan solos: se pasa el respaldo JSON de uno a otro. Safari en iPhone puede borrar datos de sitios locales tras días sin uso: en celular conviene Chrome y respaldo frecuente.
- El Centro de Mando (registro web) y este CRM no se sincronizan en vivo: la base se importa con `datos/centro-de-mando.json` (fusionar) y se puede volver a generar con `herramientas/convertir-centro-de-mando.py`.
- WhatsApp Business no exporta etiquetas ni historial a CSV: se importa la agenda del celular y se elige el segmento al importar.
- Copiar al portapapeles en iOS requiere que el usuario toque el botón (ya es así) y a veces un segundo toque.
- El CRM no envía mensajes ni correos: abre wa.me o el cliente de correo con el texto listo.
