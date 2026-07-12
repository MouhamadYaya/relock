# Architecture — Blocus V1

Décisions techniques verrouillées en Phase 2. Plateforme : **iOS uniquement**. Base : starter **bare React Native 0.82** (ce repo). Voir [PRODUCT.md](../PRODUCT.md) et [DESIGN.md](../DESIGN.md).

## Stack

- **UI / base** : starter bare RN 0.82 (React Navigation 7, TanStack Query, Zustand, MMKV, i18next, thème light/dark, couche transport pluggable — tout existant, réutilisé).
- **Blocage natif** : `expo-modules-core` (greffé via [`install-expo-modules`](https://docs.expo.dev/bare/installing-expo-modules/)) + **`react-native-device-activity`** (Kingstinct, v0.6.x, iOS 15.1+). Pas d'EAS ni de Dev Client complet requis : un `expo prebuild` unique scaffolde les extensions Xcode, puis builds Xcode locaux classiques.
- **Backend** : **Supabase** (Auth + Postgres + RLS). Branché sur la couche transport existante via un adaptateur Supabase (remplace le mock/Firebase du starter).
- **i18n** : ajout du **français** (langue principale de Blocus).
- **Preview mobile** : build Xcode local sur **appareil physique** (Family Controls / shield ne sont pas testables complètement sur simulateur).

## Prérequis Apple (bloquants)

- Entitlement `com.apple.developer.family-controls` — **déjà accordé** ✅. À appliquer sur l'app principale ET les extensions.
- Approbation Apple par **bundle ID** (peut bloquer même le build de dev tant que non validée).
- App principale + 3 extensions natives créées par la lib : `ActivityMonitorExtension`, `ShieldAction`, `ShieldConfiguration`.
- **App Group** partagé (UserDefaults) pour faire remonter les données extension → app → JS.

## Périmètre natif V1

Fourni par `react-native-device-activity` :
- **Sélection d'apps** via `FamilyActivityPicker` (l'utilisateur choisit ; réseaux à feed court pré-suggérés en avant). Le token de sélection est opaque et lié à l'appareil → stocké en local (MMKV), pas rehydratable tel quel entre appareils.
- **Blocage** via `ManagedSettingsStore` (shield système).
- **Comptage d'interceptions** : on logge nous-mêmes dans `ShieldAction`/`ShieldConfiguration` → App Group → JS → Supabase.

Les 3 mécaniques V1 :
- **Délai progressif** : le shield système affiche un texte statique (le délai grandit via un compteur en App Group) ; `ShieldAction` gère « Reviens en arrière » / « Ouvrir quand même ». L'anneau de compte à rebours **animé** vit dans l'app (rituel de pause), pas dans le shield.
- **Plages horaires** : `DeviceActivitySchedule` → shield actif pendant la fenêtre.
- **Limite d'ouvertures/jour** : comptage via les logs de shield → blocage au-delà de N.

## Hors périmètre V1 (→ V1.1)

- **Extension `DeviceActivityReport`** (vraies minutes de temps d'écran système par app / par heure). Contrainte Apple dure : cette extension est sandboxée au point de **ne pas pouvoir écrire dans l'App Group** — les minutes réelles ne remontent jamais au JS ni à Supabase, et le rendu SwiftUI est peu stylable. Reportée. En V1, l'écran **Activité s'appuie à 100 % sur les métriques Blocus** (interceptions, ouvertures stoppées, streak, temps regagné) — pixel-perfect avec la maquette et synchronisées.

## Propriété des données

- **À nous (Supabase, syncable)** : profil, règles de blocage (métadonnées), événements d'interception, stats quotidiennes, streak, réglages.
- **Cloisonné Apple (jamais accessible)** : minutes de temps d'écran système par app.

## Schéma Supabase V1

RLS activé partout (`user_id = auth.uid()`). Détail SQL : [supabase/schema.sql](../supabase/schema.sql).

- `profiles` — miroir de `auth.users` : `display_name`, `avatar_url`, `locale`, `timezone`.
- `block_rules` — `type` (`progressive_delay` | `schedule` | `daily_limit`), `app_selection` (jsonb : labels des apps suggérées choisies + réf token local), `config` (jsonb : `base_delay_sec` / `schedule{start,end,days}` / `max_opens`), `is_active`.
- `block_events` — `rule_id`, `app_label`, `type` (`intercepted` | `opened_anyway` | `delay_shown`), `occurred_at`, `metadata`.
- `daily_stats` — `date`, `interceptions_count`, `opens_stopped`, `time_saved_minutes` (estimé), `streak_respected`.
- `settings` — `theme`, `notifications_enabled`, `reminder_time`.

## Écrans (référence : [docs/design/blocus-screens.html](design/blocus-screens.html))

Accueil · Activité · Ajout · Paramètres + Rituel de pause (interception in-app) + shield système stylé.
