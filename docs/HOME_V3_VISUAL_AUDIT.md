# Home V3 — audit visuel correctif

## Statut

Reconstruction corrective en cours de validation humaine. Ce document ne
déclare pas la fidélité validée : la décision finale appartient au checkpoint
humain demandé après présentation des preuves.

## Nouvelle référence « Mes apps » — 4 septembre 2026

### Correction du fond doublé et aération

`HomeBackdrop` porte désormais l'unique image Home, hors du `ScrollView`,
ancrée au sommet de l'écran sur 428 points avec fondu vers le canvas. Les
copies d'image RN et SwiftUI défilantes ont été retirées : le rapport est
transparent derrière ses données. Le rebond natif est conservé. Les cartes
passent à une base presque noire avec reflet violet réduit; leurs écarts
passent de 16 à 24 points. La zone avant le score passe de 428 à 360 points,
sans déplacer le fond, et la phrase de contexte sous le delta est retirée.
Les zones tactiles et les positions du rapport utilisent la même géométrie.
Ces changements nécessitent une nouvelle compilation iOS, car le rafraîchissement
Metro seul ne retire pas l'ancienne image compilée dans le rapport natif.

Validation sur simulateur uniquement : TypeScript, Biome ciblé et 18 tests
Home passent. Le parcours iOS recompilé réussit sur SE, avec défilement,
tractions aux deux limites et retour d'onglet
(`/tmp/relock-fixed-moon-synced-se.xcresult`). Les captures finales confirment
24 points entre les cartes, y compris sous le Top 3 (hauteur synchronisée à
232 points). Le fond reste identique dans les marges avant/après défilement
et retour d'onglet; une capture grand écran a également été inspectée.

### Étape précédente : violet et rebond

Les surfaces et accents verts des cartes passent
au violet Relock, avec 16 points entre les cartes au lieu de 10. Les positions
du rapport Apple et de ses commandes tactiles suivent le même espacement.
Le masque opaque de barre d'état décrit ci-dessous est supprimé : le décor
passe derrière l'heure et la batterie. Un fond illustré atténué couvre aussi
l'écran derrière le contenu. Le `ScrollView` retrouve `bounces` et
`alwaysBounceVertical` : résistance et retour élastique sont gérés par iOS,
sans ressort JavaScript ni animation individuelle des cartes. Cette passe
est vérifiée uniquement sur simulateur, conformément à la demande utilisateur.

Après la modification parallèle de « Score global », la hauteur commune est
252 points. Son aperçu SwiftUI a été synchronisé avec le nouveau dessin, et
les accents Focus/anneau sont également violets. Vérification : TypeScript,
Biome ciblé et 18 tests Home passent; compilation simulateur réussie. Le
parcours SE teste les tractions aux deux limites, le retour à la position
stable, le défilement et le retour d'onglet (`/tmp/relock-purple-sync-se.xcresult`,
réussi). Captures inspectées sur SE et iPhone 17 Pro Max; aucun téléphone
physique utilisé pendant cette passe.

Cette évolution remplace la précédente carte « Apps bloquées ». Elle suit les
trois nouvelles références utilisateur : matière charbon légèrement verte,
grands arrondis, bouclier menthe, bouton blanc et carte de progression dorée.
Le fond illustré et la barre d'onglets Expo restent conservés.

### États et interactions

- Sans protection active ou programmée : aucun composant « Mes apps », aucun
  emplacement vide. Les règles suspendues et expirées ne suffisent pas à
  afficher la carte. Un blocage confirmé par iOS reste toutefois visible si
  la requête des règles est momentanément en retard.
- Protection programmée, mais aucune app verrouillée : prochain créneau réel
  et « Aucune app actuellement bloquée », sans bouton de déblocage.
- Apps verrouillées : titres des règles qui couvrent effectivement leurs
  jetons, nombre dédupliqué, icônes natives et bouton « Débloquer des apps ».
