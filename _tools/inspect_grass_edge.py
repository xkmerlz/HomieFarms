"""
inspect_grass_edge.py — Check the rightmost pixel columns of the grass crop
to find the exact clean boundary.
"""
from PIL import Image

SRC = "_resources/isometric_cozy_v230729/cozy_iso_export.png"
img = Image.open(SRC).convert("RGBA")

# Current crop: (193, 192) to (225, 224) — 32×32
# Check columns 222-226 (absolute X) for alpha/color at various Y
print("Checking pixel columns around the right edge of grass tile:")
print(f"{'x':>4} {'y':>4} {'RGBA':>20}")
for x in range(220, 228):
    for y in [200, 204, 208, 212]:
        r, g, b, a = img.getpixel((x, y))
        marker = " <-- artifact?" if (a > 0 and r > 150) else ""
        print(f"  {x:>4} {y:>4}  ({r:3},{g:3},{b:3},{a:3}){marker}")
    print()

# Also check left edge
print("\nChecking left edge:")
for x in range(191, 196):
    for y in [200, 204, 208]:
        r, g, b, a = img.getpixel((x, y))
        print(f"  {x:>4} {y:>4}  ({r:3},{g:3},{b:3},{a:3})")
    print()
