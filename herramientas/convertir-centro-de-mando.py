#!/usr/bin/env python3
"""Convierte la base del Centro de Mando B2C (artefacto claude.ai) al formato de
respaldo del CRM (datos/centro-de-mando.json).

Uso:
  python3 herramientas/convertir-centro-de-mando.py <carpeta_con_colecciones> [salida.json]

La carpeta debe tener subcarpetas con un JSON por documento, tal como las
descarga la herramienta ArtifactData: crm/, crm-cambios/, crm-tmo/, pedidos/,
alianzas/ y maestro/ (skus.json). El resultado se carga en el CRM desde
Ajustes → Datos y respaldo → "Restaurar o fusionar un respaldo" (modo fusionar).
"""
import sys, json, pathlib, re, datetime, unicodedata

if len(sys.argv) < 2:
    print(__doc__); sys.exit(1)
ORIGEN = pathlib.Path(sys.argv[1])
SALIDA = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent.parent / "datos" / "centro-de-mando.json"

def docs(sub):
    carpeta = ORIGEN / sub
    out = []
    if not carpeta.is_dir():
        return out
    for f in sorted(carpeta.glob("*.json")):
        d = json.load(open(f, encoding="utf-8"))
        if isinstance(d, dict) and "data" in d and "id" in d:
            d = dict(d["data"], __id=d["id"])
        else:
            d = dict(d, __id=f.stem)
        out.append(d)
    return out

def norm_tel(t):
    s = str(t or "").strip()
    if not s: return ""
    d = re.sub(r"\D", "", s)
    if not d: return ""
    if d.startswith("00"): d = d[2:]
    if d.startswith("0") and len(d) in (9, 10) and not d.startswith("05"): d = d[1:]
    if len(d) == 9 and d[0] == "9": return "+51" + d
    if len(d) == 11 and d.startswith("51"): return "+" + d
    if len(d) == 12 and d.startswith("051"): return "+" + d[1:]
    if len(d) == 7: return "+511" + d
    if len(d) == 8 and d[0] == "1": return "+51" + d
    if len(d) >= 10: return "+" + d
    return "+51" + d

def digitos(t): return re.sub(r"\D", "", norm_tel(t))
def norm_txt(s): return unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower().strip()
def iso(txt):
    s = str(txt or "").strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", s): return s[:10]
    m = re.match(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})", s)
    if m:
        a = m.group(3); a = "20" + a if len(a) == 2 else a
        return f"{a}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return ""
def numero(s):
    t = re.sub(r"S/\.?", "", str(s or "")).replace(",", "").strip()
    try: return float(t)
    except ValueError: return 0.0
def limpio(s): return re.sub(r"\s+", " ", str(s or "")).strip()

ahora = datetime.datetime.now().strftime("%Y-%m-%dT%H:%M")

# ---------------- contactos ----------------
cambios = {d["__id"]: d for d in docs("crm-cambios")}
tmo = {}
for lote in docs("crm-tmo"):
    for k, v in (lote.get("items") or {}).items(): tmo[k] = v

