import React from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors, layout, opacity } = relockMaterial

/**
 * La scène des Réglages : la même nuit que l'Accueil, à une autre heure.
 *
 * L'Accueil est éclairé par le limbe doré d'une planète, en bas de l'écran.
 * Ici la lumière vient d'en HAUT et elle est froide — une aurore violette
 * derrière le titre. Trois couches seulement :
 *
 * 1. la base `homeCanvas` (#05060B, jamais du noir pur : les dégradés qui s'y
 *    fondent banderaient et le verre des cartes n'aurait rien à refléter) ;
 * 2. l'aurore, deux ellipses très étalées — violette au centre, un souffle
 *    cyan décalé à droite pour que la teinte ne soit pas plate ;
 * 3. le grain, en fondu neutre, dont le seul rôle est de tuer le banding.
 *
 * Le fond est FIXE et plein écran : il court derrière tout le contenu
 * scrollable, comme sur l'Accueil. Une scène qui défile avec le contenu se
 * lit comme une image ; une scène qui reste se lit comme un lieu.
 */
export function SettingsBackdrop() {
  return (
    <View
      testID="settings-backdrop"
      pointerEvents="none"
      accessibilityElementsHidden
      style={styles.backdrop}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient
            id="settingsAurora"
            cx="0.5"
            cy={layout.settingsAuroraCenterY}
            rx={layout.settingsAuroraRadiusX}
            ry={layout.settingsAuroraRadiusY}
          >
            <Stop offset="0" stopColor={colors.settingsAurora} />
            <Stop offset="0.45" stopColor={colors.settingsAuroraDeep} />
            <Stop
              offset="1"
              stopColor={colors.homeCanvas}
              stopOpacity={0}
            />
          </RadialGradient>
          <RadialGradient id="settingsAuroraCool" cx="0.86" cy="0.02" rx="0.6" ry="0.24">
            <Stop offset="0" stopColor={colors.settingsAuroraCool} />
            <Stop offset="1" stopColor={colors.homeCanvas} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="settingsVignette" cx="0.5" cy="0.42" rx="0.8" ry="0.8">
            <Stop offset="0.45" stopColor={colors.homeCanvas} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.homeCanvas} stopOpacity={0.7} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#settingsAurora)" />
        <Rect width="100%" height="100%" fill="url(#settingsAuroraCool)" />
        <Rect width="100%" height="100%" fill="url(#settingsVignette)" />
      </Svg>

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
  grain: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: opacity.homeGrain,
  },
})
