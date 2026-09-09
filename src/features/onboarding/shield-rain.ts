/**
 * Physique de la pluie de billes du premier écran — pure, sans React.
 *
 * Le dessin dit une seule chose, sans un mot : ÇA TOMBE, ET ÇA NE L'ATTEINT
 * PAS. Des billes pleuvent du haut de l'écran, heurtent une bulle invisible
 * autour du lecteur, rebondissent, glissent le long de la coque puis
 * s'éteignent en dessous. Le blocage, montré au lieu d'être expliqué.
 *
 * Ce module est à part du composant pour deux raisons :
 *
 *  - il tourne dans un WORKLET (thread UI, 60 fps). Chaque fonction porte
 *    donc la directive `'worklet'` : sans elle, l'appeler depuis
 *    `useFrameCallback` planterait à l'exécution. Elles restent du JS
 *    ordinaire côté Jest, appelables telles quelles ;
 *  - une collision se vérifie par le calcul, pas à l'œil. Les cas qui cassent
 *    une simulation (bille pile au centre du dôme, image bloquée plusieurs
 *    secondes, bille coincée au sommet) sont couverts par `shield-rain.test.ts`
 *    — impossible à tenir si la physique vivait dans le rendu.
 */

/** Zone de simulation, en points : l'écran entier. */
export type RainField = { width: number; height: number }

/** La bulle qui protège — une ellipse alignée sur les axes, en points. */
export type RainShield = { cx: number; cy: number; rx: number; ry: number }

export type RainParticle = {
  x: number
  y: number
  /** Vitesse, en points par seconde. */
  vx: number
  vy: number
  /**
   * Tempo de la vague dont la bille est née — multiplie sa gravité et son
   * élan de départ. C'est lui qui fait qu'une poignée de billes traverse
   * l'écran pendant qu'une autre flotte encore : une averse réelle n'a pas
   * une seule vitesse.
   */
  pace: number
  /**
   * Âge VISIBLE en secondes — le filet contre les billes qui ne retombent
   * jamais. Le temps passé au-dessus de l'écran ne compte pas : sinon une
   * bille du tout premier remplissage, née très haut, arriverait déjà vieille
   * et s'éteindrait en pleine descente.
   */
  life: number
}

/**
 * Les tempos des vagues. Étalés du simple au plus du double : le frottement
 * de l'air plafonne la chute à `gravity × pace / drag`, l'écart entre deux
 * vagues est donc bien celui-là, pas sa racine.
 */
export const RAIN_PACES = [0.6, 1.0, 0.75, 1.45, 0.88, 1.2] as const

/** Durée d'une vague : au-delà, les billes qui naissent changent de tempo. */
export const RAIN_WAVE_SECONDS = 2.6

export const RAIN = {
  /**
   * Assez pour une averse continue, assez peu pour que le thread UI tienne
   * 60 fps sur un iPhone SE (chaque bille = un style animé recalculé par
   * image).
   */
  count: 34,
  /** Gravité de référence. Le tempo de la vague la module (cf. `pace`). */
  gravity: 230,
  /** Frottement de l'air (1/s) — plafonne la chute et calme les rebonds. */
  drag: 0.55,
  /** Part de la vitesse NORMALE rendue au rebond. */
  restitution: 0.42,
  /**
   * Part de la vitesse TANGENTE conservée lors d'un VRAI choc — la glisse.
   */
  tangent: 0.88,
  /**
   * Vitesse normale (pt/s) au-delà de laquelle un contact compte comme un
   * choc franc.
   *
   * Sans ce repère, la perte tangentielle s'appliquait à chaque IMAGE : une
   * bille posée sur la coque gardait 0,88 de sa vitesse soixante fois par
   * seconde, soit un millième au bout d'une seconde. Elle restait collée au
   * dôme au lieu d'en descendre — l'inverse de ce que le dessin raconte. La
   * perte est donc désormais proportionnelle à la violence du contact :
   * pleine sur un rebond, quasi nulle sur un appui.
   */
  impactRef: 120,
  /**
   * Coup de pouce horizontal aléatoire à chaque contact. Sans lui, une bille
   * tombée pile sur le sommet du dôme y resterait en équilibre : la normale y
   * est verticale, la gravité n'a aucune composante tangente pour la faire
   * glisser d'un côté.
   */
  spread: 18,
  /**
   * Fractions de hauteur où la bille s'efface — elle ne touche jamais le CTA.
   *
   * La fin est calée juste au-dessus du bouton (qui commence vers 0,88 sur
   * l'écran de référence) et non sur le bas du dessin : le lecteur ne remplit
   * plus toute la cale depuis qu'il a rétréci, et une pluie qui s'arrêtait à
   * ses épaules laissait une bande noire morte entre lui et le bouton.
   */
  fadeStart: 0.62,
  fadeEnd: 0.85,
  /**
   * Durée de vie maximale. `spread` finit toujours par déloger une bille
   * coincée, mais « toujours » n'est pas « vite » : ce plafond garantit le
   * renouvellement, et `lifeFade` l'éteint en douceur au lieu de la faire
   * disparaître d'un coup en plein écran.
   */
  maxLife: 16,
  lifeFade: 1.2,
} as const

/**
 * Rayons des billes, en points.
 *
 * Le plancher compte autant que le plafond : sous ~5 pt une bille cesse de se
 * lire comme un objet qui tombe et devient une poussière d'écran — le rebond
 * sur le dôme, qui est tout le propos, n'est plus lisible.
 */
