#!/usr/bin/env python3
"""Native launch-screen marks (Android mipmaps + iOS LaunchImage) for the splash."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "brand/intro/assets/chillers-logo-4k.png"
ANDROID_RES = ROOT / "mobile/android/app/src/main/res"
IOS_IMAGESET = ROOT / "mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset"

SIDE_DP = 160
ANDROID_DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
IOS_SCALES = {"": 1, "@2x": 2, "@3x": 3}


def square_master(side: int) -> Image.Image:
    mark = Image.open(SOURCE).convert("RGBA")
    x0, y0, x1, y1 = mark.getbbox()
    glyph = mark.crop((x0, y0, x1, y1))
    padded = max(glyph.size) * 1.06
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    scaled = glyph.resize(
        (round(side * glyph.width / padded), round(side * glyph.height / padded)),
        Image.LANCZOS,
    )
    canvas.paste(scaled, ((side - scaled.width) // 2, (side - scaled.height) // 2), scaled)
    return canvas


def main() -> None:
    base = square_master(1024)
    for name, scale in ANDROID_DENSITIES.items():
        out = ANDROID_RES / f"mipmap-{name}" / "launch_mark.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        side = round(SIDE_DP * scale)
        base.resize((side, side), Image.LANCZOS).save(out, optimize=True)
        print(f"android mipmap-{name} {side}x{side}")

    for suffix, scale in IOS_SCALES.items():
        side = SIDE_DP * scale
        path = IOS_IMAGESET / f"LaunchImage{suffix}.png"
        base.resize((side, side), Image.LANCZOS).save(path, optimize=True)
        print(f"ios LaunchImage{suffix or '@1x'} {side}x{side}")


if __name__ == "__main__":
    main()
