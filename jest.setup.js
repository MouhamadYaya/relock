// Mock worklets completely FIRST

// Sentry est chargé au module scope de `app/_layout.tsx` (init + wrap +
// intégration navigation) : le mock doit couvrir cette surface, sinon les
// tests plantent à l'import et non sur une assertion.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn(component => component),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  addIntegration: jest.fn(),
  setUser: jest.fn(),
  setTag: jest.fn(),
  setTags: jest.fn(),
  setContext: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
  close: jest.fn().mockResolvedValue(undefined),
  nativeCrash: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({
    name: 'ReactNavigation',
    registerNavigationContainer: jest.fn(),
  })),
  mobileReplayIntegration: jest.fn(() => ({ name: 'MobileReplay' })),
  hermesProfilingIntegration: jest.fn(() => ({ name: 'HermesProfiling' })),
  supabaseIntegration: jest.fn(() => ({ name: 'Supabase' })),
}))

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    USE_MOCK_API: 'true',
    API_BASE_URL: 'http://localhost',
    API_TIMEOUT_MS: '15000',
    SENTRY_DSN: '',
    SENTRY_ENABLE_IN_DEV: '0',
    SENTRY_TRACES_SAMPLE_RATE: '0',
  },
}))

jest.mock('react-native-bootsplash', () => ({
  hide: jest.fn().mockResolvedValue(undefined),
  show: jest.fn().mockResolvedValue(undefined),
  getVisibilityStatus: jest.fn().mockResolvedValue('hidden'),
}))

// Module natif absent de l'environnement de test (TurboModule RNHapticFeedback)
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: { trigger: jest.fn(), triggerPattern: jest.fn() },
  trigger: jest.fn(),
  triggerPattern: jest.fn(),
  // Core Haptics : présent sur tout iPhone qui fait tourner iOS 16, donc
  // c'est CE chemin que les tests doivent exercer.
  isSupported: jest.fn(() => true),
  HapticFeedbackTypes: {},
}))

jest.mock('react-native-worklets', () => {
  const mockSerializable = {
    set: jest.fn(),
    get: jest.fn(),
  }

  return {
    useWorklet: jest.fn(),
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useFrameCallback: jest.fn(),
    useAnimatedFrame: jest.fn(),
    init: jest.fn(),
    createSerializable: jest.fn(() => mockSerializable),
    createWorklet: jest.fn(fn => fn),
    Worklets: {
      createRunInJsFn: jest.fn(fn => fn),
      createRunInContextFn: jest.fn(fn => fn),
      defaultContext: {},
    },
    __workletFactory: jest.fn(fn => fn),
  }
})

// Don't use the reanimated mock - create our own
jest.mock('react-native-reanimated', () => {
  const _React = require('react')
  const { View, Text, Image, ScrollView } = require('react-native')

  // Animations d'entrée/sortie (FadeInRight.duration(340).delay(80)…) :
  // objet chaînable, chaque méthode renvoie l'animation elle-même.
  const makeLayoutAnimation = () => {
    const anim = {}
    for (const m of [
      'duration',
      'delay',
      'springify',
      'damping',
      'easing',
      'withInitialValues',
      'build',
    ]) {
      anim[m] = jest.fn(() => anim)
    }
    return anim
  }
  const layoutAnimations = {}
  for (const name of [
    'FadeIn',
    'FadeInDown',
    'FadeInUp',
    'FadeInLeft',
    'FadeInRight',
    'FadeOut',
    'FadeOutDown',
    'FadeOutUp',
    'FadeOutLeft',
    'FadeOutRight',
    'ZoomIn',
    'ZoomOut',
    'SlideInDown',
    'SlideInUp',
    'SlideOutDown',
    'SlideOutUp',
  ]) {
    layoutAnimations[name] = makeLayoutAnimation()
  }

  return {
    ...layoutAnimations,
    interpolate: jest.fn(() => 0),
    interpolateColor: jest.fn(() => '#000000'),
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    default: {
      View,
      Text,
      Image,
      ScrollView,
      FlatList: View,
    },
    View,
    Text,
    Image,
    ScrollView,
    FlatList: View,
    useSharedValue: jest.fn(value => ({ value })),
    // La pluie du premier écran (`ShieldRain`) tient l'état de chaque bille
    // dans un `makeMutable` et l'avance dans un `useFrameCallback`. Sous Jest
    // il n'y a pas de thread UI : la valeur reste celle du départ, et la
    // boucle ne tourne jamais. C'est exactement ce qu'on veut — la physique
    // est vérifiée à part, sur ses fonctions pures (`shield-rain.test.ts`).
    makeMutable: jest.fn(value => ({ value })),
    useFrameCallback: jest.fn(() => ({
      setActive: jest.fn(),
      isActive: false,
      callbackId: -1,
    })),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedProps: jest.fn(() => ({})),
    useDerivedValue: jest.fn(fn => ({ value: fn() })),
    useAnimatedScrollHandler: jest.fn(() => ({})),
    useAnimatedGestureHandler: jest.fn(() => ({})),
    useAnimatedReaction: jest.fn(),
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn(value => value),
    withSpring: jest.fn(value => value),
    withDecay: jest.fn(value => value),
    withDelay: jest.fn((_, value) => value),
    withRepeat: jest.fn(value => value),
    withSequence: jest.fn((...values) => values[0]),
    cancelAnimation: jest.fn(),
    runOnJS: jest.fn(fn => fn),
    runOnUI: jest.fn(fn => fn),
    createAnimatedComponent: jest.fn(Component => Component),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      bezier: jest.fn(),
      out: jest.fn(fn => fn),
      in: jest.fn(fn => fn),
      inOut: jest.fn(fn => fn),
    },
  }
})

