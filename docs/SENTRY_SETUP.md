# Sentry — Configuration complète (Relock)

Surveillance des crashs, des erreurs et de la santé des versions.
Voir aussi : [.claude/rules/security.md](../.claude/rules/security.md) (redaction),
[.claude/rules/shared-services.md](../.claude/rules/shared-services.md) (couche monitoring).

---

## 0) Ce qu'il faut créer sur sentry.io

1. Compte + organisation sur [sentry.io](https://sentry.io) (offre gratuite : 5 000 erreurs/mois).
2. **New Project → React Native**, nommé `relock`. Sentry affiche alors le **DSN**.
3. **Settings → Auth Tokens → Create New Token**, scopes `project:releases` et `org:read`.

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

## 7) Limite connue — les extensions iOS

Les cinq extensions Family Controls (`RelockActivityReport`, `RelockMonitor`,
`RelockShield`, `RelockShieldAction`, `RelockWidgets`) sont des **processus
séparés** : un crash chez elles n'apparaît pas dans le rapport de l'app hôte.

Elles ne se traitent pas toutes pareil :

- `RelockActivityReport` (`DeviceActivityReportExtension`) n'a **aucun accès
  réseau** — Apple l'interdit. Aucun SDK de télémétrie ne peut y fonctionner.
- `RelockShield` (`ShieldConfigurationDataSource`) est appelée de façon
  synchrone pour dessiner chaque bouclier : y démarrer un SDK ajouterait de
  la latence sur le geste central du produit.
- `RelockMonitor`, `RelockShieldAction` et `RelockWidgets` pourraient
  accueillir sentry-cocoa, avec son cache d'enveloppes pointé vers le
  conteneur du groupe d'app `group.com.yaya.relock`.

L'approche réaliste pour les deux premières est un **journal de miettes dans
le groupe d'app**, relu et transmis par l'app au démarrage suivant — le
mécanisme qu'utilise déjà `ios/Shared/ShieldAttemptStore.swift`.

Non implémenté à ce jour.
