#!/usr/bin/env python3
"""Sous-ensemble WOFF2 des quatre graisses Inter du site public.

POURQUOI
Le site servait 4 fichiers TTF complets, 1,63 Mo au total, pour afficher du
texte latin en anglais et en français. Inter embarque le cyrillique, le grec,
le vietnamien et des milliers de glyphes que getrelock.com n'affichera jamais.
Le WOFF2 (Brotli) plus un sous-ensemble latin ramène l'ensemble sous 100 Ko.

GARDE-FOU
Le script refuse de produire un sous-ensemble qui perdrait un caractère
réellement présent dans le HTML ou le CSS du site : il lit toutes les pages,
en extrait les codepoints, et vérifie que chacun survit. Une apostrophe
typographique française absente casserait tout le site en silence — c'est
exactement ce que cette vérification empêche.

    python3 src/legal/seo-relock/tools/build-fonts.py

Dépendance : fontTools + brotli, vendorisés dans seo-relock/vendor/.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SEO = HERE.parent
SITE = SEO.parent  # src/legal
sys.path.insert(0, str(SEO / "vendor"))

from fontTools import subset  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402

FONT_DIR = SITE / "assets" / "fonts"
FACES = [
    ("Inter-Regular.ttf", 400),
    ("Inter-Medium.ttf", 500),
    ("Inter-SemiBold.ttf", 600),
    ("Inter-Bold.ttf", 700),
]

# Latin de base + supplément Latin-1 + Latin étendu A (français complet, y
# compris œ et Œ) + ponctuation générale (’ “ ” – — … •) + quelques symboles
# monétaires et flèches utilisés par l'interface.
UNICODES = (
    "U+0000-00FF,U+0100-017F,U+0180-024F,"
    "U+2000-206F,U+20A0-20BF,U+2122,U+2190-2199,U+2212,U+2713,U+25CF,U+FEFF,U+FFFD"
)


def site_codepoints() -> set[int]:
    """Tous les caractères que le site affiche réellement aujourd'hui."""
    chars: set[int] = set()
    for path in list(SITE.rglob("*.html")) + list(SITE.glob("*.css")):
        if "seo-relock" in path.parts:
            continue
        text = path.read_text(encoding="utf-8")
        # Retirer les balises : un `<` d'attribut n'est pas du texte affiché,
        # mais garder le contenu textuel, y compris celui des attributs alt.
        text = re.sub(r"<[^>]+>", " ", text) if path.suffix == ".html" else text
        chars.update(ord(c) for c in text)
    return {c for c in chars if c > 32}


def covered(unicodes: str) -> set[int]:
    out: set[int] = set()
    for part in unicodes.split(","):
        part = part.removeprefix("U+")
        if "-" in part:
            lo, hi = part.split("-")
            out.update(range(int(lo, 16), int(hi, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def main() -> int:
    wanted = site_codepoints()
    have = covered(UNICODES)
    missing = sorted(wanted - have)
    if missing:
        print("REFUS — ces caractères du site sortent du sous-ensemble :")
        for cp in missing:
            print(f"  U+{cp:04X} {chr(cp)!r}")
        return 1

    total_before = total_after = 0
    for filename, weight in FACES:
        src = FONT_DIR / filename
        dst = src.with_suffix(".woff2")

        font = TTFont(src)
        subsetter = subset.Subsetter(
            options=subset.Options(
                layout_features=["kern", "liga", "clig", "calt", "ccmp", "locl", "mark", "mkmk"],
                # `tnum` alimente `font-variant-numeric: tabular-nums` du site.
                layout_closure=True,
                notdef_outline=True,
                name_IDs=["*"],
                name_legacy=True,
                recommended_glyphs=True,
                drop_tables=["DSIG"],
            )
        )
        subsetter.options.layout_features += ["tnum", "ss01", "cv05"]
        subsetter.populate(unicodes=covered(UNICODES))
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(dst)

        before = src.stat().st_size
        after = dst.stat().st_size
        total_before += before
        total_after += after
        print(f"{filename} ({weight})  {before // 1024} KB → {dst.name} {after // 1024} KB")

    print(f"\ntotal {total_before // 1024} KB → {total_after // 1024} KB")
    print(f"{len(wanted)} caractères du site vérifiés présents dans le sous-ensemble.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
