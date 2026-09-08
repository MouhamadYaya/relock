module.exports = {
  locales: ['fr', 'en', 'es'],
  /** One JSON per language — matches `i18n.ts` imports and `generate-i18n-types.cjs`. */
  output: 'src/i18n/locales/$LOCALE.json',
  defaultNamespace: 'translation',
  namespaceSeparator: ':',
  keySeparator: '.',
  /**
   * ⚠️ `true`, et ce n'est PAS négociable.
   *
   * Une grande partie du catalogue est atteinte par des clés CALCULÉES —
   * `translate(`blocking.presets.${id}.title`)`, `onboarding_survey.<groupe>.<id>`,
   * les libellés des préréglages, du questionnaire, du plan personnalisé, du
   * mur natif. i18next-parser ne voit que les `t('clé.littérale')` : avec
   * `keepRemoved: false`, une extraction effacerait des centaines de clés
   * vivantes dans les trois langues d'un coup, sans que rien n'échoue.
   *
   * Le prix est l'inverse : une clé devenue morte ne disparaît pas toute
   * seule. C'est un nettoyage manuel, et c'est le bon compromis.
   */
  keepRemoved: true,
  lexers: {
    tsx: ['JsxLexer'],
    ts: ['JsxLexer'],
  },
}
