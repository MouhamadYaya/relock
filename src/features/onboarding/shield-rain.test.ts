import {
  isSpent,
  particleOpacity,
  RAIN,
  RAIN_PACES,
  RAIN_WAVE_SECONDS,
  type RainField,
  type RainParticle,
  type RainShield,
  spawnParticle,
  stepParticle,
  wavePace,
} from '@/features/onboarding/shield-rain'

/**
 * Ce que la simulation PROMET à l'écran, vérifié au calcul.
 *
 * La promesse tient en une phrase : rien n'atteint le lecteur. Une bille qui
 * traverse le dôme une fois sur mille, personne ne la verra en relançant
 * l'écran à la main — mais elle casse exactement ce que l'image raconte. D'où
 * des tests sur les cas qui font traverser une simulation : le pas de temps
 * qui explose après une pause, l'arrivée pile au centre, la bille qui ne
 * retombe jamais.
 */

const field: RainField = { width: 390, height: 844 }
const shield: RainShield = { cx: 195, cy: 480, rx: 152, ry: 138 }

/** Aléatoire déterministe : les tests doivent tomber deux fois pareil. */
function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

const inside = (p: { x: number; y: number }) => {
  const nx = (p.x - shield.cx) / shield.rx
  const ny = (p.y - shield.cy) / shield.ry
  return nx * nx + ny * ny < 1 - 1e-9
}

const drop = (over: Partial<RainParticle> = {}): RainParticle => ({
  x: shield.cx,
  y: 0,
  vx: 0,
  vy: 40,
  pace: 1,
  life: 0,
  ...over,
})

