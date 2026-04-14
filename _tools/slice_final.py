"""
slice_final.py — Final tile extraction. Saves real ground tiles to public/sprites/tiles/.

Confirmed tile sources from visual inspection + color analysis:
  grass         x=193, y=222, w=32, h=34   — lush dense green cube (s66c3)
  grass_light   x=129, y=222, w=32, h=34   — lighter grass variant (s66c1)
  grass_dark    x=225, y=222, w=32, h=34   — darker grass variant (s66c4)
  stone         x=0,   y=130, w=32, h=28   — gray cobblestone path (ID49 bottom-row[0])
  stone_light   x=32,  y=130, w=32, h=28   — stone variant (tile 2)
  stone_dark    x=64,  y=130, w=32, h=28   — stone variant (tile 3)
  path          x=0,   y=160, w=32, h=32   — sandy path tile (s57c0)
  farm_plot     x=0,   y=261, w=32, h=28   — dark farm soil (ID69 top-row[0])
  dirt          x=32,  y=261, w=32, h=28   — dark soil variant
  dirt_light    x=64,  y=261, w=32, h=28   — lighter dirt variant

Water and highlight are kept as procedural (no source sprite available).
"""
from PIL import Image
import os

SRC = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
DST = "public/sprites/tiles"
os.makedirs(DST, exist_ok=True)

img = Image.open(SRC).convert("RGBA")

tiles = [
    ("grass",       193, 222, 32, 34),
    ("grass_light", 129, 222, 32, 34),
    ("grass_dark",  225, 222, 32, 34),
    ("stone",         0, 130, 32, 28),
    ("stone_light",  32, 130, 32, 28),
    ("stone_dark",   64, 130, 32, 28),
    ("path",          0, 160, 32, 32),
    ("farm_plot",     0, 261, 32, 28),
    ("dirt",         32, 261, 32, 28),
    ("dirt_light",   64, 261, 32, 28),
]

for name, x, y, w, h in tiles:
    crop = img.crop((x, y, x + w, y + h))
    out  = os.path.join(DST, f"{name}.png")
    crop.save(out)
    print(f"  Saved {out}  ({w}×{h})")

# --- Preview sheet (4× scale) for final confirmation ---
from PIL import ImageDraw, Image as PILImage
import math

SCALE = 4
CELL_W = 160
CELL_H = 180
COLS = 5
ROWS = math.ceil(len(tiles) / COLS)
sheet = PILImage.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (20, 20, 20, 255))
draw  = ImageDraw.Draw(sheet)

for i, (name, x, y, w, h) in enumerate(tiles):
    col = i % COLS
    row = i // COLS
    t   = img.crop((x, y, x+w, y+h))
    t   = t.resize((t.width * SCALE, t.height * SCALE), PILImage.NEAREST)
    ox  = col * CELL_W + (CELL_W - t.width) // 2
    oy  = row * CELL_H + CELL_H - t.height - 8
    sheet.paste(t, (ox, oy), t)
    draw.text((col * CELL_W + 4, row * CELL_H + 4), name, fill=(255, 220, 50, 255))

sheet.save("_tools/final_tiles_preview.png")
print("\nFinal preview → _tools/final_tiles_preview.png")
print(f"\nDone! Saved {len(tiles)} tile sprites to {DST}/")
