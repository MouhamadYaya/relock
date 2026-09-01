import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useRef } from 'react'
import {
  type ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RuleTypeGlyphKind } from '@/features/blocking/components/BlockingGlyphs'
import { BlockingTypeCard } from '@/features/blocking/components/BlockingTypeCard'
import { HalfSheet } from '@/features/blocking/components/HalfSheet'
import { RuleTemplateCard } from '@/features/blocking/components/RuleTemplateCard'
import { returnToBlocks } from '@/features/blocking/navigation/return-to-blocks'
import { NEW_RULE_PRESET_IDS } from '@/features/blocking/presets'
import type { BlockingEditorType } from '@/features/blocking/types'
import { useT } from '@/i18n/useT'
import type { AppId } from '@/shared/components/ui/AppLogo'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial

const TEMPLATE_PEEK_RATIO = 0.15
// Hauteur de repos de la feuille ; on peut la tirer jusqu'en pleine page.
const SHEET_HEIGHT_RATIO = 0.5
const CLOSE_BUTTON_SIZE = spacing.xxxxl

function goBackFromNewRule() {
  if (router.canGoBack()) {
    router.back()
    return
  }
  returnToBlocks()
}

function openEditor(type: BlockingEditorType) {
  router.push({ pathname: '/block-editor', params: { type } })
}

function openPreset(presetId: string) {
  router.push({ pathname: '/preset-recap', params: { presetId } })
}

const TEMPLATE_IMAGES = {
  work: require('@assets/blocking/work.png'),
  focus: require('@assets/blocking/focus.png'),
  study: require('@assets/blocking/study.png'),
  creative: require('@assets/blocking/creative.png'),
  decompression: require('@assets/blocking/decompression.png'),
  sleep: require('@assets/blocking/sleep.png'),
  evening: require('@assets/blocking/evening.png'),
  weekend: require('@assets/blocking/weekend.png'),
  morning: require('@assets/blocking/morning.png'),
  social: require('@assets/blocking/social.png'),
  doomscroll: require('@assets/blocking/doomscroll.png'),
  family: require('@assets/blocking/family.png'),
} as const

interface TemplatePreset {
  id: string
  presetId: string
  kind: RuleTypeGlyphKind
  image: ImageSourcePropType
  time: string
  title: string
  description: string
  apps: AppId[]
  extraApps: number
  addLabel: string
}

function TemplateRail({
  templates,
  cardWidth,
}: {
  templates: TemplatePreset[]
  cardWidth: number
}) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      disableIntervalMomentum
      decelerationRate="fast"
      snapToAlignment="start"
      snapToInterval={cardWidth + spacing.sm}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      {templates.map(template => (
        <RuleTemplateCard
          key={template.id}
          image={template.image}
          kind={template.kind}
          time={template.time}
          title={template.title}
          description={template.description}
          addLabel={template.addLabel}
          onAdd={() => openPreset(template.presetId)}
          style={{ width: cardWidth }}
        />
      ))}
    </ScrollView>
  )
}