- Un sursis peut annoncer sa prochaine reprise; une limite quotidienne non
  atteinte n'invente pas un horaire futur.
- Le bouton transmet une demande explicite à l'onglet Blocages et ouvre le
  rituel existant (respiration puis durée). Aucun sursis n'est accordé au
  premier appui. Les règles strictes et les recouvrements restent protégés;
  les appartenances inconnues et les lectures natives échouées refusent
  l'autorisation. Les redirections du bouclier système restent passives.
- « Premier pas franchi » s'affiche pour une série réelle de 1 jour. Le titre
  et le nombre évoluent ensuite; la carte de progression est absente à zéro.

### Composition et confidentialité

Le rapport Apple conserve le héros, le score et le classement dans une seule
surface distante. Le créneau transparent réservé à la carte RN mesure
280 points, avec 10 points de part et d'autre; les coordonnées tactiles natives
et le fallback simulateur sont synchronisés. La progression est ajoutée dans
le flux de défilement normal. Un masque fixe de safe area protège la lisibilité
de la barre d'état lorsque le contenu passe derrière elle.

Le composant supprimé est `HomeBlockedAppsCard.tsx`, remplacé par
`HomeMyAppsCard.tsx`. Les nouvelles surfaces réutilisent les tokens partagés;
les principes de finition ont guidé les arrondis, les contrastes, la matière,
les cibles de 44 points et les nombres/durées sans saut de largeur.

Les fixtures restent explicitement opt-in en Debug :
`-HomeReferenceFixture YES -HomeMyAppsScenario blocked|upcoming|none`.
Elles ne créent aucune règle et ne remplacent jamais les données de production.
Les icônes opaques ne se résolvent pas sur simulateur : les captures de fixture
ne prouvent donc pas le rendu des vraies icônes Family Controls.

### Vérification de cette évolution

- TypeScript : passe. Jest : 40 suites, 245 tests passent.
- Biome ciblé, gardes des imports/icônes et compilation iOS appareil/simulateur : passent.
- Parcours simulateur grand format : trois états, défilement et retour d'onglet
  passent; la dernière capture confirme aussi le masque de barre d'état
  (`/tmp/relock-home-my-apps-large-final-shots/`).
- Même parcours sur iPhone SE, 375 points : les trois états passent
  (`/tmp/relock-home-my-apps-narrow2.xcresult`, 15 captures). Le bouton,
  l'annonce du prochain blocage et la progression restent accessibles.
- Ce contrôle a révélé des libellés de score sur deux lignes au petit format.
  Le rapport réel et sa fixture ont été corrigés ensemble : espacement réduit,
  ligne unique et réduction de police limitée. Revalidation visuelle réussie
  sur SE (`/tmp/relock-home-my-apps-narrow-final.xcresult`); « Focus » et
  « Repos » sont entièrement visibles sur une ligne. Compilation appareil
  repassée après cette dernière correction.
- Le test physique s'est arrêté avant l'accueil : le téléphone présentait
  l'onboarding et la demande iOS de suivi. Cette autorisation appartient à
  l'utilisateur; le test n'est pas déclaré réussi sur appareil.
- Le lint global signale encore des erreurs hors périmètre (notamment
  `.claude/skills/impeccable`). `npm run i18n:all` référence l'ancien `App.tsx`
  absent; extraction vérifiée avec les globes `app/**/*.{ts,tsx}` et
  `src/**/*.{ts,tsx}` vers un dossier temporaire, puis types régénérés depuis
  les traductions du dépôt. Aucun changement de dépendance.

## Régression sur iPhone physique — 4 septembre 2026

Cette vérification corrige et remplace les affirmations historiques ci-dessous
concernant les scores indisponibles, la carte de blocage à zéro et la navigation
personnalisée. Elle ne valide pas la fidélité au rendu conceptuel.

