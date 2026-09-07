import {
  formatMathChallenge,
  MATH_MAX_DIGITS,
  type MathChallenge,
  nextMathChallenge,
} from '@/features/blocking/services/pause-ritual/math-challenge'

/**
 * Le générateur est aléatoire : on l'échantillonne largement plutôt que de
 * figer une graine. Ce qui est vérifié ici n'est pas un tirage précis, ce sont
 * les INVARIANTS dont dépend l'écran — un calcul négatif, un résultat à quatre
 * chiffres ou une addition sans retenue casseraient le rituel sans jamais
 * lever d'exception.
 */
const SAMPLES = 600

function sample(): MathChallenge[] {
  return Array.from({ length: SAMPLES }, () => nextMathChallenge())
}

describe('nextMathChallenge', () => {
  it('ne produit que des résultats entiers positifs saisissables', () => {
    for (const challenge of sample()) {
      expect(Number.isInteger(challenge.answer)).toBe(true)
      expect(challenge.answer).toBeGreaterThan(0)
      expect(String(challenge.answer).length).toBeLessThanOrEqual(
        MATH_MAX_DIGITS,
      )
    }
  })

  it('énonce toujours un calcul dont la réponse annoncée est la bonne', () => {
    for (const { left, right, operator, answer } of sample()) {
      const expected =
        operator === 'x'
          ? left * right
          : operator === '+'
            ? left + right
            : left - right
      expect(answer).toBe(expected)
    }
  })

  it('force la retenue, l’emprunt et sort des tables apprises', () => {
    const seen = new Set<string>()
    for (const challenge of sample()) {
      const { left, right, operator } = challenge
      seen.add(operator)
      if (operator === '+') {
        // Sans retenue, l'addition se lit sans se calculer.
        expect((left % 10) + (right % 10)).toBeGreaterThanOrEqual(10)
      }
      if (operator === '-') {
        expect(left % 10).toBeLessThan(right % 10)
        expect(left).toBeGreaterThan(right)
      }
      if (operator === 'x') {
        // Au-delà de 10, aucune table apprise ne donne le résultat de tête.
        expect(right).toBeGreaterThan(10)
      }
    }
    expect(seen).toEqual(new Set(['x', '+', '-']))
  })

  it('ne repropose jamais le calcul qu’on vient de rater', () => {
    let previous = nextMathChallenge()
    for (let i = 0; i < SAMPLES; i += 1) {
      const next = nextMathChallenge(previous)
      expect(
        next.operator === previous.operator &&
          next.left === previous.left &&
          next.right === previous.right,
      ).toBe(false)
      previous = next
    }
  })
})

describe('formatMathChallenge', () => {
  it('écrit les signes typographiques, jamais les lettres du code', () => {
    expect(
      formatMathChallenge({ left: 7, right: 14, operator: 'x', answer: 98 }),
    ).toBe('7 × 14')
    expect(
      formatMathChallenge({ left: 62, right: 27, operator: '-', answer: 35 }),
    ).toBe('62 − 27')
    expect(
      formatMathChallenge({ left: 28, right: 47, operator: '+', answer: 75 }),
    ).toBe('28 + 47')
  })
})
