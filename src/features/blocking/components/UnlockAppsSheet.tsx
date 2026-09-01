import { IconName } from '@assets/icons'
import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import {
  BrandActionSurface,
  SheetBloom,
} from '@/features/blocking/components/BlockingSurfaces'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  BlockedAppIcons,
  isBlockedAppIconsAvailable,
} from '@/shared/native/BlockedAppIcons'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, opacity, radius, shadow, typography } = relockMaterial

function CheckGlyph() {
  return (
    <Svg width={spacing.md} height={spacing.md} viewBox="0 0 16 16">
      <Path
        d="m3.5 8.4 3 3L12.5 4.6"
        fill="none"
        stroke={colors.blockingCanvas}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/**
 * Une app du blocage, cochable. Non cochée elle reste voilée : la tuile dit
 * « toujours bloquée », le voile tombe seulement pour ce qu'on s'apprête à
 * ouvrir.
 */
function SelectableAppTile({
  tokenKey,
  selected,
  onToggle,
}: {
  tokenKey: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={tokenKey}
      onPress={onToggle}
      style={styles.tileSlot}
    >
      <View style={[styles.tile, selected && styles.tileSelected]}>
        {isBlockedAppIconsAvailable ? (
          <BlockedAppIcons
            tokenKey={tokenKey}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <IconSvg
            name={IconName.LOCK}
            size={spacing.lg}
            color={colors.textPrimary}
          />
        )}
        <View
          pointerEvents="none"
          style={[styles.tileScrim, selected && styles.tileScrimSelected]}
        />
        {selected ? (
          <View pointerEvents="none" style={styles.check}>
            <CheckGlyph />
          </View>
        ) : null}
      </View>
    </PressableScale>
  )
}

/**
 * « Quelles apps ? » — deuxième temps de « Débloquer des apps », juste après
 * la respiration.
 *
 * On ouvre app par app, jamais le blocage entier : la règle continue de
 * tourner pour tout le reste, et ce qu'on ouvre se referme tout seul à
 * l'échéance choisie à l'étape suivante.
 */
export function UnlockAppsSheet({
  visible,
  appKeys,
  pending = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  /** Clés opaques encore verrouillées de la règle (cf. `ScreenTime.appKeys`). */
  appKeys: string[]
  pending?: boolean
  onCancel: () => void
  onConfirm: (keys: string[]) => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [selected, setSelected] = useState<string[]>([])

  // Chaque ouverture repart d'une ardoise vide : on ne réouvre pas par
  // inadvertance ce qu'on avait coché la fois d'avant.
  useEffect(() => {
    if (visible) setSelected([])
  }, [visible])

  const toggle = (key: string) => {
    haptics.selectionTick()
    setSelected(current =>
      current.includes(key)
        ? current.filter(item => item !== key)
        : [...current, key],
    )
  }

  const allSelected = selected.length === appKeys.length && appKeys.length > 0

  const toggleAll = () => {
    haptics.selectionTick()
    setSelected(allSelected ? [] : appKeys)
  }

  const close = () => {
    if (!pending) onCancel()
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable accessible={false} onPress={close} style={styles.backdrop}>
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          onPress={() => {}}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <SheetBloom />
          </View>

          <View style={styles.grabber} />

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('blocking.unlock_picker.title')}
            </Text>
            <Text style={styles.subtitle}>
              {t('blocking.unlock_picker.subtitle')}
            </Text>
          </View>

          {appKeys.length > 1 ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                allSelected
                  ? t('blocking.unlock_picker.clear_all')
                  : t('blocking.unlock_picker.select_all')
              }
              onPress={toggleAll}
              style={styles.selectAll}
            >
              <Text style={styles.selectAllLabel}>
                {allSelected
                  ? t('blocking.unlock_picker.clear_all')
                  : t('blocking.unlock_picker.select_all')}
              </Text>
            </PressableScale>
          ) : null}

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.gridViewport}
            contentContainerStyle={styles.grid}
          >
            {appKeys.map(key => (
              <SelectableAppTile
                key={key}
                tokenKey={key}
                selected={selected.includes(key)}
                onToggle={() => toggle(key)}
              />
            ))}
          </ScrollView>

          <PressableScale
            testID="unlock-apps-continue"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.unlock_picker.continue')}
            accessibilityHint={t('blocking.unlock_picker.selected', {
              count: selected.length,
            })}
            accessibilityState={{ disabled: pending || selected.length === 0 }}
            disabled={pending || selected.length === 0}
            onPress={() => onConfirm(selected)}
            style={[
              styles.confirm,
              (pending || selected.length === 0) && styles.confirmDisabled,
            ]}
          >
            <BrandActionSurface />
            <Text style={styles.confirmLabel}>
              {t('blocking.unlock_picker.continue')}
            </Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('blocking.unlock_picker.cancel')}
            disabled={pending}
            onPress={close}
            style={styles.cancel}
          >
            <Text style={styles.cancelLabel}>
              {t('blocking.unlock_picker.cancel')}
            </Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.blockingImageChrome,
  },
  sheet: {
    maxHeight: '84%',
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radius.visual,
    borderTopRightRadius: radius.visual,
    backgroundColor: colors.blockingSheetSurface,
    shadowColor: shadow.panel.shadowColor,
    shadowOpacity: shadow.panel.shadowOpacity,
    shadowRadius: shadow.panel.shadowRadius,
    shadowOffset: shadow.panel.shadowOffset,
  },
  grabber: {
    alignSelf: 'center',
    width: spacing.xxxl,
    height: spacing.xxs,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingBorderStrong,
  },
  heading: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
    textAlign: 'center',
  },
  subtitle: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  selectAll: {
    alignSelf: 'center',
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingAccentTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
    marginTop: spacing.md,
  },
  selectAllLabel: {
    ...fonts.medium,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
  },
  gridViewport: {
    flexGrow: 0,
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxs,
  },
  tileSlot: {
    alignItems: 'center',
  },
  tile: {
    width: layout.blockingLockedTileSize,
    height: layout.blockingLockedTileSize,
    borderRadius: radius.panel,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingSurfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  tileSelected: {
    borderWidth: 2,
    borderColor: colors.blockingAccentLight,
    shadowColor: shadow.glow.shadowColor,
    shadowOpacity: shadow.glow.shadowOpacity,
    shadowRadius: shadow.glow.shadowRadius,
    shadowOffset: shadow.glow.shadowOffset,
  },
  tileScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingImageShade,
  },
  tileScrimSelected: {
    opacity: 0.2,
  },
  check: {
    position: 'absolute',
    right: spacing.xxs,
    bottom: spacing.xxs,
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingAccentLight,
  },
  confirm: {
    minHeight: layout.primaryActionHeight,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    marginTop: spacing.md,
    shadowColor: shadow.glow.shadowColor,
    shadowOpacity: shadow.glow.shadowOpacity,
    shadowRadius: shadow.glow.shadowRadius,
    shadowOffset: shadow.glow.shadowOffset,
  },
  confirmDisabled: {
    opacity: opacity.disabled,
  },
  confirmLabel: {
    ...fonts.semiBold,
    color: colors.onAccent,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  cancel: {
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxs,
  },
  cancelLabel: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
})
