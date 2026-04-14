"""
preview_tiles.py — Crops specific candidate tiles at 4× scale for detailed inspection.
Also saves the final selected tiles to public/sprites/tiles/.
"""
from PIL import Image
import os, json, math

SRC = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
img = Image.open(SRC).convert("RGBA")

def crop_tile(x, y, w, h, scale=4):
    c = img.crop((x, y, x + w, y + h))
    return c.resize((c.width * scale, c.height * scale), Image.NEAREST)

# Key candidates identified from classification:
# Grass tiles: s66c1-c7  at y=222-256, x=129-352 (32×34 each)
# Path/stone tiles: s57c0-c4 at y=160-192, x=0-160 (32×32 each)
# Also: s60c1 (single grass tile) at x=193, y=192 (32×32)
# Dirt tiles: s57c0 might actually be a sandy tile → check
# Clay/red tiles: s67c0 at x=1, y=232 (clay/red rooftop)

candidates = [
    # (label, x, y, w, h)
    ("grass_s66c1",  129, 222, 32, 34),
    ("grass_s66c2",  161, 222, 32, 34),
    ("grass_s66c3",  193, 222, 32, 34),
    ("grass_s66c4",  225, 222, 32, 34),
    ("grass_s66c5",  257, 222, 32, 34),
    ("grass_s66c6",  289, 222, 32, 34),
    ("grass_s60c1",  193, 192, 32, 32),
    ("path_s57c0",     0, 160, 32, 32),
    ("path_s57c1",    32, 160, 32, 32),
    ("path_s57c2",    64, 160, 32, 32),
    ("path_s57c3",    96, 160, 32, 32),
    ("path_s57c4",   128, 160, 32, 32),
    ("stone_s60c5",  321, 192, 31, 32),
    ("teal_s60c4",   289, 192, 32, 32),
    ("teal_s60c3",   257, 192, 32, 32),
    ("sandy_s60c2",  225, 192, 32, 32),
    ("sandy_s60c3b", 257, 192, 32, 32),
    ("dirt_s67c0",     1, 232, 32, 24),
    ("clay_s61",       1, 207, 31, 17),
    ("clay_s63",      65, 200, 31, 24),
]

# Create preview sheet (4× scale, 5 columns)
SCALE   = 4
COLS    = 5
CELL_W  = 140
CELL_H  = 160
ROWS    = math.ceil(len(candidates) / COLS)
sheet   = Image.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (20, 20, 20, 255))

from PIL import ImageDraw
draw = ImageDraw.Draw(sheet)

for i, (label, x, y, w, h) in enumerate(candidates):
    col = i % COLS
    row = i // COLS
    tile = crop_tile(x, y, w, h, SCALE)
    ox = col * CELL_W + (CELL_W - tile.width) // 2
    oy = row * CELL_H + (CELL_H - tile.height) // 2
    sheet.paste(tile, (ox, oy), tile)
    draw.text((col * CELL_W + 2, row * CELL_H + 2), f"{i}: {label}", fill=(255, 220, 50, 255))

sheet.save("_tools/tile_candidates_preview.png")
print("Saved _tools/tile_candidates_preview.png")
