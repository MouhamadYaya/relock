# Paywall — références du 5 septembre 2026

## Périmètre livré

Reconstruction native des quatre vues fournies : comparaison avant/après, grille 2 × 3 et formules, offre plein écran au sablier, fenêtre de remise après annulation. Les textes anglais/français de la nouvelle référence sont conservés intentionnellement. Les cadres de téléphone et barres système des maquettes ne sont pas dessinés dans l'app.

| Avant | Après |
|---|---|
| Mosaïque générique au-dessus du titre | Six photographies en grille sous le titre ; cadrages issus des références |
| Comparaison abstraite et pictogrammes | Photos avant/après, histogrammes et trois bénéfices illustrés |
| Une offre réutilisée pour deux présentations | `PaywallExitOffer` au sablier, `PaywallOffer` en panneau inférieur |
| Fermeture du paywall ouvrant la petite fenêtre | « Passer » ouvre uniquement l'offre plein écran |
| Aucun contrat de retour de paiement | Résultat typé ; seule une annulation explicite après présentation du Store ouvre la petite fenêtre |
| Onglets de prévisualisation permanents | Bouton « Fenêtre » en bas du paywall, uniquement en développement |
| Flèche dans les CTA et lune stylisée | CTA sans flèche, lunes texturées, sablier sur roche et raccords de fond fondus |
| Dimensions uniformes | Défilement natif, safe areas et grille plus compacte sur les petits écrans |

## Déclencheurs

- Bénéfices → Continue → paywall.
- Paywall → Passer → offre plein écran, jamais la fenêtre 50 %.
- Fermeture/refus de l'offre plein écran → connexion obligatoire, une seule fois.
- Résultat `cancelled` avec `storeSheetPresented: true`, depuis une formule principale → fenêtre 50 %, une fois par visite du parcours.
- Erreur, exception réseau, paiement en attente, succès ou abandon avant présentation du Store → aucune fenêtre de remise.
- Fermeture de la fenêtre → même paywall et même sélection. Annulation d'un achat depuis une offre → aucune cascade d'offres.
- « Fenêtre » → aperçu visuel explicite, sans appel d'achat et sans prétendre avoir affiché le paiement Apple.
- Actions d'achat concurrentes bloquées ; aucun accès premium accordé par les composants de présentation.

## Limites à ne pas masquer

**Le branchement Apple/RevenueCat n'est pas présent.** Le composant reçoit un futur adaptateur `purchase(plan, source)` ; le résultat doit arriver après la fermeture effective de la feuille StoreKit. L'onboarding ne lui passe actuellement aucun adaptateur : Continue sur une formule informe honnêtement qu'aucun paiement n'a été lancé.

**Les captures ne sont pas des offres commerciales validées.** Les statistiques, témoignage, « LOWEST PRICE EVER », 80 %, garantie et accès « à vie » proviennent de la maquette. Tous ces écrans de référence sont derrière `__DEV__`. Une compilation de production affiche l'indisponibilité des abonnements, sans prix ni preuves sociales de maquette.

69,99 $ → 34,99 $ correspond à environ 50 %, pas 80 %. 34,99 / 12 s'arrondit à 2,92 $, et non aux 2,91 $ affichés sur la référence. Ces incohérences restent visibles uniquement pour la comparaison graphique ; prix, conditions et véracité des promesses devront être résolus avant activation des achats.

**Identité au pixel près non attestée.** Les images jointes sont des maquettes aplaties, à des proportions plus hautes que les simulateurs. Les illustrations ont été reconstruites par génération d'images : cadrage, texture et éclairage diffèrent encore des fichiers originaux. Le paywall derrière la fenêtre reste la grille 2 × 3 de la première référence, alors que la deuxième référence utilise une autre grille. Le contenu défile sur les écrans plus courts. Pour une reproduction graphique strictement identique, utiliser les assets originaux séparés et une référence au format du téléphone cible.

## Vérification

- iPhone 17 Pro (402 × 874 points) et iPhone SE (375 × 667 points), sans toucher à l'iPhone physique.
- Navigation des actions via le pont de développement/CDP, défilement du ScrollView natif et captures `simctl`. Pas de validation d'un achat réel ni de gestes tactiles physiques.
- 71 tests onboarding réussis, dont 15 tests du paywall ; TypeScript strict et vérification des imports réussis ; Biome ciblé réussi.
- `npm run i18n:all` reste bloqué par le script existant qui cible `App.tsx`, absent. `npm run i18n:types` exécuté séparément avec succès. Aucun changement de dépendance ou version.
- Captures de comparaison dans `docs/paywall-reference-audit/`.

### Captures finales

| Vue | iPhone 17 Pro | iPhone SE |
|---|---|---|
| Avant/après | [Capture](paywall-reference-audit/relock-paywall-benefits-pro.png) | Vérifié sur simulateur |
| Formules | [Haut](paywall-reference-audit/relock-paywall-plans-pro.png), [après défilement](paywall-reference-audit/relock-paywall-scrolled-pro.png) | [Grille compacte](paywall-reference-audit/relock-paywall-plans-se.png) |
| Fenêtre 50 % | [Capture](paywall-reference-audit/relock-paywall-sheet-pro.png) | [Capture](paywall-reference-audit/relock-paywall-sheet-se.png) |
| Offre 80 % | [Haut](paywall-reference-audit/relock-paywall-full-pro.png), [boutons et pied de page](paywall-reference-audit/relock-paywall-full-bottom-pro.png) | Vérifié sur simulateur |

## Assets

Les illustrations produites avec l'outil intégré ImageGen sont enregistrées dans `assets/paywall/` et référencées via `@assets`. Les originaux générés sont conservés dans le dossier de génération Codex. Aucun SVG de l'iconothèque n'a été modifié.

- `reference-tiles.png` : atlas 2 × 3, ordinateur, oreiller, carnet, haltères, plante, appareil photo.
- `reference-benefits.png` : atlas photos avant/après puis méditation, casque et chambre.
- `reference-hourglass.png` : sablier violet sur roche sombre.
- `reference-moons.png` : atlas lune sombre et croissant, fond noir. La première tentative de transparence avait un damier incorporé ; elle n'est pas utilisée.

La compétence de finition d'interface a guidé les cibles tactiles, la hiérarchie, les raccords d'images et les adaptations aux petits écrans. Prompts de génération : `assets/paywall/PROMPTS.md`.
