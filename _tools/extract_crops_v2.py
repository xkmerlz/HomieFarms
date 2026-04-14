"""
Extract crop sprites from the isometric tileset.
Uses pixel-diff against a reference grass tile to isolate vegetation.

Mapping:
  herbs:   stage 0=tile_033, 1=tile_034, 2=tile_035, 3=tile_036
  flowers: stage 0=tile_037, 1=tile_038, 2=tile_039, 3=tile_041
  berries: stage 0=tile_040, 1=tile_043, 2=tile_045, 3=tile_044
  withered: tile_042
"""

from PIL import Image
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "_resources", "isometric tileset", "separated images")
OUT_DIR = os.path.join(ROOT, "public", "sprites", "crops")

os.makedirs(OUT_DIR, exist_ok=True)

# Crop mapping: (crop_name, stage) -> tile index
MAPPING = {
    ("herbs", 0): 33,
    ("herbs", 1): 34,
    ("herbs", 2): 35,
    ("herbs", 3): 36,
    ("flowers", 0): 37,
    ("flowers", 1): 38,
    ("flowers", 2): 39,
    ("flowers", 3): 41,
    ("berries", 0): 40,
    ("berries", 1): 43,
    ("berries", 2): 45,
    ("berries", 3): 44,
    ("withered", -1): 42,
}

# Reference grass tile for diffing
REF_TILE = 22

def load_tile(index):
    path = os.path.join(SRC_DIR, f"tile_{index:03d}.png")
    return Image.open(path).convert("RGBA")

def extract_vegetation(veg_img, ref_img, color_threshold=30):
    """Remove pixels that match the reference grass tile (within threshold)."""
    veg = np.array(veg_img, dtype=np.float32)
    ref = np.array(ref_img, dtype=np.float32)

    # Compare RGB channels where both pixels are non-transparent
    both_visible = (veg[:, :, 3] > 0) & (ref[:, :, 3] > 0)
    rgb_diff = np.sqrt(np.sum((veg[:, :, :3] - ref[:, :, :3]) ** 2, axis=2))

    # Mask out pixels that are close to the reference grass
    grass_match = both_visible & (rgb_diff < color_threshold)

    result = veg.copy()
    result[grass_match, 3] = 0  # Make matching pixels transparent

    return Image.fromarray(result.astype(np.uint8))

def crop_to_content(img, target_height=28):
    """Crop image to its non-transparent bounding box, then pad/resize to consistent size."""
    bbox = img.getbbox()
    if not bbox:
        return img

    cropped = img.crop(bbox)
    w, h = cropped.size

    # Create output canvas - center horizontally, anchor to bottom
    out_w = 32
    out_h = target_height
    canvas = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))

    # If cropped is taller than target, scale down proportionally
    if h > out_h:
        scale = out_h / h
        new_w = max(1, int(w * scale))
        cropped = cropped.resize((new_w, out_h), Image.NEAREST)
        w, h = cropped.size

    # Center horizontally, align to bottom
    x_off = (out_w - w) // 2
    y_off = out_h - h
    canvas.paste(cropped, (x_off, y_off))

    return canvas

def main():
    ref = load_tile(REF_TILE)
    print(f"Reference tile: tile_{REF_TILE:03d} ({ref.size})")

    for (crop, stage), tile_idx in MAPPING.items():
        veg = load_tile(tile_idx)
        print(f"\nProcessing {crop} stage {stage} (tile_{tile_idx:03d})...")

        # Extract vegetation by diffing against reference grass
        extracted = extract_vegetation(veg, ref, color_threshold=35)

        # Crop to content and standardize size
        result = crop_to_content(extracted)

        # Save
        if crop == "withered":
            filename = "withered.png"
        else:
            filename = f"{crop}_{stage}.png"

        out_path = os.path.join(OUT_DIR, filename)
        result.save(out_path)

        bbox = result.getbbox()
        print(f"  -> {filename} ({result.size}, content bbox={bbox})")

    print(f"\nDone! Sprites saved to {OUT_DIR}")

if __name__ == "__main__":
    main()
