// Mock worklets completely FIRST

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
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
  default: { trigger: jest.fn() },
  trigger: jest.fn(),
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

// Drop i18next's promotional Locize message on init (noisy in every suite that imports i18n)
const originalConsoleInfo = console.info.bind(console)
console.info = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : ''
  if (msg.includes('Locize') || msg.includes('locize.com')) {
    return
  }
  originalConsoleInfo(...args)
}
