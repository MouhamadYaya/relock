import React from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors } = relockMaterial

interface Props {
  /** Score Focus (0-100), `null` quand aucune valeur fiable n'existe. */
  focus: number | null
  /** Score Repos (0-100), `null` quand aucune valeur fiable n'existe. */
  rest: number | null
  size: number
  stroke: number
  /** Espace libre entre l'anneau extérieur et l'anneau intérieur. */
  gap: number
  /** Préfixe des identifiants de dégradé : unique par instance montée. */
  gradientPrefix: string
  children?: React.ReactNode
}

function arcGeometry(value: number | null, radius: number) {
  const length = 2 * Math.PI * radius
  const progress = Math.min(Math.max(value ?? 0, 0), 100)
  return {
    length,
    offset: length * (1 - progress / 100),
    available: value !== null,
  }
}

/**
 * Les deux sous-scores en anneaux concentriques — Focus à l'extérieur, Repos à
 * l'intérieur — avec le score global au centre. Un seul objet porte les trois
 * valeurs : rien ne se dispute la vedette dans la carte.
 *
 * Le rayon extérieur réserve `stroke * 1.2` de marge pour que le halo diffus
 * tienne dans le canevas SVG sans se faire couper au bord.
 */
export const HomeScoreRings = React.memo(function HomeScoreRings({
  focus,
  rest,
  size,
  stroke,
  gap,
  gradientPrefix,
  children,
}: Props) {
  const center = size / 2
  const outerRadius = (size - stroke * 2.4) / 2
  const innerRadius = outerRadius - stroke - gap
  const outer = arcGeometry(focus, outerRadius)
  const inner = arcGeometry(rest, innerRadius)
  const focusId = `${gradientPrefix}Focus`
  const restId = `${gradientPrefix}Rest`

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} accessibilityElementsHidden>
        <Defs>
          <LinearGradient id={focusId} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={colors.accentVioletDeep} />
            <Stop offset="1" stopColor={colors.accentViolet} />
          </LinearGradient>
          <LinearGradient id={restId} x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={colors.accentViolet} />
            <Stop offset="1" stopColor={colors.homeLavender} />
          </LinearGradient>
        </Defs>

        <Circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke={colors.homeProgressTrack}
          strokeWidth={stroke}
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={colors.homeProgressTrack}
          strokeWidth={stroke}
        />

        {outer.available && (
          <Circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill="none"
            stroke={`url(#${focusId})`}
            strokeWidth={stroke * 1.8}
            strokeLinecap="round"
            strokeDasharray={`${outer.length} ${outer.length}`}
            strokeDashoffset={outer.offset}
            rotation="-90"
            origin={`${center}, ${center}`}
            opacity={0.13}
          />
        )}

        <Circle
          cx={center}
          cy={center}
          r={outerRadius}
          fill="none"
          stroke={`url(#${focusId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${outer.length} ${outer.length}`}
          strokeDashoffset={outer.offset}
          rotation="-90"
          origin={`${center}, ${center}`}
          opacity={outer.available ? 1 : 0.4}
        />
        <Circle
          cx={center}
          cy={center}
          r={innerRadius}
          fill="none"
          stroke={`url(#${restId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${inner.length} ${inner.length}`}
          strokeDashoffset={inner.offset}
          rotation="-90"
          origin={`${center}, ${center}`}
          opacity={inner.available ? 1 : 0.4}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
})
