#!/usr/bin/env python3
"""Build Chrome Web Store screenshots and promo images from UI captures."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "img" / "store"
BG = (21, 23, 28)  # #15171c


def composite_ui(src: Path, canvas_w: int, canvas_h: int, max_fill: float = 0.92) -> Image.Image:
    popup = Image.open(src).convert("RGBA")
    max_w = int(canvas_w * max_fill)
    max_h = int(canvas_h * max_fill)
    scale = min(max_w / popup.width, max_h / popup.height)
    new_w = int(popup.width * scale)
    new_h = int(popup.height * scale)
    popup = popup.resize((new_w, new_h), Image.LANCZOS)

    shadow = Image.new("RGBA", (new_w + 40, new_h + 40), (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.rounded_rectangle([20, 20, new_w + 19, new_h + 19], radius=16, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=12))

    canvas = Image.new("RGB", (canvas_w, canvas_h), BG)
    x = (canvas_w - new_w) // 2
    y = (canvas_h - new_h) // 2
    canvas.paste(shadow, (x - 20, y - 20), shadow)
    canvas.paste(popup, (x, y), popup)
    return canvas


def save_pair(image: Image.Image, stem: str) -> None:
    png_path = OUT_DIR / f"{stem}.png"
    jpg_path = OUT_DIR / f"{stem}.jpg"
    image.save(png_path, "PNG")
    image.save(jpg_path, "JPEG", quality=92, subsampling=0)
    print(f"{stem}: {image.size[0]}x{image.size[1]} RGB -> {png_path.name}, {jpg_path.name}")


def main() -> None:
    sources = [
        ("popup", ROOT / "img" / "Screenshot_example.png"),
        ("settings", ROOT / "img" / "settings_example.png"),
    ]
    sizes = [
        ("screenshot", 1280, 800, 0.90),
        ("promo-small", 440, 280, 0.88),
        ("promo-marquee", 1400, 560, 0.90),
    ]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index = 1
    for label, src in sources:
        if not src.exists():
            raise FileNotFoundError(src)
        for kind, w, h, fill in sizes:
            img = composite_ui(src, w, h, fill)
            if kind == "screenshot":
                stem = f"screenshot-{index:02d}-{label}-{w}x{h}"
                index += 1
            else:
                stem = f"{kind}-{label}-{w}x{h}"
            save_pair(img, stem)


if __name__ == "__main__":
    main()
