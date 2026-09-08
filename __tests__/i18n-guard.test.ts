/**
 * Le garde de localisation, gardé à son tour.
 *
 * `scripts/check-i18n.cjs` est ce qui empêche un texte de partir non traduit.
 * S'il cesse de voir quoi que ce soit — une regex trop stricte, un chemin
 * d'exclusion trop large — il continue d'afficher `[OK]` et personne ne
 * remarque rien avant qu'un écran espagnol ne s'ouvre en français.
 *
 * Le détecteur a déjà eu une panne d'un autre genre : une alternance ambiguë
 * dans la regex JSX le faisait partir en retour arrière exponentiel, sans
 * jamais rendre la main. D'où le test de bout en bout ci-dessous, avec sa
 * limite de temps : un garde qui ne répond pas ne garde rien.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

type Finding = { file: string; line: number; value: string; prop?: string }
const lib = require('../scripts/i18n-lib.cjs') as {
  scanSource: (source: string, relative: string) => Finding[]
}

describe('garde de localisation — détecteur de texte en dur', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'relock-i18n-'))
    file = join(dir, 'Probe.tsx')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  const scan = (source: string) => {
    writeFileSync(file, source)
    return lib.scanSource(source, 'Probe.tsx')
  }

  it('voit une phrase posée entre deux balises', () => {
    const found = scan('<Text>Reprends la main sur ton temps.</Text>')
    expect(found.map(f => f.value)).toEqual(['Reprends la main sur ton temps.'])
  })

  it('voit une phrase étalée sur plusieurs lignes', () => {
    const found = scan('<Text>\n  Une phrase\n  sur deux lignes.\n</Text>')
    expect(found).toHaveLength(1)
    expect(found[0].value).toBe('Une phrase sur deux lignes.')
  })

  it('voit un texte passé en prop, y compris pour le lecteur d’écran', () => {
    const found = scan('<Pressable accessibilityLabel="Ouvrir mes réglages" />')
    expect(found).toHaveLength(1)
    expect(found[0].prop).toBe('accessibilityLabel')
  })

  it('laisse passer un nom de marque', () => {
    expect(scan('<Text>Relock</Text>')).toEqual([])
    expect(scan('<Text>TikTok</Text>')).toEqual([])
  })

  it('laisse passer un identifiant, pas une phrase', () => {
    expect(scan('<View testID="activity-native-refresh" />')).toEqual([])
  })

  it('ne se signale pas lui-même depuis un commentaire', () => {
    // Un commentaire qui EXPLIQUE un texte sorti du code ne doit pas le
    // réintroduire : sinon on ne peut plus écrire pourquoi il est parti.
    expect(scan('/* avant : <Text>Bonjour toi</Text> */')).toEqual([])
    expect(scan('// avant : title="Bonjour toi"')).toEqual([])
  })

  it('respecte l’échappatoire i18n-ignore', () => {
    const found = scan('// i18n-ignore\n<Text>debug only, jamais livré</Text>')
    expect(found).toEqual([])
  })
})

describe('garde de localisation — bout en bout', () => {
  it('rend son verdict sur tout le dépôt, et vite', () => {
    // La limite de temps EST l'assertion : le détecteur a déjà tourné sans
    // fin sur ce dépôt. Un garde qui ne rend pas la main bloque le commit
    // de tout le monde.
    const started = Date.now()
    const output = execFileSync('node', ['scripts/check-i18n.cjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20_000,
    })
    expect(Date.now() - started).toBeLessThan(20_000)
    expect(output).toContain('[OK]')
  }, 30_000)
})