export default function NewRuleScreen() {
  const t = useT()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const sheetHeight = Math.round(windowHeight * SHEET_HEIGHT_RATIO)
  const availableWidth = Math.min(windowWidth, layout.contentMaxWidth)
  // Sized so the row shows 2 full cards plus a 15% peek of the 3rd,
  // hinting that the row can be swiped left for more.
  const templateCardWidth =
    (availableWidth - spacing.md * 2 - spacing.sm * 2) /
    (2 + TEMPLATE_PEEK_RATIO)

  const productiveTemplates: TemplatePreset[] = [
    {
      id: 'work',
      presetId: NEW_RULE_PRESET_IDS.work,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.work,
      time: t('blocking.new_rule.templates.work.time'),
      title: t('blocking.new_rule.templates.work.title'),
      description: t('blocking.new_rule.templates.work.description'),
      apps: ['tiktok', 'instagram'],
      extraApps: 6,
      addLabel: t('blocking.new_rule.templates.work.add'),
    },
    {
      id: 'focus',
      presetId: NEW_RULE_PRESET_IDS.focus,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.focus,
      time: t('blocking.new_rule.templates.focus.time'),
      title: t('blocking.new_rule.templates.focus.title'),
      description: t('blocking.new_rule.templates.focus.description'),
      apps: ['x', 'tiktok'],
      extraApps: 4,
      addLabel: t('blocking.new_rule.templates.focus.add'),
    },
    {
      id: 'study',
      presetId: NEW_RULE_PRESET_IDS.study,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.study,
      time: t('blocking.new_rule.templates.study.time'),
      title: t('blocking.new_rule.templates.study.title'),
      description: t('blocking.new_rule.templates.study.description'),
      apps: ['tiktok', 'youtube'],
      extraApps: 3,
      addLabel: t('blocking.new_rule.templates.study.add'),
    },
    {
      id: 'creative',
      presetId: NEW_RULE_PRESET_IDS.creative,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.creative,
      time: t('blocking.new_rule.templates.creative.time'),
      title: t('blocking.new_rule.templates.creative.title'),
      description: t('blocking.new_rule.templates.creative.description'),
      apps: ['instagram', 'youtube'],
      extraApps: 2,
      addLabel: t('blocking.new_rule.templates.creative.add'),
    },
  ]

  const restTemplates: TemplatePreset[] = [
    {
      id: 'decompression',
      presetId: NEW_RULE_PRESET_IDS.decompression,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.decompression,
      time: t('blocking.new_rule.templates.decompression.time'),
      title: t('blocking.new_rule.templates.decompression.title'),
      description: t('blocking.new_rule.templates.decompression.description'),
      apps: ['tiktok', 'instagram'],
      extraApps: 6,
      addLabel: t('blocking.new_rule.templates.decompression.add'),
    },
    {
      id: 'sleep',
      presetId: NEW_RULE_PRESET_IDS.sleep,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.sleep,
      time: t('blocking.new_rule.templates.sleep.time'),
      title: t('blocking.new_rule.templates.sleep.title'),
      description: t('blocking.new_rule.templates.sleep.description'),
      apps: ['tiktok', 'snapchat'],
      extraApps: 6,
      addLabel: t('blocking.new_rule.templates.sleep.add'),
    },
    {
      id: 'evening',
      presetId: NEW_RULE_PRESET_IDS.evening,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.evening,
      time: t('blocking.new_rule.templates.evening.time'),
      title: t('blocking.new_rule.templates.evening.title'),
      description: t('blocking.new_rule.templates.evening.description'),
      apps: ['x', 'instagram'],
      extraApps: 3,
      addLabel: t('blocking.new_rule.templates.evening.add'),
    },
    {
      id: 'weekend',
      presetId: NEW_RULE_PRESET_IDS.weekend,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.weekend,
      time: t('blocking.new_rule.templates.weekend.time'),
      title: t('blocking.new_rule.templates.weekend.title'),
      description: t('blocking.new_rule.templates.weekend.description'),
      apps: ['x', 'snapchat'],
      extraApps: 4,
      addLabel: t('blocking.new_rule.templates.weekend.add'),
    },
  ]

  const balanceTemplates: TemplatePreset[] = [
    {
      id: 'morning',
      presetId: NEW_RULE_PRESET_IDS.morning,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.morning,
      time: t('blocking.new_rule.templates.morning.time'),
      title: t('blocking.new_rule.templates.morning.title'),
      description: t('blocking.new_rule.templates.morning.description'),
      apps: ['tiktok', 'reddit'],
      extraApps: 5,
      addLabel: t('blocking.new_rule.templates.morning.add'),
    },
    {
      id: 'social',
      presetId: NEW_RULE_PRESET_IDS.social,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.social,
      time: t('blocking.new_rule.templates.social.time'),
      title: t('blocking.new_rule.templates.social.title'),
      description: t('blocking.new_rule.templates.social.description'),
      apps: ['instagram', 'tiktok'],
      extraApps: 4,
      addLabel: t('blocking.new_rule.templates.social.add'),
    },
    {
      id: 'doomscroll',
      presetId: NEW_RULE_PRESET_IDS.doomscroll,
      kind: 'limit',
      image: TEMPLATE_IMAGES.doomscroll,
      time: t('blocking.new_rule.templates.doomscroll.time'),
      title: t('blocking.new_rule.templates.doomscroll.title'),
      description: t('blocking.new_rule.templates.doomscroll.description'),
      apps: ['tiktok', 'instagram'],
      extraApps: 3,
      addLabel: t('blocking.new_rule.templates.doomscroll.add'),
    },
    {
      id: 'family',
      presetId: NEW_RULE_PRESET_IDS.family,
      kind: 'schedule',
      image: TEMPLATE_IMAGES.family,
      time: t('blocking.new_rule.templates.family.time'),
      title: t('blocking.new_rule.templates.family.title'),
      description: t('blocking.new_rule.templates.family.description'),
      apps: ['x', 'youtube'],
      extraApps: 6,
      addLabel: t('blocking.new_rule.templates.family.add'),
    },
  ]

  const renderHeader = (close: () => void) => (
    <View style={styles.header}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('blocking.new_rule.close')}
        onPress={close}
        style={styles.closeButton}
      >
        <IconSvg
          name={IconName.CLOSE}
          size={layout.headerIconSize}
          color={colors.textPrimary}
        />
      </PressableScale>
      <View pointerEvents="none" style={styles.headerTitleLayer}>
        <Text accessibilityRole="header" style={styles.headerTitle}>
          {t('blocking.new_rule.title')}
        </Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  )

  return (
    <HalfSheet
      onClose={goBackFromNewRule}
      height={sheetHeight}
      expandable
      header={renderHeader}
      contentStyle={styles.sheetContent}
      // Repliée, la feuille ne défile pas : on la rembobine pour ne pas la
      // reposer sur un contenu resté au milieu, devenu impossible à remonter.
      onExpandedChange={open => {
        if (!open) scrollRef.current?.scrollTo({ y: 0, animated: true })
      }}
    >
      {(_close, expanded) => (
        <ScrollView
          ref={scrollRef}
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <View style={styles.typesRow}>
            <BlockingTypeCard
              kind="session"
              title={t('blocking.new_rule.types.session.title')}
              description={t('blocking.new_rule.types.session.description')}
              onPress={() => openEditor('block_now')}
              style={styles.typeCard}
            />
            <BlockingTypeCard
              kind="schedule"
              title={t('blocking.new_rule.types.schedule.title')}
              description={t('blocking.new_rule.types.schedule.description')}
              onPress={() => openEditor('schedule')}
              style={styles.typeCard}
            />
            <BlockingTypeCard
              kind="limit"
              title={t('blocking.new_rule.types.limit.title')}
              description={t('blocking.new_rule.types.limit.description')}
              onPress={() => openEditor('daily_limit')}
              style={styles.typeCard}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('blocking.new_rule.balance.title')}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t('blocking.new_rule.balance.description')}
            </Text>
            <TemplateRail
              templates={balanceTemplates}
              cardWidth={templateCardWidth}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('blocking.new_rule.rest.title')}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t('blocking.new_rule.rest.description')}
            </Text>
            <TemplateRail
              templates={restTemplates}
              cardWidth={templateCardWidth}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('blocking.new_rule.productive.title')}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t('blocking.new_rule.productive.description')}
            </Text>
            <TemplateRail
              templates={productiveTemplates}
              cardWidth={templateCardWidth}
            />
          </View>
        </ScrollView>
      )}
    </HalfSheet>
  )
}

const styles = StyleSheet.create({
  // La feuille gère déjà ses marges : le contenu défile bord à bord.
  sheetContent: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: CLOSE_BUTTON_SIZE,
    height: CLOSE_BUTTON_SIZE,
    borderRadius: radius.capsule,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderInteractive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: CLOSE_BUTTON_SIZE,
  },
  // Centré sur la ligne du bouton, pas sur la boîte : le titre reste à la même
  // hauteur d'œil que la croix malgré la marge basse de l'en-tête.
  headerTitleLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  typesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  typeCard: {
    flex: 1,
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  sectionSubtitle: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    marginTop: spacing.xs,
  },
  rail: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
})
