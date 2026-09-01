import React from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native'
import {
  EdgeInsets,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context'
import { FocusAwareStatusBar } from '@/shared/components/ui/FocusAwareStatusBar'
import type { ThemedStatusBarProps } from '@/shared/components/ui/ThemedStatusBar'
import { useTheme } from '@/shared/theme'

interface Props {
  children?: React.ReactNode
  scroll?: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
  disableTopInset?: boolean
  disableBottomInset?: boolean
  /** Merged over theme defaults (e.g. `translucent` + transparent `backgroundColor`). */
  statusBarProps?: Partial<ThemedStatusBarProps>
  /** Optional semantic canvas override for visually distinct feature screens. */
  backgroundColor?: string
}

export function ScreenWrapper({
  children,
  scroll = false,
  header,
  footer,
  disableTopInset = false,
  disableBottomInset = false,
  statusBarProps,
  backgroundColor,
}: Props) {
  const { theme } = useTheme()
  const insets: EdgeInsets = useSafeAreaInsets()

  const bg = backgroundColor ?? theme.colors.background

  // Top inset: applied once via SafeAreaView edges (not duplicated on Content).
  const safeEdges = disableTopInset
    ? (['left', 'right'] as const)
    : (['top', 'left', 'right'] as const)
  const paddingBottom = disableBottomInset ? 0 : insets.bottom

  const Content = scroll ? ScrollView : View

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: bg }]}
      edges={safeEdges}
    >
      <FocusAwareStatusBar backgroundColor={bg} {...statusBarProps} />

      {header ? <View style={styles.header}>{header}</View> : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Content
          style={[styles.container, { backgroundColor: bg, paddingBottom }]}
          contentContainerStyle={scroll ? styles.scrollContent : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </Content>
      </KeyboardAvoidingView>

      {footer ? (
        <SafeAreaView
          style={[styles.footer, { backgroundColor: bg }]}
          edges={['bottom']}
        >
          {footer}
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  // Colonne de contenu bornée + centrée sur grand écran (iPad). Sans effet
  // sur iPhone (largeur écran < maxWidth).
  container: { flex: 1, width: '100%', maxWidth: 540, alignSelf: 'center' },
  header: { width: '100%' },
  footer: { width: '100%' },
  scrollContent: { flexGrow: 1 },
})
