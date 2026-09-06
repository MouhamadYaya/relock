# Assets photo du paywall

Des atlas plutôt que des fichiers séparés : une seule décompression, un seul
cache, et surtout un **étalonnage commun** — c'est ce qui fait que les photos
appartiennent à la même scène.

Le code découpe par fraction (`CELL` dans `PaywallArtwork.tsx`) : un décalage
d'une case casse tous les cadrages. **Régénérer un atlas = remplacer le
fichier à dimensions et grille identiques.**

## Ce que le code utilise VRAIMENT

| Fichier | Case | Où |
|---|---|---|
| `relock-plan-mosaic-v2.png` (1254², 2 × 2) | haut-gauche · bureau, lampe | grille des formules, tuile 1 |
| | bas-gauche · carnet ouvert | grille des formules, tuile 2 |
| | bas-droite · appareil photo, tirages | grille des formules, tuile 3 **+** vignette « présent » |
| | haut-droite · lit défait, nuit | grille des formules, tuile 4 |
| `relock-benefits-v2.png` (1254², 2 en haut / 3 en bas) | haut-gauche · nuit, téléphone | photo « Avant » |
| | bas-droite · matin, à deux | photo « Après » |
| | bas-gauche · écriture, téléphone retourné | vignette « concentration » |
| | bas-milieu · casque, livre | vignette « attention » |
| `reference-moons.png` (1774 × 887, 2 × 1) | gauche · lune pleine | motif d'angle du champ violet |
| `assets/moon.png` | — | emblème de la feuille d'offre (`PaywallMark`) |

Ne servent plus à rien : `relock-offer-bg-v2.png`, `reference-tiles.png`,
`reference-benefits.png`, `reference-hourglass.png`, et la case droite de
`reference-moons.png`.

## ⚠️ L'asset à refaire en priorité : `relock-plan-mosaic-v2.png`

**C'est le seul vrai écart restant avec la référence.**

Le gabarit est bon — quatre cases, une grille 2 × 2, le premier tiers de
l'écran — mais les quatre photos actuelles sont **quatre natures mortes
nocturnes** : bureau éteint, carnet, appareil photo, lit défait. Elles
racontent la nuit et l'absence, c'est-à-dire *le problème*. Sur l'écran où
l'on choisit son abonnement, elles devraient raconter *ce qu'on achète*. À
20 % de zoom, la référence a un bloc clair et vivant là où Relock a un bloc
sombre et inerte.

La case « lit défait, nuit » (haut-droite) est la plus fausse des quatre :
elle appartient à l'écran Avant/Après, pas à l'écran des formules.

En attendant, l'atlas existant sert de **placeholder correctement
dimensionné** : la grille, les cadrages et le voile sont déjà réglés, un
remplacement à dimensions identiques suffit.

> Photographic sprite atlas, 1254 × 1254, exactly four equal square cells in
> a 2 × 2 grid, no gutter, no rounded corners, no text. Four scenes of a life
> reclaimed from the screen, all shot in the same warm natural light, same
> camera, same grade — bright enough to read as a light block at thumbnail
> size. TOP-LEFT: two people talking over coffee at a sunlit kitchen table,
> no phones in frame. TOP-RIGHT: a person walking outdoors in early morning
> light, seen from behind, open landscape. BOTTOM-LEFT: hands cooking on a
> wooden counter, herbs and daylight from a window. BOTTOM-RIGHT: a person
> reading in an armchair by a bright window, relaxed posture. Realistic
> available light, shallow depth of field, film grain, matte surfaces. Keep
> every subject in the upper two thirds of its cell. No screens, no phones,
> no laptops, no UI, no glossy plastic, no neon, no perfect symmetry, no
> centred cut-out subject.

## Ce que l'app ajoute par-dessus (à ne PAS peindre dans la source)

`PhotoScrim` pose un voile neutre, plus dense en pied. Il est appliqué à
**42 %** sur les tuiles et à **45 %** sur la photo « Après » — beaucoup moins
que sur la photo « Avant » (100 %), et c'est délibéré : à luminosité égale,
le diptyque ne démontre rien.

Conséquences pour la génération :

- **le sujet vit dans les deux tiers hauts** de la case ;
- **ne pas assombrir la source** : le voile s'en charge, et une source déjà
  sombre donne un rectangle noir — c'est exactement le défaut de l'atlas des
  formules aujourd'hui.

## Le diptyque Avant / Après — la contrainte qui compte

La transformation doit se comprendre **sans lire les libellés**.

- *Avant* : la nuit, seul, le visage éclairé par l'écran, lumière bleutée.
- *Après* : **le même homme**, en lumière naturelle — matin, extérieur ou vie
  sociale. Nettement plus clair, ouvert, actif.

Les deux cases actuelles remplissent le contrat (même homme, même garde-robe,
nuit puis petit déjeuner à deux). Si l'atlas est régénéré, c'est la seule
contrainte à ne pas perdre.

> One photographic sprite atlas, two equal square panels side by side,
> landscape 2:1, no gutter. Same man, same face, same wardrobe in both.
> LEFT: night, alone, sitting on the edge of an unmade bed in a dark
> blue-black room, face lit only by the phone in his hands, shoulders
> hunched. RIGHT: morning, the same man in warm natural daylight, talking
> and laughing with someone across a breakfast table, phone nowhere in
> sight, open and relaxed. The right panel must read clearly BRIGHTER than
> the left at a glance. Realistic available light, shallow depth of field,
> film grain. No text, no UI, no charts, no stars, no phone frame.

## Direction artistique

Nuit bleu-noir pour les scènes « avant », lumière naturelle franche pour les
scènes « après » et pour les formules. À éviter absolument, parce que c'est
ce qui signe l'image générée : plastique lustré, reflets impossibles,
symétrie parfaite, néon violet saturé, sujet centré et détouré. Chercher au
contraire une photo tenue à la main : profondeur de champ courte, grain, un
seul foyer lumineux hors champ.

## `reference-moons.png`

> Lunar sprite atlas, 1774 × 887, two equal square cells side by side, flat
> solid `#06090D` background everywhere outside the spheres (no transparency,
> no checkerboard). LEFT: a full moon, mostly shadowed blue-black surface,
> fine craters, pale lavender light along the lower-left curvature. RIGHT: the
> same sphere as a left-facing crescent, the lit edge a thin lavender arc
> fading into near-black. Both spheres centred with a 5 % margin, identical
> size. No external glow, no stars, no text.
