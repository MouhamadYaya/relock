/**
 * Le catalogue de traduction, vu comme un tout.
 *
 * Ces tests remplacent la relecture à l'œil : une clé ajoutée dans une seule
 * langue ne se voit qu'en changeant la langue de l'app puis en ouvrant l'écran
 * concerné — c'est-à-dire jamais. Ici elle casse la CI.
 */
import en from '@/i18n/locales/en.json'
import es from '@/i18n/locales/es.json'
import fr from '@/i18n/locales/fr.json'

type Tree = { [key: string]: string | Tree }

function flatten(tree: Tree, prefix = '', out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else flatten(value, path, out)
  }
  return out
}

const LOCALES = {
  fr: flatten(fr as Tree),
  en: flatten(en as Tree),
  es: flatten(es as Tree),
}

describe('catalogue de traduction', () => {
  it('livre exactement trois langues', () => {
    expect(Object.keys(LOCALES).sort()).toEqual(['en', 'es', 'fr'])
  })

  it.each([
    'en',
    'es',
  ] as const)('couvre en %s toutes les clés du français', locale => {
    const missing = Object.keys(LOCALES.fr).filter(
      key => !(key in LOCALES[locale]),
    )
    expect(missing).toEqual([])
  })

  it.each([
    'en',
    'es',
  ] as const)('n’invente aucune clé absente du français en %s', locale => {
    const extra = Object.keys(LOCALES[locale]).filter(
      key => !(key in LOCALES.fr),
    )
    expect(extra).toEqual([])
  })

  it.each([
    'fr',
    'en',
    'es',
  ] as const)('ne laisse aucune valeur vide en %s', locale => {
    const empty = Object.entries(LOCALES[locale])
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key)
    expect(empty).toEqual([])
  })

  it.each([
    'en',
    'es',
  ] as const)('garde les mêmes variables d’interpolation qu’en français (%s)', locale => {
    const placeholders = (value: string) =>
      (value.match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])
        .map(token => token.replace(/[{}\s]/g, ''))
        .sort()
    const drifted = Object.entries(LOCALES.fr)
      .filter(([key, value]) => {
        const other = LOCALES[locale][key]
        if (other === undefined) return false
        return placeholders(value).join(',') !== placeholders(other).join(',')
      })
      .map(([key]) => key)
    // Une variable perdue à la traduction affiche un trou dans la phrase
    // (« Essayer  jours gratuitement ») sans jamais lever d'erreur.
    expect(drifted).toEqual([])
  })
})