SEG = {
    "B2C NO BRECA": ("recontacto", "", "activo"),
    "B2C TURISTA": ("recontacto", "Turista", "activo"),
    "B2C BRECA": ("breca", "", "activo"),
    "B2B BRECA": ("corporativo", "Empresa Breca", "activo"),
    "B2B NO BRECA": ("pyme", "B2B", "b2b"),
    "B2V": ("boca", "Colaborador BVO", "activo"),
}
contactos, por_tel, por_nombre = [], {}, {}
for lote in docs("crm"):
    for it in lote.get("items") or []:
        c = dict(it); c.update(cambios.get(c.get("id"), {}))
        seg, sub, estado = SEG.get(c.get("tipo", ""), ("recontacto", "", "activo"))
        clas, prio = c.get("clasificacion", ""), c.get("prioridad", "")
        compro = c.get("yaCompro") == "Sí" or clas == "Fidelizado"
        if compro: etapa = "fidelizar"
        elif c.get("estadoVisita") == "Reserva pendiente": etapa = "cerrar"
        elif clas == "Potencial": etapa = "calificar" if prio in ("Crítica", "Alta") else "iniciar"
        else: etapa = "atraer"
        if clas == "Inactivo" and estado == "activo": estado = "dormido"
        conv = tmo.get(c.get("id"), {}) or {}
        notas = []
        if c.get("ultimaAccion"): notas.append(limpio(c["ultimaAccion"]))
        if c.get("proximaAccion"): notas.append("Próxima acción: " + limpio(c["proximaAccion"]))
        if c.get("historial"): notas.append(limpio(c["historial"]))
        if c.get("nota"): notas.append(limpio(c["nota"]))
        if conv.get("estado"): notas.append(f"Última conversación: {conv.get('estado')} ({conv.get('fecha', '')})")
        meta = f"Centro de Mando: {c.get('tipo', '')} · {clas} · prioridad {prio} · interés {c.get('linea', '')}"
        notas.append(meta)
        tel = norm_tel(c.get("celular"))
        contacto = {
            "id": "cm_" + str(c.get("id")), "cmId": c.get("id"), "prueba": False,
            "nombre": limpio(c.get("nombre")) or tel or str(c.get("id")), "telefono": tel, "correo": "",
            "empresa": "", "cargo": "", "ciudad": "Lima" if c.get("tipo") != "B2C TURISTA" else "",
            "segmento": seg, "subsegmento": sub, "origen": "Centro de Mando · " + (c.get("fuente") or c.get("canal") or ""),
            "canalPreferido": c.get("canal", ""), "perfil": "",
            "consentimiento": c.get("canal") in ("WhatsApp", "Instagram"),
            "ultimoContacto": iso(c.get("ultimoContacto")), "proximoToque": iso(c.get("fechaProximaAccion")),
            "etapa": etapa, "estado": estado, "toques": 0, "notas": "\n".join(notas),
            "referidoPor": limpio(c.get("invitadoPor")) if c.get("invitado") == "Sí" else "", "codigoReferido": "",
            "ocasion": "", "personas": c.get("nPersonas") or "", "interes": c.get("linea", ""),
            "totalInvertido": numero(c.get("totalInvertido")), "cmTipo": c.get("tipo", ""), "cmClasificacion": clas, "cmPrioridad": prio,
            "createdAt": (c.get("actualizadoEn") or ahora)[:16], "updatedAt": ahora
        }
        contactos.append(contacto)
        if tel: por_tel[digitos(tel)] = contacto["id"]
        n = norm_txt(contacto["nombre"])
        if len(n) >= 5 and not n.startswith("+"): por_nombre[n] = contacto["id"]

# ---------------- ventas (pedidos) ----------------
ESTADO_V = {"Despachado": "entregado", "Enviado": "pagado", "Borrador": "cotizado", "Anulado": "perdido"}
SEG_V = {"breca": "breca", "ff": "boca", "b2v": "boca", "nobreca": "recontacto"}
ventas = []
for p in docs("pedidos"):
    if p.get("estado") == "Anulado": continue
    tel = norm_tel(p.get("celular"))
    cid = por_tel.get(digitos(tel)) if tel else None
    if not cid:
        for nom in (p.get("cliente"), p.get("recibe")):
            n = norm_txt(nom)
            if n in por_nombre: cid = por_nombre[n]; break
    items, botellas = [], 0
    for it in p.get("items") or []:
        cant = numero(it.get("cant")); codigo = str(it.get("codigo") or "")
        es_botella = codigo.startswith("5000") and numero(it.get("ml")) > 0
        if es_botella: botellas += cant
        items.append({"productoId": "", "codigo": codigo, "nombre": it.get("sku", ""), "cantidad": cant, "precio": numero(it.get("punit")), "total": numero(it.get("total")), "ml": it.get("ml", "")})
    total = numero(p.get("total"))
    seg = SEG_V.get(p.get("segmento", ""), "recontacto")
    canal = p.get("canalVenta", "")
    if canal == "corporativo": seg = "corporativo"
    elif canal.startswith("alianza:"): seg = "grupos"
    fecha = iso(p.get("fsolicitud")) or (p.get("createdAt") or "")[:10]
    estado = ESTADO_V.get(p.get("estado", ""), "cotizado")
    ventas.append({
        "id": "cm_" + p["__id"], "pedidoId": p["__id"], "prueba": False, "contactoId": cid or "", "clienteNombre": p.get("cliente", ""),
        "fecha": fecha, "linea": "experiencia" if p.get("linea") == "piscoroom" else "botellas", "items": items,
        "botellas": botellas, "personas": numero(p.get("personas")) if p.get("personas") else 0, "total": total,
        "gancho": "", "codigoOrigen": "", "estado": estado, "fechaCierre": fecha if estado in ("pagado", "entregado") else "",
        "motivoPerdida": "", "segmento": seg, "derivarB2B": botellas > 12 or total > 1500, "embajadorId": "",
        "modalidad": p.get("modalidad", ""), "tour": p.get("tour", ""), "fechaEntrega": p.get("fentrega", ""),
        "notas": limpio(" · ".join(x for x in [p.get("notaItems"), p.get("descuento") and "Descuento: " + p["descuento"], p.get("origen")] if x)),
        "createdAt": (p.get("createdAt") or ahora)[:16], "updatedAt": ahora
    })

