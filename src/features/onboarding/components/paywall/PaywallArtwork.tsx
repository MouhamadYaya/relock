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

const TILES = require('@assets/paywall/relock-plan-mosaic-v2.png')
const BENEFITS = require('@assets/paywall/relock-benefits-v2.png')
const MOONS = require('@assets/paywall/reference-moons.png')
const GRAIN = require('@assets/home-grain.png')

/**
 * Découpage des atlas. Chaque entrée est `[x, y, largeur, hauteur]` en
 * fraction du fichier — un décalage casse tous les cadrages, donc régénérer
 * un atlas veut dire garder EXACTEMENT la même grille.
 *
 * `relock-plan-mosaic-v2` : 2 × 2 (bureau+lampe · lit défait · carnet ·
 * appareil photo). `relock-benefits-v2` : 2 cases en haut (nuit au
 * téléphone · dos à la fenêtre), 3 en bas (écriture · casque · petit
 * déjeuner à deux).
 */
const CELL = {
  tileDesk: [0, 0, 0.5, 0.5],
  tileBed: [0.5, 0, 0.5, 0.5],
  tileNotebook: [0, 0.5, 0.5, 0.5],
  tileCamera: [0.5, 0.5, 0.5, 0.5],
  night: [0, 0, 0.5, 0.5],
  morning: [2 / 3, 0.5, 1 / 3, 0.5],
  writing: [0, 0.5, 1 / 3, 0.5],
  headphones: [1 / 3, 0.5, 1 / 3, 0.5],
} as const

/** Les quatre visuels de l'écran des formules, dans l'ordre de lecture. */
const PLAN_TILES = [
  CELL.tileDesk,
  CELL.tileNotebook,
  CELL.tileCamera,
  CELL.tileBed,
] as const

/**
 * Les trois vignettes des bénéfices : trois objets de la vie hors écran,
 * pris dans la même direction artistique (nuit, un seul foyer chaud, faible
 * profondeur de champ) — écrire, écouter, se souvenir.
 */
const BENEFIT_CELLS = [
  { source: BENEFITS, region: CELL.writing },
  { source: BENEFITS, region: CELL.headphones },
  { source: TILES, region: CELL.tileCamera },
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

/**
 * Le voile des photos : il assombrit surtout le pied, là où se pose le
 * texte. `strength` le desserre pour les vignettes, qui sont trop petites
 * pour survivre à un voile de pleine page.
 */
function PhotoScrim({ strength = 1 }: { strength?: number }) {
  const shade = useId()
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={shade} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop
            offset="0"
            stopColor={PW.color.canvas}
            stopOpacity={0.2 * strength}
          />
          <Stop
            offset="0.55"
            stopColor={PW.color.canvas}
            stopOpacity={0.3 * strength}
          />
          <Stop
            offset="1"
            stopColor={PW.color.canvas}
            stopOpacity={0.78 * strength}
          />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${shade})`} />
    </Svg>
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
 * Les quatre visuels de l'écran des formules — une grille 2 × 2 qui occupe
 * le premier tiers de la page, comme la référence.
 *
 * Ils sont DÉCORATIFS : aucun libellé, aucune zone tactile, aucun état
 * sélectionné. Ce qui se choisit sur cet écran, ce sont les deux formules,
 * plus bas.
 */
export function PaywallTiles() {
  return (
    <View style={styles.tiles} testID="paywall-tiles">
      {[0, 1].map(row => (
        <View key={row} style={styles.tileRow}>
          {[0, 1].map(column => (
            <View key={column} style={styles.tile}>
              <AtlasImage
                source={TILES}
                aspect={1}
                region={PLAN_TILES[row * 2 + column]}
                style={StyleSheet.absoluteFill}
              />
              <PhotoScrim strength={0.42} />
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

/**
 * Une moitié du diptyque.
 *
 * « Avant » : la nuit, seul, le visage éclairé par l'écran. « Après » : le
 * MÊME homme, le matin, en train de parler à quelqu'un. La transformation
 * doit se comprendre sans lire les libellés, donc le voile de l'« après »
 * est allégé — l'assombrir à égalité annulerait la seule chose que le
 * diptyque doit démontrer.
 */
export function PaywallComparisonPhoto({ after = false }: { after?: boolean }) {
  return (
    <>
      <AtlasImage
        source={BENEFITS}
        aspect={1}
        region={after ? CELL.morning : CELL.night}
        style={StyleSheet.absoluteFill}
      />
      <PhotoScrim strength={after ? 0.45 : 1} />
    </>
  )
}

/** La vignette d'un bénéfice : une vraie photo, pas un pictogramme. */
export function PaywallBenefitThumb({ index }: { index: number }) {
  const cell = BENEFIT_CELLS[index % BENEFIT_CELLS.length]
  return (
    <AtlasImage
      source={cell.source}
      aspect={1}
      region={cell.region}
      style={StyleSheet.absoluteFill}
    />
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
  // La grille remplit son emplacement : c'est l'emplacement qui cède de la
  // hauteur quand l'écran est court, jamais le prix.
  tiles: { flex: 1, gap: PW.layout.tileGap },
  tileRow: { flex: 1, flexDirection: 'row', gap: PW.layout.tileGap },
  tile: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: PW.radius.md,
    backgroundColor: PW.color.surface,
  },
})
