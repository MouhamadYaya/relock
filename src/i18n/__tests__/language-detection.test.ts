/**
 * La langue au tout premier démarrage, avant que l'utilisateur n'ait rien
 * choisi.
 *
 * C'est la promesse produit : Relock s'ouvre dans la langue du téléphone
 * quand il la parle, et EN ANGLAIS pour tous les autres — jamais en français,
 * qui n'est la langue par défaut de personne hors de France. Une régression
 * ici est invisible depuis la France : un développeur francophone teste sur un
 * téléphone français et voit toujours du français, quelle que soit la logique.
 *
 * Chaque cas remonte une vraie liste de préférences iOS/Android, dans l'ordre
 * où le système la donne.
 */
const SUPPORTED = ['fr', 'en', 'es']

/**
 * Rejoue la détection avec une liste de préférences donnée.
 *
 * `jest.isolateModules` recharge `i18n.ts` : la détection tourne au premier
 * import du module, exactement comme au démarrage de l'app.
 */
function detectWith(tags: string[]): string {
  let detected = ''
  jest.isolateModules(() => {
    jest.doMock('react-native-localize', () => ({
      getLocales: () => tags.map(tag => ({ languageTag: tag })),
      findBestLanguageTag: () => ({ languageTag: tags[0], isRTL: false }),
    }))
    const { detectDeviceLanguage } = require('@/i18n/i18n')
    detected = detectDeviceLanguage()
  })
  return detected
}

describe('langue au premier démarrage', () => {
  afterEach(() => jest.resetModules())

  describe('le téléphone parle une langue que Relock livre', () => {
    it.each([
      ['fr-FR', 'fr'],
      ['fr-CA', 'fr'],
      ['en-US', 'en'],
      ['en-GB', 'en'],
      ['es-ES', 'es'],
      ['es-419', 'es'],
      ['es-MX', 'es'],
    ])('%s → %s', (tag, expected) => {
      expect(detectWith([tag])).toBe(expected)
    })

    it('accepte aussi la forme à underscore de certains Android', () => {
      expect(detectWith(['es_AR'])).toBe('es')
    })
  })

  describe('le téléphone parle une AUTRE langue → anglais', () => {
    it.each([
      ['de-DE', 'allemand'],
      ['ja-JP', 'japonais'],
      ['pt-BR', 'portugais'],
      ['ar-SA', 'arabe'],
      ['zh-Hans-CN', 'chinois'],
      ['ru-RU', 'russe'],
      ['it-IT', 'italien'],
      ['ko-KR', 'coréen'],
      ['nl-NL', 'néerlandais'],
      ['tr-TR', 'turc'],
      ['hi-IN', 'hindi'],
      ['pl-PL', 'polonais'],
    ])('%s (%s) → en', tag => {
      expect(detectWith([tag])).toBe('en')
    })

    it('reste en anglais même sans aucune préférence lisible', () => {
      expect(detectWith([])).toBe('en')
    })
  })

  describe('plusieurs langues préférées : la première que Relock parle gagne', () => {
    it('un Allemand qui a mis l’espagnol en second obtient l’espagnol', () => {
      // iOS donne la liste ORDONNÉE : ignorer les suivantes ferait perdre un
      // choix que l'utilisateur a posé lui-même dans Réglages › Langues.
      expect(detectWith(['de-DE', 'es-ES', 'en-US'])).toBe('es')
    })

    it('un Japonais dont la seconde langue est l’anglais obtient l’anglais', () => {
      expect(detectWith(['ja-JP', 'en-US'])).toBe('en')
    })

    it('un Néerlandais sans aucune des trois obtient l’anglais', () => {
      expect(detectWith(['nl-NL', 'de-DE', 'sv-SE'])).toBe('en')
    })
  })

  it('ne rend jamais autre chose que les trois langues livrées', () => {
    const tags = [
      'de-DE',
      'ja-JP',
      'pt-PT',
      'sv-SE',
      'fi-FI',
      'he-IL',
      'th-TH',
      'vi-VN',
      'uk-UA',
      'cs-CZ',
      'ro-RO',
      'id-ID',
    ]
    for (const tag of tags) {
      expect(SUPPORTED).toContain(detectWith([tag]))
    }
  })
})