- Appareil réel : iPhone 15 Pro Max, iOS 26.6.1, écran 430 × 932 pt.
- Nouveau binaire installé, ancien processus arrêté, puis lancement frais.
- Parcours : Accueil, deux gestes vers le bas du contenu, deux vers le haut,
  Activité puis Accueil, attente de dix secondes, nouveaux gestes, passage en
  arrière-plan puis retour. Dix captures plein écran inspectées visuellement.
- Résultat : fond et données présents dans chaque état Accueil, trois lignes du
  classement entièrement visibles, score numérique, textes français, actions
  d'en-tête contrastées et barre Expo native conservée. La carte des applications
  bloquées est absente lorsque le nombre réellement bloqué vaut zéro.
- Corrections : rattachement du contrôleur SwiftUI au contrôleur UIKit parent,
  conservation du rapport Home lors des transitions, suppression du double
  inset natif, gestes gérés par la surface locale et le ScrollView React Native,
  suppression du rebond qui exposait de grandes zones vides.
- Scores indicatifs issus des données d'usage dans l'extension : Focus vaut
  `max(0, min(100, 100 - 2 × activations))`, Repos représente la part de la journée
  écoulée hors écran, et le score global est leur moyenne arrondie. Ils ne
  mesurent ni la concentration ni le sommeil; le détail l'explique en français.
- Limite : aucune application n'était bloquée pendant ce parcours. Sans cette
  carte, tout le contenu tient sur ce grand écran; les gestes ne démontrent donc
  pas un déplacement vertical sur un écran plus petit ou avec davantage de
  contenu. Ce scénario reste à vérifier sur appareil. Aucun blocage n'a été créé
  pour modifier artificiellement l'état du téléphone.

Preuve locale : `/tmp/relock-home-physical-after7.xcresult`, test
`RelockBridgeDiagnosticsTests/testHomeScrollAndTabReturnOnPhysicalDevice`,
résultat `Passed` (1 test, 0 échec). Captures dans
`/tmp/relock-home-physical-after7-shots/`; ces fichiers temporaires contenant des
données personnelles ne sont pas copiés dans le dépôt. Le test vérifie aussi
l'application au premier plan, l'onglet sélectionné et la présence de pixels
colorés dans la zone du score. Les gestes du menu Expo sont désactivés uniquement
par les arguments de lancement du processus de test, sans modifier les
préférences persistantes de l'utilisateur.

Contrôles complémentaires : TypeScript, 38 suites Jest / 219 tests, Biome sur
les fichiers JS/TS/JSON concernés et gardes icônes/imports passent. Le lint global
reste affecté par des erreurs préexistantes hors du périmètre Home.

## Référence et protocole

- Référence source : `ChatGPT Image 4 sept. 2026 à 12_47_45.png`, 1024 × 1536.
- Crop écran actif : `(194, 37) → (829, 1461)`, soit 635 × 1424 px. Le châssis
  métallique n'entre jamais dans la comparaison.
- Appareil primaire : iPhone 17 Pro Max 6,9 pouces.
- Tolérance géométrique visée : ±0,01 sur chaque bord normalisé.
- Pour chaque itération : capture brute, référence cropée, côte à côte,
  superposition 50 %, différence amplifiée et `measurements.json`.

| Région | Rectangle cible dans le crop | Rectangle normalisé |
|---|---:|---:|
| Header | 31, 82, 575, 69 | .0488, .0576, .9055, .0485 |
| Hero | 0, 157, 635, 480 | 0, .1103, 1, .3371 |
| Score | 23, 637, 590, 191 | .0362, .4473, .9291, .1341 |
| Apps bloquées | 23, 842, 590, 136 | .0362, .5913, .9291, .0955 |
| Top 3 | 23, 992, 590, 271 | .0362, .6966, .9291, .1903 |
| Navigation | 23, 1276, 590, 110 | .0362, .8961, .9291, .0772 |

## Contrat de données

- Temps d'écran et Top 3 : toujours rendus dans l'extension
  `DeviceActivityReport`; aucune identité ou durée privée ne traverse le pont
  JavaScript.
