import React, { useId, useState } from 'react'
import {
  Image,
  type ImageSourcePropType,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { useT } from '@/i18n/useT'

const MOONS = require('@assets/paywall/reference-moons.png')
const GRAIN = require('@assets/home-grain.png')

/**
 * Les trois marques, prétraitées en monochrome par
 * `scripts/build-trust-logos.py` — voir `PaywallTrustLogos` pour le
 * pourquoi. L'ordre est celui de la rangée, de gauche à droite.
 */
const TRUST_LOGOS = [
  require('@assets/paywall/trust-oxford.png'),
  require('@assets/paywall/trust-harvard.png'),
  require('@assets/paywall/trust-cambridge.png'),
] as const

/** Étoile à quatre branches, aux courbes creusées — le geste de la référence. */
const SPARKLE =
  'M12 0 C13.1 8.2 15.8 10.9 24 12 C15.8 13.1 13.1 15.8 12 24 ' +
  'C10.9 15.8 8.2 13.1 0 12 C8.2 10.9 10.9 8.2 12 0 Z'

/**
 * Cadrage « cover » d'une case d'atlas.
 *
 * ⚠️ Toute `Svg` posée par-dessus doit être dimensionnée par
 * `StyleSheet.absoluteFill` + `viewBox`, JAMAIS par `width="100%"` seul :
 * react-native-svg résout mal ce couple et laissait une couture horizontale
 * nette au milieu de chaque image.
 */
function AtlasImage({
  source,
  region,
  aspect,
  style,
}: {
  source: ImageSourcePropType
  region: readonly [number, number, number, number]
  aspect: number
  style?: StyleProp<ViewStyle>
}) {
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [x, y, w, h] = region
  const imageWidth = Math.max(box.width / w, (box.height * aspect) / h)
  const imageHeight = imageWidth / aspect

  return (
    <View
      style={[styles.crop, style]}
      onLayout={({ nativeEvent: { layout } }) => {
        if (layout.width !== box.width || layout.height !== box.height) {
          setBox(layout)
        }
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {box.width > 0 ? (
        <Image
          source={source}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
          style={{
            position: 'absolute',
            width: imageWidth,
            height: imageHeight,
            left: -x * imageWidth + (box.width - w * imageWidth) / 2,
            top: -y * imageHeight + (box.height - h * imageHeight) / 2,
          }}
        />
      ) : null}
    </View>
  )
}

/** Grain fin, en fondu `overlay` : invisible, mais il tue le banding. */
function Grain() {
  return (
    <Image
      source={GRAIN}
      resizeMode="repeat"
      accessibilityIgnoresInvertColors
      style={styles.grain}
    />
  )
}

/**
 * Le halo « projecteur » de l'onboarding, repris tel quel : un foyer violet
 * en haut de l'écran qui se fond vers le noir. C'est la signature
 * atmosphérique de la marque — la version précédente du paywall l'avait
 * supprimée, et les quatre écrans avaient perdu leur ciel.
 */
function Halo({ height = '54%' }: { height?: string }) {
  const halo = useId()
  return (
    <Svg width="100%" height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id={halo} cx="50%" cy="0%" r="95%">
          <Stop offset="0%" stopColor={PW.color.halo} stopOpacity={0.9} />
          <Stop offset="55%" stopColor={PW.color.halo} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={PW.color.canvas} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${halo})`} />
    </Svg>
  )
}

/** Le fond courant : nuit de l'onboarding + halo + grain. */
export function PaywallBackdrop() {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.backdrop]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Halo />
      <Grain />
    </View>
  )
}

/**
 * Le champ violet de l'offre unique.
 *
 * La référence pose un aplat violet vif sur toute la page : c'est ce qui
 * fait qu'aucun vide n'y ressemble à un trou. Relock le décline en nuit
 * violette — la couleur du halo d'onboarding, montée jusqu'à occuper le
 * fond — plus la lune de marque en motif d'angle.
 */
export function PaywallField() {
  const field = useId()
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="paywall-field"
    >
      <Svg
        style={StyleSheet.absoluteFill}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id={field} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor={PW.color.fieldTop} />
            <Stop offset="0.52" stopColor={PW.color.fieldMid} />
            <Stop offset="1" stopColor={PW.color.fieldBottom} />
          </LinearGradient>
        </Defs>
        <Rect width="100" height="100" fill={`url(#${field})`} />
      </Svg>
      <AtlasImage
        source={MOONS}
        aspect={2}
        region={[0, 0, 0.5, 1]}
        style={styles.motif}
      />
      <Grain />
    </View>
  )
}

/** Une étoile lavande. Le décor de fête de la référence, dans nos couleurs. */
export function PaywallSparkle({
  size = PW.layout.sparkle,
  style,
}: {
  size?: number
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View pointerEvents="none" style={style} accessibilityElementsHidden>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d={SPARKLE} fill={PW.color.accent} />
      </Svg>
    </View>
  )
}

/**
 * La rangée des marques universitaires, sous la preuve sociale.
 *
 * Les fichiers sont des marques MONOCHROMES : l'alpha y porte l'obscurité du
 * trait d'origine, les pixels sont blancs. Deux conséquences, et elles sont
 * la raison d'être de ce prétraitement :
 *
 * 1. Le blason garde son détail intérieur au lieu de s'aplatir en silhouette
 *    — ce qu'aurait fait un `tintColor` sur les fichiers couleur.
 * 2. Le fond blanc incrusté du logo de Cambridge a disparu : sur la nuit de
 *    la page, un `tintColor` l'aurait laissé en rectangle plein.
 *
 * Chaque marque occupe un tiers de la rangée et se met à l'échelle dedans
 * (`contain`) : les trois fichiers n'ont pas le même rapport, et une hauteur
 * commune imposée aurait fait déborder Cambridge sur les petits écrans.
 */
export function PaywallTrustLogos({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const height = compact ? PW.layout.compactTrustLogo : PW.layout.trustLogo
  return (
    <View
      testID="paywall-trust-logos"
      style={styles.trustRow}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('paywall_reference.trust')}
    >
      {TRUST_LOGOS.map((source, index) => (
        <Image
          key={index}
          source={source}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          style={[styles.trustLogo, { height }]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  crop: { overflow: 'hidden', backgroundColor: PW.color.canvas },
  backdrop: { backgroundColor: PW.color.canvas },
  grain: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: PW.opacity.grain,
    mixBlendMode: 'overlay',
  },
  motif: {
    position: 'absolute',
    width: PW.layout.moonMotif,
    height: PW.layout.moonMotif,
    borderRadius: PW.radius.capsule,
    right: -PW.layout.moonMotif * 0.28,
    top: -PW.layout.moonMotif * 0.22,
    opacity: PW.opacity.motif,
    backgroundColor: PW.color.transparent,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // Sans écart, les trois marques se touchent et se lisent comme un seul
    // bloc gris. L'espace est ce qui en refait trois signatures distinctes.
    gap: PW.space.md,
    // Les marques ne sont pas la promesse : elles se lisent en dernier,
    // donc elles s'éteignent au lieu de rivaliser avec le CTA.
    opacity: PW.opacity.trust,
  },
  trustLogo: { flex: 1 },
})
