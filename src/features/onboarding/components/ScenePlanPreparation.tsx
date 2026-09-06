import { IconName } from '@assets/icons'
import React, { useEffect, useRef, useState } from 'react'
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { ANTI_SCROLL_PLAN } from '@/features/onboarding/services/antiScrollPlan'
import {
  haptic,
  OB,
  PERSONALIZED_PLAN as PLAN,
  PLAN_PREPARATION as PREP,
} from '@/features/onboarding/tokens'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { relockMaterial } from '@/shared/theme/tokens/relock-material'
import { spacing } from '@/shared/theme/tokens/spacing'

/** A guided preparation sequence, not a scan or a measurement of the phone. */
export function ScenePlanPreparation({ onDone }: { onDone: () => void }) {
  const { height } = useWindowDimensions()
  const reducedMotion = useReducedMotion()
  const [pct, setPct] = useState(0)
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  )
  const elapsed = useRef(0)
  const completed = useRef(false)
  const latestDone = useRef(onDone)
  useEffect(() => {
    latestDone.current = onDone
  }, [onDone])
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    )
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (!active || elapsed.current >= PREP.duration) return
    const started = Date.now()
    const previous = elapsed.current
    const tick = () => {
      elapsed.current = Math.min(PREP.duration, previous + Date.now() - started)
      const raw = Math.round((elapsed.current / PREP.duration) * 100)
      // Reduced motion keeps discrete stage changes, with the same reading time.
      setPct(reducedMotion && raw < 100 ? Math.floor(raw / 25) * 25 : raw)
      if (raw === 100) clearInterval(timer)
    }
    const timer = setInterval(tick, PREP.tick)
    return () => clearInterval(timer)
  }, [active, reducedMotion])
  useEffect(() => {
    if (pct !== 100 || !active || completed.current) return
    const timer = setTimeout(() => {
      completed.current = true
      haptic.success()
      latestDone.current()
    }, PREP.completionHold)
    return () => clearTimeout(timer)
  }, [pct, active])

  const stage = Math.min(
    ANTI_SCROLL_PLAN.length - 1,
    Math.floor(pct / (100 / ANTI_SCROLL_PLAN.length)),
  )
  const compact = height < PLAN.compactHeight
  return (
    <ScrollView
      contentContainerStyle={[styles.content, compact && styles.compact]}
      testID="plan-preparation"
    >
      <View style={styles.heading}>
        <Text style={styles.percentage}>{pct}%</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, compact && styles.titleCompact]}
        >
          On prépare ton{'\n'}plan anti-scroll.
        </Text>
      </View>
      <View style={styles.progressBlock}>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Préparation du plan"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <Svg width="100%" height={PREP.trackHeight}>
            <Defs>
              <LinearGradient
                id="plan-progress"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <Stop offset="0" stopColor={OB.grad[0]} />
                <Stop offset="0.55" stopColor={OB.grad[1]} />
                <Stop offset="1" stopColor={OB.grad[2]} />
              </LinearGradient>
            </Defs>
            <Rect
              testID="preparation-progress-fill"
              width={`${pct}%`}
              height={PREP.trackHeight}
              rx={PREP.trackHeight / 2}
              fill="url(#plan-progress)"
            />
          </Svg>
        </View>
        <Text style={styles.status} accessibilityLiveRegion="polite">
          {pct === 100 ? 'Tout est prêt.' : ANTI_SCROLL_PLAN[stage].preparing}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ce que ton plan va t’aider à faire</Text>
        {ANTI_SCROLL_PLAN.map((action, index) => {
          const done = pct === 100 || index < stage
          const current = index === stage && pct < 100
          return (
            <View
              key={action.id}
              style={styles.row}
              accessible
              accessibilityLabel={`${action.title} : ${done ? 'prêt' : current ? 'en préparation' : 'à venir'}`}
            >
              <View
                style={[
                  styles.marker,
                  (done || current) && styles.markerActive,
                ]}
              >
                {done ? (
                  <IconSvg
                    name={IconName.CHECK}
                    size={PLAN.iconSize}
                    color={OB.accent}
                  />
                ) : (
                  <Text style={[styles.number, current && styles.numberActive]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[styles.rowText, (done || current) && styles.rowActive]}
              >
                {action.title}
              </Text>
            </View>
          )
        })}
      </View>
      <Text style={styles.note}>Aucun nouveau blocage n’est activé ici.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
    gap: spacing.xxxl,
  },
  compact: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.xl,
  },
  heading: { gap: spacing.lg },
  percentage: {
    ...fonts.bold,
    fontSize: PREP.percentageSize,
    lineHeight: PREP.percentageLineHeight,
    color: OB.ink,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
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
  progressBlock: { gap: spacing.lg },
  track: {
    height: PREP.trackHeight,
    borderRadius: relockMaterial.radius.capsule,
    overflow: 'hidden',
    backgroundColor: OB.card2,
  },
  status: {
    ...fonts.medium,
    fontSize: PLAN.bodySize,
    lineHeight: PLAN.bodyLineHeight,
    color: OB.ink70,
    textAlign: 'center',
  },
  card: {
    padding: spacing.xl,
    gap: spacing.lg,
    borderRadius: relockMaterial.radius.panel,
    backgroundColor: OB.card,
  },
  cardTitle: {
    ...fonts.semiBold,
    fontSize: PLAN.bodySize,
    lineHeight: PLAN.bodyLineHeight,
    color: OB.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  marker: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: relockMaterial.radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.card2,
  },
  markerActive: { backgroundColor: OB.accentDim },
  number: { ...fonts.medium, fontSize: PLAN.captionSize, color: OB.ink70 },
  numberActive: { color: OB.accent },
  rowText: {
    flex: 1,
    ...fonts.medium,
    fontSize: PLAN.bodySize,
    lineHeight: PLAN.bodyLineHeight,
    color: OB.ink70,
  },
  rowActive: { color: OB.ink },
  note: {
    ...fonts.regular,
    fontSize: PLAN.captionSize,
    lineHeight: PLAN.captionLineHeight,
    color: OB.ink70,
    textAlign: 'center',
  },
})
