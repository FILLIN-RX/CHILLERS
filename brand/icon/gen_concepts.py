#!/usr/bin/env python3
"""Render CHILLERS launcher-icon concepts: geometric, minimal, clean, 3D, dark."""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "concepts")
S = 1024
SS = 4

MAGENTA = (0xF4, 0x2A, 0x7C)
VIOLET = (0x7C, 0x3A, 0xED)
CYAN = (0x39, 0xE6, 0xFF)
INK = (0x07, 0x07, 0x09)

LIGHT = (-0.60, -0.62)  # screen-space vector toward the light (upper-left)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(len(a)))


def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def ramp(t):
    t = clamp(t)
    return mix(MAGENTA, VIOLET, t / 0.55) if t < 0.55 else mix(VIOLET, CYAN, (t - 0.55) / 0.45)


def shade(c, k):
    return tuple(min(255, max(0, round(v * k))) for v in c)


def glow_bg(size, spots):
    im = Image.new("RGB", (size, size), INK)
    layer = Image.new("RGB", (size, size), (0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, col, rad in spots:
        r = size * rad
        d.ellipse([cx * size - r, cy * size - r, cx * size + r, cy * size + r], fill=col)
    layer = layer.filter(ImageFilter.GaussianBlur(size * 0.13))
    mask = layer.convert("L").point(lambda v: int(v * 0.22))
    return Image.composite(layer, im, mask)


def light_at(a_deg, flip=False):
    a = math.radians(a_deg)
    nx, ny = math.cos(a), -math.sin(a)
    if flip:
        nx, ny = -nx, -ny
    return nx * LIGHT[0] + ny * LIGHT[1]


def c_outline(size, cx, cy, r_out, r_in, a0, a1, segs, wobble):
    """Vertices of the faceted C ring, in pixels. cx/cy are normalized."""
    cx, cy = cx * size, cy * size
    step = (a1 - a0) / segs
    angles = [a0 - step * 0.5 + step * i for i in range(segs + 2)]

    def ring(radius, i):
        a = math.radians(angles[i])
        return (cx + radius * size * math.cos(a), cy - radius * size * math.sin(a))

    outer = [ring(r_out * (1 - wobble) if i % 2 else r_out, i) for i in range(len(angles))]
    inner = [ring(r_in, i) for i in range(len(angles))]
    return outer, inner, angles, cx, cy


def draw_c(size, cx, cy, r_out, r_in, a0, a1, segs, wobble, depth, bevel, gloss):
    """A faceted 3D "C": an annulus sector opening to the right, cut into flat planes."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    outer, inner, angles, cx, cy = c_outline(size, cx, cy, r_out, r_in, a0, a1, segs, wobble)
    mid = [mix(outer[i], inner[i], 0.42) for i in range(len(angles))]

    def tone(x, y):
        return ramp(clamp(0.5 + ((x - cx) - (y - cy)) / (2.0 * r_out * size)))

    quads = []
    for i in range(len(angles) - 1):
        if bevel:
            quads.append(((outer[i], mid[i], mid[i + 1], outer[i + 1]), angles[i], 0))
            quads.append(((mid[i], inner[i], inner[i + 1], mid[i + 1]), angles[i], 1))
        else:
            quads.append(((outer[i], inner[i], inner[i + 1], outer[i + 1]), angles[i], 0))

    if depth:
        dx, dy = size * depth * 0.72, size * depth
        for pts, _, _ in quads:
            d.polygon([(x + dx, y + dy) for x, y in pts], fill=shade(tone(*pts[0]), 0.18) + (255,))

    for pts, a, band in quads:
        base = tone(sum(p[0] for p in pts) / 4, sum(p[1] for p in pts) / 4)
        L = light_at(a, flip=(band == 1))
        k = (0.80 + 0.58 * L) if band == 0 else (0.94 - 0.46 * L)
        d.polygon(pts, fill=shade(base, k) + (255,))

    if gloss:
        rim = Image.new("L", (size, size), 0)
        rd = ImageDraw.Draw(rim)
        for i in range(len(angles) - 1):
            if light_at(angles[i]) > 0.20:
                rd.line([outer[i], outer[i + 1]], fill=255, width=max(1, int(size * 0.0055)))
        white = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        white.putalpha(rim.filter(ImageFilter.GaussianBlur(size * 0.004)).point(lambda v: int(v * 0.8)))
        img = Image.alpha_composite(img, white)
    return img


def drop_shadow(mark, size, dy=0.022, blur=0.016, opacity=0.55):
    a = mark.split()[3].filter(ImageFilter.GaussianBlur(size * blur))
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sh.putalpha(a.point(lambda v: int(v * opacity)))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(sh, (int(size * dy * 0.7), int(size * dy)), sh)
    return Image.alpha_composite(out, mark)


def gradient_shape(size, mask, top, bottom):
    band = Image.new("RGB", (1, size))
    for y in range(size):
        band.putpixel((0, y), tuple(round(v) for v in mix(top, bottom, y / size)))
    g = band.resize((size, size))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(g, (0, 0), mask)
    return out


def concept_prism():
    """A - faceted gem C, extruded, on near-black."""
    size = S * SS
    img = glow_bg(size, [(0.30, 0.26, CYAN, 0.42), (0.76, 0.80, MAGENTA, 0.46),
                         (0.50, 0.50, VIOLET, 0.30)]).convert("RGBA")
    mark = draw_c(size, 0.5, 0.5, 0.325, 0.180, 50, 310, 8, 0.028, 0.014, True, True)
    return Image.alpha_composite(img, drop_shadow(mark, size)).convert("RGB").resize((S, S), Image.LANCZOS)


def concept_play_arc():
    """B - one smooth arc + one play triangle."""
    size = S * SS
    img = glow_bg(size, [(0.50, 0.52, VIOLET, 0.34), (0.22, 0.78, MAGENTA, 0.30),
                         (0.80, 0.22, CYAN, 0.26)]).convert("RGBA")
    mark = draw_c(size, 0.485, 0.5, 0.315, 0.196, 46, 314, 26, 0.0, 0.0, False, False)
    r, cx, cy = size * 0.105, size * 0.492, size * 0.5
    tri = Image.new("L", (size, size), 0)
    ImageDraw.Draw(tri).polygon([(cx - r * 0.58, cy - r), (cx - r * 0.58, cy + r),
                                 (cx + r * 1.05, cy)], fill=255)
    mark = Image.alpha_composite(mark, gradient_shape(size, tri, (0xEF, 0xFC, 0xFF), (0x7A, 0xE6, 0xFF)))
    return Image.alpha_composite(img, drop_shadow(mark, size, 0.016, 0.014, 0.5)).convert("RGB").resize((S, S), Image.LANCZOS)


def concept_slab():
    """C - dark glass squircle tile with the C cut out and neon bleeding through."""
    size = S * SS
    img = glow_bg(size, [(0.5, 0.5, INK, 0.5)]).convert("RGBA")

    mark = draw_c(size, 0.5, 0.5, 0.265, 0.152, 50, 310, 7, 0.0, 0.0, False, False)
    alpha = mark.split()[3].filter(ImageFilter.GaussianBlur(size * 0.002))

    halo = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    halo.paste(mark, (0, 0), alpha.filter(ImageFilter.GaussianBlur(size * 0.030)))
    img = Image.alpha_composite(img, halo)

    pad = size * 0.155
    box = [pad, pad, size - pad, size - pad]
    radius = size * 0.235

    shape = Image.new("L", (size, size), 0)
    ImageDraw.Draw(shape).rounded_rectangle(box, radius=radius, fill=255)

    body = Image.new("L", (1, size), 0)
    for y in range(size):
        body.putpixel((0, y), int(255 * (0.16 + 0.30 * (1 - y / size))))
    slab = Image.composite(Image.new("RGB", (size, size), (0x34, 0x34, 0x3E)),
                           Image.new("RGB", (size, size), (0x14, 0x14, 0x18)),
                           body.resize((size, size)))
    face = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    face.paste(slab, (0, 0), Image.composite(Image.new("L", (size, size), 0), shape, alpha))
    img = Image.alpha_composite(img, face)

    edge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ed = ImageDraw.Draw(edge)
    ed.rounded_rectangle(box, radius=radius, outline=(255, 255, 255, 66), width=max(1, int(size * 0.0026)))
    img = Image.alpha_composite(img, edge)
    img = Image.alpha_composite(img, Image.composite(mark, Image.new("RGBA", (size, size), (0, 0, 0, 0)), alpha))
    return img.convert("RGB").resize((S, S), Image.LANCZOS)


CONCEPTS = [("A - prism", concept_prism), ("B - play-arc", concept_play_arc), ("C - slab", concept_slab)]


def masked(im, kind):
    """Preview under a real launcher mask."""
    s = im.size[0]
    m = Image.new("L", (s, s), 0)
    d = ImageDraw.Draw(m)
    if kind == "circle":
        d.ellipse([0, 0, s - 1, s - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=s * 0.2237, fill=255)
    out = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    out.paste(im.convert("RGBA"), (0, 0), m)
    return out


def contact_sheet(images, path):
    CW, BIG, gap, label = 452, 320, 26, 34
    sizes = (96, 72, 56, 48)
    w = len(images) * CW + gap
    h = label + BIG + gap + 130 + gap + 190
    sheet = Image.new("RGB", (w, h), (0x0B, 0x0B, 0x0D))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 21)
        small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    except OSError:
        font = small = ImageFont.load_default()
    for i, (name, im) in enumerate(images):
        x0 = gap + i * CW
        d.text((x0, 8), name, fill=(0xC8, 0xC8, 0xD0), font=font)
        sheet.paste(im.resize((BIG, BIG), Image.LANCZOS), (x0, label))
        x = x0
        for s in sizes:
            d.text((x, label + BIG + gap), f"{s}px", fill=(0x6B, 0x6B, 0x72), font=small)
            sheet.paste(im.resize((s, s), Image.LANCZOS), (x, label + BIG + gap + 24))
            x += s + 26
        x = x0
        for kind in ("circle", "squircle"):
            d.text((x, label + BIG + gap * 3 + 130), kind, fill=(0x6B, 0x6B, 0x72), font=small)
            sheet.paste(masked(im.resize((104, 104), Image.LANCZOS), kind),
                        (x, label + BIG + gap * 3 + 154), masked(im.resize((104, 104), Image.LANCZOS), kind))
            x += 120
    sheet.save(path)


def mock_sheet(images, path, cell=176):
    """Icons on a fake dark home screen, under the iOS/Android squircle mask."""
    W, H = 1320, 560
    wall = Image.new("RGB", (W, H), (0x09, 0x09, 0x0B))
    layer = Image.new("RGB", (W, H), (0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([-260, -380, 720, 480], fill=(0x0E, 0x3C, 0x4E))
    d.ellipse([640, 180, 1560, 900], fill=(0x40, 0x0D, 0x2C))
    wall = Image.blend(wall, layer.filter(ImageFilter.GaussianBlur(190)), 0.5)
    d = ImageDraw.Draw(wall)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    pitch = cell + 118
    x = (W - (len(images) * pitch - 118)) // 2
    y = (H - cell - 46) // 2
    for name, im in images:
        m = masked(im.resize((cell, cell), Image.LANCZOS), "squircle")
        wall.paste(m, (x, y), m)
        caption = "CHILLERS"
        tw = d.textbbox((0, 0), caption, font=font)
        d.text((x + (cell - (tw[2] - tw[0])) / 2 - tw[0], y + cell + 14), caption,
               fill=(0xEC, 0xEC, 0xEF), font=font)
        nx = d.textbbox((0, 0), name, font=font)
        d.text((x + (cell - (nx[2] - nx[0])) / 2 - nx[0], y - 34), name, fill=(0x7A, 0x7A, 0x84), font=font)
        x += pitch
    wall.save(path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    out = []
    for name, fn in CONCEPTS:
        im = fn()
        im.save(os.path.join(OUT, name.split(" ")[0] + ".png"))
        out.append((name, im))
    contact_sheet(out, os.path.join(OUT, "contact-sheet.png"))
    mock_sheet(out, os.path.join(OUT, "home-screen-mock.png"))
    print("wrote", OUT)
