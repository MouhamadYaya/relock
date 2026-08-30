# Home V2 — audit de fidélité visuelle

## Références et méthode

- Référence : `design/InAPP/Accueil1/HomepounewuserV2.png`
- Baseline avant modification : `/tmp/relock-home-v2-before.png`
- Implémentation finale : `/tmp/relock-home-v2-iphone17-final.png`
- Second format : `/tmp/relock-home-v2-iphone17-pro-max-final.png`
- Comparaison finale : `/tmp/relock-home-v2-comparison-final/side-by-side.png`
- Signal RMS normalisé final : `0.1903` (status bar exclue sur 8 % de la hauteur)
- Outil : `python3 scripts/compare-home-v2.py <capture.png>`
- Périmètre protégé : logique métier, routes et navigation native inchangées.

Le score d'image n'est pas une condition de réussite. L'audit se fait visuellement par composant, après exclusion prudente de la status bar, de l'heure, de la batterie, du Wi-Fi, de la Dynamic Island et des différences de rasterisation.

## Checklist de fidélité

Les cases ne passent à `[x]` qu'après capture et vérification visuelle. L'état final doit être accompagné des appareils et écarts restants ci-dessous.

- [x] Background nocturne correct
- [x] Lumière ambiante correcte et presque imperceptible
- [x] Position et échelle du logo correctes
- [x] Position et échelle flamme/réglages correctes lorsque la série est visible
- [x] Titre de bienvenue correct
- [x] Sous-titre de bienvenue correct
- [x] Géométrie du hero correcte
- [x] Matière du hero correcte
- [x] Échelle de la lune correcte
- [x] Position de la lune correcte
- [x] Bloom lunaire correct
- [x] Typographie du titre hero correcte
- [x] Description hero correcte
- [x] Géométrie du CTA correcte
- [x] Gradient du CTA correct
- [x] Glow et feedback tactile du CTA corrects
- [x] Géométrie du panneau Actions rapides correcte
- [x] Titre Actions rapides correct
- [x] Matière Focus correcte
- [x] Matière Repos correcte
- [x] Matière Réseaux limités correcte
- [x] Décorations secondaires correctement fondues
- [x] Intensité des bordures correcte
- [x] Ombres et profondeur correctes
- [x] Espacement global correct
- [x] Hiérarchie visuelle correcte
- [x] Navigation native non régressée
- [ ] Géométrie de navigation fidèle à la référence — hors périmètre, composant volontairement inchangé
- [ ] Matière de l'état sélectionné fidèle à la référence — hors périmètre
- [ ] États inactifs fidèles à la référence — hors périmètre
- [x] Cibles tactiles et labels accessibles vérifiés
- [x] Premier format iPhone vérifié
- [x] Deuxième format iPhone vérifié

## Relevé par composant

| Zone | Géométrie/alignement | Matière/lumière | Typographie/contraste | État |
|---|---|---|---|---|
| Background | Plein écran sous safe area | Canvas bleu-noir + indigo diffus | Sans objet | Vérifié sur 2 formats |
| Header/logo | Ligne fluide, actions ≥ 44 pt | Sans container visible | Wordmark prioritaire | Vérifié |
| Flamme/réglages | Alignés optiquement à droite | Flamme émotionnelle conditionnée au streak, réglage fonctionnel | Contraste haut | Vérifié; flamme absente si streak = 0 |
| Welcome | Colonne alignée au contenu | Sans surface | Violet rare + secondaire froid | Vérifié |
| Hero | Hauteur responsive 300–323 pt, rayon hero | Gradient sombre, rim et ombre diffuse | Titre fort, description secondaire | Vérifié |
| Lune | Décor absolu à droite | Asset dimensionnel + bloom local | Sans objet | Vérifié sans collision |
| CTA | 54 pt, rayon button, flèche à droite | Gradient violet-indigo + glow | Texte sombre à contraste fort | Vérifié visuellement et par test de route |
| Panneau rapide | Surface englobante discrète | Niveau 1, contour faible | Titre haut contraste | Vérifié |
| Focus | Hauteur responsive ≤ 72 pt | Niveau 2, étoile fondue | Titre > détail | Vérifié |
| Repos | Hauteur responsive ≤ 72 pt | Niveau 2, nuages fondus | Titre > détail | Vérifié |
| Réseaux | Hauteur responsive ≤ 72 pt | Niveau 2, grille secondaire | Titre > détail | Vérifié |
| Navigation | Composant natif existant | Hors modification Home V2 | États existants préservés | Non régressé, mais différent de la référence |

## Appareils vérifiés

| Appareil | Résolution de capture | Résultat | Capture |
|---|---:|---|---|
| iPhone 17 | 1206 × 2622 | Composition alignée, aucun chevauchement, rail complet | `/tmp/relock-home-v2-iphone17-final.png` |
| iPhone 17 Pro Max | 1320 × 2868 | Ratios capés correctement, aucun chevauchement, espace bas naturel | `/tmp/relock-home-v2-iphone17-pro-max-final.png` |

## Écarts restants

1. La navigation native reste visiblement différente de la référence : matière active grise plutôt que violet lumineux, proportions du sélecteur et iconographie différentes. Elle n'a pas été modifiée conformément à l'instruction explicite de préserver la navigation existante.
2. La flamme de série est conditionnée par la logique courante (`stats.streak > 0`). La référence la montre; un compte neuf à streak nul ne l'affiche volontairement.
3. Le bloom lunaire et le grain atmosphérique de la référence générée sont légèrement plus riches; l'implémentation privilégie un rendu SVG déterministe et plus retenu.
4. La graisse et le raster de quelques libellés diffèrent légèrement de l'image générée, surtout le titre Actions rapides. Les tokens utilisent les fontes natives réelles du produit.
5. La status bar, l'heure, la Dynamic Island, le Wi-Fi et la batterie diffèrent selon le simulateur et sont exclus du jugement UI.
6. Le Pro Max laisse davantage d'espace négatif sous le panneau rapide à cause de sa hauteur d'écran; les composants conservent leurs proportions et la navigation reste ancrée à la safe area.
