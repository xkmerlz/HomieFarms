"""
Generate improved pixel-art sprites for HomieFarms.
- Tilled soil with visible furrow lines
- 5 crops × 4 growth stages + withered (isometric style)
- Farm zone corner/edge post markers
All sprites are 32×28 RGBA PNGs matching the isometric tile style.
"""
from PIL import Image, ImageDraw
import os, math

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites')
TILE_DIR = os.path.join(OUT_DIR, 'tiles')
CROP_DIR = os.path.join(OUT_DIR, 'crops')

os.makedirs(TILE_DIR, exist_ok=True)
os.makedirs(CROP_DIR, exist_ok=True)

# ── Isometric diamond mask (32×28) ──────────────────────────
W, H = 32, 28
HALF_W, HALF_H = 16, 14

def iso_diamond():
    """Return list of (x_start, x_end, y) scanlines for isometric diamond."""
    lines = []
    # Top half: y=0..13
    for y in range(HALF_H):
        half = int(y * HALF_W / HALF_H)
        x0 = HALF_W - half
        x1 = HALF_W + half
        lines.append((x0, x1, y))
    # Bottom half: y=14..27
    for y in range(HALF_H):
        half = int((HALF_H - 1 - y) * HALF_W / HALF_H)
        x0 = HALF_W - half
        x1 = HALF_W + half
        lines.append((x0, x1, y + HALF_H))
    return lines

DIAMOND = iso_diamond()

def fill_diamond(img, color):
    """Fill the isometric diamond area with a solid color."""
    for x0, x1, y in DIAMOND:
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H:
                img.putpixel((x, y), color)

def fill_diamond_gradient(img, top_color, side_color):
    """Fill with a top-face color on upper half, side color on lower."""
    for x0, x1, y in DIAMOND:
        c = top_color if y < HALF_H else side_color
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H:
                img.putpixel((x, y), c)

# ── TILLED SOIL SPRITE ──────────────────────────────────────
def gen_tilled():
    """Generate tilled.png with visible furrow lines on dark soil."""
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    
    # Base: dark rich soil brown (darker than farm_plot to be visually distinct)
    soil_top = (78, 52, 30, 255)      # dark brown top face
    soil_side = (50, 32, 16, 255)     # darker side
    fill_diamond_gradient(img, soil_top, soil_side)
    
    # Draw furrow lines across the top face (diagonal lines in iso perspective)
    # Furrows run NW-SE direction in iso space = diagonal lines from top-left to bottom-right
    furrow_dark = (55, 36, 18, 255)
    furrow_light = (95, 65, 38, 255)
    
    for x0, x1, y in DIAMOND:
        if y >= HALF_H:
            continue  # only draw furrows on top face
        for x in range(x0, x1 + 1):
            # Create diagonal furrow pattern
            # In iso perspective, furrows appear as parallel diagonal lines
            stripe = (x + y) % 4
            if stripe == 0:
                img.putpixel((x, y), furrow_dark)
            elif stripe == 2:
                img.putpixel((x, y), furrow_light)
    
    img.save(os.path.join(TILE_DIR, 'tilled.png'))
    print('  tilled.png')

# ── CROP SPRITES ─────────────────────────────────────────────
# Each crop gets 4 stages (0=seed/sprout, 1=small, 2=medium, 3=full)
# Sprites are 32×32 with transparency, drawn ON TOP of the tilled tile
# Anchor bottom-center, so we draw plants growing upward from center-bottom

CROP_W, CROP_H = 32, 32

