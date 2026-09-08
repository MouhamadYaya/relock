import { constants } from '@/config/constants'
import { DEFAULT_APP_LOGO } from '@/shared/constants/app-logo'
import {
  getAppLogo,
  setAppLogo,
} from '@/shared/services/storage/app-preferences'
import { kvStorage } from '@/shared/services/storage/mmkv'

describe('préférence d’icône d’app', () => {
  beforeEach(() => {
    kvStorage.delete(constants.PREF_APP_LOGO)
  })

  it('rend l’icône d’origine tant que rien n’a été écrit', () => {
    expect(getAppLogo()).toBe(DEFAULT_APP_LOGO)
  })

  it('relit l’icône retenue', () => {
    setAppLogo('phases')

    expect(getAppLogo()).toBe('phases')
  })

  it('retombe sur le défaut devant une valeur inconnue', () => {
    // Le scénario réel : une version plus récente a écrit une icône qui
    // n'existe pas dans celle-ci, puis l'utilisateur a rétrogradé. Aucune
    // migration ne tourne dans ce sens — c'est la lecture qui doit tenir.
    kvStorage.setString(constants.PREF_APP_LOGO, 'supernova')

    expect(getAppLogo()).toBe(DEFAULT_APP_LOGO)
  })
})
