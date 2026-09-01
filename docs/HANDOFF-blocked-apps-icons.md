# Handoff — icônes d'apps dans « Apps bloquées »

> Document de passation. Le problème restant est **UN SEUL** : dans la section
> « Apps bloquées », l'icône réelle de l'app ne remplit pas sa tuile. Tout le
> reste ci-dessous est du contexte déjà livré et vérifié sur iPhone physique.

---

## 1. Le problème à résoudre

**Section « Apps bloquées » (haut de l'onglet Blocages)** — l'icône de l'app est
dessinée **plus petite que la tuile** qui la contient, avec du vide autour. Elle
doit **recouvrir toute la tuile**, nette, comme chez le concurrent (voir §6).

**Ce qui marche déjà** : les mêmes icônes dans les **cartes de règles** (petites
vignettes de 24 pt) s'affichent correctement. Le problème n'apparaît qu'aux
grandes tailles.

---

## 2. Pourquoi c'est difficile (contraintes Apple, vérifiées)

- Apple ne donne **jamais** l'identité d'une app sélectionnée (`ApplicationToken`
  est opaque : ni bundle id, ni nom, ni image accessible en code).
- La **seule** façon d'afficher l'icône est la vue système
  `Label(applicationToken)` (framework `_DeviceActivity_SwiftUI` / FamilyControls),
  rendue dans une vue native. Rien ne remonte côté JS.
- `Label(token)` **ignore `.frame()`** pour dimensionner son icône.
  C'est la **police** qui la dimensionne :
  `Label(t).labelStyle(.iconOnly).font(.system(size: N)).frame(width: W, height: W)`.
  Recette déjà éprouvée dans ce dépôt :
  `ios/RelockActivityReport/UsageReportView.swift` → `icon(_:)`, avec `N = 26`,
  `W = 30`.

### Hypothèse principale (à confirmer)

`Label(token)` semble avoir une **taille de rendu maximale**. Observations :

| Tuile | Police demandée | Résultat |
|------:|----------------:|----------|
| 24 pt (cartes) | ~21 pt | ✅ remplit |
| 30 pt (Activité) | 26 pt | ✅ remplit |
| 72 pt (Apps bloquées) | ~62 pt | ❌ icône plus petite que la tuile |

Au-delà d'un certain seuil, l'icône **cesse de grandir** et reste centrée dans un
cadre trop grand. Le plafond exact n'a pas été mesuré.

### Ce qui a déjà été essayé et ÉCARTÉ

| Tentative | Résultat |
|---|---|
| `.frame(width: 72, height: 72)` seul | icône minuscule, centrée (le `frame` agrandit la boîte, pas le dessin) |
| `.frame(25)` + `.scaleEffect(72/25)` | remplit **mais FLOU** (agrandissement d'un bitmap déjà rendu) |
| `.imageScale(.large)` + `.font(...)` + `.scaledToFit()` | icône minuscule (`imageScale`/`scaledToFit` ramènent à la taille intrinsèque) |
| `.font(.system(size: side * 26/30))` — **état actuel** | correct en petit (cartes), **insuffisant en 72 pt** |

### Pistes non explorées (par ordre d'intérêt)

1. **Mesurer le plafond réel** : rendre `Label(token)` à des polices croissantes
   (30 / 40 / 50 / 60) et relever à partir de quand l'icône cesse de grandir.
   Ça tranche entre « plafond Apple » et « mauvaise combinaison de modificateurs ».
2. **`ImageRenderer` (iOS 16+)** : rasteriser `Label(token)` avec `scale` élevé
   pour obtenir un bitmap haute définition, puis l'afficher en `Image` redimensionnable.
   ⚠️ L'icône se résout via XPC (asynchrone) : un rendu immédiat peut être vide,
   il faudra probablement réessayer/attendre.
3. **Réduire la tuile** au plafond naturel (~40–56 pt ?) et compenser
   visuellement (fond, padding) pour que la tuile paraisse pleine.
   Le concurrent utilise peut-être exactement ça.
4. Vérifier si un `EnvironmentValues` (dynamic type, `controlSize`) influence
   la taille de rendu du label.

---

## 3. Fichiers concernés

### Natif (Swift)

| Fichier | Rôle |
|---|---|
| `ios/ReactNativeStarter/BlockedAppIconsView.swift` | **⭐ LE FICHIER DU PROBLÈME.** Vue native qui rend une icône à partir d'une clé de jeton. C'est ici que se joue la taille/netteté. |
| `ios/ReactNativeStarter/BlockedAppIconsViewManager.swift` / `.mm` | Enregistrement RN de la vue (interop Fabric obligatoire). |
| `ios/ReactNativeStarter/BlocusScreenTime.swift` | Module natif : `appKeys`, `blockedAppKeys`, `reprievedKeys`, `unblockAppKey`, `recomputeShield`, sursis. |
| `ios/ReactNativeStarter/BlocusScreenTime.m` | Exports ObjC des méthodes ci-dessus. |
| `ios/RelockActivityReport/UsageReportView.swift` | **Référence qui marche** : `icon(_:)` rend les icônes en 26/30 pt. |
| `ios/RelockMonitor/RelockMonitor.swift` | Miroir de `recomputeShield` + filtrage des sursis (app fermée). |

### JS / TS

| Fichier | Rôle |
|---|---|
| `src/features/blocking/components/BlockedAppTileView.tsx` | Tuile « Apps bloquées » : icône + voile + cadenas + libellé. |
| `src/features/blocking/components/RuleAppIcons.tsx` | Vignettes dans les cartes (2 max + « +N ») — **fonctionne**. |
| `src/features/blocking/hooks/useBlockedApps.ts` | Union dédupliquée des apps + état « ouverte ». |
| `src/shared/native/BlockedAppIcons.tsx` | Pont RN vers la vue native (prop `tokenKey`). |
| `src/shared/native/screen-time.ts` | Types + façade du module natif. |
| `src/features/blocking/screens/BlocagesV2Screen.tsx` | Écran : rangée « Apps bloquées », cartes, « Tout débloquer ». |
| `src/features/blocking/components/UnlockDurationSheet.tsx` | Feuille de durée (sélecteur iOS natif). |
| `src/shared/theme/tokens/relock-material.ts` | `blockingLockedTileSize: 72` = taille de la tuile. |

---

## 4. Architecture à respecter (acquis, ne pas casser)

### Identité par **clé de jeton**, jamais par index

`applicationTokens` est un `Set` Swift : **l'ordre d'itération n'est pas garanti**.
Indexer dedans (« la 2ᵉ app ») faisait afficher **deux fois la même icône**.

Tout est désormais identifié par une clé stable = **base64 de l'encodage JSON du
jeton** (`BlocusScreenTime.tokenKey`, miroir dans
`BlockedAppIconsView.encodedKey`). Cette clé sert à la fois :
- de **tri stable** (une vignette montre toujours la même app),
- d'**identité de déduplication** (union entre règles),
- de **cible du déblocage** (sursis).

> On ne LIT pas le jeton (Apple l'interdit), on le COMPARE. C'est suffisant.

⚠️ Si tu touches à `tokenKey` / `encodedKey`, garde les deux implémentations en phase.

### Déduplication

`blockedAppKeys()` renvoie l'**union dédupliquée** des apps de toutes les règles
en cours. Vérifié sur l'appareil : 8 + 3 apps sur deux règles → **8 apps
distinctes** (3 partagées).

### Sursis (déblocage temporaire)

- Une app débloquée **reste** dans la liste, avec un **cadenas ouvert**
  (`reprievedKeys()` dit lesquelles). Elle ne disparaît pas.
- Stockage : `reprieves` = `[cléBase64: timestampDeFin]` dans l'App Group.
- `recomputeShield()` (app **et** `RelockMonitor`) exclut les sursis non échus.
- Une activité `reprieve.*` réveille le moniteur à l'échéance.
  ⚠️ `RelockMonitor` traite `reprieve.*` **à part** : ce n'est pas une fenêtre de
  blocage, l'ajouter à `activeWindows` re-bloquerait tout.
- Plafond : **60 minutes**.

---

## 5. Historique des demandes utilisateur (toutes livrées sauf §1)

1. ✅ Carte d'une règle créée par l'utilisateur : **même taille et mêmes icônes**
   que les cartes prédéfinies.
2. ✅ Les apps d'un blocage apparaissent dans « Apps bloquées » (toutes les
   règles en cours, pas seulement la première).
3. ✅ **Vraies** icônes d'apps partout (plus de logos de marque codés en dur).
4. ✅ Cartes : **2 icônes maximum** puis « +N ».
5. ✅ **Jamais deux fois la même app** (déduplication + ordre stable).
6. ✅ Sous chaque app : « Débloquer ». Déblocage **individuel**, durée au choix ;
   la règle continue de tourner pour les autres apps.
7. ✅ App débloquée : **reste affichée**, cadenas **ouvert**.
8. ✅ « Tout débloquer » : demande la durée, ouvre **toutes** les apps.
9. ✅ Plus de bande noire coupant la dernière app (le « peek » de 15 % a été retiré).
10. ✅ Barre de progression lisible sur les cartes actives (la pilule d'état se
    remplit ; cf. `sessionProgress` dans `src/features/blocking/session.ts`).
11. ✅ Page « Nouvelle règle » : plus d'icônes codées en dur.
12. ✅ Préréglages : on montre le récapitulatif **puis** on demande les apps
    (on n'hérite plus de la sélection précédente).
13. ✅ Sélecteur de durée : **sélecteur iOS par défaut** (`DateTimePicker`,
    `mode="countdown"`, `display="spinner"`).
14. ❌ **RESTE À FAIRE** : icônes qui remplissent la tuile en « Apps bloquées ».

---

## 6. Cible visuelle (concurrent)

Tuiles d'environ 64 pt : **icône réelle de l'app pleine tuile**, légèrement
assombrie, **cadenas blanc centré** par-dessus, libellé « Débloquer » dessous.
C'est exactement la structure déjà en place — seule la **taille de rendu de
l'icône** ne suit pas.

---

## 7. Outils de debug disponibles (déjà en place)

Pont de dev : `src/session/dev-test-bridge.ts`.
L'iPhone interroge le Mac en HTTP (adresse déduite de Metro).

> ⚠️ Correctif important : en **bridgeless** (New Architecture),
> `NativeModules.SourceCode` est vide → l'hôte retombait sur `localhost`, qui sur
> un iPhone désigne **le téléphone**. Le pont était donc totalement muet sur
> appareil physique. Il utilise maintenant `getDevServer()`.

**Mise en place**

```bash
# 1. Serveur de commandes (dossier contenant relock-dev-commands.json)
python3 -m http.server 8123
# 2. Écoute des résultats renvoyés par le téléphone (port 8124)
#    -> n'importe quel serveur HTTP qui journalise le corps des requêtes POST
```

**Envoyer une commande** (l'`id` doit être strictement croissant) :

```bash
echo '{"id": 1001, "cmd": "blocked"}' > relock-dev-commands.json
```

**Commandes utiles**

| Commande | Effet |
|---|---|
| `selinfo` | Par règle : nb d'apps / catégories / domaines + sursis |
| `blocked` | Union dédupliquée des apps bloquées (+ contrôle d'unicité) |
| `unlock-test` | Débloque la 1re app 5 min et vérifie qu'elle **reste** listée |
| `diag` | Bilan natif complet |
| `auth` | (Re)demande l'autorisation Temps d'écran |

**Piloter l'appareil**

```bash
xcrun devicectl list devices
xcrun devicectl device install app --device <UDID> <chemin>/ReactNativeStarter.app
xcrun devicectl device process launch --device <UDID> com.yaya.relock
```

---

## 8. Contraintes de build

- ⛔️ **Ne jamais lancer `expo prebuild`** (écraserait les 5 extensions natives).
- Locale obligatoire pour CocoaPods sur cette machine :
  ```bash
  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npm run ios
  ```
- Build device :
  ```bash
  xcodebuild -workspace ios/ReactNativeStarter.xcworkspace \
    -scheme ReactNativeStarter -configuration Debug \
    -destination 'generic/platform=iOS' build
  ```
- ⚠️ Les icônes réelles **n'apparaissent JAMAIS sur simulateur** (Family Controls
  n'y tourne pas). Toute vérification visuelle doit se faire sur iPhone physique.
- `RelockActivityReport.swift` : le constructeur de scènes n'accepte que
  **10 enfants** avant iOS 17.4. Les scènes sont regroupées par période
  (`dayScenes` / `weekScenes` / `monthScenes` / `homeScenes`) avec
  `@DeviceActivityReportBuilder`. Ne pas remettre 15 scènes à plat.

---

## 9. État de la qualité

`npx tsc --noEmit` ✅ · `npx biome check src/` ✅ (3 avertissements préexistants,
hors périmètre) · `npx jest` ✅ 129 tests / 18 suites.
