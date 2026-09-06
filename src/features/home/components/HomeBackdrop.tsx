import React from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors, layout, opacity } = relockMaterial

/**
 * La scène de l'Accueil : une seule lumière, jamais interrompue.
 *
 * Le fond est plein écran et fixe — il court derrière tout le contenu
 * scrollable et ne s'arrête nulle part. Quatre couches, du fond vers l'avant :
 *
 * 1. la base `homeCanvas` (#05060B, jamais du noir pur) ;
 * 2. le globe, dont le limbe éclairé est LA source lumineuse de l'écran ;
 * 3. le halo chaud centré sur ce limbe, à 22 % de la hauteur ;
 * 4. la vignette qui assombrit les bords, puis le grain.
 *
 * Tout le reste de l'écran répond à cette lumière : les cartes captent leur
 * arête haute d'autant plus qu'elles en sont proches (voir `HomeCardMaterial`).
 */
export function HomeBackdrop() {
  return (
    <View
      testID="home-fixed-backdrop"
      pointerEvents="none"
      accessibilityElementsHidden
      style={styles.backdrop}
    >
      <View style={styles.artwork}>
        <Image
          source={require('@assets/home-dashboard-hero.png')}
          resizeMode="cover"
          style={styles.image}
        />
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="homeFixedShade" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={colors.homeCanvas}
                stopOpacity={opacity.homeBackdropTop}
              />
              <Stop
                offset="0.18"
                stopColor={colors.homeCanvas}
                stopOpacity={opacity.homeBackdropTop}
              />
              <Stop
                offset="0.55"
                stopColor={colors.homeCanvas}
                stopOpacity={opacity.homeBackdropMiddle}
              />
              <Stop
                offset="0.85"
                stopColor={colors.homeCanvas}
                stopOpacity={opacity.homeBackdropFade}
              />
              <Stop offset="1" stopColor={colors.homeCanvas} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#homeFixedShade)" />
        </Svg>
      </View>

      {/* Halo et vignette débordent le cadre du globe : ils appartiennent à la
          scène entière, pas à l'illustration. */}
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient
            id="homeHalo"
            cx={layout.homeHaloCenterX}
            cy={layout.homeHaloCenterY}
            rx={layout.homeHaloRadiusX}
            ry={layout.homeHaloRadiusY}
          >
            <Stop offset="0" stopColor={colors.homeDawn} stopOpacity={0.14} />
            <Stop
              offset={layout.homeHaloFalloff}
              stopColor={colors.homeDawn}
              stopOpacity={0}
            />
          </RadialGradient>
          <RadialGradient
            id="homeVignette"
            cx={layout.homeHaloCenterX}
            cy={layout.homeVignetteCenterY}
            rx="0.75"
            ry="0.75"
          >
            <Stop
              offset={layout.homeVignetteInner}
              stopColor={colors.homeCanvas}
              stopOpacity={0}
            />
            <Stop offset="1" stopColor={colors.homeCanvas} stopOpacity={0.85} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeHalo)" />
        <Rect width="100%" height="100%" fill="url(#homeVignette)" />
      </Svg>

      {/* Grain : gris moyen en fondu `overlay`, donc neutre en luminosité. Il
          n'est pas là pour se voir, il est là pour tuer le banding. */}
      <Image
        source={require('@assets/home-grain.png')}
        resizeMode="repeat"
        style={styles.grain}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.homeCanvas,
  },
  artwork: { height: layout.homeBackdropHeight, overflow: 'hidden' },
  // Override the asset's intrinsic 480 × 360 size so cover uses the full frame.
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    // Lower the moon independently of the content; the top shade hides its edge.
    transform: [
      { translateY: layout.homeBackdropImageOffsetY },
      { scale: layout.homeBackdropImageScale },
    ],
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: opacity.homeGrain,
    mixBlendMode: 'overlay',
  },
})
