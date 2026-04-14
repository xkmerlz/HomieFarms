"""
Generate procedural crop sprites for HomieFarms.
5 crops × 4 growth stages + 1 withered = 21 sprites.
Each sprite is 32×32 (same as tile size, isometric diamond base).
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'crops')
os.makedirs(OUT, exist_ok=True)

# Crop color themes (stem, fruit/leaf)
CROPS = {
    'lettuce':  {'stem': (80, 140, 60),  'fruit': (120, 200, 80),  'accent': (90, 180, 70)},
    'carrots':  {'stem': (80, 140, 60),  'fruit': (240, 140, 40),  'accent': (60, 160, 50)},
    'tomatoes': {'stem': (70, 130, 50),  'fruit': (220, 50, 40),   'accent': (90, 170, 60)},
    'pumpkins': {'stem': (70, 120, 50),  'fruit': (230, 150, 30),  'accent': (80, 150, 50)},
    'starfruit':{'stem': (90, 100, 140), 'fruit': (255, 220, 60),  'accent': (180, 160, 220)},
}

WITHERED_COLOR = (120, 100, 80)

def draw_stage_0(draw, colors):
    """Planted — tiny mound with small sprout."""
    # Dirt mound
    draw.ellipse([12, 22, 20, 26], fill=(140, 110, 70))
    # Tiny sprout
    draw.line([16, 22, 16, 19], fill=colors['stem'], width=1)

def draw_stage_1(draw, colors):
    """Sprouting — small stem with two leaves."""
    # Dirt base
    draw.ellipse([11, 22, 21, 26], fill=(140, 110, 70))
    # Stem
    draw.line([16, 23, 16, 16], fill=colors['stem'], width=1)
    # Two small leaves
    draw.line([16, 18, 13, 17], fill=colors['accent'], width=1)
    draw.line([16, 18, 19, 17], fill=colors['accent'], width=1)

def draw_stage_2(draw, colors):
    """Growing — taller stem with leaves spreading."""
    # Dirt base
    draw.ellipse([10, 23, 22, 27], fill=(140, 110, 70))
    # Stem
    draw.line([16, 24, 16, 12], fill=colors['stem'], width=2)
    # Leaves
    draw.line([16, 16, 12, 14], fill=colors['accent'], width=1)
    draw.line([16, 16, 20, 14], fill=colors['accent'], width=1)
    draw.line([16, 19, 11, 17], fill=colors['accent'], width=1)
    draw.line([16, 19, 21, 17], fill=colors['accent'], width=1)
    # Small bud
    draw.rectangle([14, 11, 18, 13], fill=colors['fruit'])

def draw_stage_3(draw, colors):
    """Harvestable — full grown with visible fruit/crop."""
    # Dirt base
    draw.ellipse([10, 24, 22, 28], fill=(140, 110, 70))
    # Stem
    draw.line([16, 25, 16, 10], fill=colors['stem'], width=2)
    # Full leaves
    draw.line([16, 14, 10, 11], fill=colors['accent'], width=2)
    draw.line([16, 14, 22, 11], fill=colors['accent'], width=2)
    draw.line([16, 18, 9, 15], fill=colors['accent'], width=1)
    draw.line([16, 18, 23, 15], fill=colors['accent'], width=1)
    # Prominent fruit
    draw.ellipse([13, 8, 19, 13], fill=colors['fruit'])
    # Highlight
    draw.point((15, 9), fill=(255, 255, 255))

def draw_withered(draw):
    """Withered — droopy brown stems."""
    draw.ellipse([10, 23, 22, 27], fill=(100, 80, 60))
    # Droopy stem
    draw.line([16, 24, 16, 14], fill=WITHERED_COLOR, width=1)
    draw.line([16, 16, 13, 19], fill=WITHERED_COLOR, width=1)
    draw.line([16, 16, 19, 19], fill=WITHERED_COLOR, width=1)
    draw.line([16, 18, 12, 21], fill=WITHERED_COLOR, width=1)
    draw.line([16, 18, 20, 21], fill=WITHERED_COLOR, width=1)

STAGES = [draw_stage_0, draw_stage_1, draw_stage_2, draw_stage_3]

for crop_name, colors in CROPS.items():
    for stage_idx, stage_fn in enumerate(STAGES):
        img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        stage_fn(draw, colors)
        filename = f'{crop_name}_{stage_idx}.png'
        img.save(os.path.join(OUT, filename))
        print(f'  {filename}')

# Shared withered sprite
img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw_withered(draw)
img.save(os.path.join(OUT, 'withered.png'))
print('  withered.png')

print(f'\nDone — {len(CROPS) * 4 + 1} sprites in {OUT}')
