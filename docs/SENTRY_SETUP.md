# Sentry — Configuration complète (Relock)

Surveillance des crashs, des erreurs et de la santé des versions.
Voir aussi : [.claude/rules/security.md](../.claude/rules/security.md) (redaction),
[.claude/rules/shared-services.md](../.claude/rules/shared-services.md) (couche monitoring).

---

## 0) Ce qu'il faut créer sur sentry.io

1. Compte + organisation sur [sentry.io](https://sentry.io) (offre gratuite : 5 000 erreurs/mois).
2. **New Project → React Native**, nommé `relock`. Sentry affiche alors le **DSN**.
3. **Settings → Developer Settings → Organization Tokens → Create New Token**.
   Prendre un jeton d'**organisation** (préfixe `sntrys_`), pas un jeton
   personnel : son périmètre `org:ci` est déjà calibré pour les builds, et il
   survit au départ de son créateur — un jeton personnel casserait la CI ce
   jour-là. Il n'est affiché qu'une fois.

   Ce jeton embarque l'URL du serveur et celle de la région : ne PAS ajouter
   de `defaults.url` dans `sentry.properties`, sentry-cli signalerait un
   conflit.

   Un `sentry-cli projects list` renverra **403** avec ce jeton : c'est normal,
   `org:ci` autorise les releases et l'upload, pas la lecture du catalogue.

Deux identifiants, deux natures — ne pas les confondre :

| | Où | Secret ? |
|---|---|---|
| **DSN** | `.env` → `SENTRY_DSN` | Non : il part dans le binaire. |
| **Auth token** | `ios/sentry.properties`, `android/sentry.properties` | **Oui**, secret d'organisation. Gitignoré. |

---

## 1) Variables d'environnement

Dans `.env` (voir `.env.example` pour la liste commentée) :

```dotenv
SENTRY_DSN=https://xxxxx@oyyyy.ingest.sentry.io/zzzz
SENTRY_ENABLE_IN_DEV=1          # 0 en temps normal ; 1 pour vérifier
SENTRY_TRACES_SAMPLE_RATE=0.2   # 1.0 le temps de la vérification
SENTRY_PROFILES_SAMPLE_RATE=0.2
SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

⚠️ `react-native-config` lit `.env` **au build**, pas au démarrage.
Toute modification impose un `npm run ios` / `npm run android` complet — un
simple *fast refresh* ne la voit pas.

---

## 2) Identifiants sentry-cli (source maps)

```bash
cp sentry.properties.example ios/sentry.properties
cp sentry.properties.example android/sentry.properties
# puis remplir org / project / auth.token dans les deux
```

Les deux fichiers sont **gitignorés**. Tant qu'ils contiennent encore le
marqueur `REMPLACER`, l'upload est automatiquement désactivé et le build
affiche un avertissement — c'est voulu : un dépôt fraîchement cloné doit
pouvoir produire un build.

En CI, ces fichiers sont écrits par l'étape « Configure Sentry » à partir des
secrets `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

Pour vérifier un jeton sans lancer de build :

```bash
SENTRY_PROPERTIES=ios/sentry.properties npx sentry-cli info
```

---

## 3) Pourquoi les source maps sont LE point critique

Un bundle de production est minifié : sans source map, une stack ressemble à
`a.b.c (index.android.bundle:1:284913)`. Inexploitable.

L'appariement bundle ↔ source map repose sur **deux mécanismes** :

- **Debug ID** — un identifiant identique injecté dans le bundle et dans sa
  source map par le sérialiseur Metro (`withSentryConfig` dans
  `metro.config.js`). Le plus fiable : indépendant de la version.
- **Nom de release** — `applicationId@versionName+versionCode`, calculé à
  l'identique par le SDK à l'exécution et par sentry-cli à l'upload.

D'où la règle : **ne jamais fixer `release` / `dist` à la main dans
`Sentry.init`**. Le SDK natif les lit du binaire ; les écrire en JS désaligne
les deux moitiés et rend les stacks illisibles alors que tout « a l'air »
configuré.

**Où l'upload a lieu, et nulle part ailleurs :**

| Plateforme | Mécanisme | Fichier |
|---|---|---|
| iOS — source maps JS | wrapper `sentry-xcode.sh` autour de la phase de bundle | `ios/Relock.xcodeproj` |
| iOS — symboles natifs (dSYM) | phase « Upload Debug Symbols to Sentry », en dernier | `ios/Relock.xcodeproj` |
| Android — les deux | `sentry.gradle`, accroché aux variantes release | `android/app/build.gradle` |

La phase dSYM est placée **après** « Copy Hermes dSYM into the archive » :
le dSYM Hermes récupéré juste avant part donc lui aussi.

---

## 4) Ce que le code fait déjà

| Fichier | Rôle |
|---|---|
| `src/shared/services/monitoring/sentry.ts` | Point d'entrée UNIQUE. Aucun autre fichier n'importe `@sentry/react-native`. |
| `src/shared/services/monitoring/scrub.ts` | Redaction avant envoi (`beforeSend` / `beforeBreadcrumb`), testée unitairement. |
| `app/_layout.tsx` | `initSentry()`, `Sentry.wrap()`, instrumentation Expo Router, tags, capture des échecs de démarrage. |
| `src/session/useSessionUser.ts` | `setSentryUser(id)` — l'UUID Supabase seul, jamais l'e-mail. |
| `src/session/logout.ts` | `setSentryUser(null)` à la déconnexion. |
| `.../api/query/client/query-client.ts` | Erreurs React Query, regroupées par `(source, code, statut)`. |
| `.../api/http/interceptors/logging.interceptor.ts` | Fil d'Ariane HTTP, **en production aussi**. |

### Confidentialité

- `sendDefaultPii: false` — le SDK n'ajoute ni IP, ni e-mail, ni corps de requête.
- `scrubEvent` / `scrubBreadcrumb` masquent JWT, `Bearer …`, e-mails, clés
  RevenueCat, chaînes opaques longues ; coupent les query strings ; ne
  gardent de l'utilisateur que son `id`.
- Session Replay, s'il est activé, masque **tout** (texte, images, vecteurs).
- Les *variables* des mutations React Query ne sont jamais envoyées.

---

## 5) Vérifier que ça marche

### En développement

```bash
# .env : SENTRY_DSN rempli + SENTRY_ENABLE_IN_DEV=1
npm run ios          # build complet OBLIGATOIRE (.env lu au build)
```

Puis, via le pont de dev (`src/session/dev-test-bridge.ts`) :

| Commande | Ce qu'elle prouve |
|---|---|
| `relock://dev/sentry-status` | Les événements partent-ils, oui ou non ? |
| `relock://dev/sentry-js` | DSN, scrubbing, contexte utilisateur. |
| `relock://dev/sentry-native` | dSYM / symboles natifs (**crashe l'app**, c'est normal). |

### En production — le seul test qui compte

Les source maps ne servent qu'en build **Release**, où le pont de dev est
inactif. D'où le déclencheur qui traverse la frontière :

> **Réglages → appui long (1,2 s) sur le numéro de version.**

Un événement non fatal part. Dans Sentry, la stack doit montrer
`SettingsScreen.tsx:<ligne>` et non `index.android.bundle:1:…`.
Si l'app affiche « Sentry inactif », le DSN n'est pas embarqué dans ce build.

---

## 6) Réglages à faire dans le dashboard

1. **Alerts → Create Alert → Issues** : « A new issue is created » →
   e-mail / Slack. C'est l'alerte qui compte le plus.
2. **Alerts** : « An issue changes state from resolved to unresolved »
   (régression) — un bug qu'on croyait réglé.
3. **Releases** : vérifier que les versions apparaissent avec leurs artefacts
   (bundle + source map). Une release sans artefact = symbolication cassée.
4. **Settings → Security & Privacy** : activer *Data Scrubber* et
   *Prevent Storing of IP Addresses* — ceinture et bretelles côté serveur.
5. **Settings → Inbound Filters** : filtrer les versions anciennes une fois
   les mises à jour déployées.

---

## 7) Les extensions iOS

Les cinq extensions Family Controls sont des **processus séparés** : un crash
chez elles n'apparaît pas dans le rapport de l'app hôte. Elles ne peuvent pas
toutes être traitées de la même façon, et ce n'est pas un choix de commodité —
c'est une contrainte de la plateforme.

| Extension | Peut héberger un SDK ? | Pourquoi |
|---|---|---|
| `RelockActivityReport` | **Non** | Apple refuse **tout accès réseau** aux `DeviceActivityReportExtension`. |
| `RelockShield` | **Non** | Appelée de façon synchrone pour dessiner chaque bouclier : toute latence se paie sur le geste central du produit. |
| `RelockMonitor` | Oui | Réveillée sur événement, a le temps et le réseau. |
| `RelockShieldAction` | Oui | Déclenchée par un tap utilisateur. |
| `RelockWidgets` | Oui | Extension de widget ordinaire. |

D'où **deux mécanismes complémentaires**, pas redondants :

### a) `ExtensionLog` — les erreurs ATTRAPÉES, pour les 5

`ios/Shared/ExtensionLog.swift` écrit dans le groupe d'app
`group.com.yaya.relock` (même conteneur que `ShieldAttemptStore`), en tampon
circulaire borné à 60 entrées. L'app draine ce journal à son démarrage suivant
(`drainExtensionTelemetry`, appelé depuis `app/_layout.tsx`) et le transmet à
Sentry.

C'est le **seul** canal possible pour les deux extensions ci-dessus.

Pannes silencieuses aujourd'hui instrumentées :

| Cible | Ce qui est signalé | Symptôme utilisateur sans la trace |
|---|---|---|
| `shield` | groupe d'app inaccessible | Les résistances restent à zéro, sans raison visible. |
| `monitor` | `startMonitoring` échoue | « Mon déblocage de 5 min s'est arrêté au bout de 10 s. » |
| `action` | demande d'ouverture non écrite | Le bouton du mur « ne marche pas », au hasard. |
| `report` | conteneur partagé injoignable | Le score d'accueil reste figé sur une valeur périmée. |

Les événements arrivent **en différé** (au prochain lancement de l'app) : le
tag `deferred` et le champ `occurred_at` conservent l'instant réel.

### b) `ExtensionSentry` — les crashs DURS, pour les 3

`ios/Shared/ExtensionSentry.swift` démarre sentry-cocoa dans `RelockMonitor`,
`RelockShieldAction` et `RelockWidgets` (pod déclaré dans `ios/Podfile`, version
lue dans le podspec de RNSentry pour rester alignée sur l'app).

Points de conception :

- **DSN** — une extension ne peut pas lire `.env` (`react-native-config` n'y
  existe pas). L'app le dépose dans le groupe d'app à chaque démarrage
  (`publishSentryDsnToExtensions`). Conséquence assumée : une extension qui
  s'exécute avant le tout premier lancement de l'app reste muette.
- **Cache d'enveloppes** dans le conteneur partagé, un sous-dossier par cible :
  une extension tuée sans réseau ne perd pas son événement.
- **`releaseName` forcé** à `com.yaya.relock@<version>+<build>` — sinon chaque
  extension créerait sa propre release et Release Health compterait quatre
  produits au lieu d'un.
- Session tracking, App Hang, watchdog et tracing désactivés : ces notions
  n'ont pas de sens dans un processus qui vit quelques millisecondes.

`#if canImport(Sentry)` rend le fichier compilable dans une cible qui ne lie
pas le pod, où il devient un no-op : un oubli de configuration ne peut pas
casser un build.
