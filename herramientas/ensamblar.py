#!/usr/bin/env python3
"""Ensambla src/ en un solo archivo crm-vdo.html (sin dependencias).

Uso:  python3 herramientas/ensamblar.py [--salida RUTA] [--solo-modulo NOMBRE ...] [--sin-dev]
Salida: crm-vdo.html en la raíz del repositorio y src/dev.html (versión que
enlaza los archivos sueltos, útil para desarrollar).

Orden de ensamblado: crm-estilos.css + src/modulos/*.css → <style>;
crm-markup.html → <body>; crm-datos.js, crm-logica.js, src/modulos/*.js (en
orden alfabético) → <script>. Cada módulo registra su pantalla con
VDO.registrarPantalla(nombre, render) (ver docs/MODULOS.md).

--salida RUTA        escribe el archivo único en otra ruta (no toca crm-vdo.html ni dev.html)
--solo-modulo NOMBRE incluye solo ese módulo (repetible); útil para probar un módulo aislado
"""
import pathlib, datetime, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
MOD = SRC / "modulos"

args = sys.argv[1:]
salida = None; solo = []; sin_dev = False
i = 0
while i < len(args):
    if args[i] == "--salida": salida = pathlib.Path(args[i + 1]); i += 2
    elif args[i] == "--solo-modulo": solo.append(args[i + 1]); i += 2
    elif args[i] == "--sin-dev": sin_dev = True; i += 1
    else: print(__doc__); sys.exit(1)

def leer(p):
    return pathlib.Path(p).read_text(encoding="utf-8")

css = leer(SRC / "crm-estilos.css")
markup = leer(SRC / "crm-markup.html")
datos = leer(SRC / "crm-datos.js")
logica = leer(SRC / "crm-logica.js")
mod_css = sorted(MOD.glob("*.css")) if MOD.is_dir() else []
mod_js = sorted(MOD.glob("*.js")) if MOD.is_dir() else []
if solo:
    mod_css = [p for p in mod_css if p.stem in solo]
    mod_js = [p for p in mod_js if p.stem in solo]
version = datetime.date.today().strftime("%Y-%m-%d")

cabecera = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#080808">
<title>CRM B2C · The Pisco Room · Viñas de Oro</title>
<meta name="description" content="CRM operativo del canal B2C de Bodegas Viñas de Oro. Local, sin servidor: los datos viven en este navegador (localStorage).">
<meta name="generador" content="herramientas/ensamblar.py · {version}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23080808' stroke='%23d4af37' stroke-width='3'/%3E%3Ctext x='32' y='40' font-family='Futura,Arial' font-size='22' text-anchor='middle' fill='%23d4af37'%3EVdO%3C/text%3E%3C/svg%3E">
"""

estilos = css + "".join("\n/* ---- módulo: %s ---- */\n%s" % (p.name, leer(p)) for p in mod_css)
scripts = "<script>\n" + datos + "\n</script>\n<script>\n" + logica + "\n</script>\n" + "".join("<script>\n/* ---- módulo: %s ---- */\n%s\n</script>\n" % (p.name, leer(p)) for p in mod_js)
single = cabecera + "<style>\n" + estilos + "\n</style>\n</head>\n<body>\n" + markup + "\n" + scripts + "</body>\n</html>\n"

destino = salida or (RAIZ / "crm-vdo.html")
destino.parent.mkdir(parents=True, exist_ok=True)
destino.write_text(single, encoding="utf-8")

if salida is None and not sin_dev:
    enlaces_css = '<link rel="stylesheet" href="crm-estilos.css">\n' + "".join('<link rel="stylesheet" href="modulos/%s">\n' % p.name for p in mod_css)
    enlaces_js = '<script src="crm-datos.js"></script>\n<script src="crm-logica.js"></script>\n' + "".join('<script src="modulos/%s"></script>\n' % p.name for p in mod_js)
    dev = cabecera + enlaces_css + '</head>\n<body>\n' + markup + '\n' + enlaces_js + '</body>\n</html>\n'
    (SRC / "dev.html").write_text(dev, encoding="utf-8")

print(f"{destino.name}: {destino.stat().st_size // 1024} KB · {version} · módulos: " + (", ".join(p.stem for p in mod_js) or "ninguno"))
