import React, { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Line, Rect } from 'react-native-svg'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { useT } from '@/i18n/useT'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Hauteurs des journées, en fraction de la plus haute semaine « avant ».
 *
 * ⚠️ Les deux graphes partagent la MÊME échelle — c'est la seule chose qui
 * rend la comparaison honnête : la semaine « après » est courte parce
 * qu'elle est courte, pas parce qu'on l'a dessinée petite. Les moyennes
 * affichées au-dessus (6 h 32 → 1 h 49, soit un rapport de 0,28) encadrent
 * ces valeurs.
 */
const USAGE = {
  before: [0.68, 1, 0.88, 0.65],
  after: [0.2, 0.26, 0.22, 0.17],
} as const

/**
 * Découpage d'une barre, du bas vers le haut. Le Temps d'écran d'iOS empile
 * les catégories d'apps ; on reprend le geste avec trois valeurs de la
 * marque au lieu des couleurs système — la lavande porte l'essentiel, le
 * gris fantôme coiffe.
 */
const SEGMENTS = [
  { part: 0.7, color: PW.color.accent },
  { part: 0.18, color: PW.color.accentDim },
  { part: 0.12, color: PW.color.inkGhost },
] as const

/** Trois repères horizontaux, comme la grille de la référence. */
const GRID = [0.25, 0.5, 0.75] as const

/**
 * Le graphe d'usage d'une semaine.
 *
 * Le trait pointillé est la moyenne DES BARRES AFFICHÉES, recalculée par
 * colonne : sur « avant » il passe sous les sommets, sur « après » les
 * journées se rangent autour de lui. C'est la ligne du Temps d'écran, pas
 * une décoration — l'écrire en dur la ferait mentir au premier réglage des
 * données.
 *
 * ⚠️ Pas de `viewBox` : avec une `viewBox` et une hauteur fixe,
 * react-native-svg met le dessin à l'échelle PUIS le centre, et les barres
 * décollent de la ligne de base. Sans elle, les coordonnées sont des points.
 */
export function PaywallUsageChart({
  after,
  compact,
}: {
  after: boolean
  compact: boolean
}) {
  const t = useT()
  const [width, setWidth] = useState(0)
  const ratios = USAGE[after ? 'after' : 'before']
  const height = compact ? PW.layout.compactChart : PW.layout.chart
  const average = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length
  // Un pas par journée, la barre centrée dedans : le graphe occupe toute la
  // largeur de son panneau, et l'initiale du jour tombe sous sa barre.
  const pitch = width / ratios.length
  const bar = pitch * PW.layout.barFill
  // Les initiales viennent des locales (« L M M J » en français, « M T W T »
  // en anglais) : une seule clé, pour que les quatre langues restent alignées
  // sur le même nombre de colonnes que `USAGE`.
  const days = t('paywall_reference.chart_days').split(' ')

  return (
    <View
      onLayout={({ nativeEvent: { layout } }) =>
        layout.width !== width && setWidth(layout.width)
      }
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg height={height} width={width}>
        {GRID.map(step => (
          <Line
            key={step}
            x1={0}
            x2={width}
            y1={height * step}
            y2={height * step}
            stroke={PW.color.hairline}
            strokeWidth={PW.layout.hairline}
          />
        ))}

        {ratios.map((ratio, index) => {
          const x = index * pitch + (pitch - bar) / 2
          const total = height * ratio
          // On empile du bas vers le haut : `base` est le sommet du segment
          // déjà posé, donc l'origine du suivant.
          let base = height
          return SEGMENTS.map((segment, rank) => {
            const slice = total * segment.part
            base -= slice
            return (
              <Rect
                key={`${index}-${rank}`}
                x={x}
                y={base}
                width={bar}
                height={slice}
                // Seul le sommet de la pile s'arrondit — un rayon sur chaque
                // segment redécouperait la barre en trois pastilles.
                rx={
                  rank === SEGMENTS.length - 1
                    ? Math.min(PW.layout.barRadius, slice / 2)
                    : 0
                }
                fill={segment.color}
              />
            )
          })
        })}

        <Line
          x1={0}
          x2={width}
          y1={height * (1 - average)}
          y2={height * (1 - average)}
          stroke={PW.color.inkFaint}
          strokeWidth={PW.layout.hairline}
          strokeDasharray="3 3"
        />
      </Svg>

      <View style={styles.axis}>
        {days.map((day, index) => (
          <Text key={index} style={styles.day} maxFontSizeMultiplier={1.1}>
            {day}
          </Text>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  axis: { height: PW.layout.chartAxis, flexDirection: 'row' },
  day: {
    ...fonts.regular,
    flex: 1,
    textAlign: 'center',
    fontSize: PW.text.compactFine,
    lineHeight: PW.layout.chartAxis,
    color: PW.color.inkGhost,
  },
})
