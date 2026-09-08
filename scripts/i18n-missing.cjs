// i18n-missing.cjs — sort exactement ce qui reste à traduire.
//
// Complément de `check-i18n.cjs` : le garde dit QUE ça manque, celui-ci dit
// QUOI, dans une forme directement traduisible puis réinjectable par
// `i18n-merge.cjs`. C'est le format que lit la commande `/i18n` de Claude Code.
//
//   node scripts/i18n-missing.cjs            → résumé lisible
//   node scripts/i18n-missing.cjs --json     → { "en": { "cle": "texte fr" }, … }
//   node scripts/i18n-missing.cjs --out DIR  → écrit DIR/en.todo.json, es.todo.json
const fs = require('node:fs')
const path = require('node:path')
const { flatten, localeDiffs, readLocale, SOURCE } = require('./i18n-lib.cjs')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const outIndex = args.indexOf('--out')
const outDir = outIndex === -1 ? null : args[outIndex + 1]

const source = flatten(readLocale(SOURCE))

/**
 * Une clé est « à traduire » si elle manque, si elle est vide, ou si elle est
 * restée en français. Les trois se réparent de la même façon : produire la
 * bonne phrase à partir du français. On les sert donc dans un seul paquet.
 */
const todo = {}
for (const diff of localeDiffs()) {
  const keys = [...diff.missing, ...diff.empty, ...diff.untranslated]
  if (keys.length === 0) continue
  todo[diff.locale] = Object.fromEntries(keys.map(key => [key, source[key]]))
}

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  for (const [locale, entries] of Object.entries(todo)) {
    const file = path.join(outDir, `${locale}.todo.json`)
    fs.writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`)
    console.log(`${file} — ${Object.keys(entries).length} clés`)
  }
  if (Object.keys(todo).length === 0) console.log('Rien à traduire.')
  process.exit(0)
}

if (asJson) {
  process.stdout.write(`${JSON.stringify(todo, null, 2)}\n`)
  process.exit(0)
}

const locales = Object.keys(todo)
if (locales.length === 0) {
  console.log('[OK] rien à traduire : fr / en / es sont alignés.')
  process.exit(0)
}

for (const locale of locales) {
  const entries = Object.entries(todo[locale])
  console.log(`\n${locale} — ${entries.length} clés à traduire depuis le fr :`)
  for (const [key, value] of entries.slice(0, 30)) {
    console.log(`  ${key}\n     « ${String(value).replace(/\n/g, '\\n')} »`)
  }
  if (entries.length > 30) console.log(`  … et ${entries.length - 30} autres.`)
}
console.log(
  '\nPour traduire : `/i18n` dans Claude Code, ou traduire le JSON de' +
    '\n`node scripts/i18n-missing.cjs --out /tmp/i18n` puis' +
    '\n`npm run i18n:merge -- en /tmp/i18n/en.todo.json`.',
)
