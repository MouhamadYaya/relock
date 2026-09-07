#!/usr/bin/env python3
"""Passe les logos universitaires en marques monochromes pour le paywall.

    python3 scripts/build-trust-logos.py

Les fichiers d'origine (`docs/paywall-reference-audit/`) sont en couleur, et
celui de Cambridge porte un fond blanc incrusté. Un `tintColor` côté React
Native ne saurait traiter ni l'un ni l'autre : il aplatit le blason en
silhouette et garde le fond blanc en rectangle plein.

La recette : l'alpha de sortie reçoit l'OBSCURITÉ du trait d'origine, les
pixels passent en blanc. Le blanc du fond devient donc transparent, le trait
sombre devient opaque, et les demi-teintes du blason gardent leur détail. La
marque se pose ensuite telle quelle sur la nuit de la page, à l'opacité que
lui donne `PaywallTrustLogos`.

Régénérer : le fichier de sortie est versionné, ce script ne sert qu'à
retrouver la recette si un logo change.
"""

import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs', 'paywall-reference-audit')
OUT = os.path.join(ROOT, 'assets', 'paywall')

# Hauteur de sortie : ~3× la rangée de 30 pt (`PW.layout.trustLogo`).
HEIGHT = 96

JOBS = [
    ('University_of_Oxford.svg.webp', 'trust-oxford.png'),
    ('Harvard_University_logo.svg.webp', 'trust-harvard.png'),
    ('University_of_Cambridge_logo.png', 'trust-cambridge.png'),
]


def monochrome(path: str) -> Image.Image:
    source = Image.open(path).convert('RGBA')
    red, green, blue, alpha = source.split()
    luminance = Image.merge('RGB', (red, green, blue)).convert('L')
    ink = luminance.point(lambda value: 255 - value)
    # Les zones déjà transparentes le restent : sans ce masque, le noir
    # implicite des pixels vides repasserait en trait opaque.
    opaque = alpha.point(lambda value: 255 if value > 128 else 0)
    cut = Image.composite(ink, Image.new('L', source.size, 0), opaque)
    white = Image.new('L', source.size, 255)
    return Image.merge('RGBA', (white, white, white, cut))


def main() -> None:
    for src, dst in JOBS:
        mark = monochrome(os.path.join(SRC, src))
        # Recadrage sur le contenu : les trois fichiers ont des marges
        # différentes, et la rangée les aligne sur leur hauteur réelle.
        mark = mark.crop(mark.getbbox())
        width = round(mark.width * HEIGHT / mark.height)
        mark = mark.resize((width, HEIGHT), Image.LANCZOS)
        mark.save(os.path.join(OUT, dst))
        print(f'{dst} {mark.size[0]}×{mark.size[1]}')


if __name__ == '__main__':
    main()
