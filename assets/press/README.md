# assets/press

Les trois visuels de la pile de coupures de presse (`SceneReversal`,
`src/features/onboarding/scenes-verdict.tsx`).

| Fichier | Contenu | Source d'origine |
|---|---|---|
| `meta.jpg` | Logo Meta, silhouette d'une personne au téléphone | image d'agence |
| `zuckerberg.jpg` | Mark Zuckerberg sortant du tribunal | image d'agence |
| `tiktok.jpg` | Logo TikTok, silhouette d'une personne au téléphone | image d'agence |

Chaque visuel est décliné en `nom.jpg` / `nom@2x.jpg` / `nom@3x.jpg` — React
Native choisit la densité tout seul.

**Recadrage** : les fichiers sont rognés au ratio **1.85**, celui de la zone
photo sur les iPhone courants (largeur de carte ≈ écran − 40 pt, hauteur
donnée par `pressPhotoHeight()` dans la scène : 142 → 205 pt selon
l'écran). Le `resizeMode="cover"` absorbe l'écart résiduel d'un modèle à
l'autre. Si tu changes ces bornes, régénère les images au nouveau ratio.

⚠️ **Droits** : ce sont des photos d'agence (Reuters / Getty / AFP au vu du
cadrage). Une image d'agence non licenciée dans l'onboarding d'une app
commerciale est un risque juridique réel — vérifie la licence avant
publication sur l'App Store.
