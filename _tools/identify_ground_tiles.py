"""
identify_ground_tiles.py — classifies each ground-sized sprite by dominant color
on its isometric top face, then copies the best candidates to public/sprites/tiles/.

Top-face sampling: the diamond is at the very top of the sprite.
For a 32×22 tile, the top-face diamond occupies the top ~16px.
We sample a small horizontal band in the center of the top face.
"""
from PIL import Image, ImageDraw
import json, os, math, shutil, colorsys

SRC    = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
DST    = "public/sprites/tiles"
REPORT = "_tools/tile_classification.png"
TILE_W = 32

img = Image.open(SRC).convert("RGBA")

with open("_tools/sprite_rects.json") as f:
    rects = json.load(f)

# ----------------------------------------------------------------------
# Collect candidate tiles (same filter as before)
# ----------------------------------------------------------------------
candidates = []
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
        candidates.append({"sprite_id": sid, "col_idx": 0,
                            "x": l, "y": t, "w": w, "h": h, "img": crop})
    else:
        n_cols = math.ceil(w / TILE_W)
        for col in range(n_cols):
            cx = col * TILE_W
            sc = crop.crop((cx, 0, min(cx + TILE_W, w), h))
            alpha_data = list(sc.split()[3].getdata())
            if sum(alpha_data) < 10 * 128:
                continue
            candidates.append({"sprite_id": sid, "col_idx": col,
                                "x": l + cx, "y": t, "w": sc.width, "h": h, "img": sc})

# ----------------------------------------------------------------------
# Classify each tile by top-face hue
# Sample a 16×4 band centered at (tile_width/2, top face midpoint ~y=5)
# ----------------------------------------------------------------------
def classify(tile_img, label):
    w, h = tile_img.size
    # Sample region: horizontal center band in upper portion (top face)
    sx1, sx2 = w // 4, (3 * w) // 4   # horizontal: middle 50%
    sy1, sy2 = 2, min(h // 2, 10)      # vertical: top 2-10px

    pixels = []
    for py in range(sy1, sy2):
        for px in range(sx1, sx2):
            r2, g, b, a = tile_img.getpixel((px, py))
            if a > 50:
                pixels.append((r2, g, b))

    if not pixels:
        return "unknown", (128, 128, 128)

    # Average color
    avg_r = sum(p[0] for p in pixels) // len(pixels)
    avg_g = sum(p[1] for p in pixels) // len(pixels)
    avg_b = sum(p[2] for p in pixels) // len(pixels)

    h_val, s, v = colorsys.rgb_to_hsv(avg_r/255, avg_g/255, avg_b/255)
    hue_deg = h_val * 360

    # Classification rules
    if v < 0.25:
        return "dark", (avg_r, avg_g, avg_b)
    if s < 0.12:
        return "stone", (avg_r, avg_g, avg_b)
    if 60 <= hue_deg <= 170 and s > 0.15:
        return "grass", (avg_r, avg_g, avg_b)
    if 170 <= hue_deg <= 260 and s > 0.15:
        return "water", (avg_r, avg_g, avg_b)
    if 20 <= hue_deg < 60 and s > 0.12:
        return "dirt", (avg_r, avg_g, avg_b)
    if 0 <= hue_deg < 20 or hue_deg > 330:
        return "clay", (avg_r, avg_g, avg_b)
    return "other", (avg_r, avg_g, avg_b)

for i, c in enumerate(candidates):
    label = f"s{c['sprite_id']}c{c['col_idx']}"
    kind, avg_color = classify(c["img"], label)
    c["idx"]   = i
    c["kind"]  = kind
    c["color"] = avg_color

# ----------------------------------------------------------------------
# Print classification results
# ----------------------------------------------------------------------
print("Index | sprite_id | col | x    | y   | w  | h  | type  | avg_color")
print("-" * 72)
for c in candidates:
    print(f"  {c['idx']:2d}  | s{c['sprite_id']:<7} | {c['col_idx']:<3} | "
          f"{c['x']:<4} | {c['y']:<3} | {c['w']:<2} | {c['h']:<2} | "
          f"{c['kind']:<6} | {c['color']}")

# ----------------------------------------------------------------------
# Summary: best candidates per type
# Skip "dark", "other", "unknown"; prefer "grass", "stone", "dirt", "water"
# ----------------------------------------------------------------------
from collections import defaultdict
by_type = defaultdict(list)
for c in candidates:
    by_type[c["kind"]].append(c)

print("\n=== Best candidates per tile type ===")
for kind in ["grass", "stone", "dirt", "water", "clay"]:
    items = by_type[kind]
    print(f"\n  {kind.upper()} ({len(items)} tiles):")
    for c in items[:8]:
        print(f"    idx={c['idx']} s{c['sprite_id']}c{c['col_idx']} @ ({c['x']},{c['y']}) {c['w']}x{c['h']} color={c['color']}")

# ----------------------------------------------------------------------
# Save labelled report image with color tags
# ----------------------------------------------------------------------
CELL_W = 55
CELL_H = 60
COLS   = 14
ROWS   = math.ceil(len(candidates) / COLS)
sheet  = Image.new("RGBA", (COLS * CELL_W, ROWS * CELL_H), (20, 20, 20, 255))
draw   = ImageDraw.Draw(sheet)

TYPE_COLORS = {
    "grass": (50, 200, 50),
    "stone": (180, 180, 180),
    "dirt":  (180, 130, 80),
    "water": (80, 130, 255),
    "clay":  (200, 100, 80),
    "dark":  (80,  80, 80),
    "other": (200, 200, 200),
    "unknown": (100, 100, 100),
}

for c in candidates:
    i    = c["idx"]
    col  = i % COLS
    row  = i // COLS
    tile = c["img"]

    ox = col * CELL_W + (CELL_W - tile.width) // 2
    oy = row * CELL_H + CELL_H - tile.height - 4
    sheet.paste(tile, (ox, oy), tile)

    tc = TYPE_COLORS.get(c["kind"], (200, 200, 200))
    draw.text((col * CELL_W + 1, row * CELL_H + 1), str(i), fill=tc)
    draw.text((col * CELL_W + 1, row * CELL_H + 10), c["kind"][:4], fill=tc)

sheet.save(REPORT)
print(f"\nReport image → {REPORT}")
