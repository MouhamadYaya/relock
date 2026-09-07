# Relock privacy and compliance audit

**Audit date:** September 7, 2026  
**Repository scope:** React Native application, iOS app and extensions, Android manifest, Supabase schema and Edge Functions, runtime configuration, subscription integration, monitoring, storage, settings controls, and the static legal website.  
**Purpose:** Evidence record supporting the English and French Privacy Policies in this directory.  
**Limit:** This is a source-code audit, not a verification of deployed infrastructure, vendor dashboards, production environment variables, store listings, organizational procedures, or legal compliance in a particular jurisdiction.

## Executive conclusion

Relock is an account-based focus application. It uses Apple Screen Time technologies to enforce user-configured app restrictions, synchronizes account/profile/rule/onboarding and aggregate activity data through Supabase, uses RevenueCat for subscription state and conversion attributes, ImageKit for profile photos, and optional Sentry monitoring that defaults on in local preferences when configured. The app offers profile editing, reminder controls, crash-report opt-out, a limited JSON export, activity reset, and in-app account deletion.

The two highest-impact policy limitations are:

1. Account deletion removes the Supabase authentication user and cascading Supabase rows, but the function explicitly does not remove ImageKit assets or RevenueCat records.
2. The JSON export omits several local, Supabase, and provider-held datasets and caps two returned datasets at 400 rows.

Other release blockers include an iOS privacy manifest that declares no collection despite the implemented data flows, an App Tracking Transparency prompt without an identified advertising/IDFA use, no application-level MMKV encryption key, no age gate, no complete retention schedule, and Apple sign-in code that does not implement nonce/replay protection.

## 1. Data inventory

