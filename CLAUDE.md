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
| `npm run ios` | build + install + démarre Metro + **connecte l'app au serveur automatiquement** (`scripts/dev-run.cjs`) |
| `npm run android` | idem côté Android |
| `npm run dev:open` | connecte l'app déjà installée au Metro en cours, sans rebuild |
| `npm run ios:raw` / `android:raw` | `expo run:*` brut, sans l'automatisation ci-dessus |

### Connexion automatique au serveur Metro (plus de saisie d'URL)

Le dev-launcher relance seul le dernier bundle ouvert, mais cette mémoire vit dans
les données de l'app : une désinstallation la vide. Et sur iPhone **physique**,
`expo run:ios` se contente d'installer le binaire — il ne transmet jamais l'URL du
serveur (cf. `@expo/cli` `run/ios/launchApp.js`, qui `return` avant le launch
lorsque la cible n'est pas un simulateur). D'où l'écran « Enter URL manually ».

`scripts/dev-open.cjs` relance l'app avec l'argument `--initialUrl <url>`, que le
dev-launcher lit au démarrage avant d'afficher son UI
(`EXDevLauncherController.initialUrlFromProcessInfo`) ; sur Android il passe par le
deep link `relock://expo-development-client/?url=…` après un `adb reverse`.
L'IP LAN est recalculée à chaque lancement, donc un changement DHCP est sans effet.

`scripts/dev-run.cjs` orchestre le tout : `expo run:* --no-bundler` (indispensable,
sinon `expo run` garde Metro au premier plan et rien ne peut s'enchaîner), puis
`expo start`, puis la connexion dès que Metro répond. Si un Metro tourne déjà, il
n'en démarre pas un second.

**Recette :**
1. **Première fois / après un changement natif ou de pods** : `npm run ios` (build complet, installe, lance, démarre Metro).
2. **Ensuite, changements JS uniquement** : `npm start`, puis `npm run dev:open` dans un second terminal — l'app installée se rouvre directement sur le bon serveur (aucune URL à saisir, aucun QR à scanner).

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

`ios/Relock/AppDelegate.swift` est en `ExpoAppDelegate` + `ExpoReactNativeFactory` :

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
- Branche de travail : `main` (anciennement `blocus-v1-build`, renommée le 2026-09-06)
