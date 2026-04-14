"""
tile_precision.py — Targeted 4× crop previews for stone and dirt tiles.
Also previews the final selections for the game.
"""
from PIL import Image, ImageDraw
import os, math

SRC = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
img = Image.open(SRC).convert("RGBA")
SCALE = 4

regions = [
    # Stone tiles — bottom portion of ID49 region
    # (The stone tiles appear in the lower part of the y=104-160 strip)
    ("stone_row_y130",        0, 130, 128, 30),  # bottom part of ID49
    ("stone_row_y136",        0, 136, 128, 24),  # tighter crop
    ("stone_row_y134",        0, 134, 128, 26),  # slightly wider

    # Dirt tiles — top portion of ID69 region (y=261-320)
    ("dirt_row_y261",         0, 261,  96, 28),  # top of ID69
    ("dirt_row_y265",         0, 265,  96, 26),
    ("grass_row_y283",        0, 283,  96, 26),  # green section of ID69

    # Confirming grass tile from s66
    ("grass_confirm",       129, 222,  32, 34),
    ("grass_light_confirm", 161, 222,  32, 34),
    # Confirming sandy stone path
    ("path_confirm",          0, 160,  32, 32),
]

COLS = 3
ROWS = math.ceil(len(regions) / COLS)
MAX_W = max(w for _, _, _, w, _ in regions) * SCALE + 10
MAX_H = max(h for _, _, _, _, h in regions) * SCALE + 25
sheet = Image.new("RGBA", (COLS * MAX_W, ROWS * MAX_H), (20, 20, 20, 255))
draw  = ImageDraw.Draw(sheet)

for i, (label, x, y, w, h) in enumerate(regions):
    col = i % COLS
    row = i // COLS
    tile = img.crop((x, y, x+w, y+h))
    tile = tile.resize((tile.width*SCALE, tile.height*SCALE), Image.NEAREST)
    ox = col * MAX_W + (MAX_W - tile.width) // 2
    oy = row * MAX_H + 20
    sheet.paste(tile, (ox, oy), tile)
    draw.text((col * MAX_W + 2, row * MAX_H + 2), f"{i}: {label}", fill=(255, 220, 50, 255))

sheet.save("_tools/precision_preview.png")
print("Saved _tools/precision_preview.png")
