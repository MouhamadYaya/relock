import { IconName } from '@assets/icons'
import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { HomeCardMaterial } from '@/features/home/components/HomeCardMaterial'
import { HomeScoreRings } from '@/features/home/components/HomeScoreRings'
import { scoreBand } from '@/features/home/services/home-dashboard'
import type {
  HomeScoreBand,
  HomeScoreComponent,
  HomeScoreSignal,
  HomeScoreSnapshot,
} from '@/features/home/types'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, opacity, radius, typography } = relockMaterial

/**
 * Ouverture au ressort, fermeture au timing.
 *
 * ⚠️ **Pas de rotation 3D ici, et c'est délibéré.** Une version précédente
 * ouvrait la feuille par un `rotateY` sous perspective. Sur iOS, une vue en
 * `overflow: 'hidden'` qui contient un `ScrollView` et un calque de matière
 * est rasterisée en plusieurs couches, que CoreAnimation reprojette chacune
 * avec sa propre matrice pendant la transformation : la carte se fendait
 * verticalement — moitié gauche en bloc opaque, contenu décalé et tronqué à
 * droite. L'artefact ne se corrige pas par réglage (angle, perspective,
 * `backfaceVisibility`) : il tient à la façon dont le clipping et la 3D se
 * composent. Le mouvement est donc entièrement plan — échelle, translation,
 * opacité — ce qu'aucun pipeline ne peut mal projeter.
 */
const SPRING = { damping: 20, stiffness: 190, mass: 0.85 } as const
const CLOSE_MS = 200
const EASE_OUT = Easing.bezier(0.4, 0, 1, 1)

/** Échelle de départ : la feuille grandit depuis la carte, sans la mimer. */
const FROM_SCALE = 0.9
/** Elle monte légèrement en s'ouvrant : le geste vient du bas, comme le tap. */
const FROM_TRANSLATE_Y = 26

const BAND_KEYS = {
  excellent: 'home.score_band_excellent',
  good: 'home.score_band_good',
  fair: 'home.score_band_fair',
  poor: 'home.score_band_poor',
  unknown: 'home.score_calculating',
} as const satisfies Record<HomeScoreBand, string>

/** Icône, libellé et gabarit de mesure — un jeu par signal. */
const SIGNALS = {
  pressure: {
    icon: IconName.BLOCK,
    label: 'home.score_signal_pressure_label',
    measure: 'home.score_signal_pressure_measure',
  },
  resistance: {
    icon: IconName.CHECK,
    label: 'home.score_signal_resistance_label',
    measure: 'home.score_signal_resistance_measure',
  },
  breaches: {
    icon: IconName.CLOCK,
    label: 'home.score_signal_breaches_label',
    measure: 'home.score_signal_breaches_measure',
  },
  coverage: {
    icon: IconName.SHIELDFILL,
    label: 'home.score_signal_coverage_label',
    measure: 'home.score_signal_coverage_measure',
  },
  regularity: {
    icon: IconName.CALENDAR,
    label: 'home.score_signal_regularity_label',
    measure: 'home.score_signal_regularity_measure',
  },
  quota: {
    icon: IconName.CHART,
    label: 'home.score_signal_quota_label',
    measure: 'home.score_signal_quota_measure',
  },
} as const satisfies Record<
  HomeScoreSignal,
  { icon: IconName; label: string; measure: string }
>

interface Props {
  visible: boolean
  snapshot: HomeScoreSnapshot
  onClose: () => void
}

const tintOf = (axis: 'focus' | 'rest') =>
  axis === 'focus' ? colors.accentViolet : colors.homeLavender

function Bar({ value, tint }: { value: number | null; tint: string }) {
  return (
    <View style={styles.track}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
            backgroundColor: tint,
          },
        ]}
      />
    </View>
  )
}

