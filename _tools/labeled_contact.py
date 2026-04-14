"""
labeled_contact.py — creates a contact sheet with clear index numbers.
Also prints average top-face color for each tile for type identification.
"""
from PIL import Image, ImageDraw
import json, os, math

SRC     = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
OUT     = "_tools/tile_contact_labeled.png"

CELL_W  = 50
CELL_H  = 55
COLS    = 14

img = Image.open(SRC).convert("RGBA")

with open("_tools/sprite_rects.json") as f:
    rects = json.load(f)

# Build up all entries we want to show (same filter as extract_tiles)
entries = []
import math as _math

for r in rects:
    l, t, rb, b = r["box"]
    w, h = r["w"], r["h"]
    sid  = r["id"]
    if h < 14 or h > 36:
        continue
    if w < 26:
        continue

    crop = img.crop((l, t, rb, b))

    if w <= 40:
        entries.append({"idx": len(entries), "sprite_id": sid, "col_idx": 0,
                        "x": l, "y": t, "w": w, "h": h, "img": crop})
    else:
        n_cols = _math.ceil(w / 32)
        for col in range(n_cols):
            cx = col * 32
            sc = crop.crop((cx, 0, min(cx + 32, w), h))
            alpha = sc.split()[3]
            if sum(list(alpha.getdata())) < 10 * 128:
                continue
            entries.append({"idx": len(entries), "sprite_id": sid, "col_idx": col,
                            "x": l + cx, "y": t, "w": sc.width, "h": h, "img": sc})

print(f"Total entries: {len(entries)}")

ROWS = _math.ceil(len(entries) / COLS)
sheet = Image.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (20, 20, 20, 255))
draw  = ImageDraw.Draw(sheet)

for e in entries:
    i    = e["idx"]
    col  = i % COLS
    row  = i // COLS
    tile = e["img"]

    ox = col * CELL_W + (CELL_W - tile.width) // 2
    oy = row * CELL_H + CELL_H - tile.height - 2
    sheet.paste(tile, (ox, oy), tile)

    # Draw index number (simple pixel font - draw small digits manually)
    # Use ImageDraw text with default font
    draw.text((col * CELL_W + 1, row * CELL_H + 1), str(i), fill=(255, 200, 0, 255))
    # Also draw small sprite_id/col_idx hint
    sub = f"s{e['sprite_id']}"
    if e['col_idx'] > 0:
        sub += f"c{e['col_idx']}"
    draw.text((col * CELL_W + 1, row * CELL_H + 10), sub, fill=(150, 150, 150, 255))

sheet.save(OUT)
print(f"Saved labeled contact sheet → {OUT}")
