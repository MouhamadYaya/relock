import { IconName } from '@assets/icons'
import React, { useEffect, useState } from 'react'
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Pill } from '@/features/onboarding/bits'
import { ANTI_SCROLL_PLAN } from '@/features/onboarding/services/antiScrollPlan'
import { recoveryGoal } from '@/features/onboarding/services/recoveryGoal'
import { OB, PERSONALIZED_PLAN as PLAN } from '@/features/onboarding/tokens'
import type { PersonalizedPlan } from '@/features/onboarding/types/personalizedPlan'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { relockMaterial } from '@/shared/theme/tokens/relock-material'
import { spacing } from '@/shared/theme/tokens/spacing'

const ACTION_ICONS = {
  block: IconName.LOCK,
  pause: IconName.CLOCK,
  progress: IconName.CHART,
}

export function ScenePersonalizedPlan({
  plan,
  onNext,
}: {
  plan: PersonalizedPlan
  onNext: () => void
}) {
  const goal = recoveryGoal(plan.hours)
  const { height } = useWindowDimensions()
  const compact = height < PLAN.compactHeight
  const [stage, setStage] = useState(0)
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  )
  const [viewport, setViewport] = useState(0)
  const [content, setContent] = useState(0)
  const [offset, setOffset] = useState(0)
  const [readToEnd, setReadToEnd] = useState(false)
  const revealed = stage === PLAN.readingDelays.length
  const atEnd =
    viewport > 0 && content > 0 && offset + viewport >= content - spacing.xs
  const ready = revealed && readToEnd

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    )
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (!active || revealed) return
    const timer = setTimeout(
      () => setStage(value => value + 1),
      PLAN.readingDelays[stage],
    )
    return () => clearTimeout(timer)
  }, [active, revealed, stage])
  useEffect(() => {
    if (revealed && atEnd) setReadToEnd(true)
  }, [revealed, atEnd])

  return (
    <View style={styles.screen} testID="onboarding-personalized-plan">
      <ScrollView
        testID="plan-scroll"
        contentContainerStyle={[
          styles.content,
          compact && styles.contentCompact,
        ]}
        showsVerticalScrollIndicator={false}
        onLayout={event => setViewport(event.nativeEvent.layout.height)}
        onContentSizeChange={(_width, size) => setContent(size)}
        onScroll={event => setOffset(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        <PlanBeat visible={stage >= 1} testID="plan-title">
          <View style={styles.heading}>
            <View
              style={[styles.success, compact && styles.successCompact]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <IconSvg
                name={IconName.CHECK}
                size={PLAN.iconSize}
                color={OB.ink}
              />
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.title, compact && styles.titleCompact]}
            >
              Ton plan anti-scroll{'\n'}est prêt.
            </Text>
          </View>
        </PlanBeat>

        <PlanBeat visible={stage >= 2} testID="plan-goal">
          <View style={styles.goal}>
            <Text style={styles.eyebrow}>Objectif annuel</Text>
            <View style={[styles.goalPill, compact && styles.goalPillCompact]}>
              <Text style={styles.goalNumber}>{goal.days} jours pour toi</Text>
            </View>
            <Text style={styles.goalNote}>
              ≈ {goal.dailyTime} en moins par jour.{'\n'}
              {goal.exceedsUsage
                ? 'Cap non personnalisé, à adapter à ton usage.'
                : 'Un objectif, pas un gain garanti.'}
            </Text>
          </View>
        </PlanBeat>

        <PlanBeat visible={stage >= 3} testID="plan-actions">
          <View style={[styles.actions, compact && styles.actionsCompact]}>
            <Text style={styles.sectionTitle}>
              Moins de scroll. En 3 réflexes.
            </Text>
            {ANTI_SCROLL_PLAN.map(action => (
              <View key={action.id} style={styles.action}>
                <View
                  style={styles.icon}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <IconSvg
                    name={ACTION_ICONS[action.id]}
                    size={PLAN.iconSize}
                    color={OB.accent}
                  />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.caption}>{action.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </PlanBeat>
      </ScrollView>

      <View style={styles.footer}>
        <PlanBeat visible={stage >= 4} testID="plan-note">
          <Text style={styles.footerNote}>
            {revealed && !readToEnd
              ? 'Découvre la suite de ton plan en faisant défiler.'
              : 'Tu choisiras tes apps et tes blocages ensuite.'}
          </Text>
        </PlanBeat>
        <PlanBeat visible={revealed} testID="plan-continue">
          <Pill
            label="C’est parti"
            disabled={!ready}
            onPress={() => {
              if (ready) onNext()
            }}
          />
        </PlanBeat>
      </View>
    </View>
  )
}

function PlanBeat({
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
      duration: reducedMotion ? 0 : PLAN.revealDuration,
      easing: Easing.out(Easing.cubic),
    })
  }, [visible, reducedMotion, progress])
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: reducedMotion ? 0 : (1 - progress.value) * spacing.sm },
    ],
  }))
  return (
    <Animated.View
      testID={testID}
      style={style}
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
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    gap: spacing.xxl,
  },
  contentCompact: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  heading: { alignItems: 'center', gap: spacing.sm },
  successCompact: { width: spacing.xxl, height: spacing.xxl },
  success: {
    width: PLAN.successSize,
    height: PLAN.successSize,
    borderRadius: relockMaterial.radius.capsule,
    backgroundColor: OB.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...fonts.bold,
    fontSize: PLAN.titleSize,
    lineHeight: PLAN.titleLineHeight,
    color: OB.ink,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: PLAN.compactTitleSize,
    lineHeight: PLAN.compactTitleLineHeight,
  },
  eyebrow: {
    ...fonts.medium,
    fontSize: PLAN.bodySize,
    color: OB.ink70,
    textAlign: 'center',
  },
  goal: { alignItems: 'center', gap: spacing.xs },
  goalPillCompact: { paddingVertical: spacing.sm },
  goalPill: {
    alignSelf: 'stretch',
    borderRadius: relockMaterial.radius.capsule,
    backgroundColor: OB.accentDim,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  goalNumber: {
    ...fonts.bold,
    fontSize: PLAN.goalSize,
    color: OB.ink,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  goalNote: {
    ...fonts.regular,
    fontSize: PLAN.captionSize,
    lineHeight: PLAN.captionLineHeight,
    color: OB.ink70,
    textAlign: 'center',
  },
  actions: {
    padding: spacing.lg,
    borderRadius: relockMaterial.radius.panel,
    backgroundColor: OB.card,
    gap: spacing.md,
  },
  actionsCompact: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: { ...fonts.semiBold, fontSize: PLAN.bodySize, color: OB.ink },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: spacing.xxl, alignItems: 'center' },
  actionCopy: { flex: 1, gap: spacing.xxs },
  actionTitle: { ...fonts.semiBold, fontSize: PLAN.bodySize, color: OB.ink },
  caption: {
    ...fonts.regular,
    fontSize: PLAN.captionSize,
    lineHeight: PLAN.captionLineHeight,
    color: OB.ink70,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  footerNote: {
    ...fonts.regular,
    fontSize: PLAN.captionSize,
    lineHeight: PLAN.captionLineHeight,
    color: OB.ink70,
    textAlign: 'center',
  },
})
