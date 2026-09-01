import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  BlockedAppIcons,
  isBlockedAppIconsAvailable,
} from '@/shared/native/BlockedAppIcons'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, shadow, typography } = relockMaterial

/** Hauteur complète d'une tuile, légende comprise — partagée avec sa rangée. */
export const BLOCKED_APP_SLOT_HEIGHT =
  layout.blockingLockedTileSize +
  spacing.xs +
  typography.blockingCompactTitleLineHeight +
  spacing.micro

/**
 * Décompte restant avant le reblocage automatique, découpé en h/m/s.
 *
 * ⚠️ `Math.ceil` et pas `floor` : à 1,4 s de la fin on lit encore « 2s » —
 * un compteur qui affiche « 0s » pendant une seconde entière donne
 * l'impression que le sursis est déjà fini alors que l'app est ouverte.
 */
export function reprieveCountdownParts(
  untilSeconds: number,
  nowMilliseconds = Date.now(),
): { hours: number; minutes: number; seconds: number } {
  const total = Math.max(
    0,
    Math.ceil((untilSeconds * 1000 - nowMilliseconds) / 1000),
  )
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** « 1h 05m », « 1m 29s » ou « 42s » selon ce qu'il reste réellement. */
function countdownLabel(
  t: ReturnType<typeof useT>,
  untilSeconds: number,
  nowMilliseconds: number,
): string {
  const { hours, minutes, seconds } = reprieveCountdownParts(
    untilSeconds,
    nowMilliseconds,
  )
  if (hours > 0) {
    return t('blocking.reblock_app.countdown_hours_minutes', {
      hours,
      minutes: pad(minutes),
    })
  }
  if (minutes > 0) {
    return t('blocking.reblock_app.countdown_minutes_seconds', {
      minutes,
      seconds: pad(seconds),
    })
  }
  return t('blocking.reblock_app.countdown_seconds', { seconds })
}

/** Cadenas seul, sans pastille : l'app reste le premier élément identifiable. */
export function BlockedAppLockGlyph({ open }: { open: boolean }) {
  const glyphColor = open
    ? colors.blockingUnlockedAppMark
    : colors.blockingLockedAppMark
  const shacklePath = open
    ? 'M22 16v-5a6 6 0 0 0-11.75-1.72'
    : 'M10 16v-5a6 6 0 0 1 12 0v5'

  return (
    <View testID="blocked-app-lock-overlay" style={styles.lockOverlay}>
      <Svg
        testID={open ? 'blocked-app-lock-open' : 'blocked-app-lock-closed'}
        width={spacing.lg + spacing.xs}
        height={spacing.lg + spacing.xs}
        viewBox="0 0 32 32"
      >
        <Path
          testID="blocked-app-lock-contrast-stroke"
          d={shacklePath}
          fill="none"
          stroke={colors.blockingAppMarkContrast}
          strokeWidth={5.8}
          strokeLinecap="round"
        />
        <Rect
          testID="blocked-app-lock-contrast-body"
          x={5.5}
          y={12.5}
          width={21}
          height={18}
          rx={5.2}
          fill={colors.blockingAppMarkContrast}
        />
        <Path
          d={shacklePath}
          fill="none"
          stroke={glyphColor}
          strokeWidth={2.8}
          strokeLinecap="round"
        />
        <Rect x={7} y={14} width={18} height={15} rx={3.8} fill={glyphColor} />
        <Circle cx={16} cy={21} r={1.8} fill={colors.blockingAppMarkContrast} />
      </Svg>
    </View>
  )
}

/**
 * Une app couverte par une protection : sa VRAIE icône (rendue par la vue
 * native, seule capable de lire un jeton Family Controls), l'état du cadenas
 * par-dessus, et dessous l'action qui l'ouvre individuellement.
 */
export function BlockedAppTileView({
  tokenKey,
  unlocked,
  label,
  reprievedUntil,
  showLabel = true,
  onPress,
  disabled = false,
}: {
  /** Identité stable de l'app (cf. `ScreenTime.blockedAppKeys`). */
  tokenKey: string
  unlocked: boolean
  label: string
  /** Fin du sursis (epoch en secondes) — pilote le décompte sous la tuile. */
  reprievedUntil?: number
  /**
   * Masque le mot d'action sous la tuile (« Débloquer »). Un décompte de
   * sursis, lui, reste TOUJOURS affiché : ce n'est pas un bouton, c'est
   * l'information qu'on ne peut lire nulle part ailleurs.
   */
  showLabel?: boolean
  onPress: () => void
  disabled?: boolean
}) {
  const t = useT()
  const counting = unlocked && reprievedUntil != null
  const [now, setNow] = useState(() => Date.now())

  // Le décompte ne bat QUE pendant un sursis : une rangée d'apps verrouillées
  // ne doit pas réveiller le JS chaque seconde pour ne rien changer.
  useEffect(() => {
    if (!counting) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [counting])

  // Sous une app ouverte, « Rebloquer » ne disait pas l'essentiel : le sursis
  // se referme tout seul. On affiche donc le temps qu'il reste ; l'action
  // reste accessible au tap et garde son intitulé pour VoiceOver.
  const caption =
    unlocked && reprievedUntil != null
      ? countdownLabel(t, reprievedUntil, now)
      : label

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.slot}
    >
      <View style={[styles.tile, unlocked && styles.tileOpen]}>
        {/* L'icône réelle occupe TOUTE la tuile ; le voile puis le cadenas se
            posent par-dessus. On reconnaît donc l'app d'un coup d'œil tout en
            lisant son état — l'icône seule ne dirait pas « bloquée », le
            cadenas seul ne dirait pas « laquelle ». */}
        {isBlockedAppIconsAvailable ? (
          <BlockedAppIcons tokenKey={tokenKey} style={styles.realIcon} />
        ) : null}
        <View
          pointerEvents="none"
          style={[styles.scrim, unlocked && styles.scrimOpen]}
        />
        <View pointerEvents="none" style={styles.lock}>
          <BlockedAppLockGlyph open={unlocked} />
        </View>
      </View>
      {showLabel || counting ? (
        <Text
          pointerEvents="none"
          numberOfLines={1}
          style={[styles.label, unlocked && styles.labelOpen]}
        >
          {caption}
        </Text>
      ) : null}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  slot: {
    flexShrink: 0,
    alignItems: 'center',
    gap: spacing.xs,
  },
  tile: {
    width: layout.blockingLockedTileSize,
    height: layout.blockingLockedTileSize,
    borderRadius: radius.action,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.blockingSurfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
    shadowColor: colors.blockingAccent,
    shadowOpacity: shadow.blockingGlow.shadowOpacity,
    shadowRadius: shadow.blockingGlow.shadowRadius,
    shadowOffset: shadow.blockingGlow.shadowOffset,
  },
  tileOpen: {
    borderColor: colors.surfaceHighlight,
  },
  realIcon: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingImageShade,
    opacity: 0.42,
  },
  // Ouverte : on allège le voile — l'app se voit mieux, ce qui EST le message.
  scrimOpen: {
    opacity: 0.08,
  },
  lock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockOverlay: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...fonts.medium,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
  },
  labelOpen: {
    color: colors.textPrimary,
  },
})
