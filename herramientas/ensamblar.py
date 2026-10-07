#!/usr/bin/env python3
"""Ensambla src/ en un solo archivo crm-vdo.html (sin dependencias).

Uso:  python3 herramientas/ensamblar.py
Salida: crm-vdo.html en la raíz del repositorio y src/dev.html (versión que
enlaza los archivos sueltos, útil para desarrollar).
"""
import pathlib, datetime

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"

def leer(nombre):
    return (SRC / nombre).read_text(encoding="utf-8")

css = leer("crm-estilos.css")
markup = leer("crm-markup.html")
datos = leer("crm-datos.js")
logica = leer("crm-logica.js")
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

single = cabecera + "<style>\n" + css + "\n</style>\n</head>\n<body>\n" + markup + "\n<script>\n" + datos + "\n</script>\n<script>\n" + logica + "\n</script>\n</body>\n</html>\n"
(RAIZ / "crm-vdo.html").write_text(single, encoding="utf-8")

dev = cabecera + '<link rel="stylesheet" href="crm-estilos.css">\n</head>\n<body>\n' + markup + '\n<script src="crm-datos.js"></script>\n<script src="crm-logica.js"></script>\n</body>\n</html>\n'
(SRC / "dev.html").write_text(dev, encoding="utf-8")

print("crm-vdo.html:", (RAIZ / "crm-vdo.html").stat().st_size // 1024, "KB ·", version)
