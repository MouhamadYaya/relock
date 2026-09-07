// Config Metro basée sur Expo (nécessaire depuis l'intégration expo-dev-client :
// `expo start` sert l'entrée virtuelle `.expo/.virtual-metro-entry` que
// l'AppDelegate charge en DEBUG). On conserve le transformer SVG maison.
//
// ⚠️ `getSentryExpoConfig` REMPLACE `getDefaultConfig` d'Expo — ce n'est pas
// une préférence de style. La variante générique (`withSentryConfig`) enveloppe
// `serializer.customSerializer` et suppose qu'il rend `{ code, map }` ; le
// sérialiseur d'Expo rend autre chose, si bien que Sentry lisait un `code`
// `undefined` et cassait le bundle sur `undefined.match(...)`. Le symptôme est
// perfide : « iOS Bundling failed » UNIQUEMENT en Release, donc invisible
// pendant tout le développement et découvert au moment de publier.
//
// `getSentryExpoConfig` passe, lui, par le point d'extension prévu par Expo
// (`unstable_beforeAssetSerializationPlugins`) et n'entre jamais en conflit.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const { withNativeWind } = require('nativewind/metro')

// `annotateReactComponents` reste désactivé : cette option installe SON PROPRE
// transformer Babel, qui écraserait `react-native-svg-transformer` ci-dessous.
const config = getSentryExpoConfig(__dirname, { annotateReactComponents: false })

// SVG en composant React (react-native-svg-transformer), repris de l'ancienne
// config RN CLI : on sort `svg` des assets et on l'ajoute aux sources.
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer',
)
config.resolver.assetExts = config.resolver.assetExts.filter(
  ext => ext !== 'svg',
)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg']

module.exports = withNativeWind(config, { input: './global.css' })
