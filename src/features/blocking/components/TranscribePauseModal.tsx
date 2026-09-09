import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import type { PauseRitual } from '@/shared/services/storage/app-preferences'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'
import {
  isTranscriptionComplete,
  matchedLength,
  nextTranscribeIndex,
} from '../services/pause-ritual/transcribe-challenge'
import { PauseRitualShell } from './PauseRitualShell'

const { colors, layout, radius, typography } = relockMaterial

/**
 * Le rituel « recopier une phrase ».
 *
 * Deux détails font tout le dispositif, et aucun n'est décoratif :
 *
 *  - **Le modèle s'éclaire au fil de la frappe.** La part déjà juste passe en
 *    clair, le reste demeure gris. Sans ce repère, recopier soixante-dix
 *    caractères devient un jeu de piste — on relit trois fois pour retrouver
 *    où l'on en était, et l'effort se déplace de la saisie vers la recherche
 *    de sa place. Le premier écart arrête net l'éclaircissement : l'erreur se
 *    voit là où elle est, pas à la validation.
 *  - **Le collage est coupé** (`contextMenuHidden`). Le modèle est un `Text`
 *    non sélectionnable et le champ n'offre aucun menu : la phrase se tape,
 *    elle ne se transporte pas. Sans cela, le rituel dure deux secondes.
 *
 * L'auto-correction et l'auto-capitalisation sont désactivées pour la même
 * raison : ce qu'on tape doit être ce qui s'affiche, sinon l'échec vient du
 * clavier et non de l'utilisateur.
 */
