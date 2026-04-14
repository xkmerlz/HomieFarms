"""
gen_path_tiles.py — Generate dirt/path tiles by recoloring the stone cube.

Takes the stone tile (flat-topped cube used for roads) and shifts its grey
tones to warm brown/earth tones for path variants. Same 32×32 shape so they
tile seamlessly with grass and stone.
"""
from PIL import Image, ImageEnhance
import numpy as np
import os

DST = "public/sprites/tiles"

# Use the stone tile as base — flat top, no grass blades
stone = Image.open(os.path.join(DST, "stone.png")).convert("RGBA")
arr = np.array(stone, dtype=np.float32)

def recolor_to_earth(img_arr, r_mult, g_mult, b_mult, brightness=1.0):
    """Recolor grey stone to earth tones by applying channel multipliers."""
    out = img_arr.copy()
    a = out[:,:,3]
    mask = a > 0
    
    for ch, mult in enumerate([r_mult, g_mult, b_mult]):
        old = out[:,:,ch]
        out[:,:,ch] = np.where(mask, np.clip(old * mult * brightness, 0, 255), old)
    
    return out.astype(np.uint8)

# Path variants — warm browns derived from grey stone
variants = {
    # path: light sandy/beige trampled earth
    "path":       (1.30, 1.05, 0.70, 1.00),
    # dirt: medium-dark brown earth
    "dirt":       (1.20, 0.90, 0.55, 0.85),
    # dirt_light: warm light brown
    "dirt_light": (1.25, 1.00, 0.65, 0.95),
}

for name, (hr, hg, hb, bright) in variants.items():
    result = recolor_to_earth(arr, hr, hg, hb, bright)
    img = Image.fromarray(result)
    path = os.path.join(DST, f"{name}.png")
    img.save(path)
    print(f"  Saved {path}  ({img.width}x{img.height})")

print("Done.")
