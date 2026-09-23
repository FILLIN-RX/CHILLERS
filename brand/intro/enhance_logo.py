"""Upscale + clean the CHILLERS crystal-C mark for 4K cinematic use.

Originals in public/ are never modified; everything lands in brand/intro/assets/.
"""
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import os

SRC = "public/android-chrome-512x512.png"
OUT = "brand/intro/assets"
MASTER = 2048
UHD = 3840

os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert("RGBA")

# --- alpha cleanup: kill compression noise, keep soft edges -----------------
a = im.split()[3].point(lambda v: 0 if v < 6 else min(255, int(v * 255 / 249)))
im.putalpha(a)

# --- recenter the glyph: symmetric padding around the optical bbox ----------
box = a.getbbox()
glyph = im.crop(box)
gw, gh = glyph.size
side = int(max(gw, gh) * 1.06)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(glyph, ((side - gw) // 2, (side - gh) // 2), glyph)

# --- upscale: two-stage lanczos, then recover edge definition ---------------
big = canvas.resize((MASTER, MASTER), Image.Resampling.LANCZOS)
big = big.filter(ImageFilter.UnsharpMask(radius=3, percent=120, threshold=1))

# neon punch: saturation + a touch of contrast on RGB only
rgb = big.convert("RGB")
rgb = ImageEnhance.Color(rgb).enhance(1.18)
rgb = ImageEnhance.Contrast(rgb).enhance(1.06)
rgb = ImageOps.autocontrast(rgb, cutoff=1)
big = Image.merge("RGBA", (*rgb.split(), big.split()[3]))
big.save(f"{OUT}/chillers-logo-2k.png")

uhd = big.resize((UHD, UHD), Image.Resampling.LANCZOS)
uhd = uhd.filter(ImageFilter.UnsharpMask(radius=2, percent=80, threshold=1))
uhd.save(f"{OUT}/chillers-logo-4k.png")

# --- white silhouette: additive glow / rim-light pass in the renderer -------
sil = Image.new("RGBA", big.size, (0, 0, 0, 0))
sil.paste(Image.new("RGB", big.size, (255, 255, 255)), (0, 0), big.split()[3])
sil.save(f"{OUT}/chillers-logo-white-2k.png")

for f in sorted(os.listdir(OUT)):
    p = f"{OUT}/{f}"
    print(f"{f:32} {Image.open(p).size}  {round(os.path.getsize(p)/1024)} KB")