export function TranscribePauseModal({
  visible,
  ritual,
  tokenKey,
  allApps = false,
  onCancel,
  onContinue,
  pickedRitual,
  onPickRitual,
}: {
  visible: boolean
  ritual: PauseRitual
  tokenKey?: string
  allApps?: boolean
  onCancel: () => void
  onContinue: () => void
  pickedRitual?: PauseRitual
  onPickRitual?: (next: PauseRitual) => void
}) {
  const t = useT()
  const [index, setIndex] = useState(() => nextTranscribeIndex())
  const [typed, setTyped] = useState('')
  const completed = useRef(false)

  /*
    Les phrases sont citées UNE À UNE, littéralement.

    `i18next-parser` tourne avec `keepRemoved: false` : toute clé qu'il ne
    voit pas écrite en clair dans le code disparaît des fichiers de langue au
    prochain `npm run i18n:all`. Une clé construite (`line_${n}`) serait donc
    silencieusement supprimée — et le rituel afficherait sa propre clé.
    `transcribe-challenge.test.ts` verrouille l'accord entre cette liste et
    `TRANSCRIBE_LINE_COUNT`.
  */
  const lines = useMemo(
    () => [
      t('blocking.transcribe.line_1'),
      t('blocking.transcribe.line_2'),
      t('blocking.transcribe.line_3'),
      t('blocking.transcribe.line_4'),
      t('blocking.transcribe.line_5'),
      t('blocking.transcribe.line_6'),
    ],
    [t],
  )
  const target = lines[index] ?? lines[0]

  // Chaque ouverture tire une nouvelle phrase et repart d'un champ vide :
  // reprendre une saisie déjà à moitié faite permettrait de franchir le
  // rituel en deux passages, sans jamais l'accomplir en entier.
  useEffect(() => {
    if (!visible) return
    setIndex(current => nextTranscribeIndex(current))
    setTyped('')
    completed.current = false
  }, [visible])

  const matched = matchedLength(target, typed)
  const ready = isTranscriptionComplete(target, typed)
  const drifted = matched < typed.length

  // Le succès se signale UNE fois : sans ce verrou, chaque frappe
  // supplémentaire sur une phrase déjà juste redéclenche le retour haptique.
  useEffect(() => {
    if (ready && !completed.current) {
      completed.current = true
      // La phrase est recopiée juste : la friction est levée, ça se félicite.
      haptics.success()
    } else if (!ready) {
      completed.current = false
    }
  }, [ready])

  return (
    <PauseRitualShell
      visible={visible}
      ritual={ritual}
      tokenKey={tokenKey}
      allApps={allApps}
      avoidKeyboard
      onClose={onCancel}
      pickedRitual={pickedRitual}
      onPickRitual={onPickRitual}
      actions={
        <>
          <PressableScale
            testID="transcribe-continue"
            accessibilityRole="button"
            accessibilityLabel={
              ready
                ? t('blocking.breathing.continue')
                : t('blocking.transcribe.incomplete')
            }
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={onContinue}
            style={[styles.continueAction, ready && styles.continueReady]}
          >
            <Text
              style={[styles.continueLabel, ready && styles.continueLabelReady]}
            >
              {ready
                ? t('blocking.breathing.continue')
                : t('blocking.transcribe.incomplete')}
            </Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('blocking.breathing.cancel')}
            onPress={onCancel}
            style={styles.cancelAction}
          >
            <Text style={styles.cancelLabel}>
              {t('blocking.breathing.cancel')}
            </Text>
          </PressableScale>
        </>
      }
    >
      <View style={styles.hero}>
        <Text style={styles.prompt}>
          {ready
            ? t('blocking.transcribe.done')
            : t('blocking.transcribe.prompt')}
        </Text>

        {/*
          Le modèle. `selectable` reste à sa valeur par défaut (faux) : un
          texte sélectionnable se copie, et se colle dans le champ juste en
          dessous.
        */}
        <View style={styles.model}>
          <Text testID="transcribe-model" style={styles.modelText}>
            <Text style={styles.modelDone}>{target.slice(0, matched)}</Text>
            <Text style={styles.modelTodo}>{target.slice(matched)}</Text>
          </Text>
        </View>

        <TextInput
          testID="transcribe-input"
          accessibilityLabel={t('blocking.transcribe.field')}
          accessibilityHint={target}
          value={typed}
          onChangeText={setTyped}
          multiline
          autoFocus={visible}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          // Pas de suggestion, pas de collage : la phrase se tape.
          contextMenuHidden
          textContentType="none"
          keyboardAppearance="dark"
          placeholder={t('blocking.transcribe.placeholder')}
          placeholderTextColor={colors.blockingInkMuted}
          style={[
            styles.input,
            drifted && styles.inputDrifted,
            ready && styles.inputReady,
          ]}
        />

        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {ready
            ? t('blocking.transcribe.match')
            : drifted
              ? t('blocking.transcribe.mismatch')
              : t('blocking.transcribe.progress', {
                  done: matched,
                  total: target.length,
                })}
        </Text>
      </View>
    </PauseRitualShell>
  )
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  prompt: {
    ...fonts.regular,
    maxWidth: layout.contentMaxWidth,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
  },
  model: {
    padding: spacing.md,
    borderRadius: radius.functional,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  modelText: {
    ...fonts.medium,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingSectionLineHeight,
    textAlign: 'center',
  },
  // Ce qui est déjà juste s'éclaire ; ce qui reste attend en gris.
  modelDone: { color: colors.blockingAccentLight },
  modelTodo: { color: colors.textSecondary },
  input: {
    ...fonts.regular,
    minHeight: spacing.xxxxxl * 1.6,
    maxHeight: spacing.xxxxxl * 2.4,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlignVertical: 'top',
    borderRadius: radius.functional,
    backgroundColor: colors.blockingSurfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  inputDrifted: { borderColor: colors.blockingDangerBorder },
  inputReady: { borderColor: colors.blockingAccentLight },
  status: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  continueAction: {
    width: '100%',
    minHeight: layout.primaryActionHeight,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  continueReady: {
    backgroundColor: colors.blockingAccent,
    borderColor: colors.blockingAccentLight,
  },
  continueLabel: {
    ...fonts.semiBold,
    color: colors.textSecondary,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  continueLabelReady: { color: colors.onAccent },
  cancelAction: {
    minWidth: spacing.xxxxxl * 2,
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxs,
  },
  cancelLabel: {
    ...fonts.medium,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
})
