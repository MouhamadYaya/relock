# Relock Visual System

Ce document est la référence visuelle permanente de Relock. Toute modification d'interface doit le lire avant de créer ou d'altérer une surface. Les tokens exécutables sont définis dans `src/shared/theme/tokens/relock-material.ts`; le document explique l'intention qu'ils protègent.

## Direction

Relock vit dans un univers nocturne calme : protection de l'attention, lumière lunaire et énergie violette contrôlée. L'objectif n'est ni le cyberpunk ni une accumulation d'effets. Une interface premium est une interface retenue, hiérarchisée et tactile.

Les quinze principes obligatoires sont :

1. **Darkness is the canvas.** Le presque-noir bleuté est l'environnement, jamais un vide plat.
2. **Light defines surfaces.** La lumière et la variation de matière séparent les niveaux avant les contours.
3. **Purple means energy/action.** Le violet signale l'action, la progression, l'état actif ou une source lumineuse Relock.
4. **Borders are almost invisible.** Les traits structurent silencieusement et ne dessinent pas chaque rectangle.
5. **Depth replaces outlines.** Contraste local, matière et ombre diffuse créent l'élévation.
6. **One visual hero per screen.** Un seul moment porte l'émotion et l'attention maximale.
7. **Decorations stay secondary.** Un décor se découvre après le contenu, jamais avant.
8. **Functional icons stay simple.** Réglages, chevrons et actions système restent plats, cohérents et lisibles.
9. **Emotional illustrations may be dimensional.** Lune, flamme, orb et récompenses peuvent porter texture, volume et glow.
10. **Negative space is intentional.** L'espace libre fait partie de la hiérarchie.
11. **Effects must be felt before they are noticed.** Un gradient ou un glow évident est déjà trop fort.
12. **Every screen belongs to the same night universe.** Les compositions varient, le langage reste commun.
13. **Avoid excessive saturation.** Environ 90 % de l'écran reste neutre; le violet est rare.
14. **Avoid container-inside-container appearance.** Limiter les panneaux englobants; les vraies actions doivent gagner.
15. **Premium means restraint.** En cas de doute, réduire l'effet.

## Relock Material

Une surface Relock combine cinq ingrédients : obscurité, matière, profondeur, lumière violette et contraste contrôlé. Sa recette standard est :

1. une base bleu-noir;
2. un gradient de luminosité très faible;
3. un highlight supérieur presque imperceptible;
4. une bordure froide à faible opacité, seulement si nécessaire;
5. une ombre noire large et diffuse;
6. un glow local uniquement lorsqu'une source logique l'explique.

Chaque effet pris séparément doit être difficile à remarquer. Le résultat doit être perçu comme une matière, pas comme une liste d'effets.

### Niveaux de surface

| Niveau | Rôle | Traitement |
|---|---|---|
| 0 | Canvas global | Presque-noir, variation bleu-noir et lumière indigo atmosphérique très faible |
| 1 | Grande surface ou panneau | Légèrement plus clair que le canvas, contour minimal, ombre diffuse |
| 2 | Carte interactive | Contraste local plus net, highlight supérieur, zone tactile évidente |
| 3 | Action ou sélection | Accent violet/indigo, luminosité et contraste maximaux mais contrôlés |

Ne pas inventer de niveaux intermédiaires sans besoin fonctionnel. Deux surfaces adjacentes doivent se distinguer surtout par la luminosité, le contraste et la profondeur.

## Couleur et contraste

Les rôles de couleur partagés vivent dans `relockMaterial.colors`.

- `canvas*` définit le monde nocturne.
- `surfaceHero*`, `surfacePanel*` et `surfaceInteractive*` définissent les trois matières de contenu.
- `textPrimary`, `textSecondary`, `textTertiary` portent respectivement les emphases haute, moyenne et basse.
- `accentViolet`, `accentVioletDeep` et `accentBlue` sont réservés à l'énergie, l'action et l'état actif.
- `borderSubtle` et `borderInteractive` ne doivent jamais devenir des liserés violets dominants.
- `moonHalo*` explique une lumière lunaire locale; il ne s'applique pas à toutes les cartes.

Ordre de contraste : titre ou action principale, contenu principal, description, état inactif, décoration. Un motif décoratif doit rester le niveau le plus faible.

## Géométrie

### Espacement

Utiliser d'abord `theme.spacing`, puis les rôles de `relockMaterial.layout` pour la composition Home. Les marges extérieures, l'espace entre sections et les paddings internes doivent former un rythme visible; ne pas combler chaque espace libre.

Pour les écrans : respecter la safe area, conserver des marges latérales cohérentes, laisser respirer le header, séparer clairement le message introductif, le hero et les actions secondaires. Les composants doivent rester fluides : largeur relative, `maxWidth` sur iPad et peu de positionnement absolu hors illustrations décoratives.

### Rayons

Utiliser uniquement l'échelle `relockMaterial.radius` :

- `compact` pour les petits contrôles;
- `action` pour les cartes interactives;
- `button` pour le CTA;
- `panel` pour les panneaux;
- `hero` pour la surface principale;
- `capsule` pour une vraie forme pilule ou circulaire.

