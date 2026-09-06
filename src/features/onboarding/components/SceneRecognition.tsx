import React, { useEffect, useState } from 'react'
import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Moon, Pill } from '@/features/onboarding/bits'
import { OB, RECOGNITION } from '@/features/onboarding/tokens'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

/** A familiar situation, not a statistic or a measurement of the user's usage. */
export function SceneRecognition({ onNext }: { onNext: () => void }) {
  const [stage, setStage] = useState(0)
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  )
  const ready = stage === RECOGNITION.readingDelays.length

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setActive(state === 'active')
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    if (!active || ready) return
    const timer = setTimeout(
      () => setStage(value => value + 1),
      RECOGNITION.readingDelays[stage],
    )
    return () => clearTimeout(timer)
  }, [active, ready, stage])

  return (
    <View testID="onboarding-recognition" style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Moon size={RECOGNITION.moonSize} glow />
        </View>
        <ReadingBeat visible={stage >= 1} testID="recognition-intro">
          <Text style={styles.intro}>Tu ouvres TikTok pour deux minutes.</Text>
        </ReadingBeat>
        <View style={styles.turn}>
          <ReadingBeat visible={stage >= 2} testID="recognition-look-up">
            <Text style={styles.intro}>Tu relèves la tête.</Text>
          </ReadingBeat>
          <ReadingBeat visible={stage >= 3} testID="recognition-elapsed">
            <Text accessibilityRole="header" style={styles.headline}>
              Deux heures ont passé.
            </Text>
          </ReadingBeat>
        </View>
        <ReadingBeat visible={stage >= 4} testID="recognition-question">
          <Text style={styles.question}>Tu connais ce moment ?</Text>
        </ReadingBeat>
      </ScrollView>
      <View style={styles.footer}>
        <ReadingBeat visible={ready} testID="recognition-continue">
          <Pill
            label="Ça me parle"
            disabled={!ready}
            onPress={() => {
              if (ready) onNext()
            }}
          />
        </ReadingBeat>
      </View>
    </View>
  )
}

/** Invisible beats keep their layout but cannot be touched or read by VoiceOver. */
function ReadingBeat({
  visible,
  testID,
  children,
}: {
  visible: boolean
  testID: string
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reducedMotion ? 0 : RECOGNITION.revealDuration,
      easing: Easing.out(Easing.cubic),
    })
  }, [visible, reducedMotion, progress])
  const animation = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: reducedMotion ? 0 : (1 - progress.value) * spacing.sm },
    ],
  }))
  return (
    <Animated.View
      testID={testID}
      style={animation}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xxl,
  },
  intro: {
    ...fonts.medium,
    fontSize: RECOGNITION.introSize,
    lineHeight: RECOGNITION.introLineHeight,
    color: OB.ink70,
    textAlign: 'center',
  },
  turn: { gap: spacing.xs },
  headline: {
    ...fonts.bold,
    fontSize: RECOGNITION.titleSize,
    lineHeight: RECOGNITION.titleLineHeight,
    color: OB.accent,
    textAlign: 'center',
  },
  question: {
    ...fonts.regular,
    fontSize: RECOGNITION.questionSize,
    lineHeight: RECOGNITION.questionLineHeight,
    color: OB.ink70,
    textAlign: 'center',
  },
  footer: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
})
