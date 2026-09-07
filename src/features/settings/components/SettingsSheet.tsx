import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { settingsTheme } from '@/shared/theme'

const { colors, radius, size, spacing, type } = settingsTheme

interface Props {
  title: string
  closeLabel: string
  onClose: () => void
  children: React.ReactNode
}

/**
 * La feuille de choix des Réglages : poignée, titre, une carte de lignes.
 *
 * Elle ne réinvente rien : les lignes qu'elle contient sont les `SettingsRow`
 * du reste de l'écran, avec les mêmes filets et le même alignement. La
 * version précédente empilait quatre gros boutons pleine largeur séparés par
 * des marges — ça ne ressemblait à aucune convention du système, et la coche
 * de sélection flottait sous l'élément choisi au lieu de se poser sur sa
 * ligne.
 *
 * Le voile est tapable et referme la feuille : c'est le geste qu'on tente
 * d'instinct, et le refuser fait chercher une croix qui n'existe pas.
 */
export function SettingsSheet({ title, closeLabel, onClose, children }: Props) {
  const insets = useSafeAreaInsets()

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        style={styles.scrim}
        onPress={onClose}
      />

      <View
        accessibilityViewIsModal
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.rowV }]}
      >
        <View style={styles.grabber} />
        <Text style={styles.title}>{title}</Text>

        {/*
          Une `View`, PAS un `ScrollView`.

          Un `ScrollView` placé dans un conteneur qui se dimensionne à son
          contenu (`justifyContent: 'flex-end'`, sans `flex`) s'effondre à
          une hauteur nulle : la feuille se montait, le voile couvrait
          l'écran, et il n'y avait rien à voir — un écran entièrement vide.
          Les listes de choix tiennent en quelques lignes courtes ; la
          feuille grandit donc avec son contenu, y compris aux grandes
          tailles de texte.
        */}
        <View style={styles.card}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: size.hairline,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.screenH,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
    marginBottom: 18,
  },
  title: {
    color: colors.textPrimary,
    fontSize: type.sheetTitle.size,
    fontWeight: type.sheetTitle.weight,
    marginBottom: spacing.titleGap,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
})
