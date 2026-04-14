"""
Generate a flat tilled soil sprite with a light grass bleed at the edges.
Dirt fills the full tile diamond; grass from the base tile peeks through
only at the outermost fringe pixels for a natural transition.
"""
from PIL import Image
import os, random

random.seed(42)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRASS_PATH = os.path.join(ROOT, "public", "sprites", "tiles", "grass.png")
OUT = os.path.join(ROOT, "public", "sprites", "tiles", "tilled.png")

# Load grass tile as base (32x32 with content starting at y=3)
grass = Image.open(GRASS_PATH).convert("RGBA")
W, H = grass.size  # 32x32

# Shift grass UP slightly so blades overlap the dirt edges
GRASS_SHIFT_UP = 3
grass_shifted = Image.new("RGBA", (W, H), (0, 0, 0, 0))
grass_shifted.paste(grass, (0, -GRASS_SHIFT_UP))

img = grass_shifted.copy()
pixels = img.load()
grass_px = grass_shifted.load()

# The full tile diamond: center (16, 11), half-w 16, half-h 8
DIAMOND_CX, DIAMOND_CY = 16, 11
DIAMOND_HW, DIAMOND_HH = 16, 8

# Brown dirt palette
DIRT_COLORS = [
    (101, 67, 42),
    (120, 80, 50),
    (110, 72, 45),
    (130, 88, 55),
    (95, 62, 38),
]

# Fringe width in normalized diamond distance (0.0-1.0)
# Only the outermost ~15% of the diamond gets grass bleed
FRINGE_START = 0.82

for y in range(H):
    for x in range(W):
        ndx = abs(x - DIAMOND_CX + 0.5) / DIAMOND_HW
        ndy = abs(y - DIAMOND_CY + 0.5) / DIAMOND_HH
        dist = ndx + ndy  # 0 at center, 1 at diamond edge

        if dist > 1.0:
            continue  # Outside diamond — keep grass (shifted)

        # Dirt color for this pixel
        stripe = ((x + y) // 2) % len(DIRT_COLORS)
        noise = ((x * 7 + y * 13) % 5) - 2
        r, g, b = DIRT_COLORS[stripe]
        r = max(0, min(255, r + noise * 3))
        g = max(0, min(255, g + noise * 2))
        b = max(0, min(255, b + noise * 2))

        if dist < FRINGE_START:
            # Solid dirt
            pixels[x, y] = (r, g, b, 255)
        else:
            # Fringe zone: probabilistic grass/dirt mix
            # Closer to edge = more grass
            t = (dist - FRINGE_START) / (1.0 - FRINGE_START)  # 0..1
            jitter = ((x * 31 + y * 17 + x * y) % 100) / 100.0
            if jitter > t * 0.6:
                # Paint dirt
                pixels[x, y] = (r, g, b, 255)
            # else: keep grass pixel from shifted base

img.save(OUT)
print(f"Saved tilled sprite with grass bleed to {OUT}")
print(f"Size: {img.size}, bbox: {img.getbbox()}")
