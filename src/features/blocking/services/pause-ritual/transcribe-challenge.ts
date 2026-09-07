/**
 * Le rituel « recopier une phrase ».
 *
 * La friction visée est MANUELLE : occuper les deux pouces trente secondes,
 * là où la respiration occupe l'attention et le calcul la tête. La phrase est
 * donc volontairement pénible à saisir — ponctuation, mots qu'aucun clavier
 * ne devine, rythme irrégulier — mais jamais absurde : ce qu'on recopie
 * décrit ce qu'on est en train de faire, et cette lecture forcée fait
 * partie du dispositif.
 *
 * Trois décisions structurent la comparaison, chacune contre un échec précis :
 *
 *  1. **Les apostrophes et guillemets typographiques valent leur équivalent
 *     droit.** Un clavier iOS produit « ’ », un clavier externe « ' » :
 *     exiger le bon caractère rendrait la phrase infranchissable selon le
 *     matériel, ce qui n'a rien à voir avec l'effort demandé.
 *  2. **La casse ne compte pas.** La majuscule initiale demande un appui sur
 *     Maj que l'auto-capitalisation désactivée ne donne plus ; punir ça, ce
 *     n'est pas ajouter de la friction, c'est ajouter du hasard.
 *  3. **Les accents et la ponctuation comptent.** C'est précisément là qu'est
 *     le travail. Les neutraliser viderait le rituel de sa substance.
 *
 * Les espaces sont normalisés (répétitions, espaces insécables des claviers
 * français) et les blancs de tête et de fin ignorés : personne ne doit
 * échouer sur un espace invisible.
 */

/**
 * Le nombre de phrases du répertoire, par langue.
 *
 * Les clés vivent dans `src/i18n/locales/*.json` sous
 * `blocking.transcribe.line_1` … `line_6`, et le composant les cite une à
 * une, littéralement — c'est ce qui les rend visibles à `i18n:extract`, qui
 * supprime toute clé qu'il ne voit pas écrite en clair (`keepRemoved: false`).
 * `transcribe-challenge.test.ts` verrouille l'accord entre ce nombre et le
 * contenu réel des fichiers de langue.
 */
export const TRANSCRIBE_LINE_COUNT = 6

/**
 * L'index de la phrase à recopier, différent du précédent.
 *
 * Tirer au hasard sans mémoire redonne la même phrase une fois sur six ;
 * la retrouver juste après l'avoir tapée permet de la recopier de tête, ce
 * qui supprime l'effort de lecture qu'on cherchait à imposer.
 */
export function nextTranscribeIndex(previous?: number): number {
  if (TRANSCRIBE_LINE_COUNT <= 1) return 0
  const index = Math.floor(Math.random() * (TRANSCRIBE_LINE_COUNT - 1))
  return previous === undefined || index < previous ? index : index + 1
}

/** Apostrophes et guillemets typographiques → leur équivalent droit. */
function unifyQuotes(value: string): string {
  return value.replace(/[‘’ʼ′]/g, "'").replace(/[“”]/g, '"')
}

/**
 * La forme comparable d'un texte : guillemets unifiés, blancs normalisés
 * (l'espace insécable des claviers français inclus), casse effacée.
 */
export function normalizeTranscription(value: string): string {
  return unifyQuotes(value)
    .replace(/[\s  ]+/g, ' ')
    .trim()
    .toLocaleLowerCase()
}

/**
 * Le nombre de caractères déjà justes, en partant du début.
 *
 * C'est la mesure qui pilote l'affichage : le modèle s'éclaire au fil de la
 * frappe, et s'arrête net au premier écart. Un retour à la lettre près vaut
 * mieux qu'un verdict à la validation — on voit son erreur là où elle est.
 */
export function matchedLength(target: string, typed: string): number {
  const model = unifyQuotes(target).toLocaleLowerCase()
  const input = unifyQuotes(typed).toLocaleLowerCase()
  let matched = 0
  while (matched < input.length && matched < model.length) {
    // Les blancs sont interchangeables : un espace insécable produit par le
    // clavier ne doit pas faire virer au rouge une saisie par ailleurs juste.
    const a = model[matched]
    const b = input[matched]
    const bothBlank = /[\s  ]/.test(a) && /[\s  ]/.test(b)
    if (a !== b && !bothBlank) break
    matched += 1
  }
  return matched
}

/** La saisie reproduit-elle la phrase ? */
export function isTranscriptionComplete(
  target: string,
  typed: string,
): boolean {
  return normalizeTranscription(target) === normalizeTranscription(typed)
}
