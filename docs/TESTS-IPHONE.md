# Tester Relock sur un iPhone physique

Le cœur de Relock (Family Controls, DeviceActivity, ManagedSettings) **n'existe
pas sur simulateur**. Toute vérification sérieuse passe donc par un iPhone
branché, piloté depuis le Mac par deux outils complémentaires :

| Outil | Ce qu'il apporte | Ce qu'il ne peut pas faire |
|---|---|---|
| **XCUITest** (`ios/RelockUITests/`) | Déverrouille l'appareil, lance l'app, tape, fait défiler, capture l'écran | Lire l'état natif (App Group, bouclier) |
| **Pont de dev** (`src/session/dev-test-bridge.ts`) | Interroge et pilote le natif depuis le Mac en Wi-Fi | Toucher l'interface |

Les deux ensemble donnent la vérité complète : ce que l'utilisateur **voit** et
ce que le système **applique**.

---

## 1. Mise en place

```bash
# a) Adresse du Mac vue par l'iPhone — À RECALCULER À CHAQUE FOIS (cf. pièges)
HOST=$(ipconfig getifaddr en0)

# b) Metro (garder sa sortie dans un fichier : les console.log de l'app y vont)
npx expo start --dev-client --lan --scheme relock > /tmp/metro.log 2>&1 &

# c) Serveur de commandes — un dossier contenant relock-dev-commands.json
mkdir -p /tmp/devcmd && cd /tmp/devcmd
echo '{"id": 1, "cmd": "noop"}' > relock-dev-commands.json
python3 -m http.server 8123 --bind 0.0.0.0 &

# d) Collecteur de résultats (port 8124) — tout serveur qui journalise le POST
```

Envoyer une commande — **l'`id` doit être strictement croissant** :

```bash
echo "{\"id\": $(date +%s), \"cmd\": \"diag\"}" > /tmp/devcmd/relock-dev-commands.json
```

Lancer l'app en la pointant explicitement sur le bon Metro, puis la maintenir
au premier plan pendant la session de test :

```bash
xcrun devicectl device process launch --terminate-existing --device <UDID> \
  --payload-url "relock://expo-development-client/?url=http%3A%2F%2F${HOST}%3A8081" \
  com.yaya.relock

TEST_RUNNER_RELOCK_ATTACH=1 TEST_RUNNER_RELOCK_DEV_HOST="$HOST" \
TEST_RUNNER_RELOCK_HOLD_SECONDS=900 \
xcodebuild test -workspace ios/Relock.xcworkspace \
  -scheme Relock -destination "platform=iOS,id=<UDID>" \
  -only-testing:RelockUITests/RelockBridgeDiagnosticsTests/testHoldForegroundForBridgeCommands
```

> `TEST_RUNNER_…` doit être une variable d'environnement **du processus
> `xcodebuild`**, pas un argument de build : xcodebuild retire le préfixe et
> transmet le reste au runner.

---

## 2. Cinq pièges qui font perdre des heures

1. **Autorisation « Réseau local » (iOS 14+).** Sans
   `NSLocalNetworkUsageDescription` dans `Info.plist`, l'iPhone refuse toute
   connexion vers une IP locale : l'app se lance, ne charge jamais son bundle,
   et le pont reste muet. Symptôme discriminant : `URLSession` renvoie **-1009**
   pour une IP du LAN alors que `localhost` répond -1004.
   `testDeviceCanReachDevelopmentMac` diagnostique ce cas depuis l'appareil.

2. **L'adresse du Mac change.** En changeant de Wi-Fi, `en0` passe par exemple
   de `172.20.x` à `192.168.x`. L'entrée « RECENTLY OPENED » du dev-launcher
   qui semble périmée est parfois la bonne, et l'IP notée dans un script est
   parfois la mauvaise. **Toujours recalculer `ipconfig getifaddr en0`.**

3. **L'iPhone se verrouille.** iOS suspend alors les timers JavaScript : le
   pont cesse de lire les commandes sans rien signaler.
   `devicectl process launch` ne déverrouille pas l'appareil ; une session
   XCUITest si — d'où le test de maintien.

