import { IconName } from '@assets/icons'
import React, { useEffect, useState } from 'react'
import { ImageBackground, Modal, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  BlockedAppIcons,
  isBlockedAppIconsAvailable,
} from '@/shared/native/BlockedAppIcons'
import { ScreenTime } from '@/shared/native/screen-time'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial
const WAIT_SECONDS = 6
const WAIT_MS = WAIT_SECONDS * 1000
const BREATH_PHASE_MS = WAIT_MS / 2
const ORB_SIZE = spacing.xxxxxl * 5
const ORB_MAX_LIFT = spacing.md
const ORB_ECHO_MAX_LIFT = spacing.sm

export function BreathingPauseModal({
  visible,
  tokenKey,
  allApps = false,
  onCancel,
  onContinue,
}: {
  visible: boolean
  tokenKey?: string
  allApps?: boolean
  onCancel: () => void
  onContinue: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const [remaining, setRemaining] = useState(WAIT_SECONDS)
  const [ready, setReady] = useState(false)
  const [inhaling, setInhaling] = useState(true)
  const [soundOn, setSoundOn] = useState(false)
  const breath = useSharedValue(reduceMotion ? 1 : 0)
  const progress = useSharedValue(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reanimated garantit l'identité stable des SharedValue.
  useEffect(() => {
    if (!visible) return

    const startedAt = Date.now()
    const deadline = startedAt + WAIT_MS
    let active = true
    setRemaining(WAIT_SECONDS)
    setReady(false)
    setInhaling(true)
    setSoundOn(false)

    progress.value = 0
    breath.value = reduceMotion
      ? 1
      : withRepeat(
          withSequence(
            withTiming(1, {
              duration: BREATH_PHASE_MS,
              easing: Easing.inOut(Easing.cubic),
            }),
            withTiming(0, {
              duration: BREATH_PHASE_MS,
              easing: Easing.inOut(Easing.cubic),
            }),
          ),
          -1,
          false,
        )
    progress.value = withTiming(1, {
      duration: WAIT_MS,
      easing: Easing.linear,
    })

    ScreenTime.playCalmSound()
      .then(started => {
        if (active) setSoundOn(started)
      })
      .catch(() => {})

    const tick = () => {
      const now = Date.now()
      const left = Math.max(0, deadline - now)
      setRemaining(Math.ceil(left / 1000))
      const cycleElapsed = (now - startedAt) % WAIT_MS
      setInhaling(cycleElapsed < BREATH_PHASE_MS)
    }
    const timer = setInterval(tick, 100)
    const readyTimer = setTimeout(() => {
      setRemaining(0)
      setReady(true)
    }, WAIT_MS)
    tick()

    return () => {
      active = false
      clearInterval(timer)
      clearTimeout(readyTimer)
      cancelAnimation(breath)
      cancelAnimation(progress)
      ScreenTime.stopCalmSound().catch(() => {})
    }
  }, [reduceMotion, visible])

  const orbStyle = useAnimatedStyle(() => ({
    opacity: 0.8 + breath.value * 0.2,
    transform: [
      { translateY: -breath.value * ORB_MAX_LIFT },
      { scale: 0.68 + breath.value * 0.48 },
      { rotate: `${-5 + breath.value * 10}deg` },
    ],
  }))
  const orbEchoStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + breath.value * 0.12,
    transform: [
      { translateY: -breath.value * ORB_ECHO_MAX_LIFT },
      { scale: 0.62 + breath.value * 0.44 },
      { rotate: `${8 - breath.value * 16}deg` },
    ],
  }))
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  const close = () => {
    ScreenTime.stopCalmSound().catch(() => {})
    onCancel()
  }

  const continueToDuration = () => {
    if (!ready) return
    ScreenTime.stopCalmSound().catch(() => {})
    onContinue()
  }

  const toggleSound = async () => {
    if (soundOn) {
      await ScreenTime.stopCalmSound().catch(() => false)
      setSoundOn(false)
      return
    }
    const started = await ScreenTime.playCalmSound().catch(() => false)
    setSoundOn(started)
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      statusBarTranslucent
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      <ImageBackground
        accessibilityViewIsModal
        source={require('@assets/blocking/breathing-mountains.png')}
        resizeMode="cover"
        style={styles.root}
      >
        <View pointerEvents="none" style={styles.imageShade} />

        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.topBar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.breathing.cancel')}
              onPress={close}
              style={styles.roundAction}
            >
              <IconSvg
                name={IconName.CLOSE}
                size={spacing.lg}
                color={colors.textPrimary}
              />
            </PressableScale>

            <View pointerEvents="none" style={styles.appPill}>
              <View style={styles.appIcon}>
                {tokenKey && isBlockedAppIconsAvailable ? (
                  <BlockedAppIcons
                    tokenKey={tokenKey}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <IconSvg
                    name={IconName.LOCK}
                    size={spacing.lg}
                    color={colors.textPrimary}
                  />
                )}
              </View>
              <Text numberOfLines={1} style={styles.appPillLabel}>
                {allApps
                  ? t('blocking.breathing.all_apps')
                  : t('blocking.breathing.one_app')}
              </Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View pointerEvents="none" style={styles.orbStage}>
              <Animated.Image
                testID="breathing-mist-orb-echo"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                source={require('@assets/blocking/breathing-mist-orb-alpha.png')}
                resizeMode="contain"
                style={[styles.orbImage, orbEchoStyle]}
              />
              <Animated.Image
                testID="breathing-mist-orb"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                source={require('@assets/blocking/breathing-mist-orb-alpha.png')}
                resizeMode="contain"
                style={[styles.orbImage, orbStyle]}
              />
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.phase}>
              {reduceMotion
                ? t('blocking.breathing.slowly')
                : inhaling
                  ? t('blocking.breathing.inhale')
                  : t('blocking.breathing.exhale')}
            </Text>
            <Text style={styles.prompt}>{t('blocking.breathing.prompt')}</Text>
          </View>

          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                soundOn
                  ? t('blocking.breathing.sound_off')
                  : t('blocking.breathing.sound_on')
              }
              onPress={toggleSound}
              style={styles.soundAction}
            >
              <Text style={styles.soundLabel}>
                {soundOn
                  ? t('blocking.breathing.sound_off')
                  : t('blocking.breathing.sound_on')}
              </Text>
            </PressableScale>

            <PressableScale
              testID="breathing-continue"
              accessibilityRole="button"
              accessibilityLabel={
                ready
                  ? t('blocking.breathing.continue')
                  : t('blocking.breathing.wait', { count: remaining })
              }
              accessibilityState={{ disabled: !ready }}
              disabled={!ready}
              onPress={continueToDuration}
              style={[styles.continueAction, ready && styles.continueReady]}
            >
              {!ready ? (
                <Animated.View
                  pointerEvents="none"
                  style={[styles.continueProgress, progressStyle]}
                />
              ) : null}
              <Text
                style={[
                  styles.continueLabel,
                  ready && styles.continueLabelReady,
                ]}
              >
                {ready
                  ? t('blocking.breathing.continue')
                  : t('blocking.breathing.wait', { count: remaining })}
              </Text>
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.breathing.cancel')}
              onPress={close}
              style={styles.cancelAction}
            >
              <Text style={styles.cancelLabel}>
                {t('blocking.breathing.cancel')}
              </Text>
            </PressableScale>
          </View>
        </View>
      </ImageBackground>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.blockingCanvas,
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingImageShade,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    minHeight: spacing.xxxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roundAction: {
    width: spacing.xxxxl,
    height: spacing.xxxxl,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  appPill: {
    maxWidth: '72%',
    minHeight: spacing.xxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.sm,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  appIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.compact,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingSurfaceRaised,
  },
  appPillLabel: {
    ...fonts.medium,
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  orbStage: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  phase: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.blockingTitleSize,
    lineHeight: typography.blockingTitleLineHeight,
    letterSpacing: typography.blockingTitleLetterSpacing,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  prompt: {
    ...fonts.regular,
    maxWidth: layout.contentMaxWidth,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  actions: {
    alignItems: 'center',
  },
  soundAction: {
    minHeight: spacing.xxxxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
    marginBottom: spacing.sm,
  },
  soundLabel: {
    ...fonts.medium,
    color: colors.textSecondary,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
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
  continueProgress: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.blockingAccentMedium,
  },
  continueLabel: {
    ...fonts.semiBold,
    color: colors.textSecondary,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
    fontVariant: ['tabular-nums'],
  },
  continueLabelReady: {
    color: colors.onAccent,
  },
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
