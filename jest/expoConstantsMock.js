// `expo-constants` est publié en ESM non transpilé : le charger tel quel fait
// échouer l'import. Les tests n'ont de toute façon pas de binaire natif à
// interroger — sans version native, `appVersion()` retombe sur le repli
// déclaré dans `app-config.ts`, ce qui est exactement le chemin à couvrir ici.
module.exports = {
  __esModule: true,
  default: {
    nativeAppVersion: null,
    nativeBuildVersion: null,
    expoConfig: null,
  },
}
