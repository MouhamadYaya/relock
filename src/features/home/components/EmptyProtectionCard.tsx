import { router } from 'expo-router'
import React from 'react'
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'

const { colors, layout, radius, shadow, typography } = relockMaterial
const FW = {
  400: fonts.regular,
  600: fonts.semiBold,
  800: fonts.bold,
} as const
const f = (weight: keyof typeof FW) => FW[weight]

function HeroMaterial() {
  return (
    <View pointerEvents="none" style={styles.materialFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="hero-surface" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.surfaceHeroTop} />
            <Stop offset="1" stopColor={colors.surfaceHeroBottom} />
          </LinearGradient>
          <RadialGradient id="hero-bloom" cx="78%" cy="30%" r="66%">
            <Stop
              offset="0"
              stopColor={colors.moonHaloSolid}
              stopOpacity={0.08}
            />
            <Stop offset="1" stopColor={colors.moonHaloSolid} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="hero-rim" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.onAccent} stopOpacity={0.09} />
            <Stop
              offset="0.52"
              stopColor={colors.moonHaloSolid}
              stopOpacity={0.11}
            />
            <Stop offset="1" stopColor={colors.onAccent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#hero-surface)" />
        <Rect width="100%" height="100%" fill="url(#hero-bloom)" />
        <Rect width="100%" height="1" fill="url(#hero-rim)" />
      </Svg>
    </View>
  )
}

function MoonArtwork() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.moonZone}
    >
      <Image
        source={require('@assets/home-demilune2.png')}
        style={styles.moon}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  )
}

function GradientAction() {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Créer ma première protection"
      onPress={() => router.push('/add-block')}
      style={styles.action}
    >
      <View pointerEvents="none" style={styles.materialFill}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hero-action" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.accentVioletDeep} />
              <Stop offset="0.55" stopColor={colors.accentViolet} />
              <Stop offset="1" stopColor={colors.accentBlue} />
            </LinearGradient>
            <LinearGradient id="action-highlight" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.onAccent} stopOpacity={0.09} />
              <Stop offset="1" stopColor={colors.onAccent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#hero-action)" />
          <Rect width="100%" height="50%" fill="url(#action-highlight)" />
        </Svg>
      </View>
      <Text style={[f(600), styles.actionLabel]}>
        Créer ma première protection
      </Text>
      <Text aria-hidden style={[f(600), styles.actionArrow]}>
        →
      </Text>
    </PressableScale>
  )
}

export function EmptyProtectionCard() {
  const { width } = useWindowDimensions()
  const contentWidth = Math.min(width, layout.contentMaxWidth)
  const heroWidth = contentWidth - layout.screenHorizontal * 2
  const heroHeight = Math.max(
    layout.heroMinHeight,
    Math.min(layout.heroMaxHeight, heroWidth * layout.heroAspectRatio),
  )

  return (
    <View style={styles.shadowWrap}>
      <View style={[styles.card, { height: heroHeight }]}>
        <HeroMaterial />
        <MoonArtwork />

        <View style={styles.content}>
          <View style={styles.copy}>
            <Text style={[f(800), styles.title]}>
              Ton attention{`\n`}n'est pas encore{`\n`}protégée
            </Text>
            <Text style={[f(400), styles.description]}>
              Crée ta première protection{`\n`}pour commencer à reprendre
              {`\n`}le contrôle.
            </Text>
          </View>

          <GradientAction />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: radius.hero,
    ...shadow.hero,
  },
  card: {
    borderRadius: radius.hero,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  materialFill: {
    ...StyleSheet.absoluteFillObject,
  },
  moonZone: {
    position: 'absolute',
    width: layout.heroMoonSize,
    height: layout.heroMoonSize,
    right: layout.heroMoonRight,
    top: layout.heroMoonTop,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moon: {
    width: layout.heroMoonSize,
    height: layout.heroMoonSize,
  },
  content: {
    flex: 1,
    paddingHorizontal: layout.heroPaddingHorizontal,
    paddingTop: layout.heroPaddingTop,
    paddingBottom: layout.heroPaddingBottom,
  },
  copy: {
    flex: 1,
    width: layout.heroCopyWidth,
    zIndex: 1,
  },
  title: {
    fontSize: typography.heroTitleSize,
    lineHeight: typography.heroTitleLineHeight,
    color: colors.textPrimary,
    letterSpacing: -0.45,
    marginBottom: layout.heroTitleBottom,
  },
  description: {
    fontSize: typography.heroBodySize,
    lineHeight: typography.heroBodyLineHeight,
    color: colors.textSecondary,
    marginBottom: layout.heroDescriptionBottom,
  },
  action: {
    height: layout.primaryActionHeight,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.glow,
  },
  actionLabel: {
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
    color: colors.onBrightAccent,
  },
  actionArrow: {
    position: 'absolute',
    right: layout.primaryActionArrowRight,
    fontSize: typography.sectionTitleSize,
    lineHeight: typography.sectionTitleLineHeight,
    color: colors.onBrightAccent,
  },
})