| Data category | Data elements evidenced in code | Collection/use | Storage and recipients | Evidence |
|---|---|---|---|---|
| Authentication | Supabase user ID, email, access token, refresh token, Apple identity token, Google ID token | Create a Supabase session and identify the signed-in user | MMKV/Supabase; Apple or Google supplies the identity assertion | [auth.service.ts:39](../features/auth/services/auth/auth.service.ts#L39), [auth.service.ts:60](../features/auth/services/auth/auth.service.ts#L60), [auth.service.ts:99](../features/auth/services/auth/auth.service.ts#L99), [auth.schemas.ts:22](../features/auth/services/auth/auth.schemas.ts#L22) |
| Profile | Display name, avatar URL, birth date, locale, time zone, created/updated timestamps, provider name/avatar metadata | Display and edit a user profile | Supabase `profiles`; avatar binary and URL through ImageKit | [schema.sql:8](../../supabase/schema.sql#L8), [profile.service.ts:47](../features/user/services/profile/profile.service.ts#L47), [ProfileScreen.tsx:85](../features/settings/screens/ProfileScreen.tsx#L85) |
| Birth date | User-selected date from 1900 through the current date | Profile attribute; no code-enforced age eligibility decision | Supabase `profiles.birth_date` | [birth-date.ts:11](../features/settings/services/birth-date.ts#L11), [profile.service.ts:102](../features/user/services/profile/profile.service.ts#L102) |
| Profile photo | Selected image URI, file name, MIME type, uploaded binary, generated hosted URL | User-selected avatar | ImageKit user folder and Supabase avatar URL | [ProfileScreen.tsx:85](../features/settings/screens/ProfileScreen.tsx#L85), [imagekit.upload.ts:64](../shared/services/imagekit/imagekit.upload.ts#L64), [imagekit.upload.ts:81](../shared/services/imagekit/imagekit.upload.ts#L81) |
| Onboarding | Name, trigger, app choices, difficult moment, feelings, screen-time band, hours, hard-mode choice, app count, rule preset IDs | Resume onboarding, configure initial experience, conversion analytics | Local MMKV checkpoint; answers in Supabase; selected attributes in RevenueCat | [onboarding-checkpoint.ts:24](../features/onboarding/services/onboarding-checkpoint.ts#L24), [onboarding-checkpoint.ts:51](../features/onboarding/services/onboarding-checkpoint.ts#L51), [onboarding-answers.service.ts:20](../features/onboarding/services/onboarding-answers.service.ts#L20), [revenuecat.ts:329](../features/onboarding/services/revenuecat.ts#L329) |
| Blocking rules | Rule ID, user ID, rule type, app-selection JSON, schedule/duration/limit configuration, active/suspended state, timestamps | Create, edit, suspend, resume, and enforce focus rules | Supabase `block_rules`; operational rule state also local | [schema.sql:28](../../supabase/schema.sql#L28), [block-rules.service.ts:38](../features/blocking/services/block-rules/block-rules.service.ts#L38), [block-rules.service.ts:72](../features/blocking/services/block-rules/block-rules.service.ts#L72) |
| Apple app selections | Opaque FamilyActivity selection tokens; local selection records; app/category labels or counts used by app logic | Identify which apps/categories a rule applies to | Opaque tokens in the iOS App Group, not the backend; labels/reference/count can appear in rule configuration | [screen-time.ts:40](../shared/native/screen-time.ts#L40), [schema.sql:34](../../supabase/schema.sql#L34), [Relock.entitlements:9](../../ios/Relock/Relock.entitlements#L9) |
| Local shield attempts | Application key, application name, attempt count/time, request/event records, rule/event context | Show interventions, diagnostics, and produce daily aggregates | iOS App Group local file; aggregate daily values sync to Supabase | [ShieldAttemptStore.swift:4](../../ios/Shared/ShieldAttemptStore.swift#L4), [ShieldAttemptStore.swift:49](../../ios/Shared/ShieldAttemptStore.swift#L49), [ShieldAttemptStore.swift:191](../../ios/Shared/ShieldAttemptStore.swift#L191), [screen-time.ts:77](../shared/native/screen-time.ts#L77) |
| Daily activity statistics | Date, intervention count, opens stopped, estimated minutes saved, streak | Activity summaries and progress | Supabase `daily_stats` after local aggregation | [schema.sql:63](../../supabase/schema.sql#L63), [stats.service.ts:50](../features/blocking/services/stats/stats.service.ts#L50), [stats.service.ts:139](../features/blocking/services/stats/stats.service.ts#L139) |
| Block events table | User ID, rule ID, app label, event type/time, metadata | Schema supports detailed event rows; no active insert path was identified in the audited application | Supabase `block_events`; included in export if rows exist | [schema.sql:47](../../supabase/schema.sql#L47), [data-export.ts:22](../features/settings/services/data-export.ts#L22) |
| Settings/preferences | Theme, notification settings, weekly/win-back/streak preferences, crash-report preference, tracking state, onboarding state, subscription cache | Configure UI, local reminders, telemetry, and cached entitlement state | Primarily MMKV; a Supabase `settings` table is created but no active app update path was identified | [schema.sql:77](../../supabase/schema.sql#L77), [prefs.ts:1](../features/notifications/prefs.ts#L1), [app-preferences.ts:26](../shared/services/storage/app-preferences.ts#L26), [constants.ts:25](../config/constants.ts#L25) |
| Subscription/customer data | Store offerings/packages, product identifier, entitlement/customer information, purchase/restore result, expiration/status, Supabase user ID | Present and sell subscriptions, validate access, restore purchases, open customer center | App Store or Google Play, RevenueCat, local entitlement cache | [revenuecat.ts:194](../features/onboarding/services/revenuecat.ts#L194), [billing-identity.ts:21](../session/billing-identity.ts#L21), [revenuecat.ts:365](../features/onboarding/services/revenuecat.ts#L365) |
| RevenueCat conversion attributes | `trigger`, `moment`, `hours`, `apps`, and `feelings` onboarding values | Subscription conversion analytics | RevenueCat customer attributes; user-linked after RevenueCat login | [revenuecat.ts:329](../features/onboarding/services/revenuecat.ts#L329), [OnboardingFlow.tsx:417](../features/onboarding/OnboardingFlow.tsx#L417), [billing-identity.ts:21](../session/billing-identity.ts#L21) |
| Crash/performance telemetry | Crashes, app hangs, watchdog/NDK/native errors, performance traces, profiles, route names, breadcrumbs, masked replay if configured, device/app context | Diagnose reliability and performance | Sentry and a local Sentry queue/cache | [sentry.ts:79](../shared/services/monitoring/sentry.ts#L79), [sentry.ts:29](../shared/services/monitoring/sentry.ts#L29), [sentry.ts:150](../shared/services/monitoring/sentry.ts#L150) |
| Telemetry identity | Supabase UUID only | Correlate Sentry events with an authenticated account | Sentry user context | [sentry.ts:233](../shared/services/monitoring/sentry.ts#L233), [useSessionUser.ts:22](../session/useSessionUser.ts#L22) |
| Network breadcrumbs | HTTP method, scrubbed path, status/problem code, duration | Debug API failures and performance | Sentry when monitoring is active | [logging.interceptor.ts:60](../shared/services/api/interceptors/logging.interceptor.ts#L60), [scrub.ts:24](../shared/services/monitoring/scrub.ts#L24) |
| Extension telemetry | Local extension log details and native error context | Relay extension failures to the app/Sentry | iOS App Group local log, then Sentry if enabled | [extension-telemetry.ts:31](../shared/services/monitoring/extension-telemetry.ts#L31), [ExtensionLog.swift:34](../../ios/Shared/ExtensionLog.swift#L34), [ExtensionSentry.swift:38](../../ios/Shared/ExtensionSentry.swift#L38) |
| Notifications | System authorization status, local notification identifiers, reminder preferences and calculated reminder content/time | Schedule streak, win-back, and weekly local reminders | On device through the local notification API and MMKV preferences | [notifications.ts:1](../shared/native/notifications.ts#L1), [notifications.ts:11](../shared/native/notifications.ts#L11), [notification.service.ts:73](../features/notifications/services/notification.service.ts#L73) |
| Website access/support | Static website itself sets no analytics, ad scripts, form, or cookies; hosting logs and support messages are operational unknowns | Deliver the site, secure hosting, answer messages | `[HOSTING PROVIDER]` and support systems | [index.html](./index.html), [pages.css](./pages.css) |

## 2. Storage and retention map

| Location | Stored data | Controls evidenced | Retention evidenced or missing |
|---|---|---|---|
| Supabase Auth | Authentication user, provider linkage, email/session | Authenticated session; account deletion uses server-side service role after verifying the caller | User remains until account deletion; backup retention and auth-log retention are not in the repository. [delete-account/index.ts:36](../../supabase/functions/delete-account/index.ts#L36) |
| Supabase Postgres | Profiles, rules, daily stats, block events, settings, onboarding answers | Row-level security enabled with per-user policies; foreign keys cascade on auth-user deletion | No time-based retention job is defined. [schema.sql:100](../../supabase/schema.sql#L100), [schema.sql:8](../../supabase/schema.sql#L8) |
| MMKV | Auth tokens, onboarding checkpoint, preferences, caches, app state | Namespaced storage; no `encryptionKey` is configured in the audited creation call | Most values persist until overwritten, logout, reset, setup completion, or deletion by feature logic. [mmkv.ts:105](../shared/services/storage/mmkv.ts#L105), [logout.ts:43](../session/logout.ts#L43) |
| iOS App Group | Opaque FamilyActivity selections, shield attempt/event log, extension logs and operational state | Apple app-group sandbox shared only by signed Relock targets | Pending events are acknowledged after aggregate sync; complete duration for other files is not defined. [ShieldAttemptStore.swift:117](../../ios/Shared/ShieldAttemptStore.swift#L117), [stats.service.ts:50](../features/blocking/services/stats/stats.service.ts#L50) |
| ImageKit | Profile-photo binary and delivery URL | Authenticated Edge Function issues a user-folder grant valid for 600 seconds; private signing key remains server-side | Unique names cause replaced avatars to accumulate; no deletion job is implemented. [imagekit-auth/index.ts:61](../../supabase/functions/imagekit-auth/index.ts#L61), [imagekit.upload.ts:99](../shared/services/imagekit/imagekit.upload.ts#L99) |
| RevenueCat | Customer identifier, offerings, purchase/entitlement state, onboarding attributes | Supabase UUID is used for login; app logs out on session transition | Provider retention/deletion procedure is not implemented in the account-deletion function. [billing-identity.ts:21](../session/billing-identity.ts#L21), [delete-account/index.ts:16](../../supabase/functions/delete-account/index.ts#L16) |
| Sentry | Diagnostic events, traces, profiles, optional masked replay, Supabase UUID | `sendDefaultPii: false`; scrubbing of secrets and direct identifiers; replay masks text/images/vectors; local cache maximum 60 events | Production server retention and sample rates depend on deployment settings and are not proved by source. [sentry.ts:79](../shared/services/monitoring/sentry.ts#L79), [scrub.ts:89](../shared/services/monitoring/scrub.ts#L89) |

## 3. Third-party service and SDK inventory

| Service | Role | Data or access evidenced | Official privacy notice |
|---|---|---|---|
| Supabase | Authentication, database, Edge Functions | Account identifiers, profile, rule configuration, onboarding answers, aggregate stats, deletion and ImageKit signing requests | [Supabase Privacy Policy](https://supabase.com/privacy) |
| Apple | Sign-in, Family Controls/Device Activity/Managed Settings, local notifications, App Store purchases | Identity assertion, Screen Time authorization and opaque selections, purchase/subscription data under Apple’s systems | [Apple Privacy Policy](https://www.apple.com/legal/privacy/) |
| Google | Google Sign-In and potential Google Play billing | Google ID token; store purchase data if Android billing is publicly active | [Google Privacy Policy](https://policies.google.com/privacy) |
| RevenueCat | Subscription catalog, purchase/restore/customer-center and entitlement state | Supabase UUID, purchase/customer information, onboarding conversion attributes | [RevenueCat Privacy Policy](https://www.revenuecat.com/privacy) |
| ImageKit | Profile-photo upload and delivery | User-selected image, file metadata, user-specific folder, hosted URL | [ImageKit Privacy Policy](https://imagekit.io/privacy-policy-new) |
| Sentry | Crash, performance, profiling, optional masked replay | Diagnostic context, route names, scrubbed request metadata, Supabase UUID, extension errors | [Sentry Privacy Policy](https://sentry.io/privacy/) |
| `[HOSTING PROVIDER]` | Static legal/marketing website | Expected HTTP access/security logs; deployment is not in the repository | `[HOST PRIVACY NOTICE]` |

No advertising SDK, social-pixel script, third-party website analytics script, ad-network dependency, `AdSupport` import, or advertising-identifier read was identified in the audited source. This does not prove the absence of non-code business sharing or infrastructure-level analytics.

## 4. Tracking, analytics, and telemetry

### 4.1 Sentry

- Sentry starts only when configured and when the local `crashReports` preference is true. [sentry.ts:60](../shared/services/monitoring/sentry.ts#L60)
- The preference defaults to `true`. [app-preferences.ts:26](../shared/services/storage/app-preferences.ts#L26)
- The SDK is configured with `sendDefaultPii: false`, diagnostic scrubbing, automatic sessions, native crash/app-hang/NDK capture, performance/profiling sample rates, and optional replay sample rates. [sentry.ts:79](../shared/services/monitoring/sentry.ts#L79)
- Replays mask text, images, and vectors. [sentry.ts:128](../shared/services/monitoring/sentry.ts#L128)
- Navigation instrumentation records route names rather than full paths. [sentry.ts:29](../shared/services/monitoring/sentry.ts#L29)
- The scrubber removes or redacts common authorization, token, password, session, email, phone, and query-string values. [scrub.ts:24](../shared/services/monitoring/scrub.ts#L24), [scrub.ts:89](../shared/services/monitoring/scrub.ts#L89)
- Sentry receives the Supabase UUID as user context after login. [sentry.ts:233](../shared/services/monitoring/sentry.ts#L233)

### 4.2 RevenueCat analytics

RevenueCat is not limited to anonymous store entitlement checks. Relock logs RevenueCat into the Supabase UUID and sends selected onboarding answers (`trigger`, `moment`, `hours`, `apps`, and `feelings`) as attributes for conversion analysis. These attributes can therefore be associated with the RevenueCat customer after login. [billing-identity.ts:21](../session/billing-identity.ts#L21), [revenuecat.ts:329](../features/onboarding/services/revenuecat.ts#L329)

### 4.3 App Tracking Transparency

The Info.plist contains an ATT purpose string, the native module requests authorization, and onboarding/paywall code invokes the prompt. [Info.plist:71](../../ios/Relock/Info.plist#L71), [RelockTracking.swift:46](../../ios/Relock/RelockTracking.swift#L46), [useTrackingPrompt.ts:18](../shared/native/useTrackingPrompt.ts#L18), [OnboardingFlow.tsx:306](../features/onboarding/OnboardingFlow.tsx#L306), [PaywallScreen.tsx:85](../features/onboarding/screens/PaywallScreen.tsx#L85)

No advertising SDK or advertising-identifier consumption was identified. Product/legal owners must confirm why ATT is requested and either remove it or disclose the actual cross-company tracking purpose.

## 5. User-facing controls

| Control | What is implemented | Material limitation | Evidence |
|---|---|---|---|
| Edit profile | Change display name, birth date, and selected profile photo | Replaced ImageKit photo is not automatically deleted | [ProfileScreen.tsx:85](../features/settings/screens/ProfileScreen.tsx#L85), [profile.service.ts:91](../features/user/services/profile/profile.service.ts#L91) |
| Crash-report control | Toggle shown in Settings; Sentry respects it | Defaults enabled; production DSN/sample settings must be confirmed | [SettingsScreen.tsx:679](../features/settings/screens/SettingsScreen.tsx#L679), [sentry.ts:60](../shared/services/monitoring/sentry.ts#L60) |
| Notification controls | Per-category reminder preferences and system authorization | Local notifications only; system permission must also be changed at OS level | [prefs.ts:1](../features/notifications/prefs.ts#L1), [notifications.ts:11](../shared/native/notifications.ts#L11) |
| Tracking choice | Apple ATT prompt and iOS Settings | Actual tracking purpose is not evidenced | [RelockTracking.swift:46](../../ios/Relock/RelockTracking.swift#L46) |
| JSON export | Profile, rules, daily stats, and block events | Omits onboarding answers, server settings, local app-group/MMKV data, subscription/provider data, hosted photos, and diagnostics; daily stats and block events are capped at 400 rows each | [data-export.ts:22](../features/settings/services/data-export.ts#L22), [data-export.ts:78](../features/settings/services/data-export.ts#L78) |
| Reset activity | Deletes Supabase block events, daily stats, and blocking rules | Retains account, profile, onboarding answers, subscription relationship, photos, and provider data | [reset.service.ts:29](../features/blocking/services/reset.service.ts#L29) |
| Delete account | Authenticated Edge Function deletes the Supabase Auth user; foreign keys cascade Supabase rows | Does not cancel store subscription and explicitly does not delete ImageKit or RevenueCat data | [DeleteAccountScreen.tsx:13](../features/settings/screens/DeleteAccountScreen.tsx#L13), [delete-account/index.ts:16](../../supabase/functions/delete-account/index.ts#L16), [delete-account/index.ts:36](../../supabase/functions/delete-account/index.ts#L36), [schema.sql:8](../../supabase/schema.sql#L8) |
| Logout | Clears app auth tokens, query/persistence caches, offline queue, and navigation state | Logout is not account deletion and does not delete backend/provider data | [logout.ts:43](../session/logout.ts#L43) |
| Legal links | Settings opens privacy and terms URLs; links now select English/French based on current app language | Production domain deployment and final URLs remain to be completed | [SettingsScreen.tsx:745](../features/settings/screens/SettingsScreen.tsx#L745), [app-config.ts:41](../config/app-config.ts#L41) |

No in-app workflow was identified for downloading all local/provider data, deleting only a RevenueCat customer, deleting ImageKit assets, withdrawing already-sent onboarding attributes, or contacting a privacy officer through a structured request form.

## 6. Security findings

### Safeguards evidenced

- Supabase row-level security is enabled for app tables, with user-ID-scoped policies. [schema.sql:100](../../supabase/schema.sql#L100)
- The account-deletion Edge Function validates the requester’s bearer token before using the service role to delete that user. [delete-account/index.ts:36](../../supabase/functions/delete-account/index.ts#L36)
- ImageKit’s private key remains in the Edge Function; the app receives a signed, user-folder-limited grant that expires after 600 seconds. [imagekit-auth/index.ts:61](../../supabase/functions/imagekit-auth/index.ts#L61)
- iOS App Transport Security does not allow arbitrary loads; local networking is allowed for development. [Info.plist:50](../../ios/Relock/Info.plist#L50)
- Android disables application backup in the manifest and requests only Internet permission in the inspected manifest. [AndroidManifest.xml:1](../../android/app/src/main/AndroidManifest.xml#L1)
- Sentry default PII is disabled and explicit scrubbing is implemented. [sentry.ts:79](../shared/services/monitoring/sentry.ts#L79), [scrub.ts:24](../shared/services/monitoring/scrub.ts#L24)

### Security limitations

- MMKV is initialized without an application encryption key even though comments describe it as secure storage. Do not claim app-level local encryption. [mmkv.ts:105](../shared/services/storage/mmkv.ts#L105)
- Apple sign-in explicitly omits nonce verification/replay protection. [auth.service.ts:85](../features/auth/services/auth/auth.service.ts#L85)
- Security at the Supabase, ImageKit, RevenueCat, Sentry, Apple, Google, and hosting layers cannot be verified from this repository.
- The repository does not evidence a breach-response procedure, access-review process, vendor data-processing agreements, key-rotation policy, backup policy, or organizational security controls.

## 7. Confirmed gaps and required decisions

| Priority | Gap | Policy or release impact | Required action/owner |
|---|---|---|---|
| Critical | iOS `PrivacyInfo.xcprivacy` declares no collected data and no tracking despite account, profile, subscription, telemetry, and backend flows | App Store disclosure can conflict with product behavior and the policy | Update the manifest/privacy nutrition answers after counsel and App Store review. [PrivacyInfo.xcprivacy:44](../../ios/Relock/PrivacyInfo.xcprivacy#L44) |
| High | Account deletion excludes ImageKit and RevenueCat | A broad “delete your data” promise would be false | Implement provider deletion or a documented manual workflow, then describe residual legal retention. [delete-account/index.ts:16](../../supabase/functions/delete-account/index.ts#L16) |
| High | Export is partial and capped | It is not a complete portability/access response | Expand export or describe it precisely and maintain a manual rights-request process. [data-export.ts:22](../features/settings/services/data-export.ts#L22) |
| High | Replaced profile photos accumulate on ImageKit | Orphaned personal images may remain without user visibility | Delete the previous asset after successful replacement and on account deletion. [imagekit.upload.ts:99](../shared/services/imagekit/imagekit.upload.ts#L99) |
| High | ATT prompt exists without an evidenced tracking purpose | Prompt and privacy labels may be misleading; purpose cannot be drafted accurately | Confirm the intended tracking flow or remove ATT request and purpose string. [RelockTracking.swift:46](../../ios/Relock/RelockTracking.swift#L46) |
| High | No age gate or parental-consent flow | Target-audience/children section cannot be finalized | Set launch minimum age and implement gating/consent if required. [birth-date.ts:11](../features/settings/services/birth-date.ts#L11) |
| High | No complete retention schedule | Policy cannot state definite retention periods | Approve periods for each provider, local logs, backups, support and website logs; configure deletion jobs. |
| High | Apple sign-in has no nonce verification | Replay-risk control is absent | Implement provider-recommended nonce verification before release. [auth.service.ts:85](../features/auth/services/auth/auth.service.ts#L85) |
| Medium | MMKV has no app-level encryption key | Tokens and local personal data should not be described as encrypted by Relock | Threat-model platform protection and add encrypted storage where appropriate. [mmkv.ts:105](../shared/services/storage/mmkv.ts#L105) |
| Medium | Sentry crash reporting defaults on | Consent/legal-basis and disclosure may differ by jurisdiction | Confirm launch markets, lawful basis, first-run notice, deployed sampling, replay, profiling, and retention. [app-preferences.ts:26](../shared/services/storage/app-preferences.ts#L26) |
| Medium | RevenueCat receives behavioral onboarding attributes | “Subscription processing only” disclosure would be incomplete | Confirm necessity, lawful basis, retention, and deletion handling. [revenuecat.ts:329](../features/onboarding/services/revenuecat.ts#L329) |
| Medium | Platform availability is ambiguous | Terms/marketing could incorrectly promise Android blocking | Confirm supported devices and launch stores; align the site and store listings. |
| Medium | Legal URLs/contact values were placeholder product configuration | In-app legal access can fail until production host is deployed | Deploy `relock.app`, confirm paths and replace contact placeholders. [app-config.ts:41](../config/app-config.ts#L41) |

## 8. Information that code cannot determine

The following must be supplied by the product/legal owner before publication. The policy and terms use matching bracketed placeholders.

| Required fact | Placeholder used |
|---|---|
| Full legal entity name and entity type | `[LEGAL ENTITY NAME AND ENTITY TYPE]` |
| Registered/business address | `[REGISTERED ADDRESS]` |
| Privacy, legal, and support email addresses | `[PRIVACY CONTACT EMAIL]`, `[LEGAL CONTACT EMAIL]`, `[SUPPORT EMAIL]` |
| Governing law, courts, and launch jurisdictions | `[GOVERNING JURISDICTION]`, `[COURTS AND VENUE]` |
| Effective and last-updated dates | `[EFFECTIVE DATE]`, `[LAST UPDATED]` |
| Minimum age and target audience | `[MINIMUM AGE AND TARGET AUDIENCE]` |
| Public platform/device/region availability | `[CONFIRM PLATFORM AVAILABILITY]` |
| App Store/public download URL | `[APP_STORE_URL]` |
| Supabase project region and backup/log retention | `[SUPABASE PROJECT REGION]`, `[SUPABASE RETENTION AND BACKUP PERIOD]` |
| Sentry production sampling, replay/profiling use, and server retention | `[SENTRY PRODUCTION SETTINGS AND RETENTION]` |
| ImageKit region, retention, and deletion workflow | `[IMAGEKIT RETENTION AND DELETION PROCESS]` |
| RevenueCat retention and customer-deletion workflow | `[REVENUECAT RETENTION AND DELETION PROCESS]` |
| Website host, access-log fields, processing region, and retention | `[HOSTING PROVIDER]`, `[HOSTING LOG DETAILS AND RETENTION]` |
| Whether the business sells/shares data outside audited code | `[CONFIRM NO SALE OR CROSS-CONTEXT BEHAVIORAL ADVERTISING]` |
| Privacy request verification, response, and provider escalation procedure | `[INTERNAL PRIVACY REQUEST PROCESS]` |
| Liability cap and consumer-law localization | `[LIABILITY CAP AMOUNT]` |
| DPO, EU/UK representative, Quebec privacy officer, or other required representative | `[DPO OR REPRESENTATIVE, IF REQUIRED]` |

## 9. Assumptions used in the draft

1. The final repeated instruction to produce both policies supersedes the earlier sentence asking to defer privacy-policy content.
2. The static site itself will not add analytics, advertising scripts, forms, consent-management tools, or cookies before publication. Hosting logs remain unknown.
3. Relock does not itself receive payment-card details because the audited purchase flow uses the platform stores and RevenueCat.
4. Relock does not sell personal data or use it for third-party advertising; this is only a draft assumption because source code cannot prove business-side disclosures.
5. The live service will use the schema and Edge Functions in this repository. Deployment status has not been verified.
6. English and French documents are intended to have substantively equivalent meaning; qualified bilingual counsel should review both.

## 10. Publication checklist

- Resolve or accept every gap in Section 7 with an accountable owner.
- Replace every bracketed placeholder in all HTML files.
- Verify the production vendor dashboards, data regions, retention, replay/profiling settings, and data-processing agreements.
- Align Apple privacy nutrition labels, `PrivacyInfo.xcprivacy`, Google Play Data Safety, and the ATT purpose with actual production behavior.
- Test complete export and deletion across Supabase, ImageKit, RevenueCat, Sentry, backups, and local data.
- Confirm subscription/trial/cancellation text against live App Store and Google Play offers.
- Have a qualified privacy attorney review the English and French policy, terms, and launch-jurisdiction requirements before publication.
