# Home V2 — REJETÉE

> **Statut : REJETÉE le 4 septembre 2026.** Les affirmations de composition
> complète et d'absence de collision ci-dessous ne sont plus valides. La
> capture iPhone 17 montre un Top 3 tronqué par la navigation, un hero trop
> sombre et une hiérarchie de cartes trop lourde. La reconstruction corrective
> et ses preuves objectives vivent dans `HOME_V3_VISUAL_AUDIT.md`.

## Archive de l'audit invalidé

## Références et preuves

- Direction visuelle : image de référence fournie avec le brief Home.
- Illustration approuvée : option 2, conservée dans `design/InAPP/Accueil3/HomeDashboardHeroApproved.png`.
- Capture finale iPhone 17 : `design/InAPP/Accueil3/HomeDashboard-iPhone17-final.png`.
- Capture finale compacte : `design/InAPP/Accueil3/HomeDashboard-iPhoneSE-final.png`.

L'audit est qualitatif et composant par composant. La barre d'état, l'heure, la Dynamic Island, le Wi-Fi et la batterie dépendent du simulateur et ne sont pas utilisés pour juger la fidélité de la Home.

## Composition livrée

La Home est désormais un tableau de bord unique, dans l'ordre suivant :

1. en-tête Relock avec salutation, sous-titre, flamme conditionnelle et accès Réglages ;
2. carte héro illustrée avec temps d'écran réel, variation et message contextuel ;
3. carte Score Relock avec anneau central, Focus et Repos ;
4. carte Applications bloquées avec total et prochaine réinitialisation ;
5. Top applications dynamique, trié par durée décroissante et limité aux trois premières ;
6. barre d'onglets flottante, minimisée au défilement.

Les anciens états Home séparés et leurs anciennes cartes visuelles ont été retirés. Un nouvel utilisateur voit la même structure, avec valeurs nulles ou vides honnêtes plutôt qu'un écran alternatif.

## Checklist

- [x] Fond nocturne bleu-noir et hiérarchie sombre cohérente
- [x] En-tête compact et actions accessibles
- [x] Illustration héro approuvée intégrée sans texte rasterisé
- [x] Temps d'écran issu de `DeviceActivityReport`
- [x] Variation et phrase contextuelle calculées depuis les données Apple
- [x] Carte Score compacte, sans chevauchement sur petits écrans
- [x] Scores indisponibles rendus comme indisponibles, sans valeur inventée
- [x] Nombre d'applications bloquées issu des règles natives
- [x] Compte à rebours calculé jusqu'à minuit local
- [x] Top 3 trié, avec rang, icône, nom, durée et barre proportionnelle
- [x] Navigation Réglages conservée
- [x] Appui sur le héro et le Top applications routé vers Activité
- [x] Appui sur Score ouvre une feuille de détail
- [x] Appui sur Applications bloquées utilise la page Blocages existante
- [x] Feedback tactile et réduction des animations pris en charge
- [x] Défilement naturel sur écran compact
- [x] Vérification visuelle sur deux tailles d'iPhone

## Source des données

| Zone | Source de production | État vide |
|---|---|---|
| Temps d'écran et Top applications | `DeviceActivityReport` / `DeviceActivityResults` | Valeurs système nulles ou absentes |
| Applications bloquées | Règles de blocage et clés natives existantes | `0` |
| Série et statistiques de session | Statistiques utilisateur déjà exposées par l'application | Icône masquée ou valeur nulle |
| Focus, Repos et Score Relock | Aucun modèle produit réel n'existe encore | `—` / « En calcul » |
| Réinitialisation | Prochain minuit dans le fuseau local | Toujours calculable |

Apple isole les données détaillées Screen Time dans l'extension `DeviceActivityReport`. Elles sont donc affichées directement par SwiftUI dans la surface native et ne sont pas exportées vers JavaScript. Ce découpage respecte la confidentialité d'Apple tout en gardant une seule expérience visuelle.

## Appareils vérifiés

| Appareil | Résolution | Résultat |
|---|---:|---|
| iPhone 17 | 1206 × 2622 | Composition complète, aucune collision, début du Top applications visible, barre d'onglets flottante correcte |
| iPhone SE (format compact) | 750 × 1334 | Géométrie préservée, aucune collision, suite du contenu accessible par défilement |

## Limites assumées

1. Les scores Focus et Repos restent indisponibles tant qu'une vraie définition métier et une vraie source de données ne sont pas ajoutées. Le Score Relock n'est calculé que lorsque les deux sous-scores sont valides ; la formule prévue est leur moyenne arrondie.
2. Le simulateur utilise une fixture compilée exclusivement sous `targetEnvironment(simulator)` pour rendre la surface privée Screen Time vérifiable. Aucun faux jeu de données n'est inclus dans le chemin de production appareil.
3. La position verticale du Top applications dépend de la hauteur de l'appareil ; sur les petits formats, le défilement est intentionnel.