# Color palettes for each crop
CROP_COLORS = {
    'lettuce': {
        'stem': (60, 100, 40, 255),
        'leaf': (80, 160, 60, 255),
        'leaf_light': (120, 200, 80, 255),
        'fruit': (100, 180, 70, 255),
    },
    'carrots': {
        'stem': (60, 100, 40, 255),
        'leaf': (70, 140, 50, 255),
        'leaf_light': (100, 180, 60, 255),
        'fruit': (220, 130, 40, 255),
        'fruit_dark': (180, 100, 30, 255),
    },
    'tomatoes': {
        'stem': (60, 100, 40, 255),
        'leaf': (70, 130, 50, 255),
        'leaf_light': (90, 160, 60, 255),
        'fruit': (200, 50, 40, 255),
        'fruit_light': (230, 80, 60, 255),
    },
    'pumpkins': {
        'stem': (60, 100, 40, 255),
        'leaf': (70, 130, 50, 255),
        'leaf_light': (90, 160, 60, 255),
        'fruit': (220, 150, 30, 255),
        'fruit_dark': (180, 110, 20, 255),
    },
    'starfruit': {
        'stem': (60, 100, 40, 255),
        'leaf': (70, 130, 80, 255),
        'leaf_light': (100, 170, 110, 255),
        'fruit': (255, 220, 50, 255),
        'fruit_light': (255, 240, 120, 255),
    },
}

def draw_seed_stage(img, colors):
    """Stage 0: tiny seed mound / first sprout (2-3px tall)."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30  # bottom center anchor point
    # Small dirt mound
    d.rectangle([cx-2, cy-2, cx+2, cy], fill=(90, 60, 35, 255))
    # Tiny green sprout
    d.line([(cx, cy-2), (cx, cy-4)], fill=colors['stem'], width=1)
    d.point((cx-1, cy-4), fill=colors['leaf'])
    d.point((cx+1, cy-4), fill=colors['leaf'])

def draw_sprout_stage(img, colors):
    """Stage 1: small plant with 2-3 leaves (5-6px tall)."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Stem
    d.line([(cx, cy), (cx, cy-6)], fill=colors['stem'], width=1)
    # Leaves
    d.line([(cx, cy-4), (cx-3, cy-6)], fill=colors['leaf'], width=1)
    d.line([(cx, cy-4), (cx+3, cy-6)], fill=colors['leaf'], width=1)
    d.point((cx-3, cy-7), fill=colors['leaf_light'])
    d.point((cx+3, cy-7), fill=colors['leaf_light'])
    # Top leaf
    d.point((cx, cy-7), fill=colors['leaf_light'])

def draw_medium_stage(img, colors):
    """Stage 2: medium plant with more foliage (8-10px tall)."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Stem
    d.line([(cx, cy), (cx, cy-9)], fill=colors['stem'], width=1)
    # Lower leaves
    d.line([(cx, cy-3), (cx-4, cy-5)], fill=colors['leaf'], width=1)
    d.line([(cx, cy-3), (cx+4, cy-5)], fill=colors['leaf'], width=1)
    d.rectangle([cx-5, cy-6, cx-3, cy-5], fill=colors['leaf_light'])
    d.rectangle([cx+3, cy-6, cx+5, cy-5], fill=colors['leaf_light'])
    # Upper leaves
    d.line([(cx, cy-6), (cx-3, cy-8)], fill=colors['leaf'], width=1)
    d.line([(cx, cy-6), (cx+3, cy-8)], fill=colors['leaf'], width=1)
    d.rectangle([cx-4, cy-9, cx-2, cy-8], fill=colors['leaf_light'])
    d.rectangle([cx+2, cy-9, cx+4, cy-8], fill=colors['leaf_light'])
    # Top
    d.point((cx, cy-10), fill=colors['leaf_light'])

def draw_lettuce_full(img, colors):
    """Lettuce stage 3: round leafy head."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Full round lettuce head
    d.ellipse([cx-5, cy-10, cx+5, cy-2], fill=colors['leaf'])
    d.ellipse([cx-4, cy-9, cx+4, cy-4], fill=colors['leaf_light'])
    # Highlight
    d.ellipse([cx-2, cy-8, cx+1, cy-5], fill=colors['fruit'])

