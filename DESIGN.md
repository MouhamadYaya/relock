# Design

Système visuel de **Blocus** — app iOS de lutte contre le scroll compulsif. Dark-first, premium, inspiré du soin visuel d'Opal. Ce document capture les tokens réels du starter (`src/shared/theme`) et marque les **cibles** (raffinements vers le niveau Opal). Il est la référence pour toute génération d'écran : les variantes doivent rester sur cette base.

## Theme & Mood

Sombre par défaut (le clair reste supporté, à parité structurelle). Ambiance : nuit calme, near-black profond, un seul accent lavande-indigo vibrant qui guide l'œil. Minimal, respirant, aucun bruit visuel. Le ton visuel reste posé même quand le message textuel est cash (« 4 h 12 sur TikTok ») : la confrontation passe par la donnée et la typographie, jamais par une esthétique agressive ou anxiogène. Références : Opal (profondeur, minimalisme, accent unique). Anti-références : dashboards corporate froids, écrans denses type usine à gaz.

## Color

Palette sémantique OKLCH-pensée (valeurs hex issues des tokens existants). L'accent lavande-indigo est la seule couleur de marque — tout le reste est neutre near-black tinté ~228°.

### Dark (défaut)

- `background` `#0B0C10` — near-black tinté cool, jamais pur #000
- `backgroundSecondary` `#101218`
- `surface` `#161821` — cartes, sheets
- `surfaceSecondary` `#1C1F2B` — surfaces imbriquées (éviter d'empiler)
- `textPrimary` `#F0F0F4` (≥15:1 sur background, AAA)
- `textSecondary` `#A8ABBE`
- `textTertiary` `#6B6F82` (min AA sur background)
- `primary` `#A49AFE` — accent lavande-indigo, couleur signature
- `primaryHover` `#8E82F0` · `primaryActive` `#7468DB` · `onPrimary` `#0B0C10`
- `success` `#4ADE80` · `danger` `#FB7185` · `warning` `#FBBF24` · `info` `#60A5FA`
- `border` `rgba(148,152,178,0.16)` · `divider` `rgba(148,152,178,0.08)`
- Overlays : `light .04` → `medium .08` → `heavy .14` → `backdrop rgba(0,0,0,.60)`
- `primaryAmbient` `rgba(164,154,254,0.14)` — wash de marque (halo, focus, sélection)

### Light (secondaire)

- `background` `#F6F7FA` · `surface` `#FFFFFF` · `surfaceSecondary` `#F2F3F7`
- `textPrimary` `#111318` · `textSecondary` `#4A4D5C` · `textTertiary` `#7C7F91`
- `primary` `#5247E6` (assombri pour ≥4.5:1 sur blanc) · `onPrimary` `#FFFFFF`
- États : `success #16A34A` · `danger #E11D48` · `warning #D97706` · `info #2563EB`

### Règles couleur

- Un seul accent. Ne pas introduire de 2e couleur de marque ; la richesse vient des neutres et de l'espace.
- Réserver `primary` aux actions et à la donnée saillante (chiffre clé, barre de progression, état actif). Pas de aplats violets décoratifs.
- Les surfaces se distinguent par le tint-shift, pas par des ombres lourdes (sur dark, l'élévation = surface plus claire, pas une drop-shadow visible).
- **Bannis** (voir règles globales) : texte en dégradé, bordure-accent latérale, glassmorphism décoratif.

## Typography

Une seule famille : **Inter** (Regular/Medium/SemiBold/Bold). Mono : **JetBrains Mono** (valeurs techniques uniquement). Pas de pairing — la hiérarchie vient du poids et de la taille.

Échelle sémantique (px, actuelle) :
- Display : `displayLarge 34/42 SemiBold` · `displayMedium 30/38` · `displaySmall 26/32`
- Headline : `headlineLarge 22/28` · `headlineMedium 20/26` · `headlineSmall 18/24`
- Title : `titleLarge 17/22` · `titleMedium 16/22 SemiBold` · `titleSmall 15/20`
- Body : `bodyLarge 16/22` · `bodyMedium 15/20` · `bodySmall 14/20` · `bodyBold 16/22 SemiBold`
- Label : `labelLarge 14/20 SemiBold` · `labelMedium 13/18` · `labelSmall 12/16`
- `caps 12/16 SemiBold, tracking 1, uppercase` — à utiliser avec parcimonie (labels d'onglets, pas d'eyebrow sur chaque section)

**Cible Opal** : les grands chiffres du dashboard (temps d'écran, streak) s'affichent en `displayLarge`/`displayMedium` **Bold**, tabular-nums, pour un impact « donnée en face ». Prévoir un usage tabulaire des chiffres partout où ils s'alignent (graphes, listes d'apps).

## Spacing

Grille 4px. `micro 2 · xxs 4 · xs 8 · sm 12 · md 16 · lg 20 · xl 24 · xxl 32 · xxxl 40 · xxxxl 48 · xxxxxl 56`. Padding d'écran par défaut `md`/`lg`. Varier le rythme entre sections (ne pas espacer tout uniformément) ; laisser respirer autour des chiffres clés.

## Radius

Actuel (conservateur) : `xs 2 · sm 4 · md 6 · lg 8 · xl 12 · xxl 16 · xxxl 20 · pill 9999`.

**Cible Opal (raffinement recommandé)** — Opal respire avec des coins généreux :
- Boutons : passer de `md 6` → **`14`**
- Cartes / surfaces (Résumé, blocs Activité) : `lg 8` → **`20`**
- Sheets / modales : `xl 12` → **`24`**
- Chips / tags de sélection d'app : `pill`
Garder les tokens ; ajuster leurs valeurs plutôt qu'introduire des rayons magiques dans les composants.

## Elevation & Depth

Sur **dark**, la profondeur se lit par le tint-shift des surfaces (background → surface → surfaceSecondary), pas par des ombres. Réserver les ombres portées (`card`/`floating`/`modal`/`dialog`) aux éléments réellement flottants (FAB d'ajout, bottom sheet, toast). Ajouter au besoin un `primaryAmbient` en halo (glow discret sous un chiffre clé ou un bouton primaire) — matière premium, pas décorative.

## Motion

Intentionnelle, jamais gratuite. Ease-out exponentiel (quart/quint/expo), pas de bounce ni d'elastic. Matériaux premium autorisés quand ils servent : blur, halo/glow d'accent, mask/clip-path.
- **Écran d'interception** (le moment signature) : apparition douce + le compte à rebours du délai progressif s'anime (anneau qui se remplit, respiration). C'est là qu'on investit le plus.
- **Chiffres** : count-up sur le temps d'écran / streak à l'entrée de l'écran.
- **Sélection d'app** : feedback tactile immédiat (scale léger), stagger sur la liste.
- `prefers-reduced-motion` obligatoire : crossfade ou instantané en repli. Les reveals enrichissent un contenu déjà visible (ne jamais masquer le contenu derrière une transition déclenchée par classe).

## Components (existants dans le starter)

Réutiliser : `Button`, `Text`, `ScreenWrapper`, `ScreenHeader`, `HalfSheet`, `GlobalModal`, `ErrorBoundary`, `SuspenseBoundary`, `OfflineBanner`, `IconSvg`, `Activity`, `ThemedStatusBar`, `SectionHeader`, `AnimatedTabBar` (tab bar custom animée). Étendre plutôt que réinventer. Nouveaux composants à prévoir (spécifiques Blocus) : carte Résumé, graphe temps-par-heure, ligne d'app avec barre de progression, sélecteur de type de blocage, écran d'interception, bande de dates (jour/semaine/mois), anneau de délai progressif.

## Iconography

`react-native-svg` + registre d'icônes généré (`assets/icons.ts`, `npm run gen:icons`). Icônes linéaires, épaisseur cohérente, alignées optiquement. Style sobre — pas d'icônes colorées multi-tons (sauf logos vendeurs dans `brand.ts`, réservés aux boutons de login social).