- Série : statistiques réelles existantes.
- Apps bloquées : clés opaques natives des protections actives.
- Score : indisponible en production tant qu'aucun modèle Focus/Repos fiable
  n'existe.
- Fixture : compilée uniquement en Debug, inactive par défaut, activée par
  `-HomeReferenceFixture YES`. Aucun faux contenu Home n'est activé par le seul
  fait d'être sur simulateur.

## Itérations

Les preuves sont rangées sous `docs/home-visual-audit/iteration-1` à
`iteration-5`. Chaque dossier contient la capture brute, le crop de référence,
le côte à côte, la superposition 50 %, le diff et les mesures.

| Itération | Correction réellement visible |
|---|---|
| 1 | Première reconstruction compacte; l'inset SwiftUI doublé décale et coupe le Top 3. |
| 2 | Suppression du double safe-area natif; les trois rangées deviennent entièrement visibles. |
| 3 | Alignement des limites Score/Blocages/Top 3/navbar; la distribution interne des tabs reste incorrecte. |
| 4 | Trois cellules de navigation égales et capsule Accueil visible; vérification séparée de l'état réel sans fixture. |
| 5 | Anneau Score agrandi, padding des cartes rapproché de la référence, rangées natives réalignées, transformations Hero/Blocages ajoutées. |

Le RMS normalisé de l'itération 5 est `0,2499`. Il est consigné comme aide
reproductible, mais n'est pas traité comme une validation visuelle : le hero
occupe presque la moitié de l'image et son asset approuvé a une composition
intrinsèquement différente de la référence.

## Mesures finales — iPhone 17 Pro Max

Les rectangles ci-dessous viennent des tokens exécutés et ont été vérifiés sur
la capture @3x. La colonne erreur est le plus grand écart d'un bord normalisé.

| Région | Cible (crop 635 × 1424) | Capture finale normalisée | Erreur max |
|---|---:|---:|---:|
| Score | 23, 637, 590, 191 | 23,1, 637,5, 588,8, 190,7 | 0,0018 |
| Apps bloquées | 23, 842, 590, 136 | 23,1, 843,1, 588,8, 135,5 | 0,0018 |
| Top 3 | 23, 992, 590, 271 | 23,1, 993,5, 588,8, 271,1 | 0,0018 |
| Navigation | 23, 1276, 590, 110 | 23,1, 1275,0, 588,8, 110,2 | 0,0018 |

## Écart visuel restant soumis au checkpoint humain

`HomeDashboardHeroApproved.png` place l'apex de l'arc presque au sommet et
dessine une planète sombre pleine. La référence place un anneau vide plus bas,
avec une dominante rose/orange beaucoup plus chaude. Un recadrage qui descend
l'arc descend aussi la silhouette et casse son alignement; un recadrage qui
garde la silhouette centrée laisse l'arc trop haut. La capture finale conserve
donc l'asset déjà approuvé, comme demandé. Son remplacement demanderait une
nouvelle série d'images et une approbation humaine préalable.

Les autres écarts visibles sont secondaires : icônes de fixture simplifiées
(les icônes réelles restent fournies par Apple en production) et verre des
cartes moins lumineux que dans le rendu conceptuel.

## Checklist corrective

- [x] Header transparent, touch targets 44 pt, flamme chaude visible à zéro.
- [x] Hero bord à bord, sans carte arrondie, texte centré dans l'anneau.
- [x] Score compact, géométrie stable, anneau gradient, Focus/Repos iconés.
- [x] Apps bloquées compactes et stables à zéro.
- [x] Top 3 entièrement visible avec trois emplacements stables.
- [x] Navigation partagée à trois onglets, sans minimisation.
- [x] Flip/expansion réels et fallback Reduce Motion.
- [x] Fixture de référence Debug explicitement opt-in.
- [x] Cinq itérations visuelles iPhone 17 Pro Max archivées.
- [x] Build simulateur et build appareil validés.
- [ ] Validation humaine obtenue.
