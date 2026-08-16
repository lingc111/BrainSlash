from __future__ import annotations

import math
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "resources" / "textures" / "home" / "paper"
SOURCE = ROOT / "tools" / "art-source" / "paper-grain-master.png"
SCALE = 4
SEED = 260816


def paper_tile(size: int = 512) -> Image.Image:
    source = Image.open(SOURCE).convert("RGB")
    source = ImageOps.fit(source, (size // 2, size // 2), method=Image.Resampling.LANCZOS)
    source = source.filter(ImageFilter.GaussianBlur(1.2))
    source = ImageOps.grayscale(source)
    source = ImageOps.autocontrast(source, cutoff=4)
    source = source.point(lambda value: 128 + (value - 128) * 0.12)
    top = Image.new("L", (size, size // 2))
    top.paste(source, (0, 0))
    top.paste(ImageOps.mirror(source), (size // 2, 0))
    tiled = Image.new("L", (size, size))
    tiled.paste(top, (0, 0))
    tiled.paste(ImageOps.flip(top), (0, size // 2))
    return tiled.filter(ImageFilter.GaussianBlur(0.35))


GRAIN = paper_tile()


def texture(size: tuple[int, int], color: tuple[int, int, int], strength: float = 0.16) -> Image.Image:
    grain = Image.new("L", size)
    tile_w, tile_h = GRAIN.size
    for y in range(0, size[1], tile_h):
        for x in range(0, size[0], tile_w):
            grain.paste(GRAIN, (x, y))
    base = Image.new("RGB", size, color)
    gray = Image.merge("RGB", (grain, grain, grain))
    soft = Image.blend(Image.new("RGB", size, (128, 128, 128)), gray, strength)
    return ImageChops.multiply(base, soft.point(lambda value: min(255, value * 2)))


def antialiased_mask(size: tuple[int, int], points: list[tuple[float, float]]) -> Image.Image:
    large = Image.new("L", (size[0] * SCALE, size[1] * SCALE), 0)
    draw = ImageDraw.Draw(large)
    draw.polygon([(round(x * SCALE), round(y * SCALE)) for x, y in points], fill=255)
    return large.resize(size, Image.Resampling.LANCZOS)


def composite_shape(
    size: tuple[int, int],
    points: list[tuple[float, float]],
    color: tuple[int, int, int],
    grain_strength: float = 0.16,
    edge: tuple[int, int, int, int] = (91, 82, 72, 70),
) -> tuple[Image.Image, Image.Image]:
    mask = antialiased_mask(size, points)
    result = Image.new("RGBA", size, (0, 0, 0, 0))
    surface = texture(size, color, grain_strength).convert("RGBA")
    result.alpha_composite(Image.composite(surface, Image.new("RGBA", size), mask))
    inner = mask.filter(ImageFilter.MinFilter(3))
    outline = ImageChops.subtract(mask, inner)
    edge_layer = Image.new("RGBA", size, edge)
    result.alpha_composite(Image.composite(edge_layer, Image.new("RGBA", size), outline))
    return result, mask


def save_graph_paper() -> None:
    size = 512
    image = texture((size, size), (247, 243, 234), 0.12).convert("RGBA")
    grid_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(grid_layer, "RGBA")
    spacing = 64
    for pos in range(0, size + 1, spacing):
        draw.line((pos, 0, pos, size), fill=(116, 140, 151, 22), width=1)
        draw.line((0, pos, size, pos), fill=(116, 140, 151, 22), width=1)
    image = Image.alpha_composite(image, grid_layer)
    image.save(OUTPUT / "bg_graph_paper.png", optimize=True)


def save_daily() -> None:
    size = (850, 560)
    points = [(25, 22), (142, 17), (278, 23), (430, 16), (596, 22), (826, 28),
              (830, 142), (826, 274), (833, 404), (819, 529), (670, 535), (503, 529),
              (344, 539), (184, 531), (28, 539), (22, 418), (27, 281), (18, 145)]
    image, mask = composite_shape(size, points, (248, 245, 236), 0.17)
    lines = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(lines, "RGBA")
    for y in range(78, 526, 47):
        draw.line((30, y, 820, y), fill=(89, 130, 151, 35), width=2)
    draw.line((112, 28, 112, 532), fill=(173, 92, 86, 28), width=2)
    lines.putalpha(ImageChops.multiply(lines.getchannel("A"), mask))
    image.alpha_composite(lines)
    holes = Image.new("L", size, 0)
    hdraw = ImageDraw.Draw(holes)
    for y in range(92, 493, 64):
        hdraw.ellipse((35, y - 11, 57, y + 11), fill=255)
    alpha = ImageChops.subtract(image.getchannel("A"), holes)
    image.putalpha(alpha)
    image.save(OUTPUT / "daily_paper.png", optimize=True)


def save_tape(name: str, size: tuple[int, int], color: tuple[int, int, int], alpha: int) -> None:
    w, h = size
    points = [(8, 13), (18, 8), (w - 19, 11), (w - 7, 17), (w - 13, h - 12),
              (w - 25, h - 7), (17, h - 10), (7, h - 17)]
    image, mask = composite_shape(size, points, color, 0.22, (90, 72, 50, 30))
    image.putalpha(mask.point(lambda value: round(value * alpha / 255)))
    image.save(OUTPUT / name, optimize=True)


def save_brush() -> None:
    size = (600, 110)
    rng = random.Random(SEED)
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    for index, y in enumerate((25, 48, 70)):
        top = y - 18
        bottom = y + 18
        pts = [(12 + index * 8, y), (27, top + rng.randint(-3, 4)), (260, top),
               (565 - index * 5, top + rng.randint(-4, 4)), (592 - index * 6, y + rng.randint(-3, 3)),
               (568, bottom + rng.randint(-3, 3)), (238, bottom), (25, bottom + rng.randint(-4, 3))]
        draw.polygon(pts, fill=185 if index != 1 else 235)
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    surface = texture(size, (220, 123, 39), 0.12).convert("RGBA")
    surface.putalpha(mask)
    surface.save(OUTPUT / "brush_orange.png", optimize=True)


def save_brawl() -> None:
    size = (850, 250)
    points = [(17, 39), (52, 25), (188, 31), (348, 22), (511, 27), (694, 23), (831, 35),
              (820, 66), (836, 92), (816, 124), (837, 153), (815, 183), (827, 219),
              (681, 226), (532, 221), (361, 229), (191, 220), (27, 224), (37, 190),
              (16, 161), (35, 129), (15, 96), (34, 68)]
    image, _ = composite_shape(size, points, (226, 181, 60), 0.19, (90, 72, 42, 70))
    image.save(OUTPUT / "brawl_yellow_paper.png", optimize=True)


def save_sticky() -> None:
    size = (380, 350)
    points = [(18, 20), (357, 25), (361, 278), (317, 330), (174, 324), (22, 333), (17, 176)]
    image, mask = composite_shape(size, points, (239, 190, 199), 0.17)
    fold = Image.new("RGBA", size, (0, 0, 0, 0))
    fdraw = ImageDraw.Draw(fold, "RGBA")
    fdraw.polygon([(317, 330), (361, 278), (353, 325)], fill=(252, 222, 224, 225))
    fdraw.line([(317, 330), (361, 278)], fill=(116, 83, 82, 65), width=2)
    fold.putalpha(ImageChops.multiply(fold.getchannel("A"), mask))
    image.alpha_composite(fold)
    image.save(OUTPUT / "sticky_pink.png", optimize=True)


def save_polaroid() -> None:
    size = (350, 380)
    points = [(20, 18), (330, 23), (334, 357), (185, 362), (17, 353), (22, 165)]
    image, mask = composite_shape(size, points, (247, 244, 235), 0.15)
    photo = Image.new("RGBA", size, (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(photo, "RGBA")
    pdraw.rectangle((48, 55, 303, 239), fill=(187, 207, 211, 105), outline=(83, 83, 77, 80), width=2)
    photo.putalpha(ImageChops.multiply(photo.getchannel("A"), mask))
    image.alpha_composite(photo)
    image.save(OUTPUT / "polaroid_paper.png", optimize=True)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    save_graph_paper()
    save_daily()
    save_tape("tape_red.png", (320, 90), (157, 67, 59), 205)
    save_tape("tape_beige.png", (220, 80), (210, 181, 130), 190)
    save_brush()
    save_brawl()
    save_sticky()
    save_polaroid()
    for path in sorted(OUTPUT.glob("*.png")):
        with Image.open(path) as image:
            print(f"{path.name}: {image.size} {image.mode} alpha={image.getchannel('A').getextrema()}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(exc, file=sys.stderr)
        raise
