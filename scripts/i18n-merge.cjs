// i18n-merge.cjs — réinjecte des traductions dans un fichier de langue.
//
//   node scripts/i18n-merge.cjs en /tmp/i18n/en.todo.json
//
// Le fichier d'entrée est soit plat (`{"settings.title": "Settings"}`), soit
// imbriqué (`{"settings": {"title": "Settings"}}`) : les deux formes se
// rencontrent selon qu'on vient de `i18n-missing` ou d'un extrait écrit à la
// main. On refuse d'écrire quoi que ce soit tant qu'une seule entrée est
// douteuse — un fichier de langue à moitié écrit est plus dur à réparer qu'un
// fichier pas écrit du tout.
const fs = require('node:fs')
const {
  flatten,
  placeholders,
  readLocale,
  SOURCE,
  TARGETS,
  unflatten,
  writeLocale,
} = require('./i18n-lib.cjs')

const [locale, file] = process.argv.slice(2)

if (!locale || !file) {
  console.error('Usage : node scripts/i18n-merge.cjs <locale> <fichier.json>')
  process.exit(2)
}
if (!TARGETS.includes(locale)) {
  console.error(
    `[FAIL] « ${locale} » n'est pas une langue cible (${TARGETS.join(', ')}).` +
      `\nLe français est la source : il s'écrit dans le code, pas par fusion.`,
  )
  process.exit(2)
}
if (!fs.existsSync(file)) {
  console.error(`[FAIL] fichier introuvable : ${file}`)
  process.exit(2)
}

const incoming = flatten(JSON.parse(fs.readFileSync(file, 'utf8')))
const source = flatten(readLocale(SOURCE))
const current = flatten(readLocale(locale))

// ── Refus AVANT écriture ─────────────────────────────────────────────────

const rejected = []
for (const [key, value] of Object.entries(incoming)) {
  if (!(key in source)) {
    rejected.push(`${key} — absente du français : ajoute-la d'abord à fr.json`)
    continue
  }
  if (typeof value !== 'string' || value.trim() === '') {
    rejected.push(`${key} — valeur vide`)
    continue
  }
  const expected = placeholders(source[key]).join(',')
  const got = placeholders(value).join(',')
  if (expected !== got) {
    rejected.push(
      `${key} — variables {{…}} : attendu [${expected}], reçu [${got}]`,
    )
  }
}

if (rejected.length > 0) {
  console.error(
    `[FAIL] ${rejected.length} entrées refusées, rien n'a été écrit :`,
  )
  for (const line of rejected) console.error(`   ${line}`)
  process.exit(3)
}

// ── Écriture ─────────────────────────────────────────────────────────────

let added = 0
let updated = 0
for (const [key, value] of Object.entries(incoming)) {
  if (!(key in current)) added += 1
  else if (current[key] !== value) updated += 1
  current[key] = value
}

// L'ordre des clés suit le français : les trois fichiers se relisent alors
// côte à côte, et un diff ne mélange plus « déplacé » et « changé ».
const ordered = {}
for (const key of Object.keys(source)) {
  if (key in current) ordered[key] = current[key]
}
for (const [key, value] of Object.entries(current)) {
  if (!(key in ordered)) ordered[key] = value
}

writeLocale(locale, unflatten(ordered))
console.log(`[OK] ${locale}.json — ${added} ajoutées, ${updated} mises à jour.`)
