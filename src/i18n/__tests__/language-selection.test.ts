/**
 * Le choix de langue : détection automatique, mémoire, et bascule réelle.
 *
 * Le chemin manuel (Réglages › Langue) n'était vérifié que par le rendu du
 * sélecteur ; rien ne garantissait que le choix survive au redémarrage, ni que
 * l'app bascule vraiment tout son texte. Ces deux promesses tombent sous des
 * tests parce qu'elles se cassent en silence.
 */
import { constants } from '@/config/constants'
import i18n, {
  detectDeviceLanguage,
  resolveInitialLanguage,
  SUPPORTED_LANGUAGES,
  setAppLanguage,
} from '@/i18n/i18n'
import { kvStorage } from '@/shared/services/storage/mmkv'

describe('langue de l’application', () => {
  afterEach(async () => {
    kvStorage.delete(constants.PREF_LANGUAGE)
    await i18n.changeLanguage('fr')
  })

  it('ne livre que le français, l’anglais et l’espagnol', () => {
    expect([...SUPPORTED_LANGUAGES]).toEqual(['fr', 'en', 'es'])
  })

  it('déduit la langue du téléphone quand rien n’a été choisi', () => {
    // `react-native-localize` est mocké sur `fr-FR` (jest.setup.js).
    expect(detectDeviceLanguage()).toBe('fr')
    expect(resolveInitialLanguage()).toBe('fr')
  })

  it('retient le choix manuel et le fait primer sur le téléphone', async () => {
    await setAppLanguage('es')
    expect(kvStorage.getString(constants.PREF_LANGUAGE)).toBe('es')
    // C'est ce que lira le prochain démarrage : sans mémoire, l'app repartait
    // dans la langue du téléphone et le choix de l'utilisateur disparaissait.
    expect(resolveInitialLanguage()).toBe('es')
  })

  it('ignore une langue stockée qui n’est plus livrée', async () => {
    kvStorage.setString(constants.PREF_LANGUAGE, 'de')
    expect(resolveInitialLanguage()).toBe('fr')
  })

  it.each([
    'fr',
    'en',
    'es',
  ] as const)('bascule tout le texte de l’app en %s', async language => {
    await setAppLanguage(language)
    expect(i18n.language).toBe(language)
    // Un échantillon qui traverse les grandes surfaces de l'app : réglages,
    // blocages, accueil, onboarding, notifications, paywall.
    const sample = [
      'settings.title',
      'blocking.list.title',
      'home.time_regained',
      'onboarding_survey.trigger.title',
      'notifications.soft_ask_title',
      'paywall.plans_title',
    ]
    for (const key of sample) {
      const value = i18n.t(key as never) as unknown as string
      expect(value).not.toBe(key)
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('rend un texte DIFFÉRENT dans chaque langue', async () => {
    const rendered: string[] = []
    for (const language of SUPPORTED_LANGUAGES) {
      await setAppLanguage(language)
      rendered.push(i18n.t('blocking.list.empty_title' as never) as never)
    }
    expect(new Set(rendered).size).toBe(3)
  })
})
