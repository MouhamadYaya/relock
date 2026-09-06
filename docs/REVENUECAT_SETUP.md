# RevenueCat — Configuration complète (Expo)

Ce guide te permet d’activer les paiements RevenueCat dans Relock avec le flow recommandé.

## 0) Installation Expo avec `npx`

Depuis le dossier du projet:

```bash
npx expo install react-native-purchases react-native-purchases-ui
```

Si l’installation bloque sur une contrainte `ERESOLVE` (peer `react-dom`), relance avec:

```bash
npx expo install -- --legacy-peer-deps react-native-purchases react-native-purchases-ui
```

Puis rebuild natif:

```bash
npx pod-install ios
npm run ios   # ou npm run android
```

## 1) Variables d’environnement

- `REVENUECAT_ENABLED=1`
- `REVENUECAT_IOS_API_KEY=<clé iOS public SDK>`
- `REVENUECAT_ANDROID_API_KEY=<clé Android public SDK>`
- `REVENUECAT_ENTITLEMENT_ID=relock_pro` (par défaut)

L’ID entitlement doit être strictement identique à celui du dashboard.

## 2) Configuration Dashboard

1. Crée ton projet RevenueCat + app iOS/Android.
2. Connecte les stores (App Store / Google Play).
3. Crée l’entitlement `relock_pro`.
4. Crée les produits côté stores:
   - `relock_weekly`
   - `relock_yearly`
5. Crée une offering (ex: `default`) avec ces packages.
6. Configure le paywall dans l’éditeur RevenueCat.

## 3) Intégration côté app (pattern recommandé)

### Initialisation (au boot)

```ts
import Purchases, { LOG_LEVEL } from 'react-native-purchases'

export async function initializeRevenueCat(apiKey: string) {
  if (!apiKey) return false
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO)
  Purchases.configure({ apiKey })
  return true
}
```

### Récupération Customer Info + erreur handling

```ts
import Purchases from 'react-native-purchases'

export async function getCustomerInfoSafe() {
  try {
    return await Purchases.getCustomerInfo()
  } catch (error) {
    // log/Sentry + retry strategy if transient
    throw error
  }
}
```

### Vérification entitlement `relock_pro`

```ts
const ENTITLEMENT_ID = 'relock_pro'

export async function hasProEntitlement() {
  try {
    const customerInfo = await Purchases.getCustomerInfo()
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID]
    return typeof entitlement !== 'undefined'
  } catch {
    return false
  }
}
```

### Paywall (modern)

```ts
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui'

export async function openPaywallIfNeeded() {
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: ENTITLEMENT_ID,
    })

    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      return true
    }

    if (result === PAYWALL_RESULT.ERROR || result === PAYWALL_RESULT.NOT_PRESENTED) {
      const info = await Purchases.getCustomerInfo()
      return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined'
    }

    return false
  } catch {
    return false
  }
}
```

### Restore

```ts
export async function restorePurchases() {
  try {
    await Purchases.restorePurchases()
    const info = await Purchases.getCustomerInfo()
    return typeof info.entitlements.active[ENTITLEMENT_ID] !== 'undefined'
  } catch {
    return false
  }
}
```

### Customer Center

```ts
export async function openCustomerCenter() {
  try {
    await RevenueCatUI.presentCustomerCenter()
  } catch {
    // optional fallback UI
  }
}
```

## 4) Build & tests

- `npm run ios` / `npm run android` pour vérifier en device.
- iOS sandbox:
  - compte Sandbox + produit yearly/weekly dans App Store Connect.
- Android test:
  - compte de test + produit dans Google Play Console.
- Contrôles attendus:
  - Entitlement actif → onboarding passe sans paywall.
  - Pas d’entitlement → paywall present.
  - Restore fonctionne pour accounts déjà abonnés.
