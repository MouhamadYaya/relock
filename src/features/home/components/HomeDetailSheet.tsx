import { IconName } from '@assets/icons'
import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, typography } = relockMaterial

interface Props {
  visible: boolean
  title: string
  closeLabel: string
  onClose: () => void
  children: React.ReactNode
}

export function HomeDetailSheet({
  visible,
  title,
  closeLabel,
  onClose,
  children,
}: Props) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()

  const close = () => {
    // Refermer est un retrait : plus discret que l'ouverture, toujours.
    haptics.graze()
    onClose()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={close}
          style={styles.backdrop}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}
        >
          <View style={styles.handle} accessibilityElementsHidden />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              hitSlop={spacing.sm}
              onPress={close}
              style={styles.close}
            >
              <IconSvg
                name={IconName.CLOSE}
                size={layout.headerIconSize}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.homeModalBackdrop,
  },
  sheet: {
    width: '100%',
    maxWidth: layout.homeSheetMaxWidth,
    maxHeight: '82%',
    alignSelf: 'center',
    backgroundColor: colors.homeCanvasRaised,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
    paddingHorizontal: layout.homeSheetPadding,
    paddingTop: spacing.xs,
  },
  handle: {
    width: spacing.xxxxl,
    height: spacing.xxs,
    alignSelf: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeProgressTrack,
    marginBottom: spacing.md,
  },
  header: {
    minHeight: layout.homeHeaderActionSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...fonts.bold,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeSheetTitleSize,
    lineHeight: typography.homeSheetTitleLineHeight,
    letterSpacing: typography.homeGreetingLetterSpacing,
  },
  close: {
    width: layout.homeHeaderActionSize,
    height: layout.homeHeaderActionSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
})
