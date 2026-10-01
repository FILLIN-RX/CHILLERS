#!/usr/bin/env python3
"""Export the CHILLERS launcher icon (concept A - prism) to Android + iOS.

Android gets a full adaptive icon: background / foreground / monochrome layers plus
legacy mipmaps. iOS gets the AppIcon.appiconset PNG set (Contents.json already lists them).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from gen_concepts import CYAN, MAGENTA, VIOLET, c_outline, draw_c, drop_shadow, glow_bg  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
RES = os.path.join(ROOT, "mobile", "android", "app", "src", "main", "res")
IOS_SET = os.path.join(ROOT, "mobile", "ios", "Runner", "Assets.xcassets", "AppIcon.appiconset")
MASTER_DIR = os.path.join(HERE, "master")

GLOWS = [(0.30, 0.26, CYAN, 0.42), (0.76, 0.80, MAGENTA, 0.46), (0.50, 0.50, VIOLET, 0.30)]
C = dict(r_out=0.325, r_in=0.180, a0=50, a1=310, segs=8, wobble=0.028)

# The adaptive canvas is 108dp with only 66dp of guaranteed-visible circle, so the
# foreground mark is scaled down from the full-bleed master ratio.
FG_SCALE = 0.84
VIEWPORT_DP = 72.0
LAYER_DP = 108.0

DENSITIES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
             "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}

SPLASH_SIZES = {"mdpi": 160, "hdpi": 240, "xhdpi": 320, "xxhdpi": 480, "xxxhdpi": 640}

IOS_FILES = {
    "Icon-App-20x20@1x.png": 20, "Icon-App-20x20@2x.png": 40, "Icon-App-20x20@3x.png": 60,
    "Icon-App-29x29@1x.png": 29, "Icon-App-29x29@2x.png": 58, "Icon-App-29x29@3x.png": 87,
    "Icon-App-40x40@1x.png": 40, "Icon-App-40x40@2x.png": 80, "Icon-App-40x40@3x.png": 120,
    "Icon-App-60x60@2x.png": 120, "Icon-App-60x60@3x.png": 180,
    "Icon-App-76x76@1x.png": 76, "Icon-App-76x76@2x.png": 152, "Icon-App-83.5x83.5@2x.png": 167,
    "Icon-App-1024x1024@1x.png": 1024,
}

ADAPTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
"""

written = []


