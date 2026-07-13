# Blocage natif — Family Controls (A)

Suivi de l'intégration du module natif iOS qui bloque réellement les apps.
Voir aussi [choseafaire.md](../choseafaire.md).

## Ce qui est fait (code)

- **`ios/ReactNativeStarter/BlocusScreenTime.swift`** — module natif :
  - `requestAuthorization` / `authorizationStatus` (Family Controls, iOS 16+)
  - `presentPicker` → sélecteur d'apps Apple (`FamilyActivityPicker`), renvoie `{ count }` (jeton opaque)
  - `startBlocking` / `stopBlocking` → pose/retire le bouclier `ManagedSettings`
  - `getStatus` → `{ supported, authorized, blocking, count }`
- **`ios/ReactNativeStarter/BlocusScreenTime.m`** — pont ObjC (`RCT_EXTERN_MODULE`).
- Fichiers **ajoutés à la cible** app (Compile Sources).
- Entitlement **`com.apple.developer.family-controls`** déjà dans `ReactNativeStarter.entitlements` (rattaché Debug + Release).
- **JS** : `src/shared/native/screen-time.ts` (wrapper, `isScreenTimeAvailable`), câblage écran Ajout + interrupteur Accueil.
  - Simulateur / module absent → comportement mock (crée la règle, pas de blocage réel).
  - iPhone → autorisation → sélecteur Apple → bouclier réel.

## Réalité iOS à retenir

- Family Controls **ne marche pas sur simulateur** → iPhone physique requis.
- Le sélecteur renvoie un **jeton opaque** : l'app ne connaît que le **nombre** d'apps, pas leurs noms/logos. La grille custom de l'écran Ajout est un **préréglage visuel**, pas le vrai choix.
- Entitlement **approuvé par Apple par bundle ID**.

## Session Xcode guidée (à faire sur device)

1. Ouvrir `ios/ReactNativeStarter.xcworkspace` dans Xcode.
2. Cible **ReactNativeStarter** → onglet **Signing & Capabilities** :
   - **Team** = ton compte développeur Apple.
   - **Bundle Identifier** = l'identifiant Blocus **approuvé Family Controls**.
   - Vérifier que la capability **Family Controls** est listée (elle vient de l'entitlement).
3. Brancher l'iPhone, le sélectionner comme destination.
4. **Run** (⌘R). Première fois : approuver le profil dev sur l'iPhone (Réglages → Général → VPN et gestion d'appareils).
5. Test : écran Ajout → « Activer le blocage » → autoriser Temps d'écran → choisir TikTok/Instagram dans le sélecteur Apple → ouvrir TikTok = écran de blocage système.

## Reste à faire (A2)

- Extension **DeviceActivityMonitor** : délai progressif, plages horaires, limites d'ouvertures, log des événements → `block_events` (rend les stats réelles).
