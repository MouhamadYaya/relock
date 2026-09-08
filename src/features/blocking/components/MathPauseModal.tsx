import React, { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import type { PauseRitual } from '@/shared/services/storage/app-preferences'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'
import {
  formatMathChallenge,
  MATH_MAX_DIGITS,
  MATH_ROUNDS,
  type MathChallenge,
  nextMathChallenge,
} from '../services/pause-ritual/math-challenge'
import { PauseRitualShell } from './PauseRitualShell'

const { colors, layout, radius, typography } = relockMaterial

/** Le pavé : dix chiffres, un effacement, une validation. */
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/**
 * Le rituel « calcul mental ».
 *
 * Trois opérations justes d'affilée ouvrent la porte. La friction n'est pas
 * le temps qui passe — c'est l'attention qu'il faut détourner de l'envie pour
 * la poser sur un calcul. D'où deux partis pris :
 *
 *  - **Un pavé numérique maison, pas le clavier du système.** Le clavier
 *    couvre la moitié de l'écran, propose la saisie prédictive, et sur
 *    certains réglages un presse-papier. Ici, dix touches, aucune aide.
 *  - **Une erreur ne fait pas reculer.** Le compteur de manches ne redescend
 *    jamais : seule l'opération courante est retirée. Punir une faute de
 *    frappe transformerait la friction en piège, et un piège se contourne en
 *    supprimant le blocage.
 *
 * La coque (`PauseRitualShell`) porte le décor, la sortie et le changement de
 * rituel ; ce fichier ne s'occupe que du calcul.
 */
export function MathPauseModal({
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
  const reduceMotion = useReducedMotion()
  const [challenge, setChallenge] = useState<MathChallenge>(() =>
    nextMathChallenge(),
  )
  const [entry, setEntry] = useState('')
  const [solved, setSolved] = useState(0)
  const [wrong, setWrong] = useState(false)
  const shake = useSharedValue(0)

  // Chaque ouverture repart de zéro : une pause abandonnée puis reprise ne
  // doit pas hériter des manches déjà gagnées, sinon rouvrir l'app deux fois
  // suffit à franchir le rituel sans jamais le faire en entier.
  useEffect(() => {
    if (!visible) return
    setChallenge(nextMathChallenge())
    setEntry('')
    setSolved(0)
    setWrong(false)
  }, [visible])

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }))

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reanimated garantit l'identité stable des SharedValue.
  const reject = useCallback(() => {
    haptics.impactRigid()
    setWrong(true)
    setEntry('')
    setChallenge(current => nextMathChallenge(current))
    if (reduceMotion) return
    shake.value = withSequence(
      withTiming(-SHAKE_AMPLITUDE, { duration: 55, easing: Easing.linear }),
      withTiming(SHAKE_AMPLITUDE, { duration: 55, easing: Easing.linear }),
      withTiming(-SHAKE_AMPLITUDE / 2, { duration: 55, easing: Easing.linear }),
      withTiming(0, { duration: 55, easing: Easing.linear }),
    )
  }, [reduceMotion])

  const submit = useCallback(() => {
    if (entry.length === 0) return
    if (Number.parseInt(entry, 10) !== challenge.answer) {
      reject()
      return
    }
    haptics.selectionTick()
    setWrong(false)
    setEntry('')
    const done = solved + 1
    setSolved(done)
    if (done < MATH_ROUNDS) setChallenge(current => nextMathChallenge(current))
  }, [challenge.answer, entry, reject, solved])

  const ready = solved >= MATH_ROUNDS

  const press = (key: string) => {
    if (ready || entry.length >= MATH_MAX_DIGITS) return
    haptics.selectionTick()
    setWrong(false)
    setEntry(current => current + key)
  }

  const erase = () => {
    if (ready || entry.length === 0) return
    haptics.selectionTick()
    setWrong(false)
    setEntry(current => current.slice(0, -1))
  }

  return (
    <PauseRitualShell
      visible={visible}
      ritual={ritual}
      tokenKey={tokenKey}
      allApps={allApps}
      onClose={onCancel}
      pickedRitual={pickedRitual}
      onPickRitual={onPickRitual}
      actions={
        <>
          <PressableScale
            testID="math-continue"
            accessibilityRole="button"
            accessibilityLabel={
              ready
                ? t('blocking.breathing.continue')
                : t('blocking.math.remaining', { count: MATH_ROUNDS - solved })
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
                : t('blocking.math.remaining', { count: MATH_ROUNDS - solved })}
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
        {/* Les manches gagnées, en pastilles : trois points disent la
            progression sans qu'on ait à lire « 2 sur 3 ». */}
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('blocking.math.progress', {
            done: solved,
            total: MATH_ROUNDS,
          })}
          style={styles.progressDots}
        >
          {/* Trois pastilles fixes, jamais réordonnées : l'index EST l'identité. */}
          {Array.from({ length: MATH_ROUNDS }, (_, index) => (
            <View
              key={`round-${index}`}
              style={[styles.dot, index < solved && styles.dotDone]}
            />
          ))}
        </View>

        <Text style={styles.prompt}>
          {ready ? t('blocking.math.done') : t('blocking.math.prompt')}
        </Text>

        {ready ? null : (
          <Animated.View style={[styles.board, shakeStyle]}>
            <Text testID="math-expression" style={styles.expression}>
              {formatMathChallenge(challenge)}
            </Text>
            <View style={[styles.entry, wrong && styles.entryWrong]}>
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.entryValue, wrong && styles.entryValueWrong]}
              >
                {entry.length > 0 ? entry : '·'}
              </Text>
            </View>
            <Text style={styles.hint}>
              {wrong ? t('blocking.math.wrong') : t('blocking.math.hint')}
            </Text>
          </Animated.View>
        )}
      </View>

      {ready ? null : (
        <View style={styles.keypad}>
          {KEYS.map(key => (
            <PressableScale
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key}
              haptic="none"
              onPress={() => press(key)}
              style={styles.key}
            >
              <Text style={styles.keyLabel}>{key}</Text>
            </PressableScale>
          ))}
          <PressableScale
            testID="math-erase"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.math.erase')}
            haptic="none"
            onPress={erase}
            style={styles.key}
          >
            <Text style={styles.keyGlyph}>⌫</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="0"
            haptic="none"
            onPress={() => press('0')}
            style={styles.key}
          >
            <Text style={styles.keyLabel}>0</Text>
          </PressableScale>
          <PressableScale
            testID="math-submit"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.math.check')}
            accessibilityState={{ disabled: entry.length === 0 }}
            disabled={entry.length === 0}
            haptic="none"
            onPress={submit}
            style={[styles.key, styles.keySubmit]}
          >
            <Text style={styles.keyGlyph}>✓</Text>
          </PressableScale>
        </View>
      )}
    </PauseRitualShell>
  )
}

