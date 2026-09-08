// i18n-lib.cjs — briques partagées par les scripts i18n.
//
// Un seul endroit décrit ce qu'est « du texte affiché » et ce qu'est une
// valeur légitimement identique d'une langue à l'autre. Les trois scripts
// (check, missing, merge) doivent en avoir exactement la même définition,
// sinon le garde bloque ce que le remplisseur vient d'écrire.
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales')

/** La langue de référence : c'est en français que le produit s'écrit. */
const SOURCE = 'fr'
/** Les langues à remplir. Ajouter une langue = l'ajouter ici ET dans `i18n.ts`. */
const TARGETS = ['en', 'es']
const ALL = [SOURCE, ...TARGETS]

// ── Fichiers de langue ───────────────────────────────────────────────────

const localePath = locale => path.join(LOCALES_DIR, `${locale}.json`)

function readLocale(locale) {
  return JSON.parse(fs.readFileSync(localePath(locale), 'utf8'))
}

function writeLocale(locale, tree) {
  fs.writeFileSync(localePath(locale), `${JSON.stringify(tree, null, 2)}\n`)
}

/** `{a:{b:'x'}}` → `{'a.b':'x'}` — la forme dans laquelle on compare. */
function flatten(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const dotted = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, dotted, out)
    } else {
      out[dotted] = value
    }
  }
  return out
}

/** L'inverse : `{'a.b':'x'}` → `{a:{b:'x'}}`, pour réécrire un fichier. */
function unflatten(flat) {
  const tree = {}
  for (const [dotted, value] of Object.entries(flat)) {
    const parts = dotted.split('.')
    let node = tree
    for (const part of parts.slice(0, -1)) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {}
      node = node[part]
    }
    node[parts[parts.length - 1]] = value
  }
  return tree
}

/** Les `{{variables}}` d'une chaîne, triées — une traduction doit les garder. */
function placeholders(value) {
  return (String(value).match(/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/g) ?? [])
    .map(token => token.replace(/[{}\s]/g, ''))
    .sort()
}

/**
 * Une valeur peut-elle légitimement rester identique au français ?
 *
 * Oui pour un gabarit sans mot (« {{hours}} h {{minutes}} »), un horaire, un
 * nombre. Les noms propres et les rares expressions identiques dans les trois
 * langues passent par `IDENTICAL_OK` : elles restent VISIBLES en revue, ce qui
 * est le but — recopier le français pour faire taire le garde doit se voir.
 */
const IDENTICAL_OK = new Set([
  // Noms propres, marques, sources citées.
  'paywall_reference.author',
  'paywall_reference.author_2',
  'paywall_reference.author_3',
  'paywall_reference.trust',
  'paywall.notice_title',
  'settings.pro.title',
  'onboarding_tutorial.hard.switch',
  'onboarding_verdict.press.meta.source',
])

/**
 * Un mot SEUL est souvent le même d'une langue à l'autre — « Focus »,
 * « Social », « Type », « dormir », « apps ». Signaler chacun d'eux noierait
 * les vrais oublis sous une liste d'exceptions que plus personne ne relit.
 *
 * On ne signale donc une valeur recopiée que si elle porte DEUX mots (une
 * phrase ne survit pas telle quelle à une traduction), ou un accent propre au
 * français : « Réglages » recopié en anglais se voit à l'accent, « dormir »
 * non — et c'est justement le mot espagnol.
 */
const FRENCH_ACCENT = /[àâäéèêëîïôöùûüÿçœæ]/i

function looksTranslatable(value) {
  const stripped = String(value)
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/[^\p{L}\s-]/gu, ' ')
  const words = stripped.split(/\s+/).filter(word => /\p{L}{3}/u.test(word))
  if (words.length >= 2) return true
  return words.length === 1 && FRENCH_ACCENT.test(words[0])
}

// ── Le diff entre le français et une langue cible ────────────────────────