4. **Les simulateurs répondent aussi.** Un simulateur qui fait tourner Relock
   interroge le même serveur de commandes (`localhost` = le Mac) et **écrase
   les rapports de l'iPhone** avec des valeurs vides (aucun Family Controls).
   `xcrun simctl shutdown all` avant toute session.

5. **Un harnais ne doit JAMAIS toucher l'interface « pour rien ».** Une
   première version du test de maintien touchait le centre de l'écran toutes
   les dix secondes pour empêcher la veille : sur la feuille « Nouveau
   blocage », ces touches ont fini par créer une vraie règle dans le compte.
   La session XCUITest suffit à garder l'appareil éveillé.

---

## 3. Commandes du pont

| Commande | Effet |
|---|---|
| `diag` | Bilan natif complet, dont la **vérité système** : `shieldApplications`, `shieldCategories`, `ruleDays`, `suspendedRules`, `armedActivities`, `limitProgress` |
| `rules` | Confronte les règles en base, l'état déduit par le moteur JS et les activités réellement armées par iOS |
| `selinfo` | Par règle : nb d'apps / catégories / domaines + sursis en cours |
| `blocked` | Union dédupliquée des apps sous bouclier |
| `unlock-test` | Débloque la 1ʳᵉ app 5 min et vérifie qu'elle **reste** listée |
| `mkrule/<block_now\|schedule\|daily_limit>/<valeur>` | Crée une VRAIE règle « [TEST] … » avec la sélection d'apps existante |
| `rmtest` | Supprime toutes les règles « [TEST] … » (base + natif) |
| `pause/<id>/<secondes>` · `resume/<id>` | Cycle de suspension, avec `ruleDays` avant/après |
| `limit/on\|off/<id>` | Rejoue l'effet d'un quota atteint (build DEBUG) |
| `sync` | Remonte le journal natif vers `daily_stats` |
| `auth` | (Re)demande l'autorisation Temps d'écran |

### Ce que `shieldApplications` prouve

`blocus.isBlocking` est un drapeau que Relock écrit elle-même : il dit ce que
l'app **croit** avoir fait. `shieldApplications` relit le magasin
ManagedSettings — c'est ce qu'iOS **applique**. C'est la seule mesure qui
distingue « la règle est armée » de « les apps sont réellement bloquées ».

---

## 4. Vérifier les trois mécaniques

```bash
# Bloquer maintenant  → l'activité « timed.<id> » doit être armée
# Plage horaire       → « sched.<id> » armée + ruleDays conservé
# Limite de temps/jour→ « limit.<id> » armée ; à l'échéance le moniteur écrit
#                       limitProgress = 100 et le bouclier monte tout seul
```

Un franchissement de seuil réel s'observe dans `diag` :
`monitorLastWakeWhat: "eventDidReachThreshold limit.<id> limitReached"` prouve
que l'extension `RelockMonitor` a bien été réveillée par iOS. Comme
`startDailyLimit` pose ses seuils avec `includesPastActivity: true`, une
limite créée en cours de journée compte l'usage **depuis minuit** : une limite
basse se déclenche donc immédiatement, ce qui rend la vérification instantanée.

---

## 5. Exercer le mur système

Le mur (`ios/RelockShield`) est dessiné **hors process** : son texte n'apparaît
dans la hiérarchie d'accessibilité d'aucune app, et interroger l'app bloquée
échoue en `kAXErrorServerNotFound` (elle n'est même pas lancée). Deux
conséquences pratiques :

- capturer avec `XCUIScreen.main.screenshot()`, jamais
  `XCUIApplication.screenshot()` ;
- pour savoir QUELLE app a buté sur le mur, lire `shieldLastApplicationName`
  dans `diag` — les jetons Family Controls étant opaques, rien d'autre ne le
  dit. `testCaptureSystemShieldForCandidateApps` ouvre une liste de bundles
  (`TEST_RUNNER_RELOCK_SHIELD_BUNDLES`) ; le diagnostic tranche ensuite.

⚠️ **Une sélection d'apps ne peut pas être fabriquée par un test.** Seul le
sélecteur système `FamilyActivityPicker` produit des jetons, et Apple le
protège : son contenu n'est pas exposé à l'automatisation. Il faut donc qu'un
humain ait choisi au moins une app dans Relock avant tout test du mur — et
refaire ce choix après une réinstallation qui purge l'App Group (cf. §2).