# ---------------- cuentas (alianzas) ----------------
ESTADO_A = {"Activa": "cerrado", "En curso": "reunion", "Esperando respuesta": "contactado", "Paralizada": "contactado", "Cerrada": "cerrado", "Descartada": "perdido"}
cuentas = []
for a in docs("alianzas"):
    ids = []
    for k in a.get("contactos") or []:
        tel = norm_tel(k.get("celular")); correo = str(k.get("correo") or "").strip().lower()
        cid = "cm_ali_" + a["__id"] + "_" + re.sub(r"[^a-z0-9]+", "-", norm_txt(k.get("nombre")))[:24]
        contactos.append({
            "id": cid, "prueba": False, "nombre": limpio(k.get("nombre")), "telefono": tel, "correo": correo, "empresa": a.get("nombre", ""), "cargo": k.get("cargo", ""),
            "ciudad": "Lima", "segmento": "grupos", "subsegmento": a.get("nombre", ""), "origen": "Centro de Mando · alianzas", "perfil": "", "consentimiento": False,
            "ultimoContacto": iso(a.get("ultimoMovimiento")), "proximoToque": iso((a.get("proximoPaso") or {}).get("fecha")), "etapa": "calificar", "estado": "activo", "toques": 0,
            "notas": limpio(a.get("resumen")), "referidoPor": "", "codigoReferido": "", "ocasion": "", "personas": "", "createdAt": (a.get("createdAt") or ahora)[:16], "updatedAt": ahora
        })
        ids.append(cid)
    pp = a.get("proximoPaso") or {}
    cuentas.append({
        "id": "cm_ali_" + a["__id"], "prueba": False, "empresa": a.get("nombre", ""), "segmento": "grupos", "tipoAlianza": a.get("tipo", ""), "contactos": ids,
        "paquete": "", "personas": "", "fechaEvento": "", "monto": numero(a.get("valorQ4")), "estado": ESTADO_A.get(a.get("estado", ""), "contactado"), "estadoOriginal": a.get("estado", ""),
        "notas": limpio(" · ".join(x for x in [a.get("resumen"), a.get("nota")] if x)), "proximoPaso": limpio(pp.get("texto")), "fechaProximoPaso": iso(pp.get("fecha")),
        "acuerdos": a.get("acuerdos") or [], "log": a.get("log") or [], "createdAt": (a.get("createdAt") or ahora)[:16], "updatedAt": ahora
    })

# ---------------- maestro de SKU ----------------
sku = []
m = ORIGEN / "maestro" / "skus.json"
if m.exists():
    d = json.load(open(m, encoding="utf-8"))
    d = d.get("data", d)
    sku = d.get("items") or []

salida = {
    "formato": "vdo-crm-respaldo", "version": 1, "generado": ahora,
    "fuente": "Centro de Mando B2C (registro web) · corte 07/10/2026",
    "tablas": {"contactos": contactos, "ventas": ventas, "cuentas": cuentas, "interacciones": [], "embajadores": [], "calendario": [], "plantillas": []},
    "config": {"skuMaestro": sku}
}
SALIDA.parent.mkdir(parents=True, exist_ok=True)
SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{SALIDA}: {len(contactos)} contactos, {len(ventas)} ventas, {len(cuentas)} cuentas, {len(sku)} SKU · {SALIDA.stat().st_size // 1024} KB")
