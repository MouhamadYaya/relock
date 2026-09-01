import React from 'react'
import { StyleSheet } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors, radius } = relockMaterial

/**
 * La matière des cartes Relock — SEULE source de vérité.
 *
 * Un dégradé qui part d'un violet sourd et retombe dans le noir, plus un bloom
 * radial dans l'angle haut-gauche : c'est ce qui donne du volume aux cartes de
 * règles, et c'est ce que doivent porter toutes les cartes de l'app. Un aplat
 * gris se lit comme une feuille système, pas comme Relock.
 */
export function BlockingCardSurface({
  active = true,
  cornerRadius = radius.functional,
}: {
  /** Éteinte, la carte garde la même forme sans le bloom violet. */
  active?: boolean
  cornerRadius?: number
}) {
  const top = active
    ? colors.blockingSurfaceActiveTop
    : colors.blockingSurfaceRaised
  const bottom = active
    ? colors.blockingSurfaceActiveBottom
    : colors.blockingSurface
  const border = active ? colors.blockingBorderStrong : colors.blockingBorder
  return (
    <Svg
      testID="blocking-card-surface"
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="card-surface" x1="0" y1="0" x2="0.72" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop
            offset="0.42"
            stopColor={active ? colors.blockingSurfaceActiveMiddle : top}
            stopOpacity={active ? 1 : 0}
          />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
        {active ? (
          <RadialGradient id="card-surface-bloom" cx="14%" cy="8%" r="92%">
            {/* Un foyer accent au cœur du bloom : sans lui le violet retombe
                dans le gris dès le premier tiers de la carte. */}
            <Stop
              offset="0"
              stopColor={colors.blockingAccent}
              stopOpacity={0.2}
            />
            <Stop
              offset="0.32"
              stopColor={colors.blockingSurfaceActiveBloom}
              stopOpacity={0.36}
            />
            <Stop
              offset="1"
              stopColor={colors.blockingSurfaceActiveBloom}
              stopOpacity={0}
            />
          </RadialGradient>
        ) : null}
      </Defs>
      <Rect
        width="100%"
        height="100%"
        rx={cornerRadius}
        fill="url(#card-surface)"
      />
      {active ? (
        <Rect
          width="100%"
          height="100%"
          rx={cornerRadius}
          fill="url(#card-surface-bloom)"
        />
      ) : null}
      <Rect
        x={StyleSheet.hairlineWidth}
        y={StyleSheet.hairlineWidth}
        width="99.5%"
        height="99.5%"
        rx={cornerRadius}
        fill="none"
        stroke={border}
        strokeWidth={StyleSheet.hairlineWidth}
      />
    </Svg>
  )
}

/**
 * Le dégradé d'action Relock (celui du bouton « + » et des cartes prédéfinies).
 * Posé derrière un bouton, il en fait l'action principale de l'écran.
 */
export function BrandActionSurface() {
  return (
    <Svg
      testID="brand-action-surface"
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="brand-action" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.blockingAccentLight} />
          <Stop offset="0.55" stopColor={colors.blockingAccent} />
          <Stop offset="1" stopColor={colors.accentVioletDeep} />
        </LinearGradient>
      </Defs>
      {/* ⚠️ AUCUN arrondi ici : un `rx` de capsule (999) se clampe à la
          MOITIÉ DE LA LARGEUR, jamais à la hauteur — le dégradé devenait une
          ellipse et laissait les quatre coins du bouton non peints. C'est le
          conteneur (`borderRadius` + `overflow: hidden`) qui donne la forme ;
          le dégradé, lui, remplit tout. */}
      <Rect width="100%" height="100%" fill="url(#brand-action)" />
    </Svg>
  )
}

/**
 * Halo violet posé en haut d'une feuille : elle cesse d'être un rectangle gris
 * système et redevient une surface Relock.
 */
export function SheetBloom() {
  return (
    <Svg
      testID="blocking-sheet-surface"
      pointerEvents="none"
      style={StyleSheet.absoluteFillObject}
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="sheet-material" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.blockingSheetSurfaceTop} />
          <Stop offset="1" stopColor={colors.blockingSheetSurface} />
        </LinearGradient>
        <RadialGradient id="sheet-bloom" cx="50%" cy="-8%" r="68%">
          <Stop
            offset="0"
            stopColor={colors.blockingAccent}
            stopOpacity={0.18}
          />
          <Stop
            offset="0.34"
            stopColor={colors.blockingSurfaceActiveBloom}
            stopOpacity={0.12}
          />
          <Stop
            offset="0.78"
            stopColor={colors.blockingSurfaceActiveBloom}
            stopOpacity={0}
          />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#sheet-material)" />
      <Rect width="100%" height="100%" fill="url(#sheet-bloom)" />
    </Svg>
  )
}
