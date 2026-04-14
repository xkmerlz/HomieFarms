"""
Extract every 32×32 tile from the cozy iso tileset and save individually.
Also generates a visual catalogue image with numbered labels.
"""
from PIL import Image, ImageDraw, ImageFont
import os

SRC = os.path.join(os.path.dirname(__file__), "..", "_resources", "isometric_cozy_v230729", "cozy_iso_export.png")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "_resources", "tile_catalogue")
os.makedirs(OUT_DIR, exist_ok=True)

TILE_W, TILE_H = 32, 32

src = Image.open(SRC).convert("RGBA")
sheet_w, sheet_h = src.size

cols = sheet_w // TILE_W  # 16
rows = sheet_h // TILE_H  # 10

print(f"Sheet: {sheet_w}x{sheet_h}, Grid: {cols}x{rows} = {cols*rows} cells")

# Extract each tile and check if it has any non-transparent pixels
tiles = []
for row in range(rows):
    for col in range(cols):
        x0 = col * TILE_W
        y0 = row * TILE_H
        tile = src.crop((x0, y0, x0 + TILE_W, y0 + TILE_H))
        
        # Check if tile has content (any non-fully-transparent pixel)
        bbox = tile.getbbox()
        has_content = bbox is not None
        
        idx = row * cols + col
        tiles.append({
            'idx': idx,
            'row': row,
            'col': col,
            'x': x0,
            'y': y0,
            'has_content': has_content,
            'image': tile,
        })
        
        if has_content:
            name = f"tile_{row:02d}_{col:02d}.png"
            tile.save(os.path.join(OUT_DIR, name))

# Generate catalogue image: each tile with index overlay
SCALE = 2  # 2x zoom for visibility
PADDING = 2
cell_w = TILE_W * SCALE + PADDING
cell_h = TILE_H * SCALE + PADDING + 12  # extra space for label

cat_w = cols * cell_w + PADDING
cat_h = rows * cell_h + PADDING

cat = Image.new("RGBA", (cat_w, cat_h), (40, 40, 40, 255))
draw = ImageDraw.Draw(cat)

content_count = 0
for t in tiles:
    cx = t['col'] * cell_w + PADDING
    cy = t['row'] * cell_h + PADDING
    
    if t['has_content']:
        content_count += 1
        # Draw white background for content tiles
        draw.rectangle([cx, cy, cx + TILE_W * SCALE, cy + TILE_H * SCALE], fill=(60, 60, 60, 255))
        scaled = t['image'].resize((TILE_W * SCALE, TILE_H * SCALE), Image.NEAREST)
        cat.paste(scaled, (cx, cy), scaled)
    
    # Label
    label = f"{t['row']},{t['col']}"
    color = (200, 200, 200) if t['has_content'] else (80, 80, 80)
    draw.text((cx + 2, cy + TILE_H * SCALE + 1), label, fill=color)

cat_path = os.path.join(OUT_DIR, "_catalogue.png")
cat.save(cat_path)
print(f"Saved catalogue: {cat_path}")
print(f"Content tiles: {content_count}/{len(tiles)}")

# Print a text summary
summary_lines = []
for t in tiles:
    if t['has_content']:
        summary_lines.append(f"  [{t['row']:2d},{t['col']:2d}]  tile_{t['row']:02d}_{t['col']:02d}.png  (px {t['x']},{t['y']})")

summary_path = os.path.join(OUT_DIR, "_index.txt")
with open(summary_path, "w") as f:
    f.write(f"Cozy Iso Tileset — {cols}x{rows} grid, {TILE_W}x{TILE_H}px tiles\n")
    f.write(f"Source: cozy_iso_export.png ({sheet_w}x{sheet_h})\n")
    f.write(f"Content tiles: {content_count}\n\n")
    f.write("[row,col]  filename                  (pixel offset)\n")
    f.write("-" * 55 + "\n")
    f.write("\n".join(summary_lines))

print(f"Index: {summary_path}")
