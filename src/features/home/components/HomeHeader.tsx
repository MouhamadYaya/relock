import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { RelockWordmark } from '@/shared/components/ui/RelockWordmark'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial

/**
 * L'entete de l'Accueil : logotype a gauche, serie et reglages a droite.
 *
 * Elle ne dit plus bonjour. Un salut change trois fois par jour et ne porte
 * aucune information ; la marque, elle, ancre l'ecran et ne bouge jamais —
 * c'est la barre fixe de l'app, pas le haut du contenu (voir `HomeScreen`,
 * ou elle vit HORS du `ScrollView`).
 *
 * La serie n'a volontairement pas de pastille : la flamme et son compte se
 * posent a nu sur le fond nocturne, seule l'action reglages porte un cercle.
 * Deux pastilles cote a cote alourdissaient la rangee et volaient la vedette
 * au logotype.
 */
interface Props {
  streak: number
  streakLabel: string
  settingsLabel: string
  onPressStreak: () => void
  onPressSettings: () => void
}

/** Sans pastille, la flamme n'offre plus de cible : on la rend au doigt. */
const STREAK_HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 }

export const HomeHeader = React.memo(function HomeHeader({
  streak,
  streakLabel,
  settingsLabel,
  onPressStreak,
  onPressSettings,
}: Props) {
  return (
    <View style={styles.header}>
      <RelockWordmark height={layout.homeLogoHeight} />
      <View style={styles.actions}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={streakLabel}
          hitSlop={STREAK_HIT_SLOP}
          onPress={onPressStreak}
          style={styles.streak}
        >
          <Text accessibilityElementsHidden style={styles.flame}>
            🔥
          </Text>
          <Text style={styles.streakValue}>{streak}</Text>
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={settingsLabel}
          onPress={onPressSettings}
          shadow
          style={styles.settings}
        >
          <IconSvg
            name={IconName.SETTINGS}
            size={layout.headerIconSize}
            color={colors.textPrimary}
          />
        </PressableScale>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  header: {
    minHeight: layout.homeHeaderActionSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  flame: {
    fontSize: layout.homeHeaderFlameSize,
    lineHeight: layout.homeHeaderFlameSize + 6,
    textShadowColor: colors.homeTextShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  streakValue: {
    ...fonts.bold,
    color: colors.homeFlame,
    fontSize: typography.heroBodySize,
    fontVariant: ['tabular-nums'],
    textShadowColor: colors.homeTextShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  settings: {
    width: layout.homeHeaderActionSize,
    height: layout.homeHeaderActionSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeHeaderControl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
  },
})
