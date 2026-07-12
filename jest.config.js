module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'], // Change to .js
  moduleNameMapper: {
    // Évite de charger react-native-url-polyfill / @supabase/supabase-js
    // (ESM non transpilés) dans l'environnement de test.
    '^react-native-url-polyfill/auto$': '<rootDir>/jest/emptyMock.js',
    '^@supabase/supabase-js$': '<rootDir>/jest/supabaseJsMock.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-config|@shopify/flash-list|react-native-webview)/)',
  ],
}
