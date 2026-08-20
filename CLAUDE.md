# CLAUDE.md — Relock

Contexte pour tout assistant IA travaillant sur ce dépôt.
Voir aussi `AGENTS.md` (règles strictes — dont : **ne jamais modifier les versions dans `package.json` / `package-lock.json`**).

## Nature du projet

React Native **0.81.6** en **workflow bare**, avec **Expo SDK 54 intégré SANS prebuild** (depuis 2026-08-20) :

- `expo` + `expo-dev-client` sont installés ; les dossiers `ios/` et `android/` sont écrits à la main et versionnés.
- **5 extensions natives iOS Family Controls** (`RelockActivityReport`, `RelockMonitor`, `RelockShield`, `RelockShieldAction`, `RelockWidgets`) + module natif `BlocusScreenTime`. Ce sont des cibles Xcode pures (pas de pod, pas de config plugin).
- ⛔️ **NE JAMAIS lancer `expo prebuild`** : ça régénérerait `ios/`/`android/` et écraserait ces extensions (le cœur du produit).

## Lancer le projet en local

Les scripts npm passent désormais par Expo :

| Commande | Fait quoi |
|---|---|
| `npm start` | `expo start --dev-client` — Metro + QR code du dev launcher |
| `npm run ios` | `expo run:ios` — build + install + lance le dev client (simulateur/device iOS) |
| `npm run android` | `expo run:android` |

**Recette :**
1. **Première fois / après un changement natif ou de pods** : `npm run ios` (build complet, installe, lance, démarre Metro).
2. **Ensuite, changements JS uniquement** : `npm start`, puis ouvrir l'app Relock déjà installée (le simulateur se connecte seul ; sur iPhone physique avec le build dev, scanner le QR affiché par Metro).

### Expo Go vs expo-dev-client (piège fréquent)

**Expo Go NE MARCHE PAS** ici (modules natifs custom). On utilise **expo-dev-client** = un build de dev de **ton** app, qui apporte l'expérience Expo (QR code, dev launcher, fast refresh). Tu scannes le QR pour ouvrir **ton propre build**, pas Expo Go. Le QR/preview EST donc disponible, contrairement à ce que suggère l'ancienne doc.

### ⚠️ Piège CocoaPods (OBLIGATOIRE sur cette machine)

`pod install` — et `expo run:ios` qui l'appelle en interne — plante avec
`Unicode Normalization not appropriate for ASCII-8BIT` car la locale shell est vide (`LANG=`, `LC_CTYPE=C`) avec Ruby 4 + CocoaPods 1.17.
**Toujours préfixer par la locale UTF-8 :**

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install --project-directory=ios
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npm run ios
```

## AppDelegate (points sensibles à préserver)

`ios/ReactNativeStarter/AppDelegate.swift` est en `ExpoAppDelegate` + `ExpoReactNativeFactory` :

- `bindReactNativeFactory(factory)` doit être appelé (sinon **crash du dev launcher au démarrage** — assertion dans `ExpoAppDelegate.recreateRootView`).
- `application(open:)` est un `override` qui fait `super.application(...) || RCTLinkingManager.application(...)` (deep links `relock://` + dev-client).
- hook bootsplash dans `ReactNativeDelegate.customize(_:)`.

## Config Expo côté JS

- `metro.config.js` : basé sur `expo/metro-config` (transformer SVG maison conservé).
- `babel.config.js` : `babel-preset-expo` (plugin reanimated + module-resolver conservés).
- `app.json` : bloc `expo` (bundle `com.yaya.relock`, scheme `relock`).
- `index.js` reste l'entrée (`main: "index.js"`) ; en DEBUG l'AppDelegate charge l'entrée virtuelle `.expo/.virtual-metro-entry` servie par `expo start`.

## Tests / qualité

```bash
npm test              # Jest
npx tsc --noEmit      # TypeScript strict
biome check .         # lint/format
```

## Identité

- Bundle iOS : `com.yaya.relock` · scheme deep link : `relock://`
- Branche de travail : `blocus-v1-build`
