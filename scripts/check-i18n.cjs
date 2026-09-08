// check-i18n.cjs — interdit qu'un texte parte non traduit.
//
// POURQUOI CE GARDE EXISTE
// Relock s'écrit en français, et se livre en trois langues. Un texte ajouté
// sans `t()`, ou une clé remplie en français seulement, ne casse rien : l'app
// démarre, l'écran s'affiche, les tests passent. Ça ne se voit qu'en changeant
// la langue de l'app et en rouvrant l'écran exact — c'est-à-dire jamais. Le
// seul moment où l'oubli est encore réparable, c'est le commit.
//
// Il vérifie deux choses distinctes :
//   1. le code ne contient plus de texte affiché en dur ;
//   2. les trois fichiers de langue disent la même chose, avec les mêmes
//      variables, sans trou ni recopie du français.
//
// SI CE SCRIPT ÉCHOUE : `npm run i18n:fix` explique quoi faire, et
// `npm run i18n:missing` sort exactement ce qui reste à traduire.
const { hardcodedStrings, localeDiffs, TARGETS } = require('./i18n-lib.cjs')

const problems = []

// ── 1. Texte en dur ──────────────────────────────────────────────────────

const hardcoded = hardcodedStrings()
if (hardcoded.length > 0) {
  problems.push(
    `Texte affiché en dur (${hardcoded.length}) — il doit passer par t() :`,
  )
  for (const item of hardcoded.slice(0, 40)) {
    const where = item.prop ? ` [${item.prop}]` : ''
    problems.push(
      `   ${item.file}:${item.line}${where} « ${item.value.slice(0, 80)} »`,
    )
  }
  if (hardcoded.length > 40) {
    problems.push(`   … et ${hardcoded.length - 40} autres.`)
  }
}

// ── 2. Parité des fichiers de langue ─────────────────────────────────────

const LABELS = {
  missing: 'clés absentes',
  untranslated: 'clés encore en français',
  empty: 'valeurs vides',
  drifted: 'variables {{…}} qui ne correspondent plus au français',
  orphan: 'clés qui n’existent plus en français',
}

for (const diff of localeDiffs()) {
  for (const kind of Object.keys(LABELS)) {
    const keys = diff[kind]
    if (keys.length === 0) continue
    problems.push(`${diff.locale}.json — ${LABELS[kind]} (${keys.length}) :`)
    for (const key of keys.slice(0, 25)) problems.push(`   ${key}`)
    if (keys.length > 25) {
      problems.push(`   … et ${keys.length - 25} autres.`)
    }
  }
}

// ── Verdict ──────────────────────────────────────────────────────────────

if (problems.length > 0) {
  console.error('[FAIL] Localisation incomplète.\n')
  for (const line of problems) console.error(line)
  console.error(
    '\nÀ faire :' +
      "\n  • texte en dur → remplacer par t('section.cle') et ajouter la clé" +
      '\n    dans src/i18n/locales/fr.json ;' +
      `\n  • clés manquantes → \`npm run i18n:missing\` sort le français à traduire` +
      `\n    en ${TARGETS.join(' et ')}, puis \`npm run i18n:merge <fichier.json>\`.` +
      '\n\n  Le plus simple : ouvrir Claude Code et lancer `/i18n`.',
  )
  process.exit(3)
}

console.log('[OK] localisation complète (fr / en / es).')
