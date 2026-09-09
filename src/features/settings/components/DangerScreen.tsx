import type { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SettingsHeader } from '@/features/settings/components/SettingsHeader'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { settingsTheme } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, radius, size, spacing, type } = settingsTheme

interface Props {
  /** Titre de la barre : court, il double le titre de la page. */
  headerTitle: string
  backLabel: string
  icon: IconName
  title: string
  intro: string
  /** Ce qui disparaît, une puce par ligne. */
  items: string[]
  /** Ce qu'il faut avoir lu avant d'agir — ou ce qui, au contraire, survit. */
  note: { label: string; icon: IconName; tone: 'warning' | 'keep' }
  ctaLabel: string
  cancelLabel: string
  busy?: boolean
  onConfirm: () => void
}

/**
 * Le patron des écrans irréversibles : réinitialisation, suppression de
 * compte.
 *
 * Chacun a son propre écran plutôt qu'une simple alerte. Une alerte pose la
 * question avant d'avoir rien expliqué : on y répond « Supprimer » sans
 * savoir ce que ça emporte. Ici on énumère ce qui disparaît, on dit ce qui NE
 * disparaît PAS — c'est souvent la seule différence entre deux actions qui se
 * ressemblent — et l'alerte ne reste que comme dernier cran.
 *
 * Le rouge est réservé à l'action elle-même. Le bloc d'avertissement est
 * ambre, le bloc « ce que tu gardes » est vert : trois rôles, trois couleurs,
 * jamais mélangés.
 */
export function DangerScreen({
  headerTitle,
  backLabel,
  icon,
  title,
  intro,
  items,
  note,
  ctaLabel,
  cancelLabel,
  busy,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets()
  const [pressedCta, setPressedCta] = React.useState(false)
  const [pressedCancel, setPressedCancel] = React.useState(false)
  const keeps = note.tone === 'keep'
  const accent = keeps ? colors.success : colors.danger

  return (
    <ScreenWrapper
      disableBottomInset
      backgroundColor={colors.bg}
      statusBarProps={{ backgroundColor: colors.bg }}
    >
      <SettingsHeader
        title={headerTitle}
        backLabel={backLabel}
        onBack={() => router.back()}
      />

      <View
        style={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.rowV },
        ]}
      >
        <View style={styles.mark}>
          <IconSvg
            name={icon}
            size={26}
            strokeWidth={size.iconStroke}
            color={colors.danger}
          />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.intro}>{intro}</Text>

        <View style={styles.card}>
          {items.map(item => (
            <View key={item} style={styles.item}>
              <View style={styles.bullet} />
              <Text style={styles.itemLabel}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.note, { borderColor: accent }]}>
          <IconSvg
            name={note.icon}
            size={size.icon}
            strokeWidth={size.iconStroke}
            color={accent}
          />
          <Text style={[styles.noteLabel, { color: accent }]}>
            {note.label}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            accessibilityState={{ busy }}
            disabled={busy}
            onPress={onConfirm}
            // Un écran de destruction : l'appui se sent d'abord, il se confirme
            // ensuite. Le coup est plus franc que le tic des lignes ordinaires.
            onPressIn={() => {
              setPressedCta(true)
              if (!busy) haptics.press()
            }}
            onPressOut={() => setPressedCta(false)}
            style={pressedCta ? styles.destructivePressed : styles.destructive}
          >
            {busy ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.destructiveLabel}>{ctaLabel}</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            disabled={busy}
            onPress={() => router.back()}
            onPressIn={() => {
              setPressedCancel(true)
              if (!busy) haptics.tap()
            }}
            onPressOut={() => setPressedCancel(false)}
            style={pressedCancel ? styles.secondaryPressed : styles.secondary}
          >
            <Text style={styles.secondaryLabel}>{cancelLabel}</Text>
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  )
}

/**
 * ⚠️ Aucun `style` en FONCTION ni en TABLEAU sur les `Pressable` : le style
 * était perdu à l'exécution et la vue retombait sur `flexDirection: 'column'`.
 * Voir la note détaillée dans `SettingsRow`.
 */
const BUTTON = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  minHeight: 54,
  borderRadius: radius.pill,
}
const DESTRUCTIVE = { ...BUTTON, backgroundColor: colors.danger }
const SECONDARY = {
  ...BUTTON,
  marginTop: 10,
  borderWidth: size.hairline,
  borderColor: colors.cardBorder,
  backgroundColor: colors.card,
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.rowV,
  },

  mark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 18,
  },
  intro: {
    color: colors.textSecondary,
    fontSize: type.rowTitle.size,
    fontWeight: '400',
    lineHeight: 23,
    marginTop: 8,
  },
  card: {
    marginTop: spacing.rowV + 4,
    padding: spacing.rowH,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    marginRight: 12,
  },
  itemLabel: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: type.rowValue.size,
    fontWeight: '500',
  },
  note: {
    flexDirection: 'row',
    marginTop: spacing.rowV,
    padding: 14,
    borderRadius: radius.card - 6,
    borderWidth: size.hairline,
    backgroundColor: colors.card,
  },
  noteLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: type.rowSubtitle.size,
    fontWeight: '400',
    lineHeight: type.rowSubtitle.lineHeight,
  },
  actions: { marginTop: 'auto', paddingTop: spacing.rowV },
  destructive: DESTRUCTIVE,
  destructivePressed: { ...DESTRUCTIVE, opacity: 0.7 },
  destructiveLabel: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: '600',
  },
  secondary: SECONDARY,
  secondaryPressed: { ...SECONDARY, opacity: 0.7 },
  secondaryLabel: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: '600',
  },
})