def draw_carrots_full(img, colors):
    """Carrots stage 3: green tops with orange peeking out."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Carrot tips showing from soil
    d.rectangle([cx-3, cy-1, cx-2, cy], fill=colors['fruit'])
    d.rectangle([cx, cy-1, cx+1, cy], fill=colors['fruit'])
    d.rectangle([cx+3, cy-1, cx+4, cy], fill=colors['fruit_dark'])
    # Green feathery tops
    d.line([(cx-3, cy-2), (cx-4, cy-8)], fill=colors['stem'], width=1)
    d.line([(cx, cy-2), (cx, cy-10)], fill=colors['stem'], width=1)
    d.line([(cx+3, cy-2), (cx+4, cy-8)], fill=colors['stem'], width=1)
    # Leaves
    for xoff in [-4, 0, 4]:
        bx = cx + xoff
        d.line([(bx, cy-6), (bx-2, cy-8)], fill=colors['leaf'], width=1)
        d.line([(bx, cy-6), (bx+2, cy-8)], fill=colors['leaf'], width=1)
        d.point((bx-2, cy-9), fill=colors['leaf_light'])
        d.point((bx+2, cy-9), fill=colors['leaf_light'])
    d.point((cx, cy-11), fill=colors['leaf_light'])

def draw_tomatoes_full(img, colors):
    """Tomatoes stage 3: vine with red fruits."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Main stem
    d.line([(cx, cy), (cx, cy-12)], fill=colors['stem'], width=1)
    # Leaves
    d.line([(cx, cy-5), (cx-4, cy-7)], fill=colors['leaf'], width=1)
    d.line([(cx, cy-5), (cx+4, cy-7)], fill=colors['leaf'], width=1)
    d.line([(cx, cy-9), (cx-3, cy-11)], fill=colors['leaf'], width=1)
    d.line([(cx, cy-9), (cx+3, cy-11)], fill=colors['leaf'], width=1)
    # Red tomato fruits
    d.ellipse([cx-5, cy-5, cx-2, cy-2], fill=colors['fruit'])
    d.point((cx-4, cy-4), fill=colors['fruit_light'])
    d.ellipse([cx+2, cy-7, cx+5, cy-4], fill=colors['fruit'])
    d.point((cx+3, cy-6), fill=colors['fruit_light'])
    # Small tomato at top
    d.ellipse([cx-2, cy-10, cx+1, cy-8], fill=colors['fruit'])

def draw_pumpkins_full(img, colors):
    """Pumpkins stage 3: big orange pumpkin on ground."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Big pumpkin body
    d.ellipse([cx-6, cy-7, cx+6, cy], fill=colors['fruit'])
    # Pumpkin ridges (vertical lines)
    d.line([(cx, cy-7), (cx, cy)], fill=colors['fruit_dark'], width=1)
    d.line([(cx-3, cy-6), (cx-3, cy)], fill=colors['fruit_dark'], width=1)
    d.line([(cx+3, cy-6), (cx+3, cy)], fill=colors['fruit_dark'], width=1)
    # Highlight
    d.ellipse([cx-2, cy-6, cx+1, cy-3], fill=colors['fruit'])
    # Green stem on top
    d.line([(cx, cy-7), (cx, cy-10)], fill=colors['stem'], width=1)
    d.line([(cx, cy-9), (cx+2, cy-10)], fill=colors['leaf'], width=1)
    # Vine leaf
    d.line([(cx, cy-5), (cx-5, cy-6)], fill=colors['leaf'], width=1)
    d.point((cx-6, cy-7), fill=colors['leaf_light'])

def draw_starfruit_full(img, colors):
    """Starfruit stage 3: exotic star-shaped yellow fruit on bush."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    # Bush base
    d.ellipse([cx-5, cy-4, cx+5, cy], fill=colors['leaf'])
    d.ellipse([cx-4, cy-6, cx+4, cy-1], fill=colors['leaf_light'])
    # Stem
    d.line([(cx, cy-6), (cx, cy-10)], fill=colors['stem'], width=1)
    # Star fruit - draw a star shape
    # Center of star
    sx, sy = cx, cy - 9
    d.rectangle([sx-3, sy-1, sx+3, sy+1], fill=colors['fruit'])
    d.rectangle([sx-1, sy-3, sx+1, sy+3], fill=colors['fruit'])
    # Diagonal points
    d.point((sx-2, sy-2), fill=colors['fruit'])
    d.point((sx+2, sy-2), fill=colors['fruit'])
    d.point((sx-2, sy+2), fill=colors['fruit'])
    d.point((sx+2, sy+2), fill=colors['fruit'])
    # Highlight
    d.point((sx-1, sy-1), fill=colors['fruit_light'])
    d.point((sx, sy), fill=colors['fruit_light'])

