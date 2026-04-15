"""
Generate isometric house sprites using actual tiles from the cozy tileset.
Footprint: 4x3 tiles (3x3 house + 1x3 garden).
Layered construction: stone foundation, wood walls, tinted roof, chimney.
"""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "sprites", "buildings")
TILES_DIR = os.path.join(ROOT, "_resources", "tile_catalogue")
PU_TILES_DIR = os.path.join(ROOT, "public", "sprites", "tiles")

TILE_W, TILE_H = 32, 16
Z_STEP = 16

# Canvas sizing — room for 4x3 footprint + chimney (z up to 5)
X_RANGE, Y_RANGE, Z_RANGE = 4, 3, 6
CW = (X_RANGE + Y_RANGE) * (TILE_W // 2) + 32
CH = (X_RANGE + Y_RANGE) * (TILE_H // 2) + Z_RANGE * Z_STEP + 48


def load(name):
    """Load a tile PNG from catalogue or public sprites."""
    for d in [TILES_DIR, PU_TILES_DIR]:
        p = os.path.join(d, name)
        if os.path.exists(p):
            return Image.open(p).convert("RGBA")
    print(f"  Warning: {name} not found")
    return Image.new("RGBA", (32, 32), (255, 0, 255, 128))


def iso(x, y, z):
    """Convert grid (x, y, z) to pixel position on canvas."""
    origin_x = Y_RANGE * (TILE_W // 2) + 16
    origin_y = Z_RANGE * Z_STEP + 16
    px = origin_x + (x - y) * (TILE_W // 2)
    py = origin_y + (x + y) * (TILE_H // 2) - z * Z_STEP
    return int(px), int(py)


def tint(img, color, strength=0.55):
    """Apply a color tint while preserving detail and alpha."""
    overlay = Image.new("RGBA", img.size, (*color, 255))
    blended = Image.blend(img, overlay, strength)
    blended.putalpha(img.split()[3])
    return blended


def generate_house(name, roof_color, _):
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

    # -- Load tile assets --
    stone      = load("tile_04_00.png")  # Stone cube — foundation
    stone_dark = load("tile_04_03.png")  # Dark stone — chimney
    wood_lo    = load("tile_05_00.png")  # Dark wood planks — lower walls
    wood_hi    = load("tile_05_01.png")  # Medium wood planks — upper walls
    roof_full  = load("tile_00_13.png")  # Red roof — flat top
    roof_right = load("tile_00_14.png")  # Red roof — right slope
    roof_left  = load("tile_01_13.png")  # Red roof — left slope
    roof_front = load("tile_00_08.png")  # Red roof — front piece
    door       = load("tile_02_05.png")  # Wooden door
    window     = load("tile_01_07.png")  # Stained glass window
    dirt       = load("tilled.png")      # Tilled soil — garden
    planter    = load("tile_03_00.png")  # Empty planter box
    barrel     = load("tile_02_03.png")  # Small barrel

    # Tint only the roof tiles — walls stay natural wood
    t_roof_full  = tint(roof_full, roof_color)
    t_roof_right = tint(roof_right, roof_color)
    t_roof_left  = tint(roof_left, roof_color)
    t_roof_front = tint(roof_front, roof_color)

    blocks = []  # (x, y, z, tile)

    # ---- Garden row: x=3, y=0..2, z=0 ----
    for y in range(3):
        blocks.append((3, y, 0, dirt))

    # ---- z=0  Foundation: stone cubes ----
    for x in range(3):
        for y in range(3):
            blocks.append((x, y, 0, stone))

    # ---- z=1  Lower walls: dark wood ----
    for x in range(3):
        for y in range(3):
            blocks.append((x, y, 1, wood_lo))
    # Door overlaid on the visible left wall (facing garden)
    blocks.append((2, 1, 1, door))

    # ---- z=2  Upper walls: lighter wood ----
    for x in range(3):
        for y in range(3):
            blocks.append((x, y, 2, wood_hi))
    # Window on the visible right wall
    blocks.append((1, 2, 2, window))

    # ---- z=3  Roof: tinted, with edge slopes ----
    for x in range(3):
        for y in range(3):
            if x == 2 and y == 2:
                blocks.append((x, y, 3, t_roof_front))
            elif x == 2:
                blocks.append((x, y, 3, t_roof_left))
            elif y == 2:
                blocks.append((x, y, 3, t_roof_right))
            else:
                blocks.append((x, y, 3, t_roof_full))

    # ---- Chimney: dark stone at back corner, above roof ----
    blocks.append((0, 0, 4, stone_dark))
    blocks.append((0, 0, 5, stone_dark))

    # ---- Garden decorations ----
    blocks.append((3, 0, 1, planter))
    blocks.append((3, 2, 1, barrel))

    # Sort back-to-front for correct overlap
    blocks.sort(key=lambda b: (b[0] + b[1], b[2], b[1]))

    for x, y, z, tile in blocks:
        px, py = iso(x, y, z)
        canvas.alpha_composite(tile, (px - 16, py - 16))

    # Crop away excess transparency
    bbox = canvas.getbbox()
    if bbox:
        canvas = canvas.crop(bbox)

    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f"{name}.png")
    canvas.save(out)
    print(f"Saved {name} ({canvas.size[0]}x{canvas.size[1]})")


variations = [
    ("house_S1", (178, 68, 50), None),   # Red roof
    ("house_S2", (60, 100, 160), None),   # Blue roof
    ("house_S3", (70, 140, 80), None),    # Green roof
    ("house_S4", (120, 80, 50), None),    # Brown roof
    ("house_N1", (140, 70, 120), None),   # Purple roof
    ("house_N2", (210, 180, 50), None),   # Yellow roof
    ("house_N3", (220, 110, 40), None),   # Orange roof
    ("house_N4", (100, 110, 120), None),  # Grey roof
]

if __name__ == "__main__":
    for v in variations:
        generate_house(*v)