const SHAKE_AMPLITUDE = 9

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  progressDots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingGlass,
  },
  dotDone: { backgroundColor: colors.blockingAccentLight },
  prompt: {
    ...fonts.regular,
    maxWidth: layout.contentMaxWidth,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
  },
  board: { alignItems: 'center', gap: spacing.sm },
  expression: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.blockingTitleSize,
    lineHeight: typography.blockingTitleLineHeight,
    letterSpacing: typography.blockingTitleLetterSpacing,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  // Le champ de réponse : une ardoise, pas un champ de formulaire. Il ne
  // reçoit jamais le focus du système — rien à y coller, rien à y suggérer.
  entry: {
    minWidth: spacing.xxxxxl * 2.4,
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.functional,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  entryWrong: {
    backgroundColor: colors.blockingDangerTint,
    borderColor: colors.blockingDangerBorder,
  },
  entryValue: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    fontVariant: ['tabular-nums'],
  },
  entryValueWrong: { color: colors.blockingDangerBright },
  hint: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
    textAlign: 'center',
  },
  // Trois colonnes fixes : le pavé garde la même géométrie d'un appareil à
  // l'autre, donc la même mémoire musculaire.
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: layout.pauseKeyGap,
    marginBottom: spacing.md,
  },
  // `flexBasis: '30%'` + `flexGrow` : trois touches par rangée (3 × 30 % +
  // deux gouttières < 100 %), puis l'espace restant se répartit. Une largeur
  // en pourcentage fixe, elle, ne tient pas compte du `gap` et fait passer la
  // troisième touche à la ligne.
  key: {
    flexBasis: '30%',
    flexGrow: 1,
    height: layout.pauseKeyHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.functional,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  keySubmit: {
    backgroundColor: colors.blockingAccentTintStrong,
    borderColor: colors.blockingBorderStrong,
  },
  keyLabel: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    fontVariant: ['tabular-nums'],
  },
  keyGlyph: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
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
