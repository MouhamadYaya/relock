# Blocus — Choses à faire / à ne pas oublier

Fichier de suivi de tout ce qui est reporté, à brancher plus tard, ou qui dépend de toi.
Voir aussi [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 🔓 À réactiver — auth désactivée temporairement

- **Connexion/onboarding désactivés pour la preview** : dans [src/session/bootstrap.ts](src/session/bootstrap.ts), le flag `BYPASS_AUTH = true` fait démarrer l'app directement sur les onglets. **À réactiver** en repassant `BYPASS_AUTH` à `false` (l'app repassera par onboarding → connexion).

## À faire bientôt (V1) — dépend de toi

- [ ] **Supabase** : créer le projet, exécuter [supabase/schema.sql](supabase/schema.sql), me donner l'**URL du projet + la clé anon** → je les mets dans `.env` (jamais commité). ⚠️ Ne jamais partager la *service_role key*.
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