describe('shield-rain', () => {
  describe('le dôme', () => {
    it('ne laisse aucune bille finir sa course à l’intérieur', () => {
      const random = seeded(7)
      // Un balayage large : toutes les colonnes de l'écran, longtemps.
      for (let col = 0; col <= 40; col++) {
        const p = drop({ x: (field.width * col) / 40, vy: 20 + col })
        for (let i = 0; i < 900; i++) {
          stepParticle(p, 1 / 60, field, shield, random)
          expect(inside(p)).toBe(false)
        }
      }
    })

    it('ne se laisse pas traverser par une image qui a duré', () => {
      // Après un rechargement Metro ou une alerte système, `dt` peut valoir
      // plusieurs secondes. Le composant le plafonne à 1/30 s ; la physique
      // doit tenir jusqu'à ce plafond sans laisser passer personne.
      const random = seeded(11)
      const p = drop({ x: shield.cx + 4, vy: 900 })
      for (let i = 0; i < 400; i++) {
        stepParticle(p, 1 / 30, field, shield, random)
        expect(inside(p)).toBe(false)
      }
    })

    it('ne divise pas par zéro sur une bille pile au centre', () => {
      // Cas dégénéré : au centre exact, aucune direction de sortie ne se
      // déduit de la position — une division par zéro qui enverrait la bille
      // à NaN, donc hors de l'écran pour de bon.
      //
      // `dt` à zéro n'est pas une commodité de test : deux images peuvent
      // tomber dans la même milliseconde, et `timeSincePreviousFrame` vaut
      // alors 0. C'est le seul chemin qui laisse une bille exactement au
      // centre après intégration.
      const p = drop({ x: shield.cx, y: shield.cy, vy: 300 })
      stepParticle(p, 0, field, shield, seeded(3))
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
      expect(p.vy).toBeLessThan(0)
      expect(inside(p)).toBe(false)
    })

    it('freine la bille au contact au lieu de l’accélérer', () => {
      const random = seeded(5)
      const p = drop({ x: shield.cx, vy: 260 })
      let peak = 0
      for (let i = 0; i < 600; i++) {
        stepParticle(p, 1 / 60, field, shield, random)
        peak = Math.max(peak, Math.hypot(p.vx, p.vy))
      }
      // Un rebond qui rend plus d'énergie qu'il n'en reçoit fait « bouillir »
      // la pluie : les billes accélèrent à chaque contact jusqu'à partir en
      // ligne droite. La chute libre sur toute la hauteur borne le plausible.
      expect(peak).toBeLessThan(Math.sqrt(2 * RAIN.gravity * field.height))
    })

    it('fait glisser la bille posée sur le sommet plutôt que de l’y laisser', () => {
      const random = seeded(13)
      const p = drop({
        x: shield.cx,
        y: shield.cy - shield.ry - 1,
        vx: 0,
        vy: 0,
      })
      for (let i = 0; i < 60 * 8; i++)
        stepParticle(p, 1 / 60, field, shield, random)
      // Huit secondes plus tard elle doit avoir quitté le sommet : `spread`
      // est là précisément pour rompre cet équilibre.
      expect(p.y).toBeGreaterThan(shield.cy)
    })
  })

  describe('le renouvellement', () => {
    it('déclare finie la bille descendue sous la zone d’effacement', () => {
      expect(isSpent(drop({ y: field.height * RAIN.fadeEnd + 1 }), field)).toBe(
        true,
      )
      expect(isSpent(drop({ y: field.height * 0.2 }), field)).toBe(false)
    })

    it('ne fait pas vieillir la bille tant qu’elle est au-dessus de l’écran', () => {
      // Sinon une bille du premier remplissage, née très haut, entrerait
      // déjà vieille dans le cadre et s'éteindrait en pleine descente.
      const p = drop({ y: -400, vy: 0, pace: 0.6 })
      for (let i = 0; i < 60; i++)
        stepParticle(p, 1 / 60, field, shield, seeded(9))
      expect(p.life).toBe(0)
      expect(p.y).toBeLessThan(0)
    })

    it('déclare finie la bille qui s’éternise, même immobile', () => {
      // Le filet contre l'immortelle : sans lui, une bille en équilibre
      // occuperait une place de la pluie pour toujours.
      expect(isSpent(drop({ y: 10, life: RAIN.maxLife }), field)).toBe(true)
    })

    it('éteint la bille avant qu’elle n’atteigne le bouton', () => {
      expect(particleOpacity(drop({ y: field.height * 0.3 }), field)).toBe(1)
      expect(
        particleOpacity(drop({ y: field.height * 0.7 }), field),
      ).toBeLessThan(1)
      expect(particleOpacity(drop({ y: field.height * 0.9 }), field)).toBe(0)
    })

    it('éteint aussi la bille en fin de vie, sans la faire disparaître d’un coup', () => {
      const half = RAIN.maxLife - RAIN.lifeFade / 2
      expect(particleOpacity(drop({ y: 10, life: half }), field)).toBeCloseTo(
        0.5,
        2,
      )
    })
  })

  describe('les vagues', () => {
    it('donne le même tempo à toutes les billes d’une même fenêtre', () => {
      // C'est la définition d'une vague : ce qui naît ensemble tombe ensemble.
      const a = wavePace(RAIN_WAVE_SECONDS * 1.01)
      const b = wavePace(RAIN_WAVE_SECONDS * 1.99)
      expect(a).toBe(b)
    })

    it('change de tempo d’une fenêtre à la suivante', () => {
      const seen = new Set<number>()
      for (let turn = 0; turn < RAIN_PACES.length; turn++) {
        const pace = wavePace(RAIN_WAVE_SECONDS * (turn + 0.5))
        expect(pace).not.toBe(wavePace(RAIN_WAVE_SECONDS * (turn + 1.5)))
        seen.add(pace)
      }
      // Le tour complet doit passer par TOUS les tempos, sinon la liste
      // contient des doublons voisins et l'averse s'uniformise.
      expect(seen.size).toBe(RAIN_PACES.length)
    })

    it('boucle sans jamais sortir de la liste, même à t = 0', () => {
      for (const t of [0, -1, 0.1, 1e4]) {
        expect(RAIN_PACES).toContain(wavePace(t))
      }
    })

    it('fait vraiment tomber une vague lente moins vite qu’une vague vive', () => {
      const fall = (pace: number) => {
        const p = drop({ y: 0, vy: 24 * pace, pace })
        for (let i = 0; i < 90; i++) {
          // Hors du dôme : on mesure la chute, pas le rebond.
          p.x = 8
          stepParticle(p, 1 / 60, field, shield, seeded(2))
        }
        return p.y
      }
      const slow = fall(Math.min(...RAIN_PACES))
      const quick = fall(Math.max(...RAIN_PACES))
      expect(quick).toBeGreaterThan(slow * 1.5)
    })
  })

  describe('la naissance', () => {
    it('fait naître les billes au-dessus de l’écran, jamais dedans', () => {
      const random = seeded(23)
      for (let i = 0; i < 200; i++) {
        const p = spawnParticle(field, random, i % 2 === 0, 1)
        expect(p.y).toBeLessThan(0)
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x).toBeLessThanOrEqual(field.width)
        expect(p.vy).toBeGreaterThan(0)
      }
    })

    it('étale le premier remplissage bien plus haut que le suivant', () => {
      // C'est ce qui fait ARRIVER l'averse au lieu de l'afficher déjà pleine.
      const first = spawnParticle(field, () => 0.99, true, 1)
      const later = spawnParticle(field, () => 0.99, false, 1)
      expect(first.y).toBeLessThan(later.y - field.height)
    })
  })
})