def save(im, path, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out = im if im.size == (px, px) else im.resize((px, px), Image.LANCZOS)
    out.save(path, optimize=True)
    written.append((path, out.size, out.mode))


def background(px, ss=4):
    return glow_bg(px * ss, GLOWS).convert("RGB").resize((px, px), Image.LANCZOS)


def foreground(px, scale=1.0, ss=4):
    size = px * ss
    mark = draw_c(size, 0.5, 0.5, C["r_out"] * scale, C["r_in"] * scale,
                  C["a0"], C["a1"], C["segs"], C["wobble"], 0.014 * scale, True, True)
    return drop_shadow(mark, size, 0.022 * scale, 0.016, 0.50).resize((px, px), Image.LANCZOS)


def monochrome(px, scale=FG_SCALE, ss=4):
    """Themed-icon layer: the platform keeps only the alpha, so RGB stays pure white."""
    size = px * ss
    outer, inner, _, _, _ = c_outline(size, 0.5, 0.5, C["r_out"] * scale, C["r_in"] * scale,
                                      C["a0"], C["a1"], C["segs"], 0.0)
    ink = Image.new("L", (size, size), 0)
    ImageDraw.Draw(ink).polygon(outer + inner[::-1], fill=255)
    out = Image.new("RGBA", (px, px), (255, 255, 255, 0))
    out.putalpha(ink.resize((px, px), Image.LANCZOS))
    return out


def mark_only(px, ss=4):
    """The bare faceted C on transparency: splash mark, in-app logo."""
    return foreground(px, 1.0, ss)


def composite(px, scale=1.0):
    out = background(px).convert("RGBA")
    return Image.alpha_composite(out, foreground(px, scale)).convert("RGB")


def shape_mask(im, kind):
    out = im.convert("RGBA")
    m = Image.new("L", out.size, 0)
    d = ImageDraw.Draw(m)
    w, h = out.size
    if kind == "circle":
        d.ellipse([0, 0, w - 1, h - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, w - 1, h - 1], radius=w * 0.2237, fill=255)
    out.putalpha(m)
    return out


def adaptive_preview(px, kind="circle", ss=4):
    """What a launcher really shows: the centre 72dp of the 108dp layer, masked."""
    big = int(px * ss * LAYER_DP / VIEWPORT_DP)
    layer = Image.alpha_composite(background(big, 1).convert("RGBA"), foreground(big, FG_SCALE, 1))
    off = (big - px * ss) // 2
    crop = layer.crop((off, off, off + px * ss, off + px * ss)).convert("RGB").resize((px, px), Image.LANCZOS)
    return shape_mask(crop, kind)


def preview_sheet(images, path):
    tile, gap, top = 200, 40, 40
    W = gap + len(images) * (tile + gap)
    sheet = Image.new("RGB", (W, top + tile + 70), (0x0B, 0x0B, 0x0D))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
    except OSError:
        font = None
    for i, (label, im) in enumerate(images):
        x = gap + i * (tile + gap)
        if im.mode == "RGBA":
            sheet.paste(im, (x, top), im.getchannel("A"))
        else:
            sheet.paste(im, (x, top))
        d.text((x, top + tile + 12), label, fill=(0xA1, 0xA1, 0xAA), font=font)
    path = str(path)
    sheet.save(path, optimize=True)
    written.append((path, sheet.size, sheet.mode))


def main():
    save(composite(1024), os.path.join(MASTER_DIR, "chillers-icon-1024.png"), 1024)
    save(composite(512), os.path.join(MASTER_DIR, "chillers-icon-512.png"), 512)

    for dens, (legacy_px, layer_px) in DENSITIES.items():
        d = os.path.join(RES, f"mipmap-{dens}")
        save(composite(legacy_px), os.path.join(d, "ic_launcher.png"), legacy_px)
        save(shape_mask(composite(legacy_px), "circle"), os.path.join(d, "ic_launcher_round.png"), legacy_px)
        save(background(layer_px), os.path.join(d, "ic_launcher_background.png"), layer_px)
        save(foreground(layer_px, FG_SCALE), os.path.join(d, "ic_launcher_foreground.png"), layer_px)
        save(monochrome(layer_px), os.path.join(d, "ic_launcher_monochrome.png"), layer_px)

    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        p = os.path.join(anydpi, name)
        with open(p, "w") as fh:
            fh.write(ADAPTIVE_XML)
        written.append((p, ("xml",), "-"))

    master = composite(1024)
    for fname, px in IOS_FILES.items():
        save(master, os.path.join(IOS_SET, fname), px)

    # --- transparent mark: Android splash + in-app logo -------------------
    save(mark_only(1024), os.path.join(MASTER_DIR, "chillers-mark-1024.png"), 1024)
    for dens, px in SPLASH_SIZES.items():
        save(mark_only(px), os.path.join(RES, f"mipmap-{dens}", "launch_mark.png"), px)
    save(mark_only(192), os.path.join(ROOT, "mobile", "assets", "logo.png"), 192)

    mono = Image.new("RGBA", (200, 200), (0x12, 0x12, 0x14, 255))
    tint = Image.new("RGBA", (200, 200), (0xF4, 0x2A, 0x7C, 0))
    tint.putalpha(monochrome(200).split()[3])
    preview_sheet([("legacy square", composite(200)),
                   ("adaptive circle", adaptive_preview(200, "circle")),
                   ("adaptive squircle", adaptive_preview(200, "squircle")),
                   ("monochrome", Image.alpha_composite(mono, tint))],
                  os.path.join(MASTER_DIR, "android-preview.png"))

    for path, size, mode in written:
        print(f"  {os.path.relpath(path, ROOT):<70} {size[0]}x{size[-1]}\t{mode}")
    print(f"\n{len(written)} files written")


if __name__ == "__main__":
    main()