def draw_withered(img):
    """Withered crop: brown dead plant."""
    d = ImageDraw.Draw(img)
    cx, cy = 16, 30
    brown = (100, 70, 40, 255)
    dark = (70, 45, 25, 255)
    # Dead drooping stem
    d.line([(cx, cy), (cx, cy-7)], fill=dark, width=1)
    d.line([(cx, cy-5), (cx-3, cy-3)], fill=brown, width=1)
    d.line([(cx, cy-5), (cx+3, cy-3)], fill=brown, width=1)
    d.line([(cx, cy-7), (cx-2, cy-5)], fill=brown, width=1)
    d.line([(cx, cy-7), (cx+2, cy-6)], fill=brown, width=1)
    # Dead leaf tips
    d.point((cx-3, cy-2), fill=dark)
    d.point((cx+3, cy-2), fill=dark)

FULL_DRAW = {
    'lettuce': draw_lettuce_full,
    'carrots': draw_carrots_full,
    'tomatoes': draw_tomatoes_full,
    'pumpkins': draw_pumpkins_full,
    'starfruit': draw_starfruit_full,
}

def gen_crops():
    for crop_name, colors in CROP_COLORS.items():
        for stage in range(4):
            img = Image.new('RGBA', (CROP_W, CROP_H), (0, 0, 0, 0))
            if stage == 0:
                draw_seed_stage(img, colors)
            elif stage == 1:
                draw_sprout_stage(img, colors)
            elif stage == 2:
                draw_medium_stage(img, colors)
            elif stage == 3:
                FULL_DRAW[crop_name](img, colors)
            
            fname = f'{crop_name}_{stage}.png'
            img.save(os.path.join(CROP_DIR, fname))
            print(f'  {fname}')
    
    # Withered
    img = Image.new('RGBA', (CROP_W, CROP_H), (0, 0, 0, 0))
    draw_withered(img)
    img.save(os.path.join(CROP_DIR, 'withered.png'))
    print('  withered.png')

# ── FARM ZONE MARKER (fence post) ───────────────────────────
def gen_farm_post():
    """Generate a small fence post sprite (32×32) for farm zone corners."""
    img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = 16
    
    # Wooden post (vertical)
    post_color = (120, 80, 40, 255)
    post_dark = (90, 60, 30, 255)
    post_light = (150, 105, 55, 255)
    
    # Post body (3px wide, ~12px tall)
    d.rectangle([cx-1, 16, cx+1, 28], fill=post_color)
    d.line([(cx-1, 16), (cx-1, 28)], fill=post_dark)
    d.line([(cx+1, 16), (cx+1, 28)], fill=post_light)
    
    # Post top (cap/knob)
    d.rectangle([cx-2, 14, cx+2, 16], fill=post_light)
    d.point((cx, 13), fill=post_color)
    
    # Small sign/ribbon
    d.rectangle([cx-3, 19, cx+3, 22], fill=(180, 140, 60, 200))
    d.rectangle([cx-3, 19, cx+3, 19], fill=(200, 160, 70, 200))
    
    img.save(os.path.join(TILE_DIR, 'farm_post.png'))
    print('  farm_post.png')

# ── RUN ─────────────────────────────────────────────────────
if __name__ == '__main__':
    print('Generating sprites...')
    gen_tilled()
    gen_crops()
    gen_farm_post()
    print('Done!')
