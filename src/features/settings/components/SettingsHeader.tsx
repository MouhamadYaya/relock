import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { settingsTheme } from '@/shared/theme'

const { colors, radius, size, spacing, type } = settingsTheme

interface Props {
  title: string
  backLabel: string
  onBack: () => void
}

/**
 * L'entête des Réglages : une barre de navigation, rien de plus.
 *
 * Le titre est PETIT et centré. La version précédente affichait un grand
 * titre de 32 pt qui écrasait la première section et se désalignait du bouton
 * retour ; un écran de réglages n'a pas besoin d'annoncer son nom en grand,
 * on y arrive toujours en sachant où l'on va. La hiérarchie appartient aux
 * titres de section, qui eux structurent vraiment la page.
 */
export function SettingsHeader({ title, backLabel, onBack }: Props) {
  return (
    <View style={styles.bar}>
      {/*
        Le retour porte le même relief que tous les boutons de l'app : tic
        haptique dès le TOUCHER, pastille qui s'enfonce, halo violet qui
        éclôt dessous. `PressableScale` s'en charge — c'est aussi lui qui
        remplace l'ancien état `pressed` tenu à la main ici.
      */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={8}
        haptic="graze"
        onPress={onBack}
        shadow
        style={styles.back}
      >
        <IconSvg
          name={IconName.BACK}
          size={size.chevron}
          strokeWidth={size.iconStroke}
          color={colors.textPrimary}
        />
      </PressableScale>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      {/* Contrepoids exact du bouton : sans lui, le titre serait centré sur
          l'espace restant, donc décalé vers la droite. */}
      <View style={styles.spacer} />
    </View>
  )
}

/**
 * ⚠️ Aucun `style` en FONCTION sur les `Pressable` de cet écran : à
 * l'exécution, le style était purement et simplement perdu, la vue retombait
 * sur `flexDirection: 'column'` (le défaut de React Native) et tout le contenu
 * s'empilait à gauche. Invisible sous `react-test-renderer`, qui résout le
 * style-fonction correctement — voir `SettingsRow`.
 */
const BACK_LAYOUT = {
  width: spacing.headerH,
  height: spacing.headerH,
  borderRadius: radius.pill,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  backgroundColor: colors.control,
  borderWidth: size.hairline,
  borderColor: colors.controlBorder,
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    height: spacing.headerH,
  },
  back: BACK_LAYOUT,
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: type.screenTitle.size,
    fontWeight: type.screenTitle.weight,
  },
  spacer: { width: spacing.headerH },
})
