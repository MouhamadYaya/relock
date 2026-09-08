import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  makeMutable,
  type SharedValue,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
} from 'react-native-reanimated'
import {
  isSpent,
  particleOpacity,
  RAIN,
  RAIN_RADII,
  RAIN_WAVE_SECONDS,
  type RainField,
  type RainParticle,
  type RainShield,
  spawnParticle,
  stepParticle,
  wavePace,
} from '@/features/onboarding/shield-rain'

/**
 * L'averse de billes du premier écran, et la bulle qui l'arrête.
 *
 * La simulation (`shield-rain.ts`) tourne sur le THREAD UI dans un
 * `useFrameCallback` : trente-quatre billes à 60 fps, c'est trente-quatre
 * allers-retours par image si la physique reste en JS — le pont s'écroule et
 * la pluie saccade dès qu'un rendu React passe. Ici, aucune image ne dépend
 * du thread JS.
 *
 * Chaque bille tient son état dans UN `makeMutable` réaffecté à chaque image,
 * plutôt qu'un tableau partagé unique : Reanimated ne réagit qu'à
 * l'affectation de `.value`, et un tableau commun ferait recalculer les
 * trente-quatre styles à chaque bille déplacée.
 *
 * ⚠️ Ce composant se DESSINE PAR-DESSUS le texte et EN DESSOUS du lecteur —
 * l'ordre des frères dans la scène est ce qui l'établit. C'est ce qui
 * reproduit la référence : une bille passe devant le titre, jamais devant le
 * personnage. Celle qui entre dans son ellipse a de toute façon été renvoyée
 * par la coque avant d'y arriver ; l'ordre de rendu ne rattrape qu'un dernier
 * pixel de marge.
 */

/** Teintes relevées au pixel sur la référence : cramoisi, magenta, or. */
const COLORS = ['#F0345C', '#DE2F98', '#F3C948'] as const

type Ball = {
  color: string
  radius: number
  state: SharedValue<RainParticle & { o: number }>
}

export function ShieldRain({
  field,
  shield,
}: {
  field: RainField
  shield: RainShield
}) {
  const reduceMotion = useReducedMotion()

  const balls = useMemo<Ball[]>(
    () =>
      Array.from({ length: RAIN.count }, (_, i) => {
        // Le remplissage initial parcourt la liste des tempos au lieu de lire
        // l'horloge : à t = 0 elle n'a rien à dire, et toutes les billes
        // seraient nées dans la même vague.
        const p = spawnParticle(
          field,
          Math.random,
          !reduceMotion,
          wavePace(i * RAIN_WAVE_SECONDS),
        )
        return {
          color: COLORS[i % COLORS.length],
          radius: RAIN_RADII[i % RAIN_RADII.length],
          state: makeMutable({
            ...p,
            // Mouvement réduit : pas de chute, une poignée de billes posées
            // dans le tiers haut. L'écran garde sa texture sans rien animer.
            y: reduceMotion ? field.height * (0.06 + Math.random() * 0.3) : p.y,
            o: 1,
          }),
        }
      }),
    [field, reduceMotion],
  )

  /**
   * L'horloge des vagues. Une seule pour toute l'averse : c'est ce partage
   * qui fait qu'un groupe de billes descend au même rythme, au lieu que
   * chacune tire sa vitesse dans son coin.
   */
  const elapsed = useMemo(() => makeMutable(0), [])

  useFrameCallback(frame => {
    'worklet'
    // Le garde est DANS le worklet, pas dans l'argument `autostart` de
    // `useFrameCallback` : celui-ci n'est lu qu'au tout premier rendu (il
    // vit dans un ref), donc activer « Réduire les animations » pendant que
    // l'écran est ouvert ne l'arrêterait jamais.
    if (reduceMotion) return
    // Plafonné à 1/30 s : après une pause (Metro qui recharge, une alerte
    // système), un dt de plusieurs secondes ferait traverser le dôme à toutes
    // les billes d'un seul pas.
    const dt = Math.min((frame.timeSincePreviousFrame ?? 16) / 1000, 1 / 30)
    elapsed.value += dt
    const pace = wavePace(elapsed.value)
    for (let i = 0; i < balls.length; i++) {
      const s = balls[i].state
      const p = stepParticle(
        {
          x: s.value.x,
          y: s.value.y,
          vx: s.value.vx,
          vy: s.value.vy,
          pace: s.value.pace,
          life: s.value.life,
        },
        dt,
        field,
        shield,
        Math.random,
      )
      if (isSpent(p, field)) {
        s.value = { ...spawnParticle(field, Math.random, false, pace), o: 1 }
      } else {
        s.value = { ...p, o: particleOpacity(p, field) }
      }
    }
  })

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.field]}
      testID="shield-rain"
    >
      {balls.map((ball, i) => (
        <Bead key={`bead-${i}`} ball={ball} />
      ))}
    </View>
  )
}

function Bead({ ball }: { ball: Ball }) {
  const d = ball.radius * 2
  const style = useAnimatedStyle(() => ({
    opacity: ball.state.value.o,
    transform: [
      { translateX: ball.state.value.x - ball.radius },
      { translateY: ball.state.value.y - ball.radius },
    ],
  }))
  return (
    <Animated.View
      style={[
        styles.bead,
        {
          width: d,
          height: d,
          borderRadius: ball.radius,
          backgroundColor: ball.color,
        },
        style,
      ]}
    >
      {/* Le reflet : sans lui les billes se lisent comme des pastilles à plat.
          Statique, donc gratuit — il ne participe à aucune animation. */}
      <View
        style={[
          styles.sheen,
          {
            width: d * 0.44,
            height: d * 0.44,
            borderRadius: d * 0.22,
            top: d * 0.15,
            left: d * 0.17,
          },
        ]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  field: { overflow: 'hidden' },
  bead: { position: 'absolute', top: 0, left: 0 },
  sheen: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.24)' },
})
