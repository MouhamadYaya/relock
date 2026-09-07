/**
 * Les calculs du rituel « calcul mental ».
 *
 * L'intention est une friction COGNITIVE, pas une épreuve : ouvrir Instagram
 * doit coûter une trentaine de secondes d'attention réelle, celles pendant
 * lesquelles l'envie retombe. Trois contraintes en découlent, et elles
 * expliquent chaque borne de ce fichier :
 *
 *  1. **Aucun résultat mémorisé.** `7 × 8` se lit sans calculer — la table de
 *     multiplication est un réflexe, pas un effort. Les multiplications
 *     partent donc à deux chiffres (`7 × 14`), hors de toute table apprise.
 *  2. **Aucun calcul de tête sans retenue.** `23 + 45` se pose de gauche à
 *     droite sans y penser. Additions et soustractions FORCENT donc la
 *     retenue et l'emprunt : c'est ce qui oblige à tenir un chiffre en tête.
 *  3. **Faisable sans papier.** Le résultat reste toujours un entier positif
 *     à trois chiffres au plus, et une seule opération à la fois. Au-delà,
 *     ce n'est plus une friction : c'est un mur, et on désinstalle l'app.
 *
 * Les valeurs sont tirées à chaque manche : rien à apprendre par cœur, donc
 * rien à contourner en refaisant le même geste tous les jours.
 */

export type MathOperator = 'x' | '+' | '-'

export interface MathChallenge {
  left: number
  right: number
  operator: MathOperator
  answer: number
}

/** Entier dans `[min, max]`, bornes comprises. */
function between(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/**
 * Le nombre de manches d'une pause.
 *
 * Trois : une seule se règle par réflexe et ne freine personne, cinq
 * transforment la pause en corvée qu'on finit par contourner en désactivant
 * le blocage. Trois manches tiennent ~30 s — l'ordre de grandeur d'une envie
 * qui passe.
 */
export const MATH_ROUNDS = 3

/** Nombre maximum de chiffres saisissables — borné par le plus grand résultat (9 × 19 = 171). */
export const MATH_MAX_DIGITS = 3

/**
 * Une multiplication à deux chiffres : hors des tables apprises, mais
 * décomposable de tête (`7 × 14` = `7 × 10` + `7 × 4`).
 */
function multiplication(): MathChallenge {
  const left = between(3, 9)
  const right = between(11, 19)
  return { left, right, operator: 'x', answer: left * right }
}

/**
 * Une addition à retenue GARANTIE : les unités sont tirées de façon à
 * dépasser 10 à elles seules. Sans cette garantie, un tirage sur trois
 * tombait sur un calcul qu'on lit sans le faire.
 */
function addition(): MathChallenge {
  const leftUnits = between(4, 9)
  const rightUnits = between(10 - leftUnits, 9)
  const left = between(2, 8) * 10 + leftUnits
  const right = between(1, 7) * 10 + rightUnits
  return { left, right, operator: '+', answer: left + right }
}

/**
 * Une soustraction à emprunt GARANTI, et jamais négative : les unités du
 * premier terme sont strictement inférieures à celles du second, et ses
 * dizaines strictement supérieures.
 */
function subtraction(): MathChallenge {
  const rightUnits = between(3, 9)
  const leftUnits = between(0, rightUnits - 1)
  const rightTens = between(1, 3)
  const left = between(rightTens + 2, 9) * 10 + leftUnits
  const right = rightTens * 10 + rightUnits
  return { left, right, operator: '-', answer: left - right }
}

const GENERATORS = [multiplication, addition, subtraction] as const

/**
 * Une opération tirée au sort.
 *
 * `previous` évite de reproposer exactement le même calcul juste après une
 * erreur de frappe : reposer `8 × 13` à quelqu'un qui vient de taper `140`
 * au lieu de `104` transforme une faute d'inattention en punition.
 */
export function nextMathChallenge(previous?: MathChallenge): MathChallenge {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const challenge = GENERATORS[between(0, GENERATORS.length - 1)]()
    if (
      !previous ||
      challenge.operator !== previous.operator ||
      challenge.left !== previous.left ||
      challenge.right !== previous.right
    ) {
      return challenge
    }
  }
  // Huit tirages identiques d'affilée sont hors de portée en pratique ; on ne
  // boucle pas indéfiniment pour autant.
  return multiplication()
}

/** L'énoncé, avec le signe « × » plutôt que la lettre du code. */
export function formatMathChallenge(challenge: MathChallenge): string {
  const sign =
    challenge.operator === 'x' ? '×' : challenge.operator === '-' ? '−' : '+'
  return `${challenge.left} ${sign} ${challenge.right}`
}
