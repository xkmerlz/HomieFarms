"""Generate a tilled soil tile sprite from the farm_plot texture with furrow lines."""
from PIL import Image, ImageDraw
import os

SRC = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'tiles', 'farm_plot.png')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'tiles', 'tilled.png')

# Load farm_plot as base
img = Image.open(SRC).convert('RGBA')
draw = ImageDraw.Draw(img)

# Add subtle furrow lines (horizontal dark lines across the top face area)
# farm_plot is 32×28, top face roughly y=4-16
for y in [6, 9, 12]:
    # Calculate horizontal extent at this y position for diamond shape
    # Diamond center is at x=16, face rows span different widths
    half_w = max(1, int((16 - abs(y - 9)) * 1.2))
    x_start = 16 - half_w
    x_end = 16 + half_w
    for x in range(x_start, x_end + 1):
        if 0 <= x < 32 and 0 <= y < 28:
            px = img.getpixel((x, y))
            if px[3] > 0:  # only draw on non-transparent pixels
                # Darken slightly
                r, g, b, a = px
                draw.point((x, y), fill=(max(0, r-25), max(0, g-20), max(0, b-15), a))

img.save(OUT)
print(f'Saved tilled.png ({img.size[0]}x{img.size[1]})')
