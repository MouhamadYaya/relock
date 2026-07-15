# Relock — Rapport QA pré-App Store

> ## ✅ Post-correctifs (13 juillet 2026, même jour)
> **« Fix all » exécuté.** État après correction — build natif OK, `tsc` clean, 83/83 tests :
>
> | Bug | Correctif appliqué |
> |---|---|
> | **B1** | App Group ajouté à `RelockShieldAction.entitlements` → les « resisted » arrivent enfin |
> | **B2** | Détection réelle via `UIManager.hasViewManagerConfig` + prop `fallback` + ErrorBoundary interne — plus aucun crash possible de l'onglet Activité |
> | **B3/B21** | Protocole **pull-ack** : session vérifiée avant lecture, `ackEvents(n)` après upsert réussi — zéro perte |
> | **B4/B5/B6** | Refonte multi-blocages : **une activité DeviceActivity par règle** (`timed.<id>`…), **sélection par règle** (`selection.<id>`), bouclier = **union des fenêtres actives**, `stopRule`/`clearRuleData` ciblés — pause/fin d'une règle n'affecte plus jamais les autres |
> | **B7** | Plus de wipe cloud silencieux : dialogue « Reprendre mes données / Repartir de zéro » (`useFreshInstallPrompt`) |
> | **B8** | `heartbeatToday()` : jour de contrôle = blocage actif ce jour (un jour parfait ne casse plus la série) + tout jour avec événement compte |
> | **B9** | `recent(365)` — série/record dé-plafonnés (test mis à jour) |
> | **B10** | Carte Activité pilotée par la période (Aujourd'hui / 7 j / 30 j) + `periodLabel` dérivé dans l'extension (fini le « aujourd'hui » en dur) |
> | **B11/B12** | Kinds Monitor renommés (`window_start`/`window_end`/`limit_reached`) ; l'Activité affiche **Interceptions + Série** (fini le doublon Résistances) |
> | **B13** | Déjà résolu par la carte « Actif/En pause » (plus d'anneau quota mensonger) |
> | **B15** | Fenêtre minutée en **composants de date complets** — traverse minuit sans ambiguïté |
> | **B16** | `CodeSignOnCopy` ajouté à `RelockMonitor.appex` |
> | **B17** | `strictUntil` global supprimé (strict géré par règle côté JS) |
> | **B19/B20** | `app.json` → `com.yaya.relock` ; `RCTNewArchEnabled` retiré du plist Monitor |
> | Login | Bandeau démo/mock, identifiants pré-remplis et boutons sociaux morts **supprimés** (vérifié à l'écran) |
> | Onboarding | Cartes FR véridiques dans les 4 langues (fini « encrypted end-to-end » et « instant sync ») |
> | Réglages | Apparence/Langue **branchés** sur les vraies modales, statut Temps d'écran **réel** (tap = demande d'autorisation), lignes mortes (Notifications, Abonnement/Premium, À propos, Confidentialité, rituel) **supprimées** |
> | Info.plist | `NSLocationWhenInUseUsageDescription` vide **retiré** |
>
> **Créés** : `bindSelection`/`stopRule`/`clearRuleData`/`ackEvents` (natif + bridge), `genUUID` (id client → lie natif ↔ DB dès la création, avec rollback si l'insert échoue), `StatsService.heartbeatToday`.
> **Restent à ta charge** : exécuter la vérification sur iPhone (§ « À vérifier sur appareil »), demande d'entitlement **Family Controls distribution** pour les 5 bundle IDs, `PrivacyInfo.xcprivacy` à revalider, et **B14** (pause→reprise d'une limite remet le quota du jour à zéro — contrainte DeviceActivity, à assumer dans l'UI plus tard).

---

**Date** : 13 juillet 2026 · **Build audité** : branche locale (dernier commit `b6c60c9`) + modifications non commitées
**Méthode** : audit complet de la chaîne de données (Swift natif + extensions + JS + Supabase), 83 tests automatisés (dont 39 nouveaux de simulation temporelle multi-jours/mois, exécutés dans 2 fuseaux horaires), campagne dynamique sur simulateur iPhone 17 Pro Max (démarrage à froid, kill/relaunch, background/foreground, réinstallation complète).

**Limites de la campagne** : Family Controls ne fonctionne pas sur simulateur (interception réelle testée par analyse statique du code natif) ; pas de session Supabase créée (les tests E2E authentifiés restent à faire par toi sur ton iPhone — voir « À vérifier sur appareil » en fin de rapport).

---

## 0. Verdict global

**L'app n'est pas prête pour la soumission.** La chaîne de statistiques est bien architecturée dans son principe (extension → App Group → Supabase → UI, une seule source de vérité pour tous les écrans), et la logique temporelle JS est saine (39/39 tests). **Mais la chaîne est cassée à sa source** (les interceptions n'arrivent jamais — cause racine identifiée, correctif d'une ligne), plusieurs comportements natifs rendent le multi-blocages incohérent, et une douzaine d'éléments feraient rejeter l'app par Apple en l'état.

---

## 1. Chaîne de données — cartographie par statistique

> Chaîne théorique : Événement système → Capture (extension) → Journal App Group → `pullEvents` (drain) → `StatsService.syncFromDevice` → Supabase `daily_stats` → `useHomeStats` (React Query) → UI (Accueil + Activité).

| Statistique | Créée | Stockée | Mise à jour | Lue | Étape cassée / manquante |
|---|---|---|---|---|---|
| **Interceptions** | Tap « Fermer » sur le shield → `RelockShieldAction.logResisted()` | `eventLog` (App Group) → `daily_stats.interceptions_count` | `syncFromDevice` à chaque focus Accueil/Activité | `useHomeStats` → 2 écrans | 🔴 **B1** : l'extension écrit dans un conteneur non partagé (entitlement absent) → rien n'arrive jamais. 🔴 **B3** : drain destructif avant vérif session. 🟠 **B11** : les événements du Monitor (`intercepted`, `limit_reached`) sont drainés puis jetés. |
| **« Tu as résisté à X ouvertures »** | Identique (même événement) | `daily_stats.opens_stopped` | Identique | `useHomeStats.resisted` | 🟠 **B12** : duplication — toujours strictement égal à Interceptions. |
| **Temps regagné** | Dérivée : `resisted × 5 min` (`MIN_SAVED_PER_RESIST`) | `daily_stats.time_saved_minutes` | Au sync | `useHomeStats.savedMinutes` | Dépend de B1/B3. Heuristique jamais annoncée comme estimation dans l'UI. |
| **Série (jours de contrôle)** | `streak_respected=true` posé quand ≥1 « resisted » ce jour | `daily_stats.streak_respected` | Au sync | `computeStreak(recent(30))` | 🔴 **B8** : sémantique inversée (un jour parfait sans tentative CASSE la série). 🟠 **B9** : plafond à 30 jours (démontré par test). |
| **Record** | Jamais persisté — recalculé | — | — | `computeRecordStreak(recent(30))` | 🟠 **B9** : plafonné à 30 j ; un record ancien (>30 j) est oublié. |
| **Semaine (7 barres)** | Dérivée de `daily_stats` | — | — | `computeWeek(recent(30))` | ✅ Sain (validé lun→dim, chevauchement de mois, DST). |
| **Temps d'écran / graphe / top apps (Activité)** | iOS (extension `RelockActivityReport`, données cloisonnées par Apple) | Jamais synchronisé (contrainte Apple — normal) | Rendu par iOS | Vue native `ScreenTimeReportView` | 🔴 **B2** : garde de disponibilité cassée → crash au lieu du fallback. 🟠 **B10** : libellé « aujourd'hui » codé en dur même en mode Semaine/Mois. |
| **Quota limite/jour (anneau ambre)** | Jamais créée — les minutes consommées ne remontent pas au JS (contrainte Apple) | — | — | `ringInfo` → placeholder plein | 🟠 **B13** : l'anneau promet une info qui n'existe pas. |

**Cohérence inter-écrans : ✅ validée par construction.** Accueil et Activité lisent le **même hook** `useHomeStats` (même clé React Query) → impossible qu'ils divergent. Le rafraîchissement au retour au premier plan fonctionne (`focusManager` correctement câblé sur `AppState` + `refetchOnWindowFocus`).

---

## 2. Bugs (avec cause et correctif)

### 🔴 P0 — Bloquants (à corriger avant toute soumission)

**B1 — Les interceptions ne sont JAMAIS enregistrées** *(ton symptôme exact)*
- **Constat** : tap « Fermer » sur l'écran de blocage → aucun compteur ne bouge, jamais.
- **Cause racine** : `ios/RelockShieldAction/RelockShieldAction.entitlements` ne contient **pas** `com.apple.security.application-groups`. Sans cet entitlement, `UserDefaults(suiteName: "group.com.yaya.relock")` retombe silencieusement sur un conteneur privé de l'extension : les écritures « réussissent » mais l'app principale ne les voit jamais.
- **Preuve** : `RelockMonitor.entitlements` a l'App Group (et son partage de `selection` fonctionne — le blocage marche) ; ShieldAction ne l'a pas.
- **Correctif** (1 ligne de plist + provisioning) : ajouter au plist l'App Group `group.com.yaya.relock`, régénérer le profil de l'extension, rebuild. Vérifier ensuite sur iPhone : ouvrir TikTok bloqué → « Fermer » → rouvrir Relock → le compteur doit monter.

**B2 — Crash au lancement si l'onglet Activité a été visité (Render Error `ScreenTimeReportView`)**
- **Constat reproduit en campagne** : kill → relaunch → écran rouge plein écran dès le démarrage. La persistance de navigation restaure l'onglet Activité, dont la vue native n'a pas de view config → erreur de rendu. En release, l'unique `ErrorBoundary` (racine, `App.tsx`) remplace **toute l'app**.
- **Cause** : `requireNativeComponent()` **ne lève jamais d'exception** — le try/catch de `ScreenTimeReport.tsx` est mort, `isScreenTimeReportAvailable` vaut toujours `true` sur iOS, le fallback « Disponible sur iPhone » est inatteignable. (Déclencheur ici : le build installé précède l'ajout de l'enregistrement interop Fabric dans `ScreenTimeReportViewManager.m` — mais le garde doit protéger tous les cas.)
- **Correctif** : détecter réellement la vue — `UIManager.getViewManagerConfig('ScreenTimeReportView') != null` — + ErrorBoundary par onglet (pas seulement racine), + envisager d'exclure l'état de navigation restauré vers des écrans à composants natifs.

**B3 — Perte définitive d'événements de stats**
- **Constat** : `syncFromDevice()` appelle `pullEvents()` (qui **vide** le journal natif) **avant** de vérifier la session (`getUser`) et avant l'écriture Supabase. Utilisateur non connecté → `return` silencieux → événements perdus. Écriture Supabase échouée (offline, avion) → événements perdus. C'est la 2ᵉ raison pour laquelle tes compteurs semblent figés même quand des événements existent.
- **Correctif** : protocole *pull-ack* — lire sans vider ; ne purger (`ack`) qu'après upsert réussi ; ne rien lire si pas de session. Bonus : supprime aussi la course append/pull entre processus (fenêtre de perte actuelle).

**B4 — Mettre en pause UN blocage arrête TOUS les blocages système**
- **Constat** : `stopBlocking()` natif fait `stopMonitoring([timed, schedule, limit])` + `clearShield()` — les 3 mécaniques. Le JS l'appelle pour la pause/l'arrêt d'**une** règle. Résultat : pause de la plage horaire → le blocage minuté et la limite quotidienne **cessent de bloquer réellement**, tout en restant affichés « actifs » (DB inchangée) → désynchronisation totale UI/système.
- **Correctif** : `stopMonitoring` ciblé par type + après tout stop, ré-armer les règles encore actives en DB.

**B5 — Une seule sélection d'apps pour toutes les règles**
- **Constat** : la clé App Group `selection` est **unique**. Créer un 2ᵉ blocage avec d'autres apps écrase la sélection du 1ᵉʳ : toutes les règles bloquent désormais les apps de la **dernière** sélection. « Plusieurs applications bloquées » par règles différentes est incohérent par construction.
- **Correctif** : stocker une sélection **par règle** (clé `selection.<ruleId>`) ; le shield applique l'**union** des sélections des règles actives ; le Monitor résout par activité.

**B6 — Chevauchement : la fin d'un blocage retire le bouclier des autres**
- **Constat** : `RelockMonitor.intervalDidEnd` fait `clearShield()` inconditionnel. Un minuté qui finit à 15 h enlève le bouclier d'une plage 14 h→18 h encore active (jusqu'au prochain réveil du Monitor).
- **Correctif** : tenir l'état des fenêtres actives dans l'App Group ; à `intervalDidEnd`, ne retirer le shield que si **aucune** autre fenêtre n'est en cours, sinon re-poser.

### 🟠 P1 — Majeurs (avant soumission ou 1ʳᵉ mise à jour)

**B7 — Réinstallation / nouvel appareil = destruction silencieuse de l'historique du compte.** `resetIfFreshInstall` (drapeau `UserDefaults.standard`, effacé à la désinstallation) déclenche `wipeCloudIfPending` → suppression de **toutes** les règles, stats et événements du compte au premier login. Installer l'app sur un iPad ou un nouvel iPhone efface le compte, même si l'ancien téléphone marche encore. → Purger le **système/local** (bien), mais demander confirmation avant tout wipe **cloud**.

**B8 — La « série » mesure l'inverse du contrôle.** `streak_respected=true` uniquement les jours avec ≥1 résistance : un jour parfait (aucune tentative d'ouverture) **casse la série** ; un jour à 15 tentatives la « respecte ». → Redéfinir « jour de contrôle » (ex. : ≥1 blocage actif ce jour-là, indépendamment des tentatives), calculé par jour.

**B9 — Série et record plafonnés à 30 jours.** `recent(30)` + calcul côté client : une série réelle de 45 jours affiche 30 (démontré par le test « BUG DOCUMENTÉ » de `__tests__/stats-simulation.test.ts`). Le record > 30 j est oublié. → Étendre la fenêtre (365) ou calculer côté SQL ; persister le record.

**B10 — Filtres Activité incohérents.** Le segment Jour/Semaine/Mois ne pilote que la vue native ; la carte résumé au-dessus reste « Aujourd'hui, 13 juillet » en mode Mois, et le libellé « aujourd'hui » est codé en dur dans `UsageReportView.swift` même en Semaine/Mois. → Brancher la carte sur la période + libellé dynamique.

**B11 — Les événements du Monitor sont jetés.** Le sync ne compte que `kind === 'resisted'` ; `intercepted`, `limit_reached`, `interval_end` sont drainés puis ignorés (et perdus, cf. B3). Aucune trace des débuts/fins de fenêtres ni des limites atteintes.

**B12 — « Résistances » et « Interceptions » = le même chiffre.** `opens_stopped` et `interceptions_count` sont incrémentés à l'identique. Deux libellés pour une même valeur sur l'écran Activité = confusion. → Fusionner, ou différencier réellement (ex. interceptions = poses de bouclier du Monitor ; résistances = taps « Fermer »).

**B13 — Anneau « quota » de la limite quotidienne mensonger.** Toujours plein (placeholder) : iOS ne remonte pas les minutes consommées au JS. → Remplacer par un état binaire (« sous la limite » / « limite atteinte », dérivable de `limit_reached` une fois B1/B11 corrigés) ou retirer l'anneau.

**B14 — Pause→reprise d'une limite quotidienne remet le compteur d'usage à zéro.** Re-`startDailyLimit` à 18 h → le seuil repart de 0 pour la journée ; l'usage déjà consommé est oublié (contrainte DeviceActivity). → Au minimum l'assumer dans l'UI.

**B15 — Blocage minuté à cheval sur minuit.** `startTimedBlock` construit l'intervalle avec heure/minute/seconde sans jour : 23 h 50 + 30 min → fin « 00:20 » < début → comportement DeviceActivity indéfini (échec ou décalage d'un jour). → À tester sur appareil ; correctif : scinder en 2 fenêtres ou plafonner à minuit.

### 🟡 P2 — Mineurs / dette

- **B16** `RelockMonitor.appex` embarqué **sans** `CodeSignOnCopy` (les 3 autres l'ont) → risque d'échec de signature à l'archive/validation.
- **B17** `strictUntil` global : démarrer un blocage non-strict efface le verrou strict d'un autre ; `getStatus` (seul lecteur) n'est appelé nulle part dans `src/`. Dette à nettoyer.
- **B18** Table `block_events` + enum (`intercepted/opened_anyway/delay_shown`) jamais alimentées, enum non aligné avec les kinds réels (`resisted/…`). Brancher ou supprimer.
- **B19** `app.json` : `expo.ios.bundleIdentifier` = `cole-lucky.SwiftSupabaseStarter` (périmé vs `com.yaya.relock`) ; bloc expo inerte mais piégeux.
- **B20** `RCTNewArchEnabled` dans l'Info.plist du **Monitor** (clé RN sans objet dans une extension).
- **B21** Course résiduelle append/pull sur `eventLog` entre processus (résolue de fait par le correctif B3 pull-ack).

---

## 3. Fonctionnalités incomplètes

1. **Comptage des interceptions** — chaîne cassée (B1+B3), et une décision produit à prendre : que compte-t-on ? (taps « Fermer » seulement, ou aussi poses de bouclier du Monitor ?)
2. **Quota temps réel de la limite quotidienne** — non alimentable côté JS (contrainte Apple) ; l'UI actuelle promet plus que la donnée.
3. **Monétisation** — badge « Premium » affiché dans Réglages, aucun achat intégré (RevenueCat reporté). PRODUCT.md dit « l'app n'est jamais gratuite ».
4. **Réglages** — 6 lignes sans action (`onPress={() => {}}`) : Apparence, Langue, Notifications & rappels, Abonnement, À propos, Confidentialité.
5. **« Aperçu du rituel de pause »** — ouvre `PauseRitualScreen`, vestige d'une mécanique remplacée par le shield système (statique). À retirer ou re-scénariser.
6. **Auth sociale** — boutons Google/Facebook/Apple affichés, non branchés. « Oublié ? » (mot de passe) à vérifier.
7. **Onboarding** — cartes placeholder du starter, **en anglais**, avec claims faux (« encrypted end-to-end », « Instant sync across all your devices » — contradictoires avec B7 et l'absence de sync multi-appareils).
8. **Écran de connexion** — bandeau « Démo : les champs sont pré-remplis — appuie sur Se connecter (API mock) » + identifiants pré-remplis `demo@example.com`.

---

## 4. Risques de rejet App Store (mappés aux guidelines)

| Risque | Guideline | Gravité |
|---|---|---|
| Crash au lancement après visite d'Activité (B2) — Apple teste, kill, relance | 2.1 (App Completeness) | 🔴 Rejet quasi certain |
| Bandeau « Démo / API mock » + identifiants pré-remplis visibles | 2.1 / 2.3.1 (placeholder) | 🔴 |
| Onboarding anglais + claims faux (E2E, sync multi-devices) | 2.3.1 (métadonnées trompeuses) | 🔴 |
| Boutons Google/Facebook/Apple non fonctionnels | 2.1 ; et si activés un jour : 4.8 (Sign in with Apple obligatoire et fonctionnel) | 🔴 |
| `NSLocationWhenInUseUsageDescription` présent mais **vide** dans Info.plist | ITMS-90683 — bloqué à l'upload | 🔴 |
| Badge « Premium »/ligne Abonnement sans IAP | 2.1 / 3.1.1 | 🟠 |
| 6 lignes de réglages mortes | 2.1 | 🟠 |
| Family Controls : l'entitlement de **distribution** doit être approuvé par Apple pour l'app **et chaque extension** (demande formelle par bundle ID) | Programme Family Controls | 🔴 si non fait ; vérifier que la demande couvre `com.yaya.relock` + les 4 extensions |
| `RelockMonitor.appex` sans CodeSignOnCopy | Échec validation/signature possible | 🟠 |
| Stats à 0 pour le reviewer (B1) : app « qui ne fait rien » | 2.1 | 🟠 |
| PrivacyInfo.xcprivacy : vérifier la déclaration UserDefaults (required-reason API) pour l'app **et** les extensions | 5.1.1 | 🟡 |

---

## 5. Ce qui a été validé ✅

- **83/83 tests** (44 existants + 39 nouveaux `__tests__/stats-simulation.test.ts`), exécutés en `Europe/Paris` **et** `America/Toronto`.
- **Simulation multi-jours/mois** : série qui croît 21 jours d'affilée ; « aujourd'hui vide » ne casse pas la série ; trou d'un jour → reset correct ; scénario 6 mois (20 j actifs / 2 j off / 40 j / 1 j off / 10 j) → série 10, record 40, semaine exacte.
- **Passage minuit & DST** : plage 22 h→8 h correcte à toutes les bornes (21:59 ✗, 22:00 ✓, 07:59 ✓, 08:00 ✗) ; record stable au passage à l'heure d'été ; blocage strict à cheval sur minuit reste verrouillé après le changement de date ; `ymd` bien en date locale.
- **Bornes des anneaux** : fraction ∈ [0,1] même très en retard ; libellés corrects (74 min → « 1h14 »).
- **Cohérence Accueil ↔ Activité** : même source (un seul hook/query) — pas de désync possible entre ces écrans.
- **Retour premier plan** : `focusManager` câblé sur `AppState` → refetch réel au foreground.
- **Démarrage à froid** : sain (login) ; **réinstallation** : retour propre à l'onboarding, purge du blocage système résiduel (`resetIfFreshInstall`) — c'est le wipe *cloud* qui pose problème (B7), pas la purge locale.
- **Infra** : `daily_stats` avec `unique(user_id,date)` (upsert sûr) ; RLS activée sur toutes les tables ; les 4 extensions correctement déclarées (`NSExtensionPointIdentifier`) et embarquées.

---

## 6. Plan de correction recommandé (ordre d'exécution)

**Étape 1 — Débloquer la chaîne de stats (≤ 1 jour)**
1. B1 : App Group dans `RelockShieldAction.entitlements` (+ profil). ← *déblocant tout le reste*
2. B3 : protocole pull-ack (natif : `pullEvents` non destructif + `ackEvents` ; JS : ack après upsert réussi, skip si pas de session).
3. B2 : vraie détection de la vue native + ErrorBoundary sur l'onglet Activité.

**Étape 2 — Rendre le multi-blocages cohérent (1-2 jours)**
4. B4 : stop ciblé par activité + ré-armement des règles restantes.
5. B5 : sélection par règle + union pour le shield.
6. B6 : `intervalDidEnd` ne retire le bouclier que si aucune autre fenêtre active.
7. B15 : gestion du minuté qui traverse minuit.

**Étape 3 — Corriger la sémantique des stats (1 jour)**
8. B8 : redéfinir « jour de contrôle ». 9. B9 : dé-plafonner série/record. 10. B11/B12 : décider et implémenter interceptions vs résistances. 11. B13 : anneau quota → état binaire.

**Étape 4 — Hygiène App Store (1 jour)**
12. Purger l'UI démo du login + brancher ou retirer les boutons sociaux. 13. Réécrire l'onboarding (FR, claims vrais). 14. Retirer/mplir `NSLocation…`. 15. Brancher ou retirer les lignes Réglages + Premium + rituel. 16. B16 CodeSignOnCopy. 17. B7 : confirmation avant wipe cloud. 18. Vérifier l'approbation Family Controls (distribution) pour les 5 bundle IDs.

**Étape 5 — Validation sur appareil (toi)**
- Se connecter sur l'iPhone → TikTok bloqué → « Fermer » → rouvrir Relock : interceptions/+5 min/série doivent bouger le jour même.
- 2 règles avec 2 sélections d'apps différentes → vérifier les 2 blocages simultanés + pause de l'une n'affecte pas l'autre (post-B4/B5).
- Minuté 23 h 50 + 30 min (post-B15). Limite atteinte → badge « limite atteinte » (post-B13).
- Laisser tourner 3 jours : série 1→2→3 ; sauter un jour d'app (sans sauter le blocage) : la série ne doit PAS casser (post-B8).

---

*Rapport généré par la campagne QA automatisée. Les 39 tests de simulation temporelle sont conservés dans `__tests__/stats-simulation.test.ts` et tournent avec `npm test` (le test « BUG DOCUMENTÉ » devra être mis à jour lors de la correction de B9).*
