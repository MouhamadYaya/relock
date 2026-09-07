// Config Metro basée sur Expo (nécessaire depuis l'intégration expo-dev-client :
// `expo start` sert l'entrée virtuelle `.expo/.virtual-metro-entry` que
// l'AppDelegate charge en DEBUG). On conserve le transformer SVG maison.
const { withSentryConfig } = require('@sentry/react-native/metro')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// SVG en composant React (react-native-svg-transformer), repris de l'ancienne
// config RN CLI : on sort `svg` des assets et on l'ajoute aux sources.
config.transformer.babelTransformerPath = require.resolve(
  'react-native-svg-transformer',
)
config.resolver.assetExts = config.resolver.assetExts.filter(
  ext => ext !== 'svg',
)
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg']

/**
 * Sentry en DERNIER, autour de tout le reste.
 *
 * Son rôle ici est d'injecter un « Debug ID » identique dans le bundle et
 * dans sa source map. C'est l'appariement le plus fiable des deux : il ne
 * dépend ni du numéro de version, ni du build, ni de la plateforme — donc
 * une source map reste exploitable même si le nom de release dérive.
 *
 * `annotateReactComponents` est volontairement laissé à `false` : cette
 * option installe SON PROPRE transformer Babel, ce qui écraserait
 * `react-native-svg-transformer` configuré au-dessus.
 */
module.exports = withSentryConfig(
  withNativeWind(config, { input: './global.css' }),
  { annotateReactComponents: false },
)
