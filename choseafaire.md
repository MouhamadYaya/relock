# Blocus — Choses à faire / à ne pas oublier

Fichier de suivi de tout ce qui est reporté, à brancher plus tard, ou qui dépend de toi.
Voir aussi [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## ✅ Auth réactivée

- **Connexion/onboarding réactivés** : `BYPASS_AUTH = false` dans [src/session/bootstrap.ts](src/session/bootstrap.ts). L'app démarre sur onboarding → connexion. (fait)

## À faire bientôt (V1) — dépend de toi

- [x] **Supabase créé + schéma exécuté + branché** : client Supabase, auth (login/signUp/logout) branchée, `.env` rempli (clé publishable, jamais commitée). Connectivité vérifiée (REST 200, RLS active).
- [ ] **Supabase — config à faire de ton côté** : (a) désactiver la confirmation e-mail (Authentication → Providers → Email → *Confirm email* OFF) pour tester l'inscription instantanément ; (b) ⚠️ **faire tourner la clé secret** (`sb_secret_…`) exposée dans le chat.
- [x] **Blocages réels (Ajout → Accueil)** : l'écran Ajout écrit la règle dans `block_rules`, l'Accueil la lit (liste + toggle actif/inactif + état vide). **Vérifié end-to-end dans l'app** (création → affichage → persiste après redémarrage → RLS OK).
- [ ] **Stats réelles (reste mock)** : la série, « temps regagné », interceptions, ouvertures viennent encore de données factices. Elles dépendent de `block_events` / `daily_stats`, qui ne se remplissent qu'avec l'**interception native** (bloquée, #8). À câbler quand le natif remonte des événements (ou via un petit seed de démo).
- [ ] **Bundle ID** : `cole-lucky.SwiftSupabaseStarter` — confirmer que c'est bien l'ID sur lequel l'approbation Family Controls a été accordée, et que Blocus doit l'utiliser (c'est aussi l'ID de ton app SwiftUI « Monevo »).
- [ ] **Build dev client signé** sur ton iPhone : nécessite ton compte développeur Apple dans Xcode (signing / provisioning). Étape manuelle de ton côté — je prépare tout le reste.
- [ ] **Apple Sign-In** : activer la capability dans le portail Apple + configurer le provider dans Supabase Auth.

## Reporté à une version ultérieure (V1.1+)

- [ ] **Extension DeviceActivityReport** — vraies minutes de temps d'écran système par app / par heure. Rendu Apple cloisonné, non synchronisable. En V1, l'écran Activité utilise à 100 % nos propres métriques.
- [ ] **Monétisation RevenueCat** — paywall + abonnement. Rappel : l'app n'est jamais gratuite.
- [ ] **Android** — UsageStatsManager + AccessibilityService (V1 = iOS uniquement).
- [ ] **Session focus** (blocage total type deep work) — 4e mécanique, hors V1.
- [ ] **Mode strict** (blocage non annulable).
- [ ] **Sync multi-appareils** — le token FamilyActivitySelection est local à l'appareil, à résoudre.
- [ ] **Inscription / register + mot de passe oublié** — le starter n'a qu'un écran de login.
- [ ] **Auth sociale** (Google) réellement branchée — boutons décoratifs dans le starter.

## ⚠️ Blocage natif Family Controls (à revoir)

- **RN rétrogradé 0.82.1 → 0.81.6** (commité) pour débloquer Expo — ça a marché (build OK, 44 tests).
- **Mais** : greffer Expo (`install-expo-modules`) fait **crasher l'app au lancement** : `recreateRootView: does not support when react instance is created` — incompatibilité entre la **New Architecture de RN 0.81.6** et **Expo SDK 54** (`node_modules/expo/ios/AppDelegates/ExpoAppDelegate.swift`, assert l.36/38).
- Greffe Expo **annulée** (retour au checkpoint RN 0.81 qui marche). `react-native-device-activity` reste donc **non installable**.
- Pistes quand on y reviendra : (a) épingler RN à la version exacte visée par Expo SDK 54 (ex. 0.81.4), (b) module Swift Family Controls **custom** sans Expo, (c) attendre Expo SDK 55 (RN 0.82) et remonter RN.

## ⚠️ Blocage preview (à revoir)

- **Expo ne supporte pas encore RN 0.82** (SDK 54 = RN 0.81). Conséquence : ni Expo Go, ni Expo Dev Client, ni EAS dev-client ne marchent pour la vraie app aujourd'hui. `install-expo-modules` échoue (`Unable to find compatible Expo SDK version - reactNativeVersion[0.82.1]`).
- Options quand on y reviendra : (A) maquette Expo Go jetable, (B) EAS build de l'app *bare* (compte Apple payant), (C) attendre Expo SDK 55, (D) rétrograder RN → 0.81.
- Fichiers déjà posés en prévision : `app.json` (bloc `expo`), `eas.json`. Inertes tant que le blocage n'est pas levé.

## Contraintes Apple à garder en tête

- Les vraies minutes de temps d'écran système ne remontent **jamais** au JS/Supabase (extension cloisonnée).
- Le shield système est **statique** (pas d'anneau animé) → le compte à rebours animé se fait dans un rituel de pause in-app.
- Family Controls **non testable sur simulateur** → iPhone physique requis.
- Approbation Apple **par bundle ID**.

## Idées concurrents notées, non retenues en V1

- Tag NFC de déblocage + blocage géolocalisé (Refocus).
- Sons d'ambiance pendant les sessions (Freedom).
- Co-working communautaire, gemmes/collectibles (Opal) — les gemmes écartées (anti-référence « gadget »).
