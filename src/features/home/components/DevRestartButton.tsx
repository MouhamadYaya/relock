import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { resetOnboarding } from '@/session/bootstrap'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial

/**
 * DEV uniquement : relance tout le parcours (onboarding compris) sans avoir à
 * désinstaller l'app. `__DEV__` est une constante remplacée à la compilation —
 * en release la fonction rend `null` et le minifieur élimine le reste : le
 * bouton n'existe pas dans le binaire distribué.
 *
 * Le libellé reste en dur, hors i18n : ce n'est pas de la copie produit (jamais
 * vue par un utilisateur), et une clé de debug polluerait les trois locales.
 */
export function DevRestartButton() {
  if (!__DEV__) return null
  return (
    <Pressable
      testID="dev-restart"
      accessibilityRole="button"
      accessibilityLabel="Restart dev"
      accessibilityHint="Réinitialise l'onboarding et rejoue le parcours complet"
      hitSlop={spacing.xs}
      onPress={resetOnboarding}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>restart · dev</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    marginTop: layout.homeCardGap,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.alertBorder,
  },
  pressed: { opacity: 0.6 },
  label: {
    ...fonts.medium,
    color: colors.textTertiary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
  },
})
