"""
Generate procedural isometric placeholder tiles for M1 development.
These will be replaced with properly sliced tileset sprites later.
"""
from PIL import Image, ImageDraw
import os

dst_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'tiles')
os.makedirs(dst_dir, exist_ok=True)

# Tile dimensions: 64x64 canvas with a 64x32 isometric diamond
W, H = 64, 64
HALF_W, HALF_H = 32, 16
DEPTH = 16  # Height of the side faces

# Diamond points (top face of isometric cube)
TOP_Y = 8  # Offset from top of canvas
top_face = [
    (HALF_W, TOP_Y),           # top
    (W - 1, TOP_Y + HALF_H),   # right
    (HALF_W, TOP_Y + HALF_H * 2),  # bottom
    (0, TOP_Y + HALF_H),       # left
]

# Left side face
left_face = [
    (0, TOP_Y + HALF_H),
    (HALF_W, TOP_Y + HALF_H * 2),
    (HALF_W, TOP_Y + HALF_H * 2 + DEPTH),
    (0, TOP_Y + HALF_H + DEPTH),
]

# Right side face
right_face = [
    (HALF_W, TOP_Y + HALF_H * 2),
    (W - 1, TOP_Y + HALF_H),
    (W - 1, TOP_Y + HALF_H + DEPTH),
    (HALF_W, TOP_Y + HALF_H * 2 + DEPTH),
]

def make_tile(name, top_color, left_color, right_color, outline_color='#2a1a0a'):
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw faces (back to front: left, right, top)
    draw.polygon(left_face, fill=left_color, outline=outline_color)
    draw.polygon(right_face, fill=right_color, outline=outline_color)
    draw.polygon(top_face, fill=top_color, outline=outline_color)

    img.save(os.path.join(dst_dir, f'{name}.png'))
    print(f'  Generated: {name}.png')

# --- Tile definitions ---

# Grass (primary ground tile)
make_tile('grass',
    top_color='#4A7A3A',
    left_color='#5C3A1E',
    right_color='#4A2E16')

# Grass variant (lighter)
make_tile('grass_light',
    top_color='#5C8F4A',
    left_color='#5C3A1E',
    right_color='#4A2E16')

# Dirt (tilled soil)
make_tile('dirt',
    top_color='#6B4226',
    left_color='#5C3A1E',
    right_color='#4A2E16')

# Stone path
make_tile('stone',
    top_color='#8B8B7A',
    left_color='#6B6B5C',
    right_color='#5C5C4E')

# Stone path variant
make_tile('stone_light',
    top_color='#9B9B8A',
    left_color='#7B7B6C',
    right_color='#6C6C5E')

# Water (decorative)
make_tile('water',
    top_color='#3A6B8B',
    left_color='#2A5070',
    right_color='#1E4060')

# Farm plot (tilled, ready for planting)
make_tile('farm_plot',
    top_color='#5C3A1E',
    left_color='#4A2E16',
    right_color='#3B2410')

# Highlight tile (for hover/selection)
make_tile('highlight',
    top_color='#FFFFFF40',
    left_color='#FFFFFF20',
    right_color='#FFFFFF20',
    outline_color='#FFD700')

print(f'\nDone! Placeholder tiles in {dst_dir}')
print('These are procedural placeholders — replace with properly sliced tileset sprites later.')
