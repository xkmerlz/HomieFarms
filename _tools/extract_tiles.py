"""
extract_tiles.py — extracts individual ground tile sprites from the tileset.

Strategy:
  1. For "individual" sprites (w between 28-36, h between 15-32): save directly.
  2. For "merged row" sprites (w is roughly a multiple of 32, h between 15-32):
     split them at 32px intervals on a fixed grid x = 0, 32, 64, ...
     but only where the slice contains non-transparent pixels.
  3. Output: each slice → _tools/tile_slices/<n>_WxH_x_y.png
  4. Contact sheet: _tools/tile_contact.png for visual inspection.
"""

from PIL import Image
import json, os, math

SRC      = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
RECTS_F  = "_tools/sprite_rects.json"
OUT_DIR  = "_tools/tile_slices"
CONTACT  = "_tools/tile_contact.png"
TILE_W   = 32   # expected tile width for splitting merged rows
MIN_OPAQUE = 10  # min non-transparent pixels for a valid slice

os.makedirs(OUT_DIR, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
px  = img.load()

with open(RECTS_F) as f:
    rects = json.load(f)

def has_content(region, x, y, w, h):
    """Count opaque pixels in a bounding sub-region of the image."""
    count = 0
    for iy in range(y, min(y + h, region.height)):
        for ix in range(x, min(x + w, region.width)):
            if region.getpixel((ix, iy))[3] > 8:
                count += 1
    return count >= MIN_OPAQUE

slices = []  # list of (PIL.Image, label)

for r in rects:
    l, t, rb, b = r["box"]
    w, h = r["w"], r["h"]
    sid  = r["id"]

    # Only interested in sprites that look like ground-level isometric cubes:
    # height roughly 15–35px, width roughly 28–200px, NOT very tall (no trees etc.)
    if h < 14 or h > 36:
        continue
    if w < 26:
        continue

    crop = img.crop((l, t, rb, b))

    if w <= 40:
        # Individual sprite — save as-is
        label = f"{sid:03d}_w{w}h{h}_x{l}y{t}"
        path  = os.path.join(OUT_DIR, label + ".png")
        crop.save(path)
        slices.append((crop, label))
    else:
        # Merged row — split at TILE_W intervals
        n_cols = math.ceil(w / TILE_W)
        for col in range(n_cols):
            cx = col * TILE_W
            slice_crop = crop.crop((cx, 0, min(cx + TILE_W, w), h))
            # Only save if slice has content
            alpha = slice_crop.split()[3]
            if sum(alpha.getdata()) < MIN_OPAQUE * 128:
                continue
            gx = l + cx
            label = f"{sid:03d}_{col:02d}_w{slice_crop.width}h{h}_x{gx}y{t}"
            path  = os.path.join(OUT_DIR, label + ".png")
            slice_crop.save(path)
            slices.append((slice_crop, label))

print(f"Saved {len(slices)} tile slices to {OUT_DIR}/")

# ---- Contact sheet ----
if not slices:
    print("No slices found!")
    exit(0)

CELL_W  = 40
CELL_H  = 48
COLS    = 16
ROWS    = math.ceil(len(slices) / COLS)
FONT_H  = 0  # skip text to keep it simple

sheet_w = COLS * CELL_W
sheet_h = ROWS * CELL_H
sheet   = Image.new("RGBA", (sheet_w, sheet_h), (30, 30, 30, 255))

for i, (tile_img, label) in enumerate(slices):
    col = i % COLS
    row = i // COLS
    # Center tile in cell
    ox = col * CELL_W + (CELL_W - tile_img.width) // 2
    oy = row * CELL_H + (CELL_H - tile_img.height) // 2
    sheet.paste(tile_img, (ox, oy), tile_img)

    # Draw cell index number in top-left of cell (using basic pixel marker)
    # Just draw a tiny 1px dot with different color per row for orientation
    for dy in range(3):
        for dx in range(3):
            px_x = col * CELL_W + dx
            px_y = row * CELL_H + dy
            sheet.putpixel((px_x, px_y), (255, 100, 0, 255))

sheet.save(CONTACT)
print(f"Contact sheet ({COLS}x{ROWS}) → {CONTACT}")
print()
print("Index → label mapping:")
for i, (_, label) in enumerate(slices):
    print(f"  [{i:3d}] {label}")
