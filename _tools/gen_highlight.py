"""
gen_highlight.py — Generate a new highlight.png matching the real tile dimensions (32×28).
Draws a dashed yellow diamond outline over the top face + a tinted fill.
"""
from PIL import Image, ImageDraw
import os

W, H = 32, 16     # flat diamond — top face only, no cube sides
FACE_H = 16       # top-face diamond height (TILE_H)

# Diamond vertices (top face)
top   = (W // 2, 0)          # apex
right = (W,      H // 2 - 2) # right vertex (adjusted slightly up due to extra height)
bot   = (W // 2, FACE_H)     # bottom vertex
left  = (0,      H // 2 - 2) # left vertex

# Actually, use exact 2:1 iso positions
top   = (16, 0)
right = (32, 8)
bot   = (16, 16)
left  = (0,  8)

img  = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Semi-transparent yellow fill
draw.polygon([top, right, bot, left], fill=(255, 230, 0, 60))

# Bright yellow 1px outline
draw.line([top, right, bot, left, top], fill=(255, 230, 0, 220), width=1)

out = "public/sprites/tiles/highlight.png"
img.save(out)
print(f"Saved {out} ({W}×{H})")
