#!/usr/bin/env python3
"""Generate repeatable Home V2 visual-comparison artifacts.

Pillow is intentionally a local QA prerequisite rather than an app dependency.
The score ignores the status-bar band by default and is only a signal: visual
review by component remains the source of truth.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageChops, ImageEnhance, ImageStat
except ImportError as error:
    raise SystemExit(
        "Pillow is required for this QA script. Install it in your local Python environment."
    ) from error


DEFAULT_REFERENCE = Path("design/InAPP/Accueil1/HomepounewuserV2.png")
SEPARATOR_WIDTH = 12
SEPARATOR_COLOR = (23, 19, 41)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare a simulator screenshot with the Relock Home V2 reference."
    )
    parser.add_argument("screenshot", type=Path, help="Current simulator PNG")
    parser.add_argument(
        "--reference",
        type=Path,
        default=DEFAULT_REFERENCE,
        help=f"Reference PNG (default: {DEFAULT_REFERENCE})",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Directory receiving artifacts (default: a unique temporary directory)",
    )
    parser.add_argument(
        "--ignore-top-ratio",
        type=float,
        default=0.08,
        help="Top ratio excluded from the numeric score (default: 0.08)",
    )
    args = parser.parse_args()
    if args.output is None:
        args.output = Path(tempfile.mkdtemp(prefix="relock-home-v2-comparison-"))
    return args


def normalize_to_reference(image: Image.Image, reference: Image.Image) -> Image.Image:
    """Scale by width, then crop/pad only at the bottom to preserve top alignment."""
    scale = reference.width / image.width
    resized_height = round(image.height * scale)
    resized = image.resize((reference.width, resized_height), Image.Resampling.LANCZOS)

    if resized.height >= reference.height:
        return resized.crop((0, 0, reference.width, reference.height))

    normalized = Image.new("RGB", reference.size, SEPARATOR_COLOR)
    normalized.paste(resized, (0, 0))
    return normalized


def side_by_side(reference: Image.Image, current: Image.Image) -> Image.Image:
    canvas = Image.new(
        "RGB",
        (reference.width * 2 + SEPARATOR_WIDTH, reference.height),
        SEPARATOR_COLOR,
    )
    canvas.paste(reference, (0, 0))
    canvas.paste(current, (reference.width + SEPARATOR_WIDTH, 0))
    return canvas


def difference_score(diff: Image.Image, ignore_top_ratio: float) -> tuple[float, int]:
    ratio = min(max(ignore_top_ratio, 0), 0.5)
    ignored_pixels = round(diff.height * ratio)
    scored = diff.crop((0, ignored_pixels, diff.width, diff.height))
    rms = ImageStat.Stat(scored).rms
    normalized = sum(rms) / len(rms) / 255
    return normalized, ignored_pixels


def main() -> int:
    args = parse_args()
    if not args.reference.is_file():
        print(f"Reference not found: {args.reference}", file=sys.stderr)
        return 2
    if not args.screenshot.is_file():
        print(f"Screenshot not found: {args.screenshot}", file=sys.stderr)
        return 2

    args.output.mkdir(parents=True, exist_ok=True)
    reference = Image.open(args.reference).convert("RGB")
    current_source = Image.open(args.screenshot).convert("RGB")
    current = normalize_to_reference(current_source, reference)

    diff = ImageChops.difference(reference, current)
    overlay = Image.blend(reference, current, 0.5)
    enhanced_diff = ImageEnhance.Contrast(diff).enhance(3)
    score, ignored_pixels = difference_score(diff, args.ignore_top_ratio)

    outputs = {
        "reference-normalized.png": reference,
        "current-normalized.png": current,
        "side-by-side.png": side_by_side(reference, current),
        "overlay.png": overlay,
        "difference.png": enhanced_diff,
    }
    for filename, image in outputs.items():
        image.save(args.output / filename)

    print(f"Artifacts: {args.output.resolve()}")
    print(f"Ignored status band: {ignored_pixels}px")
    print(f"Normalized RMS signal: {score:.4f} (visual review remains authoritative)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
