# Alimentar el CRM desde el chat

El CRM B2C de Viñas de Oro vive como página publicada en claude.ai:

**https://claude.ai/artifact/EDvShuCT6JAbmMCUGMajyT**

Sus datos están en la base de datos de ese artefacto (capacidad `db`). Cualquier conversación con Claude que tenga acceso a la herramienta de artefactos puede leerla y escribirla: en Claude Code se llama `ArtifactData`; en otras superficies es la acción `read_db` / `write_db` de la herramienta de artefactos. Siempre se pasa la URL de arriba. La página abierta en cualquier dispositivo recibe los cambios en segundos.

Este documento es la guía para Claude. Puede pegarse en las instrucciones de un proyecto o subirse como skill (`skills/vdo-crm-nube/SKILL.md`).

## Reglas de oro

1. **Leer antes de escribir.** Antes de crear un contacto, buscar si ya existe por teléfono normalizado o por correo (`query` con `where`). Un contacto existente se actualiza con `update` (fusiona campos), nunca se duplica.
2. **Pinar las actualizaciones.** Para cambiar un documento que ya existe, leerlo primero y pasar su `version` como `if_version`. Para crear uno nuevo no se pasa `if_version`.
3. **Ids válidos.** Solo letras, dígitos y `_ - . ~ : @ +`. Convención: `c_chat_AAAAMMDD_apellido` para contactos, `i_chat_AAAAMMDD_HHMM_apellido` para interacciones, `v_chat_AAAAMMDD_apellido` para ventas, `cu_chat_…` para cuentas, `e_chat_…` para embajadores. El id del documento es la identidad; el campo `id` del cuerpo debe ser igual.
4. **Fechas de Lima.** Fechas de negocio `AAAA-MM-DD`; fecha y hora `AAAA-MM-DDTHH:MM`. Poner `createdAt` y `updatedAt` (fecha y hora de ahora) en todo lo que se cree; actualizar `updatedAt` al modificar.
5. **Varios cambios, un `batch`** (hasta 50 escrituras).
6. **No tocar** `config/principal` (precios, metas, reglas) ni `plantillas` ni `calendario` salvo pedido explícito de Joaquín. No borrar documentos salvo pedido explícito. No escribir bajo `data/users`.
7. **Teléfonos** en formato `+51` seguido de 9 dígitos sin espacios (`+51999888777`). Si llega con espacios o sin código la página lo normaliza, pero para buscar duplicados hay que usar la forma normalizada.
8. **Nunca mandar mensajes.** El CRM solo arma textos; el envío lo hace Joaquín desde su WhatsApp o correo.

## Colecciones

| Colección | Qué guarda | Id del documento |
|---|---|---|
| `contactos` | personas (B2C, Breca, corporativo, pymes, grupos, piloto) | `id` del contacto |
| `interacciones` | cada mensaje enviado o respuesta recibida | `id` |
| `ventas` | cotizaciones y ventas (oportunidades) | `id` |
| `cuentas` | empresas, eventos y alianzas con varios contactos | `id` |
| `embajadores` | embajadores del piloto con código de venta | `id` |
| `calendario` | un documento por día de atención (07/10 a 31/12/2026) | la fecha `AAAA-MM-DD` |
| `plantillas` | textos de WhatsApp y correo por segmento y toque | `id` |
| `config` | un solo documento `principal` con precios, segmentos, metas y reglas | `principal` |

## Contacto

```json
{
  "id": "c_chat_20261008_perez",
  "nombre": "Juan Pérez",
  "telefono": "+51999888777",
  "correo": "jperez@empresa.pe",
  "empresa": "Empresa SAC",
  "cargo": "Gerente de Marketing",
  "ciudad": "Lima",
  "segmento": "corporativo",
  "subsegmento": "",
  "origen": "Chat",
  "perfil": "A",
  "consentimiento": true,
  "etapa": "atraer",
  "estado": "activo",
  "toques": 0,
  "ocasion": "regalos de fin de año",
  "personas": 0,
  "notas": "Pidió propuesta de Gold grabado para 20 clientes",
  "createdAt": "2026-10-08T10:30",
  "updatedAt": "2026-10-08T10:30"
}
```

