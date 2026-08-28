// Config Metro basée sur Expo (nécessaire depuis l'intégration expo-dev-client :
// `expo start` sert l'entrée virtuelle `.expo/.virtual-metro-entry` que
// l'AppDelegate charge en DEBUG). On conserve le transformer SVG maison.
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

module.exports = withNativeWind(config, { input: './global.css' })
