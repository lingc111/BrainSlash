from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


CANVAS = 384


def normalize_name(name: str) -> str:
    return name.replace("green__square", "green_square")


def remove_connected_black_background(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    values = np.asarray(rgb, dtype=np.uint8)
    brightness = Image.fromarray(values.max(axis=2), "L")

    # Generated RGB assets use a near-black canvas. Flood only the dark region
    # connected to the canvas edge so enclosed black marker lines stay opaque.
    connected = brightness.copy()
    for seed in ((0, 0), (connected.width - 1, 0), (0, connected.height - 1),
                 (connected.width - 1, connected.height - 1)):
        ImageDraw.floodfill(connected, seed, 255, thresh=48)
    connected_values = np.asarray(connected, dtype=np.uint8)
    original_brightness = np.asarray(brightness, dtype=np.uint8)
    background = connected_values == 255
    alpha = np.full(original_brightness.shape, 255, dtype=np.uint8)
    feather = np.clip((original_brightness.astype(np.int16) - 8) * 255 // 40, 0, 255).astype(np.uint8)
    alpha[background] = feather[background]

    rgba = np.dstack((values, alpha))
    return Image.fromarray(rgba, "RGBA")


def resize_premultiplied(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32)
    alpha = rgba[:, :, 3:4] / 255.0
    premultiplied = np.concatenate((rgba[:, :, :3] * alpha, rgba[:, :, 3:4]), axis=2)
    resized = np.asarray(
        Image.fromarray(np.rint(premultiplied).astype(np.uint8), "RGBA").resize(
            (CANVAS, CANVAS), Image.Resampling.LANCZOS
        ),
        dtype=np.float32,
    )
    resized_alpha = resized[:, :, 3:4]
    rgb = np.divide(
        resized[:, :, :3] * 255.0,
        resized_alpha,
        out=np.zeros_like(resized[:, :, :3]),
        where=resized_alpha > 0,
    )
    return Image.fromarray(np.rint(np.concatenate((rgb, resized_alpha), axis=2)).clip(0, 255).astype(np.uint8), "RGBA")


def process(source: Path, destination: Path) -> tuple[int, int, int, int]:
    with Image.open(source) as opened:
        rgba = opened.convert("RGBA") if "A" in opened.getbands() else remove_connected_black_background(opened)
    result = resize_premultiplied(rgba)
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination, "PNG", optimize=True, compress_level=9)
    bbox = result.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError(f"No visible pixels after processing {source}")
    return bbox


def meta_for(name: str, bbox: tuple[int, int, int, int]) -> dict:
    image_uuid = str(uuid.uuid4())
    x0, y0, x1, y1 = bbox
    width, height = x1 - x0, y1 - y0
    offset_x = (x0 + x1 - CANVAS) / 2
    offset_y = (CANVAS - y0 - y1) / 2
    return {
        "ver": "1.0.27", "importer": "image", "imported": True,
        "uuid": image_uuid, "files": [".json", ".png"],
        "subMetas": {
            "6c48a": {
                "importer": "texture", "uuid": f"{image_uuid}@6c48a", "displayName": name,
                "id": "6c48a", "name": "texture",
                "userData": {
                    "wrapModeS": "clamp-to-edge", "wrapModeT": "clamp-to-edge",
                    "imageUuidOrDatabaseUri": image_uuid, "isUuid": True, "visible": False,
                    "minfilter": "linear", "magfilter": "linear", "mipfilter": "none", "anisotropy": 0,
                },
                "ver": "1.0.22", "imported": True, "files": [".json"], "subMetas": {},
            },
            "f9941": {
                "importer": "sprite-frame", "uuid": f"{image_uuid}@f9941", "displayName": name,
                "id": "f9941", "name": "spriteFrame",
                "userData": {
                    "trimThreshold": 1, "rotated": False, "offsetX": offset_x, "offsetY": offset_y,
                    "trimX": x0, "trimY": y0, "width": width, "height": height,
                    "rawWidth": CANVAS, "rawHeight": CANVAS,
                    "borderTop": 0, "borderBottom": 0, "borderLeft": 0, "borderRight": 0,
                    "packable": True, "pixelsToUnit": 100, "pivotX": 0.5, "pivotY": 0.5,
                    "meshType": 0,
                    "vertices": {
                        "rawPosition": [-width / 2, -height / 2, 0, width / 2, -height / 2, 0,
                                        -width / 2, height / 2, 0, width / 2, height / 2, 0],
                        "indexes": [0, 1, 2, 2, 1, 3],
                        "uv": [x0, y1, x1, y1, x0, y0, x1, y0],
                        "nuv": [x0 / CANVAS, y0 / CANVAS, x1 / CANVAS, y0 / CANVAS,
                                x0 / CANVAS, y1 / CANVAS, x1 / CANVAS, y1 / CANVAS],
                        "minPos": [-width / 2, -height / 2, 0], "maxPos": [width / 2, height / 2, 0],
                    },
                    "isUuid": True, "imageUuidOrDatabaseUri": f"{image_uuid}@6c48a",
                    "atlasUuid": "", "trimType": "auto",
                },
                "ver": "1.0.12", "imported": True, "files": [".json"], "subMetas": {},
            },
        },
        "userData": {"type": "sprite-frame", "fixAlphaTransparencyArtifacts": False,
                     "hasAlpha": True, "redirect": f"{image_uuid}@6c48a"},
    }


def write_asset(source: Path, destination: Path) -> None:
    bbox = process(source, destination)
    destination.with_suffix(destination.suffix + ".meta").write_text(
        json.dumps(meta_for(destination.stem, bbox), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def clean_assets(directory: Path, allowed_stems: set[str]) -> None:
    expected = directory.resolve()
    for path in directory.iterdir():
        if path.is_file() and path.suffix in {".png", ".meta"}:
            stem = path.name.removesuffix(".png.meta").removesuffix(".png")
            if stem not in allowed_stems:
                if path.resolve().parent != expected:
                    raise RuntimeError(f"Refusing to remove unexpected path {path}")
                path.unlink()


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("usage: import-gameplay-art.py SOURCE_TARGETS SOURCE_EFFECTS TARGET_DIR EFFECT_DIR")
    source_targets, source_effects, target_dir, effect_dir = map(Path, sys.argv[1:])
    target_sources = {
        normalize_name(path.stem): path
        for path in source_targets.glob("*.png")
        if normalize_name(path.stem).endswith(("_square", "_circle", "_hexagon"))
    }
    target_names = set(target_sources)
    effect_sources = {normalize_name(path.stem): path for path in source_effects.glob("*.png")}
    effect_names = {f"{name}_slash" for name in target_names} | {"bomb_slash"}
    missing = sorted(name for name in effect_names if name not in effect_sources)
    if missing:
        raise RuntimeError(f"Missing slash effects: {missing}")

    clean_assets(target_dir, target_names | {"bomb"})
    clean_assets(effect_dir, effect_names)
    for name, source in sorted(target_sources.items()):
        write_asset(source, target_dir / f"{name}.png")
    for name in sorted(effect_names):
        write_asset(effect_sources[name], effect_dir / f"{name}.png")
    print(f"Imported {len(target_names)} targets and {len(effect_names)} slash effects")


if __name__ == "__main__":
    main()
