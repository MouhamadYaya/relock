/**
 * Les catalogues de traduction sont chargés À LA DEMANDE — et ce chargement
 * doit rester SYNCHRONE.
 *
 * Deux promesses tiennent ce dispositif, et elles se cassent en silence :
 *
 *  1. la langue qui n'est pas affichée n'est jamais évaluée (c'est tout
 *     l'intérêt : ne pas construire ~2 500 clés × 3 au démarrage) ;
 *  2. `t()` répond dès le premier tour de boucle. Un backend i18next est
 *     asynchrone par défaut ; le jour où `initImmediate: false` disparaît, ou
 *     qu'un chargeur rend une promesse, le premier rendu affiche les CLÉS
 *     BRUTES (« home.time_regained ») avant de se corriger. C'est visible à
 *     l'œil nu, et aucun autre test ne l'attrape : tous les autres passent par
 *     un `await`.
 */

/** Une valeur non traduite ressemble à `section.sous_section.cle`. */
const RAW_KEY = /^[a-z0-9_]+(\.[a-z0-9_.-]+)+$/i

describe('chargement des catalogues', () => {
  afterEach(() => jest.resetModules())

  it('traduit dès le premier tour de boucle, sans attendre', () => {
    jest.isolateModules(() => {
      // Aucun `await` ici : c'est précisément ce qui est vérifié.
      const { i18n } = require('@/i18n/i18n')
      expect(i18n.language).toBe('fr')
      const value = i18n.t('home.time_regained')
      expect(typeof value).toBe('string')
      expect(value.trim()).not.toBe('')
      expect(RAW_KEY.test(value.trim())).toBe(false)
    })
  })

  it('ne touche pas aux catalogues des langues non affichées', () => {
    jest.isolateModules(() => {
      // On observe le VRAI chargement, en interceptant le module espagnol
      // lui-même. Se fier à `require.cache` ne prouverait rien : Jest tient
      // son propre registre, et le test passerait même en chargeant tout.
      let spanishLoaded = false
      jest.doMock('../locales/es.json', () => {
        spanishLoaded = true
        return {}
      })

      // `react-native-localize` est mocké sur `fr-FR` (jest.setup.js) : seuls
      // le français et l'anglais qui lui sert de repli ont une raison d'être
      // chargés.
      require('@/i18n/i18n')

      expect(spanishLoaded).toBe(false)
    })
  })

  it('charge une langue à la bascule, et la rend immédiatement', async () => {
    const { i18n } = require('@/i18n/i18n')
    await i18n.changeLanguage('es')
    const value = i18n.t('home.time_regained')
    expect(RAW_KEY.test(value.trim())).toBe(false)
    await i18n.changeLanguage('fr')
  })
})