/** Un axe : sa note, sa barre et la ligne qui dit ce qu'il mesure. */
function AxisRow({
  icon,
  axis,
  label,
  value,
  body,
}: {
  icon: IconName
  axis: 'focus' | 'rest'
  label: string
  value: number | null
  body: string
}) {
  const tint = tintOf(axis)
  return (
    <View style={styles.axis}>
      <View style={styles.axisHead}>
        <IconSvg
          name={icon}
          size={layout.homeScoreDialogGlyphSize}
          color={tint}
        />
        <Text style={styles.axisLabel}>{label}</Text>
        <Text style={styles.axisValue}>{value ?? '—'}</Text>
      </View>
      <Bar value={value} tint={tint} />
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

/**
 * Une mesure du jour, sur une seule ligne : ce qui a été observé, et la note
 * qui en découle. Le chiffre brut est là pour être recompté — c'est lui qui
 * fait la différence entre un score et une décoration. Aucune glose : la
 * ligne se comprend seule, et six paragraphes empilés ne se lisaient pas.
 */
function SignalRow({
  component,
  label,
  measure,
  icon,
}: {
  component: HomeScoreComponent
  label: string
  measure: string
  icon: IconName
}) {
  const tint = tintOf(component.axis)
  return (
    <View style={styles.signal}>
      <IconSvg name={icon} size={layout.homeScoreTileGlyphSize} color={tint} />
      <View style={styles.signalCopy}>
        <Text numberOfLines={1} style={styles.signalLabel}>
          {label}
        </Text>
        <Text numberOfLines={1} style={styles.signalMeasure}>
          {measure}
        </Text>
      </View>
      <Text style={[styles.signalValue, { color: tint }]}>
        {component.score}
      </Text>
    </View>
  )
}

/**
 * Les sept derniers jours en barres. Le dernier point est le score que l'œil
 * vient de lire sur la carte. Un jour sans mesure reste visible en creux —
 * une absence de donnée n'est pas un zéro.
 */
function Trend({ snapshot }: { snapshot: HomeScoreSnapshot }) {
  const last = snapshot.trend.length - 1
  return (
    <View style={styles.trend} accessibilityElementsHidden>
      {snapshot.trend.map((day, index) => {
        const height =
          day.score === null
            ? layout.homeScoreTrendBarMin
            : Math.max(
                layout.homeScoreTrendBarMin,
                (day.score / 100) * layout.homeScoreTrendHeight,
              )
        return (
          <View key={day.date} style={styles.trendSlot}>
            <View
              style={[
                styles.trendBar,
                {
                  height,
                  backgroundColor:
                    index === last
                      ? colors.homeScoreTrendToday
                      : colors.homeScoreTrendBar,
                  opacity: day.score === null ? opacity.homeScoreTrendEmpty : 1,
                },
              ]}
            />
            <Text style={styles.trendLabel}>{day.date.slice(8)}</Text>
          </View>
        )
      })}
    </View>
  )
}

/**
 * Titre de section. Il tient sur UNE ligne, toujours.
 *
 * « Astuces pour faire monter le score » frôle la largeur utile sur les
 * petits écrans, et l'allemand rallonge encore. Plutôt que de passer à la
 * ligne — ce qui casse le rythme des sections — ou de tronquer par une
 * ellipse, le titre se resserre très légèrement : la mise en page tient, et
 * la phrase reste entière.
 */
function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      style={styles.section}
    >
      {children}
    </Text>
  )
}

/** Une puce de conseil : un glyphe, une phrase, rien d'autre. */
function Hint({
  icon,
  tint,
  label,
}: {
  icon: IconName
  tint: string
  label: string
}) {
  return (
    <View style={styles.hint}>
      <IconSvg
        name={icon}
        size={layout.homeScoreLegendGlyphSize}
        color={tint}
      />
      <Text style={styles.hintText}>{label}</Text>
    </View>
  )
}

/**
 * Fenêtre contextuelle du score : la carte pivote et s'agrandit pour montrer
 * ce qui a produit le chiffre, ce qui le fait monter et ce qui le fait
 * baisser.
 *
 * Elle affiche le snapshot que la carte affiche déjà — aucune donnée nouvelle,
 * aucune explication qui ne se rattache pas à une mesure visible.
 */
