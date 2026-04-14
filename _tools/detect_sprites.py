"""
Detect individual sprite bounding boxes in the cozy_iso_export.png by
scanning for connected non-transparent regions. Prints a table you can use
to name and pick tiles manually, and saves a debug PNG with boxes drawn.

Run from project root:  python _tools/detect_sprites.py
"""
from PIL import Image, ImageDraw
import os, json

SRC = os.path.join(os.path.dirname(__file__), '..', '_resources',
                   'isometric_cozy_v230729', 'cozy_iso_export.png')
DEBUG_OUT = os.path.join(os.path.dirname(__file__), 'sprite_detect_debug.png')
JSON_OUT  = os.path.join(os.path.dirname(__file__), 'sprite_rects.json')

img  = Image.open(SRC).convert('RGBA')
data = img.load()
w, h = img.size

print(f'Image size: {w}x{h}')

# -------------------------------------------------------------------
# 1) Build a binary visited mask
# -------------------------------------------------------------------
visited = [[False]*h for _ in range(w)]
ALPHA_THRESHOLD = 8   # ignore near-transparent pixels

def is_solid(x, y):
    return 0 <= x < w and 0 <= y < h and data[x, y][3] > ALPHA_THRESHOLD

# -------------------------------------------------------------------
# 2) Flood-fill to find connected components (BFS)
# -------------------------------------------------------------------
def bfs(sx, sy):
    """Return bounding box (l,t,r,b) of connected opaque region."""
    stack = [(sx, sy)]
    visited[sx][sy] = True
    minx = maxx = sx
    miny = maxy = sy
    while stack:
        cx, cy = stack.pop()
        if cx < minx: minx = cx
        if cx > maxx: maxx = cx
        if cy < miny: miny = cy
        if cy > maxy: maxy = cy
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = cx+dx, cy+dy
            if not visited[nx][ny] if (0<=nx<w and 0<=ny<h) else False:
                if is_solid(nx, ny):
                    visited[nx][ny] = True
                    stack.append((nx, ny))
    return (minx, miny, maxx+1, maxy+1)

# -------------------------------------------------------------------
# 3) Scan image and collect components
# -------------------------------------------------------------------
components = []
for y in range(h):
    for x in range(w):
        if not visited[x][y] and is_solid(x, y):
            box = bfs(x, y)
            bw = box[2] - box[0]
            bh = box[3] - box[1]
            # Filter out tiny noise (< 8px in either dimension)
            if bw >= 8 and bh >= 8:
                components.append(box)

# Sort top-to-bottom, left-to-right
components.sort(key=lambda b: (b[1]//8, b[0]))

print(f'\nFound {len(components)} sprite regions:\n')
print(f"{'#':>3}  {'left':>5} {'top':>5} {'right':>5} {'bot':>5}  {'w':>4} {'h':>4}")
print('-' * 44)
for i, (l, t, r, b) in enumerate(components):
    print(f"{i:>3}  {l:>5} {t:>5} {r:>5} {b:>5}  {r-l:>4} {b-t:>4}")

# -------------------------------------------------------------------
# 4) Save debug image with numbered boxes
# -------------------------------------------------------------------
debug = img.copy().convert('RGBA')
draw  = ImageDraw.Draw(debug)
colors = ['#FF6B6B','#FFD93D','#6BCB77','#4EAEFF','#FF922B']
for i, (l, t, r, b) in enumerate(components):
    color = colors[i % len(colors)]
    draw.rectangle([l, t, r-1, b-1], outline=color, width=1)
    draw.text((l+2, t+1), str(i), fill=color)
debug.save(DEBUG_OUT)
print(f'\nDebug image saved: {DEBUG_OUT}')

# Save JSON for slice_tiles.py to consume
with open(JSON_OUT, 'w') as f:
    json.dump([{'id': i, 'box': [l,t,r,b], 'w': r-l, 'h': b-t}
               for i, (l,t,r,b) in enumerate(components)], f, indent=2)
print(f'Rects saved: {JSON_OUT}')