/**
 * Ce qui manque ou dérive dans `target` par rapport au français.
 *
 * `missing` = clé absente. `untranslated` = clé présente mais recopiée du
 * français alors qu'elle contient de vrais mots. `empty` = valeur vide.
 * `drifted` = les `{{variables}}` ne correspondent plus (« Essayer  jours
 * gratuitement » : le trou ne lève aucune erreur à l'exécution).
 * `orphan` = clé qui n'existe plus en français.
 */
function diffLocale(source, target, targetName) {
  const missing = []
  const untranslated = []
  const empty = []
  const drifted = []

  for (const [key, value] of Object.entries(source)) {
    if (!(key in target)) {
      missing.push(key)
      continue
    }
    const other = target[key]
    if (String(other).trim() === '') {
      empty.push(key)
      continue
    }
    if (placeholders(value).join(',') !== placeholders(other).join(',')) {
      drifted.push(key)
    }
    if (other === value && looksTranslatable(value) && !IDENTICAL_OK.has(key)) {
      untranslated.push(key)
    }
  }

  const orphan = Object.keys(target).filter(key => !(key in source))
  return { locale: targetName, missing, untranslated, empty, drifted, orphan }
}

function localeDiffs() {
  const source = flatten(readLocale(SOURCE))
  return TARGETS.map(locale =>
    diffLocale(source, flatten(readLocale(locale)), locale),
  )
}

// ── Le code de l'app ─────────────────────────────────────────────────────

const CODE_ROOTS = ['src', 'app']

/**
 * Fichiers dont le texte n'atteint jamais un utilisateur.
 *
 * Chaque entrée est une DETTE ASSUMÉE, pas un oubli : un écran de diagnostic
 * derrière `__DEV__` ne part pas dans le binaire distribué, et le traduire
 * coûterait trois langues à chaque changement d'un outil interne.
 */
const NOT_SHIPPED = [
  // Écran de diagnostic du moteur de notifications : route montée
  // uniquement sous `__DEV__` (`app/_layout.tsx`).
  'src/features/notifications/screens/NotificationsDebugScreen.tsx',
  // Ponts et fixtures de développement.
  'src/session/dev-test-bridge.ts',
  'src/session/dev-auth.ts',
  'src/session/dev-skip-paywall.ts',
  'src/features/blocking/dev-fixtures.ts',
  'src/features/home/services/home-reference-my-apps.ts',
]

/** Valeurs qui ne se traduisent pas : marques, symboles, gabarits. */
const LITERAL_OK = new Set([
  'Relock',
  'RELOCK',
  'TikTok',
  'Instagram',
  'YouTube',
  'Snapchat',
  'Reddit',
  'Facebook',
  'WhatsApp',
  'Threads',
  'Netflix',
  'Twitch',
  'Pinterest',
  'LinkedIn',
  'Discord',
  'Telegram',
  'Apple',
  'Google',
  'Hard Mode',
])

