"""
gen_clean_grass.py — Overwrite grass tiles using the clean flat cube (s60c1)
instead of the decorated blades-and-flowers variant (s66).

s60c1 @ (193,192) is a clean, flat-topped green cube — no stems, no berries.
We generate three variants from it using brightness adjustment.
"""
from PIL import Image, ImageEnhance, ImageFilter
import os

SRC = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
DST = "public/sprites/tiles"

src = Image.open(SRC).convert("RGBA")

# Base clean grass tile — shift 1px left to avoid right-edge bleed from adjacent sandy tile
base = src.crop((192, 192, 224, 224))

# grass       — base
# grass_light — 20% brighter
# grass_dark  — 18% darker
variants = [
    ("grass",       1.0),
    ("grass_light", 1.20),
    ("grass_dark",  0.78),
]

for name, factor in variants:
    if factor == 1.0:
        tile = base.copy()
    else:
        # Adjust brightness on RGB channels only, keep alpha intact
        r, g, b, a = base.split()
        rgb = Image.merge("RGB", (r, g, b))
        rgb = ImageEnhance.Brightness(rgb).enhance(factor)
        r2, g2, b2 = rgb.split()
        tile = Image.merge("RGBA", (r2, g2, b2, a))

    path = os.path.join(DST, f"{name}.png")
    tile.save(path)
    print(f"  Saved {path}  ({tile.width}x{tile.height})")

print("Done.")
