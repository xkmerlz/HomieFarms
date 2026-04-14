"""
Generate a placeholder isometric house sprite.
Footprint: 4×3 tiles (4 wide in q, 3 deep in r).
Output: single PNG sized for isometric placement.
Style: cozy cottage with colored roof, tan walls, dark door.
Sits on top of a 4×3 tile diamond area.
"""
from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "sprites", "buildings", "house.png")

# Tile geometry
TILE_W, TILE_H = 32, 16

# Footprint in tiles
FP_Q, FP_R = 4, 3

# The isometric diamond for a 3x4 block:
# Width in pixels = (FP_Q + FP_R) * TILE_W/2 = 7 * 16 = 112
# Height in pixels = (FP_Q + FP_R) * TILE_H/2 = 7 * 8 = 56
# Plus wall height above the base

WALL_HEIGHT = 24  # pixels of visible wall
ROOF_HEIGHT = 18  # peak above wall top

# Canvas size
CW = (FP_Q + FP_R) * (TILE_W // 2)  # 112
CH_BASE = (FP_Q + FP_R) * (TILE_H // 2)  # 56
CH = CH_BASE + WALL_HEIGHT + ROOF_HEIGHT  # 98

img = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Origin: the top diamond point is at (FP_R * TILE_W/2, 0 + ROOF_HEIGHT + WALL_HEIGHT)
# Actually let me compute the 4 corners of the base diamond:
# Top corner (iso north): center of top edge
# For a footprint of Q tiles wide, R tiles deep:
# Top point (q=0,r=0): x = FP_R * 16, y = ROOF_HEIGHT + WALL_HEIGHT
# Right point (q=FP_Q,r=0): x = (FP_R + FP_Q)*16, y = ROOF_HEIGHT + WALL_HEIGHT + FP_Q*8
# Bottom point (q=FP_Q,r=FP_R): x = (FP_Q - 0)*16... nah let me use standard formula.

def iso(q, r, y_off=0):
    """Convert tile q,r to pixel x,y"""
    x = (q - r) * (TILE_W // 2) + FP_R * (TILE_W // 2)
    y = (q + r) * (TILE_H // 2) + ROOF_HEIGHT + WALL_HEIGHT + y_off
    return (x, y)

# Base diamond corners
top = iso(0, 0)
right = iso(FP_Q, 0)
bottom = iso(FP_Q, FP_R)
left = iso(0, FP_R)

# Colors
WALL_LIGHT = (222, 198, 158)   # front-right wall (lit)
WALL_DARK = (185, 162, 128)    # front-left wall (shadow)
ROOF_MAIN = (178, 68, 50)      # red roof (top, right face)
ROOF_SHADOW = (142, 52, 38)    # darker roof left face
DOOR_COLOR = (85, 55, 35)
WINDOW_COLOR = (180, 210, 240)
WINDOW_FRAME = (120, 90, 60)

# --- Draw walls ---
# Right wall (visible front-right face): from right to bottom, extruded down
wall_r_top = [right, bottom, 
              (bottom[0], bottom[1] - WALL_HEIGHT),
              (right[0], right[1] - WALL_HEIGHT)]
draw.polygon(wall_r_top, fill=WALL_LIGHT)

# Left wall (visible front-left face): from left to bottom, extruded down
wall_l_top = [left, bottom,
              (bottom[0], bottom[1] - WALL_HEIGHT),
              (left[0], left[1] - WALL_HEIGHT)]
draw.polygon(wall_l_top, fill=WALL_DARK)

# Wall outlines
draw.line([left, bottom, right], fill=(100, 70, 40), width=1)
lwall_top = (left[0], left[1] - WALL_HEIGHT)
rwall_top = (right[0], right[1] - WALL_HEIGHT)
bwall_top = (bottom[0], bottom[1] - WALL_HEIGHT)
draw.line([lwall_top, left], fill=(100, 70, 40), width=1)
draw.line([rwall_top, right], fill=(100, 70, 40), width=1)

# --- Draw roof ---
# Roof is a peaked shape: ridge runs from top-wall to bottom-wall
# Peak: midpoint between top and bottom, raised by ROOF_HEIGHT
top_wall = (top[0], top[1] - WALL_HEIGHT)
bottom_wall = (bottom[0], bottom[1] - WALL_HEIGHT)
left_wall = (left[0], left[1] - WALL_HEIGHT)
right_wall = (right[0], right[1] - WALL_HEIGHT)

# Roof ridge: horizontal line at the top
ridge_front = (bottom_wall[0], bottom_wall[1] - ROOF_HEIGHT)
ridge_back = (top_wall[0], top_wall[1] - ROOF_HEIGHT)

# Right roof face (lit)
draw.polygon([right_wall, bottom_wall, ridge_front, ridge_back, top_wall], fill=ROOF_MAIN)
# Left roof face (shadow)
draw.polygon([left_wall, bottom_wall, ridge_front, ridge_back, top_wall], fill=ROOF_SHADOW)

# Roof outlines
draw.line([top_wall, ridge_back], fill=(120, 40, 30), width=1)
draw.line([ridge_back, ridge_front], fill=(160, 80, 60), width=1)
draw.line([ridge_front, bottom_wall], fill=(120, 40, 30), width=1)
draw.line([left_wall, top_wall], fill=(120, 40, 30), width=1)
draw.line([right_wall, top_wall], fill=(120, 40, 30), width=1)
draw.line([left_wall, bottom_wall, right_wall], fill=(120, 40, 30), width=1)

# --- Door on right wall ---
# Small rectangle on the right wall face, near bottom-center
# The right wall goes from 'right' to 'bottom' at the base
# Place door ~40% from right toward bottom
door_base_x = int(right[0] + 0.4 * (bottom[0] - right[0]))
door_base_y = int(right[1] + 0.4 * (bottom[1] - right[1]))
door_w, door_h = 6, 12
# Door as a small parallelogram on the wall face
door_pts = [
    (door_base_x - door_w//2, door_base_y),
    (door_base_x + door_w//2, door_base_y),
    (door_base_x + door_w//2, door_base_y - door_h),
    (door_base_x - door_w//2, door_base_y - door_h),
]
draw.polygon(door_pts, fill=DOOR_COLOR, outline=(60, 35, 20))

# --- Window on left wall ---
win_base_x = int(left[0] + 0.45 * (bottom[0] - left[0]))
win_base_y = int(left[1] + 0.45 * (bottom[1] - left[1]))
win_w, win_h = 8, 7
win_yoff = -8
win_pts = [
    (win_base_x - win_w//2, win_base_y + win_yoff),
    (win_base_x + win_w//2, win_base_y + win_yoff),
    (win_base_x + win_w//2, win_base_y + win_yoff - win_h),
    (win_base_x - win_w//2, win_base_y + win_yoff - win_h),
]
draw.polygon(win_pts, fill=WINDOW_COLOR, outline=WINDOW_FRAME)
# Cross panes
cx = win_base_x
cy = win_base_y + win_yoff - win_h // 2
draw.line([(win_base_x - win_w//2, cy), (win_base_x + win_w//2, cy)], fill=WINDOW_FRAME, width=1)
draw.line([(cx, win_base_y + win_yoff), (cx, win_base_y + win_yoff - win_h)], fill=WINDOW_FRAME, width=1)

# Ensure output directory exists
os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT)
print(f"Saved house sprite to {OUT}")
print(f"Size: {img.size}, bbox: {img.getbbox()}")
