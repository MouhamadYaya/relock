/**
 * Extraction seed — NOT imported or called at runtime.
 *
 * i18next-parser only detects static `t('key')` calls. Keys that are used
 * dynamically (computed key strings) or in files outside the extraction glob
 * must be referenced here as static `t()` calls so they survive
 * `npm run i18n:extract`.
 *
 * Depuis que le catalogue est majoritairement atteint par des clés calculées
 * (`translate(`blocking.presets.${id}.title`)` et ses semblables), la
 * protection principale n'est plus ce fichier mais `keepRemoved: true` dans
 * `i18next-parser.config.cjs` — voir le commentaire qui l'accompagne. Ce
 * fichier ne garde que les repères utiles à la lecture.
 *
 * Keep this file in sync with actual usage.
 */

function _extractionSeed(t: (key: string) => string) {
  // Fallback label used as a plain string literal in navigation-helpers
  t('app.title')
}
