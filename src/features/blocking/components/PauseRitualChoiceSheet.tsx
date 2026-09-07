import { IconName } from '@assets/icons'
import React, { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  PAUSE_RITUALS,
  type PauseRitual,
} from '@/shared/services/storage/app-preferences'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'
import { RITUAL_COPY } from '../services/pause-ritual/ritual-copy'
import { type PauseRitualPalette, PauseRitualTile } from './PauseRitualGlyphs'

const { colors, layout, radius, typography } = relockMaterial

const PALETTE: PauseRitualPalette = {
  surface: colors.blockingSheetCard,
  border: colors.blockingBorder,
  borderSelected: colors.blockingAccentLight,
  glyph: colors.blockingInkMuted,
  glyphSelected: colors.blockingAccentLight,
  check: colors.blockingAccentLight,
  checkMark: colors.blockingSheetCard,
}

/**
 * Combien de temps la confirmation reste affichée avant que la feuille se
 * referme. Assez pour lire une ligne, assez court pour ne pas retenir
 * quelqu'un qui a déjà compris.
 */
const CONFIRM_MS = 1600

/**
 * Le choix de l'écran de blocage, ouvert DEPUIS une pause.
 *
 * Ce n'est pas une `Modal` : elle serait imbriquée dans celle de la pause, ce
 * qu'iOS n'anime correctement qu'au prix d'un aller-retour visible (la
 * première se referme, la seconde s'ouvre). C'est un calque posé à
 * l'intérieur de la pause — un seul écran, une seule couche.
 *
 * Le choix n'interrompt PAS la pause en cours, et c'est délibéré : si changer
 * d'écran remettait le compteur à zéro sur un écran plus court, il suffirait
 * de basculer sur la respiration pour effacer trois calculs déjà faits. La
 * pause en cours va donc à son terme — d'où la confirmation explicite, qui
 * existe parce que rien ne bouge derrière la feuille : sans elle, le choix
 * aurait l'air de n'avoir servi à rien.
 */
export function PauseRitualChoiceSheet({
  current,
  picked,
  onPick,
  onClose,
}: {
  /** L'écran affiché, celui de la pause en cours. */
  current: PauseRitual
  /** L'écran enregistré — celui qui s'appliquera ensuite. */
  picked: PauseRitual
  onPick: (ritual: PauseRitual) => void
  onClose: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [confirmed, setConfirmed] = useState<PauseRitual | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const select = (ritual: PauseRitual) => {
    haptics.selectionTick()
    onPick(ritual)
    // Retoucher l'écran déjà retenu n'annonce rien de neuf : on referme.
    if (ritual === picked) {
      onClose()
      return
    }
    setConfirmed(ritual)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(onClose, CONFIRM_MS)
  }

  const highlighted = confirmed ?? picked

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        onPress={onClose}
        style={styles.scrim}
      />

      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs },
        ]}
      >
        <View style={styles.grabber} />

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              {t('blocking.pause_ritual.sheet_title')}
            </Text>
            <Text style={styles.subtitle}>
              {t('blocking.pause_ritual.sheet_body')}
            </Text>
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={styles.closeAction}
          >
            <IconSvg
              name={IconName.CLOSE}
              size={spacing.md}
              color={colors.textPrimary}
            />
          </PressableScale>
        </View>

        <View style={styles.row}>
          {PAUSE_RITUALS.map(ritual => {
            const selected = ritual === highlighted
            return (
              <PressableScale
                key={ritual}
                testID={`pause-ritual-option-${ritual}`}
                accessibilityRole="radio"
                accessibilityLabel={t(RITUAL_COPY[ritual].title)}
                accessibilityHint={t(RITUAL_COPY[ritual].description)}
                accessibilityState={{ selected }}
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
                  style={[styles.optionName, selected && styles.optionNameOn]}
                >
                  {t(RITUAL_COPY[ritual].title)}
                </Text>
              </PressableScale>
            )
          })}
        </View>

        {/*
          La description ne s'affiche que pour l'écran retenu. Trois
          descriptions côte à côte sous trois vignettes étroites redonnaient
          exactement le mur de texte qu'on cherche à éviter ; une seule ligne,
          sous la rangée, dit ce qu'il faut au moment où on hésite.
        */}
        <Text
          accessibilityLiveRegion="polite"
          numberOfLines={2}
          style={styles.description}
        >
          {t(RITUAL_COPY[highlighted].description)}
        </Text>

        {confirmed ? (
          <View testID="pause-ritual-confirmation" style={styles.confirmation}>
            <IconSvg
              name={IconName.CHECK}
              size={spacing.md}
              strokeWidth={2.4}
              color={colors.blockingAccentLight}
            />
            <Text
              testID="pause-ritual-confirmation-label"
              style={styles.confirmationLabel}
            >
              {t('blocking.pause_ritual.confirmed', {
                ritual: t(RITUAL_COPY[confirmed].title),
              })}
            </Text>
          </View>
        ) : (
          <Text style={styles.footnote}>
            {current === picked
              ? t('blocking.pause_ritual.applies_next')
              : t('blocking.pause_ritual.confirmed', {
                  ritual: t(RITUAL_COPY[picked].title),
                })}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingModalBackdrop,
  },
  sheet: {
    marginTop: 'auto',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    backgroundColor: colors.blockingSheetSurface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
  },
  grabber: {
    alignSelf: 'center',
    width: spacing.xxxl,
    height: spacing.xxs,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingGlassBright,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  subtitle: {
    ...fonts.regular,
    maxWidth: layout.contentMaxWidth,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    marginTop: spacing.xxs,
  },
  closeAction: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingGlass,
  },
  // Trois colonnes de largeur égale : les vignettes gardent leur silhouette
  // de téléphone quel que soit l'appareil, et les noms restent alignés.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  option: { flex: 1 },
  optionName: {
    ...fonts.medium,
    color: colors.textSecondary,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  optionNameOn: { ...fonts.semiBold, color: colors.textPrimary },
  description: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  // La confirmation prend la place de la légende — même hauteur, même bloc :
  // la feuille ne saute pas au moment où elle apparaît.
  confirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingAccentTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
  },
  confirmationLabel: {
    ...fonts.semiBold,
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
  },
  footnote: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },
})