- `segmento`: `boca` (red personal), `recontacto` (clientes que escribieron por WhatsApp Business), `corporativo`, `breca` (colaboradores del Grupo Breca), `pyme`, `grupos` (eventos de 20 a 40 personas), `piloto` (Chiclayo y Santa Cruz).
- `etapa`: `atraer` → `iniciar` (primer mensaje enviado) → `calificar` (respondió) → `proponer` (cotización enviada) → `cerrar` (compró) → `fidelizar` (post-venta).
- `estado`: `activo`, `dormido` (tres toques sin respuesta), `perdido`, `b2b` (derivado).
- `consentimiento`: `true` solo si la persona escribió primero; es obligatorio para que el número de la empresa le escriba.
- `perfil`: `A` alto poder adquisitivo, `B` pyme, vacío si no se sabe.
- Campos que fija el embudo cuando la página los procesa: `ultimoContacto`, `proximoToque`, `inicioConversacion`, `ultimaOla`, `ultimaRespuesta`, `respondio`, `cierrePendiente`, `yaCompro`, `codigoReferido`, `totalInvertido`. Se pueden escribir desde el chat si se conocen (por ejemplo `respondio: true` y `ultimaRespuesta` al registrar una respuesta).

Buscar duplicados antes de crear:

```
query contactos where telefono == "+51999888777"
query contactos where correo == "jperez@empresa.pe"
```

## Interacción

```json
{
  "id": "i_chat_20261008_1030_perez",
  "contactoId": "c_chat_20261008_perez",
  "fecha": "2026-10-08T10:30",
  "canal": "whatsapp",
  "toque": 1,
  "ola": 1,
  "resultado": "enviado",
  "mensaje": "Hola Juan, le escribe Joaquín…",
  "respuesta": "",
  "codigoOrigen": "",
  "createdAt": "2026-10-08T10:30",
  "updatedAt": "2026-10-08T10:30"
}
```

- `canal`: `whatsapp`, `correo`, `linkedin`, `llamada`, `visita`.
- `toque`: `1`, `2`, `3` (mensajes de la conversación), `post` (post-venta), `propuesta`, `recordatorio`, `cierre`.
- `resultado`: `enviado`, `respondio`, `compro`, `sin_respuesta`.
- `ola`: 1 (07 al 24/10), 2 (26/10 al 20/11), 3 (23/11 al 23/12), 4 (24 al 31/12).

Al registrar que se envió un mensaje, actualizar también el contacto: `etapa: "iniciar"` (si estaba en `atraer`), `toques` + 1, `ultimoContacto` (fecha) y `proximoToque` (consumidores: +2 días tras el primer toque, +5 tras el segundo; empresas: +3 y +7). Al registrar una respuesta: `etapa: "calificar"`, `respondio: true`, `ultimaRespuesta`.

## Venta u oportunidad

```json
{
  "id": "v_chat_20261008_perez",
  "contactoId": "c_chat_20261008_perez",
  "cuentaId": "",
  "fecha": "2026-10-08",
  "items": [
    { "productoId": "gold700", "nombre": "Gold 700 ml", "cantidad": 2, "precio": 89.9, "linea": "botellas", "botellas": 1 },
    { "productoId": "arte_pisco", "nombre": "El Arte del Pisco", "cantidad": 4, "precio": 290, "linea": "experiencia", "porPersona": true }
  ],
  "estado": "pagado",
  "codigoOrigen": "",
  "gancho": "",
  "segmento": "corporativo",
  "notas": "Entrega en oficina el viernes",
  "createdAt": "2026-10-08T10:30",
  "updatedAt": "2026-10-08T10:30"
}
```

- La página calcula `total`, `linea`, `botellas`, `personas` y `derivarB2B` al recibir la venta; no hace falta escribirlos. Si se escriben, deben ser coherentes (`total` = suma de cantidad × precio).
- `estado`: `cotizado`, `link_enviado`, `pagado`, `entregado`, `perdido`. Solo `pagado` y `entregado` suman a la cuota. Fechas opcionales: `fechaCierre` (cuando se pagó), `fechaEntrega`.
- `codigoOrigen`: código del embajador (`CIX-ANA`) o de campaña (`CRIOLLA31`) que originó la venta; así se calcula la comisión.
- Más de 12 botellas o más de S/ 1,500 en botellas se marca "derivar a B2B" y no suma a la cuota B2C.
- Al registrar una venta pagada, actualizar el contacto: `etapa: "cerrar"`, `yaCompro: true`, `totalInvertido` acumulado.

### Catálogo (precios B2C de octubre 2026)

| productoId | Producto | Precio | linea |
|---|---|---|---|
| `silver700` | Silver 700 ml | 74.90 (Breca 67.40) | botellas |
| `gold700` | Gold 700 ml | 89.90 (Breca 80.90) | botellas |
| `tasting` | Tasting Box 3 × 150 ml | 69.90 (Breca 62.90) | botellas |
| `minigold` | Mini Gold 50 ml | 19.90 | botellas |
| `ede500` | Edición Especial 500 ml | 99.90 | botellas |
| `blue710` | Blue 710 ml | 399.90 (Breca 379.90) | botellas |
| `catador` | Experto Catador (por persona) | 150 | experiencia |
| `coctelero` | Experto Coctelero (por persona) | 200 | experiencia |
| `arte_pisco` | El Arte del Pisco (por persona) | 290 | experiencia |
| `arte_cocteleria` | El Arte de la Coctelería (por persona) | 330 | experiencia |
| `master` | Master of Pisco (por persona) | 420 | experiencia |