Un rayon différent doit exprimer une fonction différente, pas une préférence locale.

## Typographie

La famille et les graisses viennent des tokens `fonts`; les tailles Home spécifiques viennent de `relockMaterial.typography`.

- Le hero utilise une graisse forte mais conserve un interlignage respirant et un blanc légèrement cassé.
- Le texte secondaire doit rester lisible et clairement subordonné.
- Les titres de cartes gagnent toujours sur leur métadonnée.
- Éviter l'UltraBold systématique, les tracks décoratifs et les changements de taille arbitraires.
- Une ligne ne doit jamais passer sous une illustration décorative sur un écran étroit.

## Lumière, ombres et glow

Les ombres `hero`, `panel` et `action` sont larges, noires et faibles. Elles font émerger les surfaces sans produire un effet Material générique. Le preset `glow` est réservé aux actions énergétiques.

Tout glow doit avoir une source : lune, CTA actif, indicateur actif ou illustration énergétique. Il est grand, diffus, faible et progressif. Ne jamais entourer chaque carte d'un halo violet.

La lune Home est une source de scène : elle reste à droite, peut approcher le bord, éclaire localement l'indigo et demeure plus forte que ses étoiles ou son halo.

## Illustration et iconographie

Deux catégories ne doivent pas être mélangées :

- Les illustrations émotionnelles (lune, flamme, orb, nuage, bouclier spécial) peuvent utiliser 3D, texture, saturation et volume.
- Les icônes fonctionnelles (réglages, navigation, fermer, ajouter, chevrons) restent simples, plates, cohérentes et moins saturées.

Les PNG décoratifs doivent se fondre par leur opacité, leur contraste et leur placement; leur rectangle source ne doit jamais être perceptible. Une illustration principale peut être saturée, mais son motif secondaire doit disparaître dans la surface.

## Composants de référence

### Hero

Le hero est la seule grande scène d'un écran. Il reçoit la matière la plus riche, l'illustration émotionnelle dominante et une copie courte. Le titre, la description et le CTA conservent une hiérarchie nette et un espace généreux.

### CTA principal

Le CTA combine un gradient violet-indigo horizontal, une lumière interne légère, un glow externe diffus et une indication directionnelle. La cible tactile fait au minimum 44 points. Au press, utiliser `PressableScale` (échelle 0,96) et respecter la réduction de mouvement.

### Actions rapides

Le panneau englobant reste presque confondu avec le canvas. Chaque action interne est une vraie surface interactive séparée. L'illustration, le texte puis le chevron définissent l'ordre; les décors à droite utilisent le contraste le plus faible.

### Navigation

La navigation reste native et fonctionnelle. L'état actif peut recevoir une matière violet-indigo discrète; les états inactifs restent froids, calmes et lisibles. Les icônes fonctionnelles doivent être cohérentes, et leur cible tactile ne doit pas être réduite pour gagner quelques pixels.

## Mouvement et interaction

- Les éléments pressables utilisent un feedback tactile court et déterministe, généralement une échelle à 0,96.
- Aucun mouvement décoratif permanent sur les icônes de navigation.
- Les entrées/sorties doivent être courtes, avec une sortie généralement plus rapide.
- Respecter `prefers-reduced-motion` via les primitives partagées.
- Les ombres et glows ne doivent pas clignoter ou concurrencer le contenu.

## Accessibilité et responsive

- Cible minimale : 44 × 44 points.
- Toute action a un rôle et un label accessibles; les illustrations purement décoratives sont masquées de l'arbre.
- Les textes principaux gardent un contraste élevé; le décor ne porte jamais seul une information.
- Tester au minimum deux formats d'iPhone, le plus étroit étant l'arbitre pour les collisions.
- Préférer Flexbox et les largeurs fluides. Le positionnement absolu est réservé à la matière et aux illustrations sans impact sur le flux.
- Vérifier la troncature, le Dynamic Type raisonnable, la safe area et la coexistence avec la navigation native.

## Extension aux autres écrans

Ne pas copier littéralement la lune géante. Bloquer, Activité, Onboarding, Settings, paywall, modales et statistiques réutilisent les mêmes contrastes, matières, rayons, ombres, règles violettes et interactions, tout en conservant leur propre composition et leur propre hero.

Opal est une référence de calme, de hiérarchie et de finition, pas un template. Relock conserve son identité : purple night, moonlight, attention protection et focus.

## Checklist avant livraison UI

- Lire ce document et identifier le hero unique de l'écran.
- Réutiliser les tokens existants avant d'en créer un nouveau.
- Vérifier que le violet reste rare et justifié.
- Inspecter matière, bordures, ombres et décorations à petite taille puis à 100 %.
- Vérifier toutes les cibles tactiles et labels accessibles.
- Capturer au moins deux formats lorsque la composition change.
- Comparer par composant, sans laisser la status bar fausser l'évaluation.
- Documenter honnêtement tout écart visible restant.
