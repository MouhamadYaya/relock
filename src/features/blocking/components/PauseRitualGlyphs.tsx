import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import type { PauseRitual } from '@/shared/services/storage/app-preferences'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { layout, radius, typography } = relockMaterial
const GLYPH = layout.pauseRitualGlyphSize

/** Deux flèches opposées : « permuter », jamais « revenir ». */
export function SwapGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 8.5h13M13.5 4.5 17.5 8.5 13.5 12.5M20 15.5H7M10.5 11.5 6.5 15.5 10.5 19.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

/**
 * Les couleurs de la vignette, fournies par l'écran qui l'affiche.
 *
 * Le sélecteur vit dans DEUX systèmes visuels qui ne se mélangent pas : la
 * scène sombre des écrans de blocage (`relockMaterial`) et la liste sobre des
 * Réglages (`settingsTheme`). Plutôt que de dupliquer la vignette une fois
 * par thème — deux fichiers à maintenir en accord — elle reçoit sa palette.
 * La FORME, elle, est décidée ici et une seule fois : c'est elle qu'on
 * reconnaît d'un écran à l'autre.
 */
export interface PauseRitualPalette {
  surface: string
  border: string
  borderSelected: string
  glyph: string
  glyphSelected: string
  /** Pastille de sélection. */
  check: string
  /**
   * Le chevron DANS la pastille. Une couleur à part entière, et non la
   * surface de la vignette : dans les Réglages, cette surface est un voile
   * quasi transparent (`rgba(255,255,255,0.045)`) qui, dessiné sur le violet
   * de la pastille, ne se voyait tout simplement pas.
   */
  checkMark: string
}

/**
 * L'aperçu d'un écran de blocage : une silhouette de téléphone, un symbole.
 *
 * La version précédente montrait une maquette miniature — orbe, pavé
 * numérique, lignes de texte — dans une carte large barrée d'un titre et
 * d'une description. Elle échouait pour une raison simple : à cette taille,
 * une maquette n'est plus lisible, et une carte large se lit comme une ligne
 * de réglage, pas comme un écran. Ici, la silhouette DIT « écran », et le
 * symbole dit lequel — les deux se comprennent sans lire.
 */
export function PauseRitualTile({
  ritual,
  selected,
  palette,
}: {
  ritual: PauseRitual
  selected: boolean
  palette: PauseRitualPalette
}) {
  const color = selected ? palette.glyphSelected : palette.glyph

  return (
    <View
      // Purement décoratif : le nom sous la vignette et l'étiquette
      // d'accessibilité du bouton portent déjà toute l'information.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        styles.tile,
        {
          backgroundColor: palette.surface,
          borderColor: selected ? palette.borderSelected : palette.border,
          borderWidth: selected ? SELECTED_BORDER : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {ritual === 'breathing' ? <BreathingMark color={color} /> : null}
      {ritual === 'math' ? <MathMark color={color} /> : null}
      {ritual === 'transcribe' ? <TranscribeMark color={color} /> : null}

      {selected ? (
        <View style={[styles.check, { backgroundColor: palette.check }]}>
          <IconSvg
            name={IconName.CHECK}
            size={spacing.sm}
            strokeWidth={2.6}
            color={palette.checkMark}
          />
        </View>
      ) : null}
    </View>
  )
}

/** Un souffle : trois cercles concentriques, comme l'orbe qui enfle et retombe. */
function BreathingMark({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 48 48">
      <Circle
        cx={24}
        cy={24}
        r={22}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        opacity={0.4}
      />
      <Circle
        cx={24}
        cy={24}
        r={15}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
        opacity={0.7}
      />
      <Circle cx={24} cy={24} r={7} fill={color} />
    </Svg>
  )
}

/** Les quatre signes, en carré : personne n'a besoin qu'on lui traduise. */
function MathMark({ color }: { color: string }) {
  return (
    <Svg width={GLYPH} height={GLYPH} viewBox="0 0 48 48">
      <Path
        d="M4 13h13M10.5 6.5v13M31 13h13"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Path
        d="M5.5 30.5 15.5 40.5M15.5 30.5 5.5 40.5M31 35.5h13"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <Circle cx={37.5} cy={29} r={1.9} fill={color} />
      <Circle cx={37.5} cy={42} r={1.9} fill={color} />
    </Svg>
  )
}

/**
 * Un mot à recopier, suivi d'un curseur.
 *
 * Des lettres plutôt qu'un pictogramme : « abc » se lit dans toutes les
 * langues de l'app et annonce une saisie au clavier, ce qu'aucune icône de
 * crayon ne fait aussi vite.
 */
function TranscribeMark({ color }: { color: string }) {
  return (
    <View style={styles.transcribeMark}>
      <Text style={[styles.transcribeLetters, { color }]}>abc</Text>
      <View style={[styles.caret, { backgroundColor: color }]} />
    </View>
  )
}

const SELECTED_BORDER = 1.5

const styles = StyleSheet.create({
  tile: {
    width: '100%',
    aspectRatio: layout.pauseRitualTileRatio,
    borderRadius: layout.pauseRitualTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La coche se pose SUR la vignette, en haut à droite : le nom sous la
  // silhouette reste alors libre de tenir sur deux lignes sans être poussé.
  check: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribeMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
  },
  transcribeLetters: {
    ...fonts.regular,
    fontSize: typography.blockingTitleSize,
    lineHeight: typography.blockingTitleLineHeight,
    letterSpacing: typography.blockingTitleLetterSpacing,
  },
  caret: {
    width: 2,
    height: typography.blockingSectionSize,
    borderRadius: radius.capsule,
  },
})
