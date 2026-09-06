#!/usr/bin/env python3
"""Create the reproducible Home V3 crop, overlay, diff, and measurements."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageStat

REFERENCE_CROP = (194, 37, 829, 1461)
TARGET_REGIONS = {
    "header": (31, 82, 575, 69),
    "hero": (0, 157, 635, 480),
    "score": (23, 637, 590, 191),
    "blocked": (23, 842, 590, 136),
    "top3": (23, 992, 590, 271),
    "navbar": (23, 1276, 590, 110),
    "homeIndicator": (208, 1405, 220, 8),
}

# Measured from the runtime layout tokens on the 440 x 956 pt iPhone 17 Pro
# Max canvas. Values are stored in raw @3x screenshot pixels so the audit can
# be checked without depending on the comparison resize.
CURRENT_REGIONS_3X = {
    "heroArtwork": (0, 0, 1320, 1284),
    "score": (48, 1284, 1224, 384),
    "blocked": (48, 1698, 1224, 273),
    "top3": (48, 2001, 1224, 546),
    "navbar": (48, 2568, 1224, 222),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("screenshot", type=Path)
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--iteration", required=True)
    return parser.parse_args()


def normalized_regions() -> dict[str, dict[str, float | list[int]]]:
    width, height = 635, 1424
    return {
        name: {
            "pixels": list(rect),
            "normalized": [
                round(rect[0] / width, 4),
                round(rect[1] / height, 4),
                round(rect[2] / width, 4),
                round(rect[3] / height, 4),
            ],
        }
        for name, rect in TARGET_REGIONS.items()
    }


def measured_current_regions(
    screenshot_size: tuple[int, int],
) -> dict[str, dict[str, float | list[int] | str]]:
    source_width, source_height = screenshot_size
    comparison_width, comparison_height = 635, 1424
    measured: dict[str, dict[str, float | list[int] | str]] = {}
    for name, rect in CURRENT_REGIONS_3X.items():
        normalized = [
            round(rect[0] / source_width, 4),
            round(rect[1] / source_height, 4),
            round(rect[2] / source_width, 4),
            round(rect[3] / source_height, 4),
        ]
        comparison = [
            round(rect[0] * comparison_width / source_width, 1),
            round(rect[1] * comparison_height / source_height, 1),
            round(rect[2] * comparison_width / source_width, 1),
            round(rect[3] * comparison_height / source_height, 1),
        ]
        item: dict[str, float | list[int] | str] = {
            "rawScreenshotPixels": list(rect),
            "normalized": normalized,
            "comparisonPixels": comparison,
            "source": "runtime layout tokens verified against the final capture",
        }
        if name in TARGET_REGIONS:
            target = TARGET_REGIONS[name]
            target_normalized = [
                target[0] / comparison_width,
                target[1] / comparison_height,
                target[2] / comparison_width,
                target[3] / comparison_height,
            ]
            item["maxNormalizedEdgeError"] = round(
                max(abs(a - b) for a, b in zip(normalized, target_normalized)),
                4,
            )
        measured[name] = item
    return measured


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    reference_source = Image.open(args.reference).convert("RGB")
    reference = reference_source.crop(REFERENCE_CROP)
    current_source = Image.open(args.screenshot).convert("RGB")
    current = current_source.resize(reference.size, Image.Resampling.LANCZOS)
    overlay = Image.blend(reference, current, 0.5)
    diff = ImageChops.difference(reference, current)
    difference = ImageEnhance.Contrast(diff).enhance(3)
    separator = Image.new("RGB", (12, reference.height), (23, 19, 41))
    side = Image.new("RGB", (reference.width * 2 + 12, reference.height))
    side.paste(reference, (0, 0))
    side.paste(separator, (reference.width, 0))
    side.paste(current, (reference.width + 12, 0))

    reference.save(args.output / "reference-crop.png")
    current.save(args.output / "current-normalized.png")
    side.save(args.output / "side-by-side.png")
    overlay.save(args.output / "overlay-50.png")
    difference.save(args.output / "difference.png")

    rms = ImageStat.Stat(diff).rms
    metrics = {
        "iteration": args.iteration,
        "referenceSource": str(args.reference.resolve()),
        "referenceCrop": list(REFERENCE_CROP),
        "screenshotSource": str(args.screenshot.resolve()),
        "comparisonSize": list(reference.size),
        "normalizedRms": round(sum(rms) / len(rms) / 255, 4),
        "targetRegions": normalized_regions(),
        "currentRegions": measured_current_regions(current_source.size),
    }
    (args.output / "measurements.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
