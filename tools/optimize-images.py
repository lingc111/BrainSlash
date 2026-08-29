from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


# Cocos may calculate an unstable trimmed SpriteFrame for these indexed-alpha PNGs.
PALETTE_EXCLUSIONS = {"bomb.png", "bomb_slash.png"}


def average_channel_rms(left: Image.Image, right: Image.Image) -> float:
    difference = ImageChops.difference(left.convert("RGBA"), right.convert("RGBA"))
    return sum(ImageStat.Stat(difference).rms) / 4


def optimize_png(
    path: Path, palette_colors: int | None, max_rms: float
) -> tuple[int, int, bool]:
    before = path.stat().st_size
    temporary = path.with_name(f".{path.name}.optimize.tmp")

    try:
        with Image.open(path) as source:
            source.load()
            expected_size = source.size
            encoded = source
            if palette_colors is not None and path.name not in PALETTE_EXCLUSIONS:
                encoded = source.convert("RGBA").quantize(
                    colors=palette_colors,
                    method=Image.Quantize.FASTOCTREE,
                    dither=Image.Dither.FLOYDSTEINBERG,
                )
                if average_channel_rms(source, encoded) > max_rms:
                    return before, before, True
            save_options: dict[str, object] = {
                "format": "PNG",
                "optimize": True,
                "compress_level": 9,
            }
            if "icc_profile" in source.info:
                save_options["icc_profile"] = source.info["icc_profile"]
            if "dpi" in source.info:
                save_options["dpi"] = source.info["dpi"]
            if "transparency" in source.info:
                save_options["transparency"] = source.info["transparency"]
            encoded.save(temporary, **save_options)

        with Image.open(temporary) as optimized:
            optimized.load()
            actual_size = optimized.size
        if actual_size != expected_size:
            raise RuntimeError(
                f"image dimensions changed: {expected_size} -> {actual_size}"
            )

        after = temporary.stat().st_size
        if after < before:
            os.replace(temporary, path)
            return before, after, False
        temporary.unlink()
        return before, before, False
    finally:
        temporary.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Optimize project PNG assets.")
    parser.add_argument("root", nargs="?", default="assets", type=Path)
    parser.add_argument(
        "--palette-colors",
        type=int,
        choices=range(2, 257),
        metavar="2..256",
        help="Also use indexed color when it stays within the RMS threshold.",
    )
    parser.add_argument(
        "--max-rms",
        type=float,
        default=4.0,
        help="Maximum average per-channel pixel RMS for palette conversion.",
    )
    args = parser.parse_args()

    pngs = sorted(args.root.rglob("*.png"))
    original_total = 0
    optimized_total = 0
    changed = 0
    quality_skipped = 0

    for png in pngs:
        before, after, skipped = optimize_png(
            png, args.palette_colors, args.max_rms
        )
        original_total += before
        optimized_total += after
        quality_skipped += skipped
        if after < before:
            changed += 1
            saved_kib = (before - after) / 1024
            print(f"{saved_kib:8.1f} KiB  {png.as_posix()}")

    saved = original_total - optimized_total
    print(
        f"Optimized {changed}/{len(pngs)} PNGs: "
        f"{original_total / 1024 / 1024:.2f} MiB -> "
        f"{optimized_total / 1024 / 1024:.2f} MiB "
        f"(saved {saved / 1024 / 1024:.2f} MiB, "
        f"{saved / original_total * 100 if original_total else 0:.1f}%, "
        f"quality-skipped {quality_skipped})."
    )


if __name__ == "__main__":
    main()