Experiencias con 25 % de descuento Breca: precio × 0.75. Packs (`tripack`, `sixpack`, `fivepack`) y paquetes de grupo (`esencial`, `coctelero`, `signature` para 30 personas) están "por confirmar": usar solo si Joaquín da el precio.

## Cuenta (empresa, evento o alianza)

```json
{
  "id": "cu_chat_20261008_empresa-sac",
  "empresa": "Empresa SAC",
  "segmento": "corporativo",
  "contactos": ["c_chat_20261008_perez"],
  "paquete": "",
  "personas": 0,
  "fechaEvento": "",
  "monto": 1798,
  "estado": "cotizacion",
  "notas": "",
  "proximoPaso": "Confirmar cantidad de regalos",
  "fechaProximoPaso": "2026-10-10",
  "createdAt": "2026-10-08T10:30",
  "updatedAt": "2026-10-08T10:30"
}
```

`estado`: `contactado`, `respondio`, `reunion`, `cotizacion`, `cerrado`, `perdido`.

## Embajador

```json
{ "id": "e_chat_20261008_torres", "nombre": "Ana Lucía Torres", "ciudad": "Chiclayo", "codigo": "CIX-ANA", "telefono": "+51977777777", "contactoId": "", "estado": "activo", "desde": "2026-10-08", "pagos": [], "createdAt": "2026-10-08T10:30", "updatedAt": "2026-10-08T10:30" }
```

Código sugerido: tres letras de la ciudad, guion, primer nombre en mayúsculas. Comisión 10 % de lo vendido con su código en el mes; 15 % si el mes supera S/ 1,500.

## Calendario y plantillas

- `calendario/2026-10-19`: campos editables `foco`, `hito`, `notas`, `estado` (`pendiente`, `en_curso`, `cumplido`, `no_cumplido`), `metaDia`, `cuotaDia`, `cuotas` (contactos por segmento). Usar `update` con `if_version`; no crear días nuevos.
- `plantillas/<id>`: `nombre`, `segmento` (código o `*`), `toque`, `ola` (0 = cualquiera), `canal`, `asunto`, `texto` con variables `{nombre}` `{empresa}` `{ocasion}` `{codigo}` `{gancho}` `{precio_silver}` `{precio_gold}` `{precio_blue}`, `masivo` (agrega leyendas legales), `activa`.

## Tareas típicas

**"Registra que le escribí a Juan Pérez por WhatsApp y me respondió que sí le interesa".**
1. `query contactos where telefono == …` o por nombre (leer la colección y filtrar) → obtener `id` y `version`.
2. `batch`: crear la interacción con `resultado: "respondio"`, `respuesta: "sí le interesa"`, y `update` del contacto con `etapa: "calificar"`, `respondio: true`, `ultimaRespuesta`, `ultimoContacto`, `proximoToque` (hoy), `updatedAt`, pinado con `if_version`.

**"Anota la venta de 2 Gold a María Rojas, pagada, código CIX-ANA".**
1. Buscar a María; si no existe, crearla (segmento según contexto, `consentimiento: true` si ella escribió).
2. `batch`: crear la venta (`items` con `gold700` × 2 a 89.90, `estado: "pagado"`, `fechaCierre` hoy, `codigoOrigen: "CIX-ANA"`) y `update` del contacto (`etapa: "cerrar"`, `yaCompro: true`).

**"Agrega estos 8 contactos del evento de ayer" (lista en el chat).**
1. Normalizar teléfonos, buscar duplicados por teléfono y correo.
2. Un `batch` con los nuevos (`origen: "Evento …"`, `segmento`, `consentimiento` según corresponda) y `update` de los que ya existían (solo campos vacíos).

**"¿Cómo vamos?"** Leer `ventas` con `estado` in `pagado`, `entregado` y `fecha` ≥ `2026-10-01`, sumar `total` donde `derivarB2B` no sea `true`; comparar con la cuota oficial (octubre 35,000; noviembre 38,000; diciembre 55,000) y la proyección (50,000; 65,000; 85,000) de `config/principal` → `metas`.

## Qué hace la página al recibir cambios

Si está abierta, aplica los cambios en segundos y muestra "Datos actualizados desde la nube". Completa lo que falte (teléfono normalizado, `etapa`, `estado`, totales de la venta) y vuelve a escribir el documento corregido. Si Joaquín está escribiendo en un formulario, espera a que lo cierre para redibujar.
