"""
Slice tile sprites from the cozy isometric tileset export.
Run from project root: python _tools/slice_tiles.py
"""
from PIL import Image
import os

src = os.path.join(os.path.dirname(__file__), '..', '_resources', 'isometric_cozy_v230729', 'cozy_iso_export.png')
dst_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'tiles')
os.makedirs(dst_dir, exist_ok=True)

img = Image.open(src)

# Tile regions identified by visual inspection of the 512x320 spritesheet.
# Each tile is roughly 32x32 pixels (isometric diamond).
# Format: (name, left, top, right, bottom)
tiles = [
    # Grass tiles (row 3-ish area, green grass on dirt base)
    ('grass_1',     192, 128, 224, 160),   # grass block
    ('grass_2',     224, 128, 256, 160),   # grass variant
    ('grass_3',     256, 128, 288, 160),   # tall grass

    # Dirt/earth tiles
    ('dirt_1',      128, 128, 160, 160),   # plain dirt
    ('dirt_2',      160, 128, 192, 160),   # dirt variant

    # Stone/path tiles (gray blocks, left-center)
    ('stone_1',     0,   128, 32,  160),   # stone block
    ('stone_2',     32,  128, 64,  160),   # stone variant
    ('stone_3',     64,  128, 96,  160),   # stone variant 2

    # Red/brown roof-like tiles (right side)
    ('roof_1',      320, 128, 352, 160),
    ('roof_2',      352, 128, 384, 160),

    # Farm plot tiles (bottom area with crops)
    ('farm_plot_1', 128, 256, 160, 288),
    ('farm_plot_2', 160, 256, 192, 288),

    # Grass with edges (row 4-5 area)
    ('grass_edge_1', 192, 160, 224, 192),
    ('grass_edge_2', 224, 160, 256, 192),
    ('grass_edge_3', 256, 160, 288, 192),
    ('grass_full',   288, 160, 320, 192),
]

for name, l, t, r, b in tiles:
    tile = img.crop((l, t, r, b))
    # Check if tile has any non-transparent pixels
    if tile.getextrema()[3][1] > 0:  # alpha channel max > 0
        tile.save(os.path.join(dst_dir, f'{name}.png'))
        print(f'  Saved: {name}.png ({r-l}x{b-t})')
    else:
        print(f'  SKIP (empty): {name}')

print(f'\nDone! Tiles saved to {dst_dir}')
