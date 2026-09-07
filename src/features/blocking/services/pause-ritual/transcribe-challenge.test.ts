import {
  isTranscriptionComplete,
  matchedLength,
  nextTranscribeIndex,
  normalizeTranscription,
  TRANSCRIBE_LINE_COUNT,
} from '@/features/blocking/services/pause-ritual/transcribe-challenge'
import de from '@/i18n/locales/de.json'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ru from '@/i18n/locales/ru.json'

const MODEL = 'Je choisis d’ouvrir cette application maintenant.'

describe('normalizeTranscription', () => {
  it('accepte l’apostrophe droite là où le modèle porte la typographique', () => {
    expect(
      isTranscriptionComplete(
        MODEL,
        "Je choisis d'ouvrir cette application maintenant.",
      ),
    ).toBe(true)
  })

  it('ignore la casse, les blancs superflus et l’espace insécable', () => {
    expect(
      isTranscriptionComplete(
        MODEL,
        '  je choisis d’ouvrir  cette application maintenant. ',
      ),
    ).toBe(true)
    expect(normalizeTranscription('a  b')).toBe('a b')
  })

  it('refuse une phrase amputée de ses accents ou de sa ponctuation', () => {
    expect(
      isTranscriptionComplete(
        MODEL,
        'Je choisis d’ouvrir cette application maintenant',
      ),
    ).toBe(false)
    expect(isTranscriptionComplete('Décidé.', 'Decide.')).toBe(false)
  })
})

describe('matchedLength', () => {
  it('compte les caractères justes depuis le début', () => {
    expect(matchedLength(MODEL, 'Je choisis')).toBe(10)
    expect(matchedLength(MODEL, '')).toBe(0)
  })

  it('s’arrête au premier écart, sans rattraper la suite', () => {
    // Le « x » diverge en position 3 : ce qui suit, même juste, ne compte pas.
    expect(matchedLength(MODEL, 'Je xhoisis d’ouvrir')).toBe(3)
  })

  it('ne dépasse jamais la longueur du modèle', () => {
    expect(matchedLength('abc', 'abcdef')).toBe(3)
  })
})

describe('nextTranscribeIndex', () => {
  it('reste dans le répertoire et ne redonne jamais la phrase précédente', () => {
    for (let previous = 0; previous < TRANSCRIBE_LINE_COUNT; previous += 1) {
      for (let i = 0; i < 200; i += 1) {
        const index = nextTranscribeIndex(previous)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(TRANSCRIBE_LINE_COUNT)
        expect(index).not.toBe(previous)
      }
    }
  })
})

/**
 * Le composant cite les phrases une à une, littéralement (`line_1` … `line_6`),
 * parce que `i18next-parser` supprime toute clé construite dynamiquement. Ce
 * test est le seul garde-fou entre `TRANSCRIBE_LINE_COUNT` et ce que les
 * fichiers de langue contiennent vraiment.
 */
describe('répertoire de phrases', () => {
  const locales = { fr, en, de, ru }

  for (const [name, bundle] of Object.entries(locales)) {
    it(`fournit ${TRANSCRIBE_LINE_COUNT} phrases non vides en ${name}`, () => {
      const lines = (
        bundle as { blocking: { transcribe: Record<string, string> } }
      ).blocking.transcribe
      for (let i = 1; i <= TRANSCRIBE_LINE_COUNT; i += 1) {
        expect(typeof lines[`line_${i}`]).toBe('string')
        expect(lines[`line_${i}`].length).toBeGreaterThan(20)
      }
      expect(lines[`line_${TRANSCRIBE_LINE_COUNT + 1}`]).toBeUndefined()
    })
  }
})
