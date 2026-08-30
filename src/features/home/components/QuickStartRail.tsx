import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useMemo } from 'react'
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  availablePresets,
  type Preset,
  presetDetail,
} from '@/features/blocking/presets'
import type { BlockRuleView } from '@/features/blocking/types'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'

const { colors, layout, opacity, radius, shadow, typography } = relockMaterial
const FW = { 400: fonts.regular, 600: fonts.semiBold } as const
const f = (weight: keyof typeof FW) => FW[weight]

const RAIL_ORDER = ['focus', 'nuit', 'dose'] as const
type RailId = (typeof RAIL_ORDER)[number]

const RAIL_ICON: Record<RailId, number> = {
  focus: require('@assets/home-boule.png'),
  nuit: require('@assets/home-lune-nuage.png'),
  dose: require('@assets/home-bouclier.png'),
}

const RAIL_BLEED: Record<RailId, number> = {
  focus: require('@assets/home-etoilefilante.png'),
  nuit: require('@assets/home-nuage-fumee.png'),
  dose: require('@assets/home-grille.png'),
}

function MaterialFill({ id, panel = false }: { id: string; panel?: boolean }) {
  const gradientId = `${id}-surface`
  const highlightId = `${id}-highlight`
  const top = panel ? colors.surfacePanelTop : colors.surfaceInteractiveTop
  const bottom = panel
    ? colors.surfacePanelBottom
    : colors.surfaceInteractiveBottom

  return (
    <View pointerEvents="none" style={styles.materialFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
          <LinearGradient id={highlightId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.onAccent} stopOpacity={0.09} />
            <Stop
              offset="0.58"
              stopColor={colors.onAccent}
              stopOpacity={0.04}
            />
            <Stop offset="1" stopColor={colors.onAccent} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        <Rect width="100%" height="1" fill={`url(#${highlightId})`} />
      </Svg>
    </View>
  )
}

export function QuickStartRail({ rules }: { rules: BlockRuleView[] }) {
  const { width } = useWindowDimensions()
  const items = useMemo(() => {
    const available = availablePresets(rules)
    return RAIL_ORDER.map(id => available.find(p => p.id === id)).filter(
      (preset): preset is Preset => preset !== undefined,
    )
  }, [rules])

  if (items.length === 0) return null

  const contentWidth = Math.min(width, layout.contentMaxWidth)
  const panelWidth = contentWidth - layout.screenHorizontal * 2
  const rowWidth = panelWidth - layout.panelPadding * 2
  const rowHeight = Math.min(
    layout.quickActionMaxHeight,
    rowWidth * layout.quickActionAspectRatio,
  )

  return (
    <View style={styles.outerShadow}>
      <View style={styles.outer}>
        <MaterialFill id="quick-panel" panel />
        <View style={styles.outerContent}>
          <Text style={[f(600), styles.title]}>Commencer rapidement</Text>

          {items.map((preset, index) => {
            const id = preset.id as RailId
            const isLast = index === items.length - 1

            return (
              <View
                key={preset.id}
                style={[styles.rowShadow, isLast && styles.rowLast]}
              >
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`${preset.title} — ${presetDetail(preset)}`}
                  onPress={() =>
                    router.push({
                      pathname: '/preset-recap',
                      params: { presetId: preset.id },
                    })
                  }
                  style={[styles.row, { height: rowHeight }]}
                >
                  <MaterialFill id={`quick-${id}`} />
                  <Image
                    source={RAIL_BLEED[id]}
                    style={[
                      styles.decoration,
                      id === 'nuit' && styles.decorationStrong,
                    ]}
                    resizeMode="contain"
                    accessible={false}
                  />
                  <View style={styles.rowContent}>
                    <Image
                      source={RAIL_ICON[id]}
                      style={styles.icon}
                      resizeMode="contain"
                      accessible={false}
                    />
                    <View style={styles.rowCopy}>
                      <Text style={[f(600), styles.rowTitle]}>
                        {preset.title}
                      </Text>
                      <Text
                        style={[f(400), styles.rowDetail]}
                        numberOfLines={1}
                      >
                        {presetDetail(preset)}
                      </Text>
                    </View>
                    <IconSvg
                      name={IconName.FORWARD}
                      size={layout.quickChevronSize}
                      color={colors.textSecondary}
                    />
                  </View>
                </PressableScale>
              </View>
            )
          })}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outerShadow: {
    marginTop: layout.sectionGap,
    borderRadius: radius.panel,
    ...shadow.panel,
  },
  outer: {
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  outerContent: {
    padding: layout.panelPadding,
  },
  materialFill: {
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    fontSize: typography.sectionTitleSize,
    lineHeight: typography.sectionTitleLineHeight,
    color: colors.textPrimary,
    paddingHorizontal: layout.panelTitleHorizontal,
    marginBottom: layout.panelTitleBottom,
    zIndex: 1,
  },
  rowShadow: {
    marginBottom: layout.quickActionGap,
    borderRadius: radius.action,
    ...shadow.action,
  },
  rowLast: {
    marginBottom: 0,
  },
  row: {
    borderRadius: radius.action,
    borderWidth: 1,
    borderColor: colors.borderInteractive,
    overflow: 'hidden',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.panelPadding,
    paddingHorizontal: layout.quickActionHorizontal,
  },
  decoration: {
    position: 'absolute',
    right: layout.quickDecorationRight,
    width: layout.quickDecorationSize,
    height: layout.quickDecorationSize,
    opacity: opacity.decorative,
  },
  decorationStrong: {
    opacity: opacity.decorativeStrong,
  },
  icon: {
    width: layout.quickIconSize,
    height: layout.quickIconSize,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: typography.quickTitleSize,
    lineHeight: typography.quickTitleLineHeight,
    color: colors.textPrimary,
  },
  rowDetail: {
    fontSize: typography.quickDetailSize,
    lineHeight: typography.quickDetailLineHeight,
    color: colors.textTertiary,
  },
})
