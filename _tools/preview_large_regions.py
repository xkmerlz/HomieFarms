"""
preview_large_regions.py — View large merged regions that were filtered out (h>36)
to find the gray cobblestone and dirt tiles.
"""
from PIL import Image, ImageDraw
import os, math

SRC = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
img = Image.open(SRC).convert("RGBA")
SCALE = 3

regions = [
    ("ID49_top_left",   0, 104, 128, 56),    # 4 tiles wide, 2-3 rows
    ("ID54_middle",   192, 122, 256, 70),    # big middle section (bridge area?)
    ("ID69_bottom",     0, 261, 224, 59),    # bottom section
    # Also crop specific sub-areas
    ("bottom_far_left",   0, 265, 64, 55),  # very bottom left
    ("bottom_mid",       64, 260, 96, 55),  # bottom middle
    ("bottom_right",    160, 258, 96, 62),  # bottom right section
    ("raw_y160_460",    352, 160, 160, 96), # right section at path-tile height
]

COLS = 2
ROWS = math.ceil(len(regions) / COLS)
MAX_W = 0
MAX_H = 0
tiles = []
for label, x, y, w, h in regions:
    c = img.crop((x, y, x+w, y+h))
    c = c.resize((c.width*SCALE, c.height*SCALE), Image.NEAREST)
    tiles.append((label, c))
    MAX_W = max(MAX_W, c.width)
    MAX_H = max(MAX_H, c.height)

CELL_W = MAX_W + 10
CELL_H = MAX_H + 20
sheet  = Image.new("RGBA", (COLS*CELL_W, ROWS*CELL_H), (20,20,20,255))
draw   = ImageDraw.Draw(sheet)

for i, (label, tile) in enumerate(tiles):
    col = i % COLS
    row = i // COLS
    sheet.paste(tile, (col*CELL_W + 5, row*CELL_H + 18), tile)
    draw.text((col*CELL_W + 2, row*CELL_H + 2), label, fill=(255,220,50,255))

sheet.save("_tools/large_regions_preview.png")
print("Saved _tools/large_regions_preview.png")
