import React from 'react'
import {
  Modal,
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SheetBloom } from '@/features/blocking/components/BlockingSurfaces'
import { relockMaterial } from '@/shared/theme'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, radius, shadow } = relockMaterial

/**
 * La coque commune des feuilles de blocage : fond assombri qui referme au tap,
 * demi-feuille arrondie, poignée, et le halo violet de la marque.
 *
 * Elle existe pour que deux feuilles ne puissent pas diverger sur leur
 * matière — c'est la feuille qui dit « Relock », pas son contenu.
 */
export function BlockingSheet({
  visible,
  dismissible = true,
  bloom = true,
  onClose,
  children,
  style,
}: {
  visible: boolean
  /** Une décision qui engage ne se referme PAS d'un tap à côté. */
  dismissible?: boolean
  bloom?: boolean
  onClose: () => void
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const insets = useSafeAreaInsets()

  const close = () => {
    if (dismissible) onClose()
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
            style,
          ]}
        >
          {bloom ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <SheetBloom />
            </View>
          ) : null}
          <View style={styles.grabber} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.blockingModalBackdrop,
  },
  sheet: {
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
})
