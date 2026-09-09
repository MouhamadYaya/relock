import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  type PauseRitualPalette,
  PauseRitualTile,
} from '@/features/blocking/components/PauseRitualGlyphs'
import { RITUAL_COPY } from '@/features/blocking/services/pause-ritual/ritual-copy'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  PAUSE_RITUALS,
  type PauseRitual,
} from '@/shared/services/storage/app-preferences'
import { usePreferences } from '@/shared/stores/preferences.store'
import { settingsTheme } from '@/shared/theme'

const { colors, spacing, type } = settingsTheme

/**
 * La vignette porte la FORME (silhouette de téléphone, symbole) ; les
 * Réglages lui donnent leurs couleurs. C'est ce qui permet au même sélecteur
 * d'exister ici et pendant une pause sans que l'un des deux écrans emprunte
 * le système visuel de l'autre.
 */
const PALETTE: PauseRitualPalette = {
  surface: colors.card,
  border: colors.cardBorder,
  borderSelected: colors.accent,
  glyph: colors.icon,
  glyphSelected: colors.accent,
  check: colors.accent,
  checkMark: colors.textPrimary,
}

/**
 * Le choix de l'écran de blocage, depuis les Réglages.
 *
 * Ce n'est volontairement PAS une liste de `SettingsRow` : « Calcul mental »
 * et « Recopier un texte » ne disent pas ce qu'on verra, et se tromper ne se
 * découvre alors qu'au prochain blocage — au pire moment, quand on est déjà
 * en train de résister à une envie. Trois silhouettes de téléphone côte à
 * côte se comprennent sans être lues, et ce sont les MÊMES que celles
 * proposées pendant une pause : un seul sélecteur, appris une fois.
 */
export default function PauseRitualPickerModal() {
  const t = useT()
  const current = usePreferences(state => state.pauseRitual)
  const setPauseRitual = usePreferences(state => state.setPauseRitual)

  const close = useCallback(() => router.back(), [])

  const select = useCallback(
    (ritual: PauseRitual) => {
      setPauseRitual(ritual)
      // La ligne des Réglages affiche le nom de l'écran retenu : de retour,
      // elle EST la confirmation. Pas besoin d'en ajouter une ici.
      router.back()
    },
    [setPauseRitual],
  )

  return (
    <SettingsSheet
      title={t('settings.pause_ritual.label')}
      closeLabel={t('common.close')}
      onClose={close}
    >
      <View style={styles.body}>
        <View style={styles.row}>
          {PAUSE_RITUALS.map(ritual => {
            const selected = ritual === current
            return (
              <PressableScale
                key={ritual}
                testID={`settings-pause-ritual-${ritual}`}
                accessibilityRole="radio"
                accessibilityLabel={t(RITUAL_COPY[ritual].title)}
                accessibilityHint={t(RITUAL_COPY[ritual].description)}
                accessibilityState={{ selected }}
                haptic="select"
                onPress={() => select(ritual)}
                style={styles.option}
              >
                <PauseRitualTile
                  ritual={ritual}
                  selected={selected}
                  palette={PALETTE}
                />
                <Text
                  numberOfLines={2}
                  style={[styles.name, selected && styles.nameOn]}
                >
                  {t(RITUAL_COPY[ritual].title)}
                </Text>
              </PressableScale>
            )
          })}
        </View>

        {/* Seul l'écran retenu est décrit : trois descriptions sous trois
            vignettes étroites redonnent le mur de texte qu'on évite ici. */}
        <Text style={styles.description}>
          {t(RITUAL_COPY[current].description)}
        </Text>
      </View>
    </SettingsSheet>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.rowH },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.trailingGap,
  },
  option: { flex: 1 },
  name: {
    color: colors.textSecondary,
    fontSize: type.rowSubtitle.size,
    fontWeight: type.rowSubtitle.weight,
    lineHeight: type.rowSubtitle.lineHeight,
    textAlign: 'center',
    marginTop: spacing.textGap * 2,
  },
  nameOn: { color: colors.textPrimary, fontWeight: type.rowTitle.weight },
  description: {
    color: colors.textTertiary,
    fontSize: type.caption.size,
    fontWeight: type.caption.weight,
    lineHeight: type.caption.lineHeight,
    textAlign: 'center',
    marginTop: spacing.rowV,
  },
})
