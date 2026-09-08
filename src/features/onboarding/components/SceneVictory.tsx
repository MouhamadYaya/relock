import { IconName } from '@assets/icons'
import React, { useRef } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { Moon, Pill } from '@/features/onboarding/bits'
import { Reveal } from '@/features/onboarding/motion'
import { OB, VICTORY } from '@/features/onboarding/tokens'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

/** Confirmation de configuration, pas une affirmation de blocage immédiat. */
export function SceneVictory({ onDone }: { onDone: () => void }) {
  const t = useT()
  const { height } = useWindowDimensions()
  const finished = useRef(false)
  const compact = height < VICTORY.compactHeight

  return (
    <View style={styles.screen} testID="onboarding-victory">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <VictoryBeat index={0}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Moon
              size={compact ? VICTORY.compactMoonSize : VICTORY.moonSize}
              glow
            />
          </View>
        </VictoryBeat>
        <VictoryBeat index={1}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('onboarding_victory.title')}
          </Text>
          <Text style={styles.body}>{t('onboarding_victory.body')}</Text>
        </VictoryBeat>
        <VictoryBeat index={2}>
          <View style={styles.status}>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <IconSvg
                name={IconName.CHECK}
                size={VICTORY.iconSize}
                color={OB.accent}
              />
            </View>
            <Text style={styles.statusText}>
              {t('onboarding_victory.status')}
            </Text>
          </View>
          <Text style={styles.note}>{t('onboarding_victory.note')}</Text>
        </VictoryBeat>
      </ScrollView>
      <View style={styles.footer}>
        <Pill
          label={t('onboarding_victory.cta')}
          onPress={() => {
            if (finished.current) return
            finished.current = true
            onDone()
          }}
        />
      </View>
    </View>
  )
}

function VictoryBeat({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  const reduceMotion = useReducedMotion()
  return reduceMotion ? (
    <View style={styles.beat}>{children}</View>
  ) : (
    <Reveal index={index} style={styles.beat}>
      {children}
    </Reveal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: VICTORY.maxWidth,
    alignSelf: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xxl,
  },
  beat: { alignItems: 'center', alignSelf: 'stretch' },
  title: {
    ...fonts.bold,
    fontSize: VICTORY.titleSize,
    lineHeight: VICTORY.titleLineHeight,
    color: OB.ink,
    textAlign: 'center',
  },
  body: {
    ...fonts.medium,
    fontSize: VICTORY.bodySize,
    lineHeight: VICTORY.bodyLineHeight,
    color: OB.ink70,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  statusText: {
    ...fonts.semiBold,
    fontSize: VICTORY.captionSize,
    lineHeight: VICTORY.captionLineHeight,
    color: OB.accent,
    flexShrink: 1,
  },
  note: {
    ...fonts.regular,
    fontSize: VICTORY.captionSize,
    lineHeight: VICTORY.captionLineHeight,
    color: OB.ink70,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
})