export const RAIN_RADII = [5, 5.8, 6.6, 7.4, 8.4] as const

/**
 * Le tempo en vigueur à un instant donné : toutes les billes nées dans la même
 * fenêtre le partagent, et forment donc une VAGUE. La liste tourne en boucle,
 * lente puis vive puis lente — jamais deux vagues voisines au même rythme.
 */
export function wavePace(elapsed: number): number {
  'worklet'
  const turn = Math.floor(Math.max(0, elapsed) / RAIN_WAVE_SECONDS)
  return RAIN_PACES[turn % RAIN_PACES.length]
}

/**
 * Une bille neuve, au-dessus de la zone visible.
 *
 * `staggered` sert au tout premier remplissage : les billes sont réparties
 * au-dessus de l'écran, si bien que l'averse ARRIVE au lieu d'être déjà là.
 *
 * L'étalement reste COURT (0,55 hauteur d'écran, contre 1,9 avant le
 * 2026-09-08) : plus haut, les billes des derniers rangs mettaient plusieurs
 * secondes à entrer dans le cadre et l'écran s'ouvrait quasi vide — un temps
 * mort là où la promesse doit se lire tout de suite. À 0,55, les premières
 * billes tombent dès la première image et l'averse est pleine en ~2 s.
 */
export function spawnParticle(
  field: RainField,
  random: () => number,
  staggered: boolean,
  pace: number,
): RainParticle {
  'worklet'
  return {
    x: field.width * (0.04 + random() * 0.92),
    y: staggered
      ? -20 - random() * field.height * 0.55
      : -20 - random() * field.height * 0.35,
    vx: (random() - 0.5) * 26,
    vy: (24 + random() * 46) * pace,
    pace,
    life: 0,
  }
}

/**
 * Avance une bille d'une image. Mute et renvoie l'objet reçu — appelé 34 fois
 * par image sur le thread UI, allouer un objet neuf à chaque fois se paierait.
 */
export function stepParticle(
  p: RainParticle,
  dt: number,
  field: RainField,
  shield: RainShield,
  random: () => number,
): RainParticle {
  'worklet'
  // L'âge ne court qu'une fois la bille entrée dans le cadre : `maxLife`
  // mesure un temps VU, indépendant de la hauteur de naissance.
  if (p.y > 0) p.life += dt
  p.vy += RAIN.gravity * p.pace * dt
  p.vx -= p.vx * RAIN.drag * dt
  p.vy -= p.vy * RAIN.drag * dt
  p.x += p.vx * dt
  p.y += p.vy * dt

  // Collision en coordonnées NORMALISÉES : divisée par ses rayons, l'ellipse
  // devient le cercle unité, et « suis-je dedans ? » redevient une distance.
  const nx = (p.x - shield.cx) / shield.rx
  const ny = (p.y - shield.cy) / shield.ry
  const d2 = nx * nx + ny * ny
  if (d2 >= 1) return p

  // Pile au centre : aucune direction de sortie ne se déduit de la position.
  // On l'éjecte vers le haut plutôt que de diviser par zéro.
  const d = Math.sqrt(d2)
  if (d < 1e-6) {
    p.y = shield.cy - shield.ry
    p.vy = -Math.abs(p.vy) * RAIN.restitution
    return p
  }

  // Remise sur la coque, le long du rayon (dans l'espace normalisé).
  p.x = shield.cx + (p.x - shield.cx) / d
  p.y = shield.cy + (p.y - shield.cy) / d

  // Normale de l'ellipse au point de contact : le gradient de x²/rx² + y²/ry².
  let ux = nx / shield.rx
  let uy = ny / shield.ry
  const len = Math.sqrt(ux * ux + uy * uy) || 1
  ux /= len
  uy /= len

  const vn = p.vx * ux + p.vy * uy
  // vn ≥ 0 : la bille s'éloigne déjà (on vient de la replacer). La renvoyer
  // une seconde fois lui donnerait de l'énergie au lieu de lui en prendre.
  if (vn < 0) {
    const tx = p.vx - vn * ux
    const ty = p.vy - vn * uy
    const impact = Math.min(1, -vn / RAIN.impactRef)
    const keep = 1 - (1 - RAIN.tangent) * impact
    p.vx = tx * keep - vn * ux * RAIN.restitution
    p.vy = ty * keep - vn * uy * RAIN.restitution
    p.vx += (random() - 0.5) * RAIN.spread
  }
  return p
}

/** Opacité de la bille : effacement par la hauteur, puis par l'âge. */
export function particleOpacity(p: RainParticle, field: RainField): number {
  'worklet'
  const start = field.height * RAIN.fadeStart
  const end = field.height * RAIN.fadeEnd
  const byHeight =
    p.y <= start ? 1 : p.y >= end ? 0 : 1 - (p.y - start) / (end - start)
  const remaining = RAIN.maxLife - p.life
  const byLife =
    remaining >= RAIN.lifeFade
      ? 1
      : remaining <= 0
        ? 0
        : remaining / RAIN.lifeFade
  return Math.min(byHeight, byLife)
}

/** Vrai quand la bille a fini sa course et peut repartir d'en haut. */
export function isSpent(p: RainParticle, field: RainField): boolean {
  'worklet'
  return (
    p.life >= RAIN.maxLife ||
    p.y >= field.height * RAIN.fadeEnd ||
    p.x < -80 ||
    p.x > field.width + 80
  )
}