// `react-native-localize` fournit la langue du téléphone (`src/i18n/i18n.ts`).
// Le module natif n'existe pas sous Jest : sans ce mock, chaque suite qui
// importe i18n tomberait sur l'exception du `require` — et la langue de départ
// des tests deviendrait celle du repli, pas celle attendue.
jest.mock('react-native-localize', () => ({
  getLocales: () => [
    {
      languageCode: 'fr',
      languageTag: 'fr-FR',
      countryCode: 'FR',
      isRTL: false,
    },
  ],
  findBestLanguageTag: () => ({ languageTag: 'fr-FR', isRTL: false }),
}))

// Mock gesture handler
jest.mock('react-native-mmkv', () => {
  const stores = new Map()
  const createMMKV = ({ id = 'default' } = {}) => {
    if (!stores.has(id)) stores.set(id, new Map())
    const store = stores.get(id)
    return {
      set: (key, value) => store.set(key, value),
      getString: key => store.get(key),
      getBoolean: key => store.get(key),
      getNumber: key => store.get(key),
      remove: key => store.delete(key),
      clearAll: () => store.clear(),
      contains: key => store.has(key),
      getAllKeys: () => [...store.keys()],
    }
  }
  return { createMMKV }
})

// Trousseau matériel : une Map en mémoire, mêmes signatures que le vrai module.
// `getItem` / `setItem` sont SYNCHRONES et `deleteItemAsync` ne l'est pas —
// c'est exactement cette asymétrie que `secure-store.ts` doit gérer, donc le
// mock la reproduit telle quelle plutôt que de tout rendre synchrone.
jest.mock('expo-secure-store', () => {
  const store = new Map()
  return {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    WHEN_UNLOCKED: 'WHEN_UNLOCKED',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value)
    },
    getItemAsync: async key => (store.has(key) ? store.get(key) : null),
    setItemAsync: async (key, value) => {
      store.set(key, value)
    },
    deleteItemAsync: async key => {
      store.delete(key)
    },
    isAvailableAsync: async () => true,
    canUseBiometricAuthentication: () => false,
    /** Réservé aux tests : remet le trousseau à zéro entre deux cas. */
    __reset: () => store.clear(),
  }
})

jest.mock('react-native-webview', () => {
  const React = require('react')
  const { View } = require('react-native')
  const WebView = React.forwardRef((props, _ref) =>
    React.createElement(View, props),
  )
  WebView.displayName = 'WebView'
  return { __esModule: true, default: WebView }
})

jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View
  return {
    GestureDetector: View,
    GestureHandlerRootView: View,
    Gesture: {
      Pan: jest.fn(() => ({ enabled: jest.fn().mockReturnThis() })),
      Tap: jest.fn(() => ({ enabled: jest.fn().mockReturnThis() })),
    },
  }
})

// La facturation ne s'exécute jamais en test : aucun réseau, aucun store, et
// le paquet RevenueCat est publié en ESM que Jest ne sait pas transformer.
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    setLogHandler: jest.fn(),
    configure: jest.fn(),
    getCustomerInfo: jest.fn(async () => ({ entitlements: { active: {} } })),
    getOfferings: jest.fn(async () => ({ current: null, all: {} })),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
    setAttributes: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  },
  LOG_LEVEL: { DEBUG: 'DEBUG', WARN: 'WARN' },
  PACKAGE_TYPE: { ANNUAL: 'ANNUAL', WEEKLY: 'WEEKLY' },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: '1',
    PAYMENT_PENDING_ERROR: '2',
  },
}))

jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentCustomerCenter: jest.fn(async () => undefined) },
}))

// Drop i18next's promotional Locize message on init (noisy in every suite that imports i18n)
const originalConsoleInfo = console.info.bind(console)
console.info = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  if (msg.includes('Locize') || msg.includes('locize.com')) {
    return
  }
  originalConsoleInfo(...args)
}

// i18n initialisé pour TOUTES les suites.
//
// `useT()` sans instance i18next renvoie la clé brute et journalise
// `NO_I18NEXT_INSTANCE` : chaque écran localisé dont la suite n'importait pas
// explicitement `@/i18n/i18n` échouait sur des libellés absents. Dans l'app,
// cet import de bord de module est fait une fois par `app/_layout.tsx` ; ici
// c'est le rôle du setup.
require('./src/i18n/i18n')