export function HomeScoreDetail({ visible, snapshot, onClose }: Props) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(visible)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      progress.value = reduceMotion
        ? withTiming(1, { duration: 0 })
        : withSpring(1, SPRING)
      return
    }
    progress.value = withTiming(
      0,
      { duration: reduceMotion ? 0 : CLOSE_MS, easing: EASE_OUT },
      finished => {
        if (finished) runOnJS(setMounted)(false)
      },
    )
  }, [visible, reduceMotion, progress])

  // Un seul calque animé porte tout le mouvement. Empiler des opacités
  // décalées (carte, contenu, ombre) multipliait les couches rasterisées —
  // c'est ce qui rendait le rendu fragile ; ici la feuille est un objet.
  const dialogStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 1.4),
    transform: reduceMotion
      ? [{ scale: 1 }]
      : [
          { translateY: (1 - progress.value) * FROM_TRANSLATE_Y },
          { scale: FROM_SCALE + progress.value * (1 - FROM_SCALE) },
        ],
  }))
  // Le fond s'assombrit AVANT la carte : la scène est posée quand l'objet
  // arrive, au lieu d'apparaître en même temps que lui.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 2),
  }))

  const close = () => {
    haptics.selectionTick()
    onClose()
  }

  const bandLabel = (value: number | null) => t(BAND_KEYS[scoreBand(value)])
  const available = snapshot.global !== null
  const rising = (snapshot.delta ?? 0) > 0

  if (!mounted) return null

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.close')}
            onPress={close}
            style={styles.backdrop}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[styles.dialog, dialogStyle]}
        >
          {/*
            L'ombre vit sur `dialog`, le clipping sur `surface`. Les réunir
            perdrait l'ombre : `overflow: 'hidden'` pose `masksToBounds` sur
            le calque iOS, qui découpe aussi ce qui déborde — l'ombre portée
            comprise.
          */}
          <View style={styles.surface}>
            <HomeCardMaterial />
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
            >
              <View style={styles.header}>
                <Text style={styles.title}>{t('home.score_detail_title')}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('home.close')}
                  hitSlop={spacing.sm}
                  onPress={close}
                  style={styles.close}
                >
                  <IconSvg
                    name={IconName.CLOSE}
                    size={layout.quickChevronSize}
                    color={colors.textPrimary}
                  />
                </Pressable>
              </View>

              <View style={styles.hero}>
                <HomeScoreRings
                  focus={snapshot.focus}
                  rest={snapshot.rest}
                  size={layout.homeScoreDialogRingSize}
                  stroke={layout.homeScoreDialogRingStroke}
                  gap={layout.homeScoreDialogRingGap}
                  gradientPrefix="homeScoreDialog"
                >
                  <Text style={styles.heroValue}>{snapshot.global ?? '—'}</Text>
                </HomeScoreRings>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroBand}>
                    {available
                      ? bandLabel(snapshot.global)
                      : t('home.score_calculating')}
                  </Text>
                  <Text style={styles.body}>
                    {available
                      ? t('home.score_subtitle')
                      : t('home.score_detail_unavailable')}
                  </Text>
                  {snapshot.delta !== null && (
                    <View
                      style={[
                        styles.delta,
                        {
                          backgroundColor: rising
                            ? colors.homeScoreUpSoft
                            : colors.homeScoreDownSoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.deltaText,
                          {
                            color: rising
                              ? colors.homeScoreUp
                              : colors.homeScoreDown,
                          },
                        ]}
                      >
                        {snapshot.delta === 0
                          ? t('home.score_delta_same')
                          : `${rising ? '+' : '−'}${Math.abs(snapshot.delta)} ${t('home.score_delta_suffix')}`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {snapshot.trend.length > 0 && (
                <>
                  <SectionTitle>{t('home.score_trend_title')}</SectionTitle>
                  <Trend snapshot={snapshot} />
                  <Text style={styles.scale}>{t('home.score_what_body')}</Text>
                </>
              )}

              <SectionTitle>{t('home.score_how_title')}</SectionTitle>
              <AxisRow
                icon={IconName.FOCUS}
                axis="focus"
                label={t('home.focus_score')}
                value={snapshot.focus}
                body={t('home.score_how_focus')}
              />
              <AxisRow
                icon={IconName.REST}
                axis="rest"
                label={t('home.rest_score')}
                value={snapshot.rest}
                body={t('home.score_how_rest')}
              />
              <View style={styles.formula}>
                <Text style={styles.formulaText}>
                  {t('home.score_formula')}
                </Text>
              </View>

              {snapshot.components.length > 0 && (
                <>
                  <SectionTitle>{t('home.score_today')}</SectionTitle>
                  <View style={styles.signals}>
                    {snapshot.components.map(component => {
                      const meta = SIGNALS[component.signal]
                      return (
                        <SignalRow
                          key={component.signal}
                          component={component}
                          icon={meta.icon}
                          label={t(meta.label)}
                          measure={t(meta.measure, {
                            observed: component.observed,
                            reference: component.reference ?? 0,
                          })}
                        />
                      )
                    })}
                  </View>
                </>
              )}

              <SectionTitle>{t('home.score_improve_title')}</SectionTitle>
              <View style={styles.hints}>
                <Hint
                  icon={IconName.SHIELDFILL}
                  tint={colors.homeMint}
                  label={t('home.score_tip_block')}
                />
                <Hint
                  icon={IconName.CHECK}
                  tint={colors.homeMint}
                  label={t('home.score_tip_focus')}
                />
                <Hint
                  icon={IconName.REST}
                  tint={colors.homeMint}
                  label={t('home.score_tip_rest')}
                />
              </View>

              <SectionTitle>{t('home.score_lowers_title')}</SectionTitle>
              <View style={styles.hints}>
                <Hint
                  icon={IconName.ARROWDOWN}
                  tint={colors.homeScoreDown}
                  label={t('home.score_lower_pressure')}
                />
                <Hint
                  icon={IconName.ARROWDOWN}
                  tint={colors.homeScoreDown}
                  label={t('home.score_lower_breach')}
                />
                <Hint
                  icon={IconName.ARROWDOWN}
                  tint={colors.homeScoreDown}
                  label={t('home.score_lower_gap')}
                />
              </View>

              {available && (
                <Text style={styles.note}>
                  {t(
                    snapshot.status === 'ready'
                      ? 'home.score_confidence_ready'
                      : 'home.score_confidence_provisional',
                    { days: snapshot.historyDays },
                  )}
                </Text>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.homeModalBackdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: layout.homeScoreDialogMaxWidth,
    maxHeight: '86%',
    marginHorizontal: layout.screenHorizontal,
    borderRadius: radius.homeCard,
    ...relockMaterial.shadow.hero,
  },
  surface: {
    flexShrink: 1,
    overflow: 'hidden',
    borderRadius: radius.homeCard,
    backgroundColor: colors.homeCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
  },
  content: {
    padding: layout.homeScoreDialogPadding,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...fonts.bold,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreDialogTitleSize,
    lineHeight: typography.homeScoreDialogTitleLineHeight,
    letterSpacing: typography.homeGreetingLetterSpacing,
  },
  close: {
    width: layout.homeScoreChevronSize,
    height: layout.homeScoreChevronSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  heroValue: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeMetricSize,
    lineHeight: typography.homeMetricLineHeight,
    fontVariant: ['tabular-nums'],
  },
  heroCopy: { flex: 1, gap: spacing.micro },
  heroBand: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreTitleSize,
    lineHeight: typography.homeScoreTitleLineHeight,
  },
  delta: {
    alignSelf: 'flex-start',
    marginTop: spacing.xxs,
    paddingVertical: spacing.micro,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.capsule,
  },
  deltaText: {
    ...fonts.semiBold,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
    fontVariant: ['tabular-nums'],
  },
  trend: {
    height: layout.homeScoreTrendHeight + spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxs,
    paddingTop: spacing.xs,
    borderRadius: radius.functional,
    backgroundColor: colors.homeScoreTile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  trendSlot: { flex: 1, alignItems: 'center', gap: spacing.micro },
  trendBar: {
    width: layout.homeScoreTrendBarWidth,
    borderRadius: radius.capsule,
  },
  trendLabel: {
    ...fonts.medium,
    color: colors.textTertiary,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
    fontVariant: ['tabular-nums'],
  },
  scale: {
    ...fonts.medium,
    marginTop: spacing.xs,
    color: colors.textTertiary,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
  },
  section: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreSectionSize,
    lineHeight: typography.homeScoreSectionLineHeight,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  body: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.homeScoreBodySize,
    lineHeight: typography.homeScoreBodyLineHeight,
  },
  axis: { gap: spacing.xs, marginBottom: spacing.md },
  axisHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  axisLabel: {
    ...fonts.semiBold,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreRowLabelSize,
    lineHeight: typography.homeScoreRowLabelLineHeight,
  },
  axisValue: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreDetailValueSize,
    lineHeight: typography.homeScoreDetailValueLineHeight,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: layout.homeScoreBarHeight,
    overflow: 'hidden',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeProgressTrack,
  },
  fill: { height: '100%', borderRadius: radius.capsule },
  signals: {
    overflow: 'hidden',
    borderRadius: radius.functional,
    backgroundColor: colors.homeScoreTile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  signal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  signalCopy: { flex: 1 },
  signalLabel: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.homeScoreBodySize,
    lineHeight: typography.homeScoreBodyLineHeight,
  },
  signalMeasure: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
    fontVariant: ['tabular-nums'],
  },
  signalValue: {
    ...fonts.bold,
    fontSize: typography.homeScoreDetailValueSize,
    lineHeight: typography.homeScoreDetailValueLineHeight,
    fontVariant: ['tabular-nums'],
  },
  formula: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  formulaText: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
  },
  hints: { gap: spacing.xs },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hintText: {
    ...fonts.regular,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreBodySize,
    lineHeight: typography.homeScoreBodyLineHeight,
  },
  note: {
    ...fonts.regular,
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.homeBorder,
    paddingTop: spacing.md,
    color: colors.textTertiary,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
  },
})
