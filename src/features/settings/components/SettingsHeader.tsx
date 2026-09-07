import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, typography } = relockMaterial

/**
 * Course sur laquelle le grand titre cède la place au titre compact. Calée
 * sur la hauteur du grand titre : la bascule se termine exactement quand il
 * passe sous la barre, pas à un seuil arbitraire.
 */
const HANDOFF = typography.settingsTitleLineHeight

interface Props {
  title: string
  backLabel: string
  scrollY: SharedValue<number>
  /** Hauteur de l'encoche : la bande pleine doit la couvrir entièrement. */
  topInset: number
  onBack: () => void
}

/**
 * La barre fixe des Réglages.
 *
 * Elle est vide au repos — juste le bouton retour posé sur la scène — et se
 * remplit au défilement : le voile se densifie, le titre compact apparaît au
 * moment précis où le grand titre disparaît sous elle. C'est le comportement
 * des grands titres iOS, et il vaut mieux qu'un titre permanent : au repos,
 * rien ne s'interpose entre l'aurore et le nom de l'écran.
 *
 * Le voile ne part PAS de zéro : un fond d'opacité minimale assoit la barre
 * d'état. Si le gestionnaire de défilement ne s'attachait pas, la barre
 * resterait lisible au lieu de disparaître en silence.
 */
export function SettingsHeader({
  title,
  backLabel,
  scrollY,
  topInset,
  onBack,
}: Props) {
  const solidHeight = topInset + layout.settingsHeaderHeight
  const height = solidHeight + layout.settingsHeaderFade
  const knee = solidHeight / height

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HANDOFF],
      [0.25, 1],
      Extrapolation.CLAMP,
    ),
  }))

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [HANDOFF * 0.55, HANDOFF],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [HANDOFF * 0.55, HANDOFF],
          [6, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }))

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        style={[styles.scrim, { height }, scrimStyle]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="settingsHeaderScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={colors.homeCanvas}
                stopOpacity={relockMaterial.opacity.homeHeaderScrimTop}
              />
              <Stop
                offset={knee}
                stopColor={colors.homeCanvas}
                stopOpacity={relockMaterial.opacity.homeHeaderScrimKnee}
              />
              <Stop offset="1" stopColor={colors.homeCanvas} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#settingsHeaderScrim)" />
        </Svg>
      </Animated.View>

      <View style={[styles.bar, { paddingTop: topInset }]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          onPress={() => {
            haptics.selectionTick()
            onBack()
          }}
          style={styles.back}
        >
          <IconSvg
            name={IconName.BACK}
            size={layout.settingsChevronSize}
            color={colors.homeCardInk}
          />
        </PressableScale>

        <Animated.Text
          numberOfLines={1}
          style={[styles.compactTitle, titleStyle]}
        >
          {title}
        </Animated.Text>

        {/* Contrepoids de la largeur du bouton retour : sans lui le titre
            compact serait centré sur l'espace restant, donc décalé. */}
        <View style={styles.spacer} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: layout.homeHeaderScrimZ,
  },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.settingsHorizontal,
  },
  back: {
    width: layout.settingsHeaderHeight,
    height: layout.settingsHeaderHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeHeaderControl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
  },
  compactTitle: {
    ...fonts.semiBold,
    flex: 1,
    textAlign: 'center',
    color: colors.homeCardInk,
    fontSize: typography.settingsCompactTitleSize,
    lineHeight: typography.settingsCompactTitleLineHeight,
  },
  spacer: { width: layout.settingsHeaderHeight },
})