/** Les props dont la valeur est LUE par quelqu'un (à l'écran ou à voix haute). */
const TEXT_PROPS =
  /\b(title|label|subtitle|placeholder|message|description|heading|caption|cta|body|headline|accessibilityLabel|accessibilityHint|closeLabel|confirmLabel|cancelLabel|idleLabel|holdingLabel|text|note|action|addLabel|emptyLabel|hint)\s*=\s*(["'])((?:(?!\2)[^\\]|\\.)*)\2/g

/**
 * Retire commentaires et chaînes de gabarit du fichier avant analyse.
 *
 * Sans ça, un commentaire qui EXPLIQUE un ancien texte en dur se fait
 * signaler — le garde se mordrait la queue, et on ne pourrait plus écrire
 * pourquoi une chaîne a été sortie du code.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_, before) => before)
}

/**
 * Échappatoire à la ligne : `// i18n-ignore` juste avant, ou en fin de ligne.
 *
 * Elle existe pour les commandes de développement mêlées à du code livré —
 * un bouton derrière `__DEV__` au milieu d'un écran normal. Volontairement
 * bruyante : elle se cherche en un grep, et une revue voit tout de suite
 * quelqu'un qui l'emploie pour faire taire un vrai oubli.
 */
const IGNORE_MARK = 'i18n-ignore'

function ignoredLines(rawSource) {
  const ignored = new Set()
  rawSource.split('\n').forEach((line, index) => {
    if (!line.includes(IGNORE_MARK)) return
    ignored.add(index + 1)
    ignored.add(index + 2)
  })
  return ignored
}

function* walkCode() {
  const stack = CODE_ROOTS.map(root => path.join(ROOT, root))
  while (stack.length > 0) {
    const dir = stack.pop()
    if (!fs.existsSync(dir)) continue
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__snapshots__') continue
        stack.push(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      if (/\.test\.|\.d\.ts$/.test(entry.name)) continue
      const relative = path.relative(ROOT, full)
      if (NOT_SHIPPED.includes(relative)) continue
      yield { full, relative }
    }
  }
}

/** Un texte est suspect s'il porte un mot, et n'est ni une clé ni un chemin. */
function isCopy(value) {
  const trimmed = value.trim()
  if (trimmed.length < 2) return false
  if (LITERAL_OK.has(trimmed)) return false
  if (!/\p{L}{3}/u.test(trimmed)) return false
  if (/^https?:|^\//.test(trimmed)) return false
  // `home.title`, `activity-native-refresh`, `no-hide-descendants` : des
  // identifiants, pas des phrases.
  if (/^[a-z0-9]+([.\-_/:][a-z0-9]+)*$/.test(trimmed)) return false
  return true
}

/**
 * Le texte affiché en dur d'UN fichier.
 *
 * Isolé de la marche sur le disque pour être testable sur une chaîne : c'est
 * cette fonction qui décide ce qui compte comme texte, et c'est donc elle
 * qu'un test doit pouvoir interroger directement.
 */
function scanSource(raw, relative) {
  const found = []
  const source = stripComments(raw)
  const skipped = ignoredLines(raw)
  const lineAt = index => source.slice(0, index).split('\n').length

  // Texte JSX brut : `<Text>Bonjour</Text>`, sur une ou plusieurs lignes.
  //
  // ⚠️ Pas d'alternance dans la classe : `(?:[^<>{}]|\n)*?` décrivait deux
  // fois le saut de ligne (déjà couvert par `[^<>{}]`), et cette ambiguïté
  // fait exploser le moteur en retour arrière dès qu'un fichier contient une
  // longue portion sans `</` — le script tournait alors indéfiniment à 80 %
  // de CPU au lieu d'échouer. Une classe unique reste linéaire.
  const jsxText = />\s*([^<>{}]*?)\s*<\//g
  for (const match of source.matchAll(jsxText)) {
    const value = match[1].replace(/\s+/g, ' ').trim()
    const line = lineAt(match.index)
    if (isCopy(value) && !skipped.has(line)) {
      found.push({ file: relative, line, value })
    }
  }

  // Props qui rendent du texte : `title="Bonjour"`.
  for (const match of source.matchAll(TEXT_PROPS)) {
    const value = match[3]
    const line = lineAt(match.index)
    if (isCopy(value) && /\s|\p{L}{4}/u.test(value) && !skipped.has(line)) {
      found.push({ file: relative, line, value, prop: match[1] })
    }
  }

  return found
}

/** Le texte en dur restant dans le code de l'app. */
function hardcodedStrings() {
  const found = []
  for (const { full, relative } of walkCode()) {
    found.push(...scanSource(fs.readFileSync(full, 'utf8'), relative))
  }
  return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
}

module.exports = {
  ALL,
  IDENTICAL_OK,
  LOCALES_DIR,
  ROOT,
  SOURCE,
  TARGETS,
  diffLocale,
  flatten,
  hardcodedStrings,
  localeDiffs,
  placeholders,
  readLocale,
  scanSource,
  unflatten,
  writeLocale,
}
