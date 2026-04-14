"""
Extract better tilled soil, crop, and fence sprites from the cozy_iso tileset.
Based on visual inspection of the full sheet.
"""
from PIL import Image, ImageDraw, ImageEnhance
import os

SRC = os.path.join(os.path.dirname(__file__), '..', '_resources', 'isometric_cozy_v230729', 'cozy_iso_export.png')
TILE_OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'tiles')
CROP_OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'crops')

img = Image.open(SRC).convert('RGBA')

def crop_and_save(box, name, outdir, show_info=True):
    """Crop a region and save it."""
    cropped = img.crop(box)
    path = os.path.join(outdir, f'{name}.png')
    cropped.save(path)
    if show_info:
        print(f'  {name}.png  ({cropped.size[0]}x{cropped.size[1]}) from {box}')
    return cropped

# Let me first preview specific regions to identify the right crops and soil
# Looking at the tileset, I can see:
# - Row ~y=261: dark brown soil tiles (we already extracted farm_plot, dirt, dirt_light)
# - Bottom rows y=260-290: there are small plant/crop sprites on soil tiles
# - I can see what looks like garden bed tiles with plants in the bottom section

# Let me extract preview strips to identify the right crops
print("=== Preview strips ===")
for y_start in range(250, 320, 16):
    strip = img.crop((0, y_start, 512, y_start + 32))
    strip.save(os.path.join(os.path.dirname(__file__), f'preview_y{y_start}.png'))
    print(f'  preview_y{y_start}.png')

print("\nCheck the preview files to identify crop sprite locations.")
