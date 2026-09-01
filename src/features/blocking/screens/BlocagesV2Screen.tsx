import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { BlockedAppTileView } from '@/features/blocking/components/BlockedAppTileView'
import {
  PurplePlusButton,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import { BlockingRuleCard } from '@/features/blocking/components/BlockingRuleCard'
import { BreathingPauseModal } from '@/features/blocking/components/BreathingPauseModal'
import { ReblockAppSheet } from '@/features/blocking/components/ReblockAppSheet'
import { RuleTemplateCard } from '@/features/blocking/components/RuleTemplateCard'
import { StrictBlockSheet } from '@/features/blocking/components/StrictBlockSheet'
import { UnlockDurationSheet } from '@/features/blocking/components/UnlockDurationSheet'
import { useBlockedApps } from '@/features/blocking/hooks/useBlockedApps'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useLimitSteps } from '@/features/blocking/hooks/useLimitSteps'
import { useRuleAutoCleanup } from '@/features/blocking/hooks/useRuleAutoCleanup'
import { useRuleReconciler } from '@/features/blocking/hooks/useRuleReconciler'
import {
  buildRuleTemplates,
  pickRandomRuleTemplates,
} from '@/features/blocking/rule-templates'
import {
  configLine,
  stateLine,
} from '@/features/blocking/screens/BlocagesScreen'
import {
  buildSessions,
  isSessionLocked,
  type RuleSession,
  sessionProgress,
  strictSessionFor,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { useT } from '@/i18n/useT'
import type { AppId } from '@/shared/components/ui/AppLogo'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { showErrorToast } from '@/shared/utils/toast'

const { colors, layout, radius, shadow, typography } = relockMaterial

type UnlockTarget = string | 'all'

const SUGGESTED_TEMPLATE_COUNT = 3

/** Battement minimum du rouet « Recharge Relock » — voir `reloadSection`. */
const RELOAD_SPINNER_MS = 2000

// Respiration du titre « Règles ». Hors échelle de `spacing` : c'est un
// réglage OPTIQUE au pixel près, le titre était collé à la rangée d'apps
// au-dessus et à la grille en dessous.
const RULES_TITLE_SPACE_ABOVE = 3
const RULES_TITLE_SPACE_BELOW = 7

// Rangée « Apps bloquées » : la liste défile sur TOUTE la largeur.
// ⚠️ Plus de « demi-tuile » qui dépasse : borner la fenêtre à 4,2 tuiles
// tranchait la dernière icône en plein milieu — on y lisait une bande noire,
// pas une invitation à faire glisser.

const KNOWN_APP_IDS = new Set<AppId>([
  'tiktok',
  'instagram',
  'youtube',
  'snapchat',
  'reddit',
  'x',
])

function appBadges(rule: BlockRuleView): {
  apps: AppId[]
  extraApps?: number
} {
  const apps = rule.appIds
    .map(String)
    .filter((app): app is AppId => KNOWN_APP_IDS.has(app as AppId))
    .slice(0, 2)
  const selectedCount = rule.count ?? rule.appIds.length
  const extraApps = Math.max(0, selectedCount - apps.length)
  return { apps, extraApps: extraApps || undefined }
}

// Même mappage que les cartes prédéfinies (RuleTypeGlyphKind) — c'est ce qui
// garantit le même badge, mêmes icônes, même taille sur les deux types de carte.
function glyphKind(rule: BlockRuleView): RuleTypeGlyphKind {
  if (rule.type === 'progressive_delay') return 'session'
  if (rule.type === 'daily_limit') return 'limit'
  return 'schedule'
}

function sessionStatus(session: RuleSession, now: Date): string {
  const line = stateLine(session, now)
  return `${line.pre ?? ''}${line.key ?? ''}${line.post ?? ''}`
}

/** Glyphe décoratif — même dégradé que le bouton d'ajout, sans son propre tap. */
function NewRulePlusGlyph() {
  const size = spacing.xxxl
  return (
    <View
      pointerEvents="none"
      style={[
        styles.newRulePlus,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="new-rule-plus" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.blockingAccentLight} />
            <Stop offset="0.55" stopColor={colors.blockingAccent} />
            <Stop offset="1" stopColor={colors.accentVioletDeep} />
          </LinearGradient>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          rx={size / 2}
          fill="url(#new-rule-plus)"
        />
      </Svg>
      <IconSvg
        name={IconName.PLUS}
        size={spacing.lg}
        color={colors.textPrimary}
      />
    </View>
  )
}

/** Première carte de l'état vide : crée une règle depuis zéro. */
function NewRuleSuggestionCard({
  label,
  style,
}: {
  label: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push('/add-block')}
      style={[styles.newRuleCard, style]}
    >
      <NewRulePlusGlyph />
      <Text style={styles.newRuleLabel}>{label}</Text>
    </PressableScale>
  )
}

/**
 * Panneau « Apps bloquées » quand rien n'est actif — pas de tuile verrouillée
 * à montrer, juste le rappel que tout est ouvert (cf. maquette état vide).
 * Le lien central relance la requête des règles — pour le coup où l'état
 * affiché semble faux et que l'utilisateur veut resynchroniser vite.
 */
function EmptyBlockedAppsPanel({
  availableLabel,
  troubleLabel,
  restartLabel,
  onRestart,
  restartPending,
  loadingLabel,
}: {
  availableLabel: string
  troubleLabel: string
  restartLabel: string
  onRestart: () => void
  restartPending: boolean
  loadingLabel: string
}) {
  return (
    <View style={styles.emptyPanel}>
      <View pointerEvents="none" style={styles.emptyPanelTiles}>
        {[0, 1, 2, 3].map(index => (
          <View key={index} style={styles.emptyPanelTile} />
        ))}
      </View>
      <View style={styles.emptyPanelCopy}>
        {restartPending ? (
          // Le rouet REMPLACE le texte : la section a visiblement « travaillé »,
          // puis retrouve son contenu — sans ça, un tap ne changeait rien à
          // l'écran et le lien passait pour mort.
          <ActivityIndicator
            accessibilityLabel={loadingLabel}
            color={colors.blockingAccentLight}
          />
        ) : (
          <>
            <Text style={styles.emptyAvailable}>{availableLabel}</Text>
            <Text style={styles.emptyHint}>
              {troubleLabel}{' '}
              <Text
                accessibilityRole="button"
                accessibilityLabel={restartLabel}
                suppressHighlighting
                onPress={onRestart}
                style={styles.emptyHintLink}
              >
                {restartLabel}
              </Text>
            </Text>
          </>
        )}
      </View>
    </View>
  )
}

export default function BlocagesV2Screen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [now, setNow] = useState(() => new Date())
  // `'all'` = « Tout débloquer » ; sinon la clé opaque de l'app visée.
  const [breathing, setBreathing] = useState<UnlockTarget | null>(null)
  const [unlocking, setUnlocking] = useState<UnlockTarget | null>(null)
  const [reblocking, setReblocking] = useState<string | null>(null)
  // Refus opposé par un blocage strict : ce qu'on a touché, et jusqu'à quand.
  const [strictNotice, setStrictNotice] = useState<{
    scope: 'rule' | 'app'
    title: string
    endsAt: Date | null
  } | null>(null)
  const [unlockPending, setUnlockPending] = useState(false)
  const [reblockPending, setReblockPending] = useState(false)
  const [reloading, setReloading] = useState(false)
  const { rules, isPending, refetch } = useBlockRulesQuery()
  const limitSteps = useLimitSteps()

  useRuleAutoCleanup(rules)
  useRuleReconciler(rules, !isPending)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const sessions = useMemo(
    () => buildSessions(rules, now, limitSteps),
    [limitSteps, now, rules],
  )
  // « Apps bloquées » = tout ce qui bloque EFFECTIVEMENT maintenant : on
  // agrège TOUTES les règles en cours d'exécution (pas juste la première),
  // sinon un 2e blocage actif n'apparaît jamais dans cette rangée.
  const runningSessions = sessions.filter(
    session => session.state === 'running',
  )
  // Une tuile par APP réellement couverte (jamais un compteur deviné) : c'est
  // le natif qui dédoublonne. Le hook se stabilise lui-même sur la liste
  // d'ids — inutile de mémoïser ici.
  const {
    apps: blockedApps,
    isLoading: blockedLoading,
    refresh: refreshBlockedApps,
  } = useBlockedApps(runningSessions.map(session => session.rule))
  const hasBlockedApps = blockedApps.length > 0
  const lockedApps = blockedApps.filter(app => !app.unlocked)
  const strictSessionForApp = (app: { ruleIds: string[] }) =>
    strictSessionFor(runningSessions, app.ruleIds, now)
  // « Tout débloquer » ne porte QUE sur ce qui peut réellement s'ouvrir.
  const unlockableApps = lockedApps.filter(app => !strictSessionForApp(app))
  const reblockingApp = blockedApps.find(app => app.key === reblocking)
  // La feuille de reblocage affiche LA carte de la protection concernée : on
  // lui passe donc exactement ce que la grille passe à `BlockingRuleCard`.
  const reblockingRules = runningSessions
    .filter(session => reblockingApp?.ruleIds.includes(session.rule.id))
    .map(session => {
      const badges = appBadges(session.rule)
      return {
        id: session.rule.id,
        title: session.title,
        description: configLine(session.rule),
        status: sessionStatus(session, now),
        kind: glyphKind(session.rule),
        apps: badges.apps,
        extraApps: badges.extraApps,
        ruleId: session.rule.id,
        progress: sessionProgress(session),
        active: session.state === 'running',
        onPress: () => {
          setReblocking(null)
          router.push({
            pathname: '/block-detail',
            params: { id: session.rule.id },
          })
        },
      }
    })
  const hasNoRules = !isPending && rules.length === 0
  const ruleTemplates = useMemo(() => buildRuleTemplates(t), [t])
  // Toujours proposées, même une fois des règles créées — seules celles déjà
  // en place sont retirées (on ne suggère jamais ce qui existe déjà).
  const suggestedTemplates = useMemo(() => {
    const usedPresetIds = new Set(
      rules
        .map(rule => (rule.config as Record<string, unknown> | null)?.preset_id)
        .filter((id): id is string => typeof id === 'string'),
    )
    const available = ruleTemplates.filter(
      template => !usedPresetIds.has(template.presetId),
    )
    return pickRandomRuleTemplates(available, SUGGESTED_TEMPLATE_COUNT)
  }, [ruleTemplates, rules])

  // Si le sursis expire pendant que sa feuille est ouverte, elle disparaît :
  // l'app est déjà revenue sous bouclier, confirmer n'aurait plus de sens.
  useEffect(() => {
    if (reblocking && !reblockingApp?.unlocked) setReblocking(null)
  }, [reblocking, reblockingApp?.unlocked])

  const continueAfterBreathing = () => {
    const target = breathing
    if (!target) return
    if (target !== 'all' && !unlockableApps.some(app => app.key === target)) {
      setBreathing(null)
      return
    }
    setBreathing(null)
    requestAnimationFrame(() => setUnlocking(target))
  }

  /**
   * Déblocage INDIVIDUEL : la règle continue de tourner pour toutes les
   * autres apps, seule celle-ci sort du bouclier pour la durée choisie.
   * Peu importe combien de règles la visent — un sursis porte sur l'app.
   */
  const confirmUnlockApp = async (minutes: number) => {
    if (!unlocking) return
    setUnlockPending(true)
    try {
      // « Tout débloquer » ouvre chaque app encore verrouillée pour la même
      // durée : les règles continuent de tourner, tout se referme à l'échéance.
      const targets =
        unlocking === 'all' ? unlockableApps.map(app => app.key) : [unlocking]
      for (const key of targets) {
        await ScreenTime.unblockAppKey(key, minutes)
      }
      setUnlocking(null)
    } catch (error) {
      showErrorToast(error)
    } finally {
      await refreshBlockedApps()
      setUnlockPending(false)
    }
  }

  const confirmReblockApp = async () => {
    if (!reblocking || reblockPending) return
    setReblockPending(true)
    try {
      await ScreenTime.reblockAppKey(reblocking)
      setReblocking(null)
    } catch (error) {
      showErrorToast(error)
    } finally {
      await refreshBlockedApps()
      setReblockPending(false)
    }
  }

  /**
   * « Recharge Relock » : relit les règles ET la rangée d'apps. Le rouet
   * reste au moins le temps d'un battement pour que l'action se voie —
   * un rafraîchissement instantané passe pour un bouton mort.
   */
  const reloadSection = async () => {
    if (reloading) return
    setReloading(true)
    try {
      await Promise.all([
        refetch(),
        refreshBlockedApps(),
        new Promise(resolve => setTimeout(resolve, RELOAD_SPINNER_MS)),
      ])
    } finally {
      setReloading(false)
    }
  }

  /**
   * Ouvrir la fiche d'un blocage STRICT n'aurait aucun sens : elle ne
   * proposerait que des sorties éteintes. On répond directement la seule
   * chose vraie — c'est verrouillé, et voici jusqu'à quand.
   */
  const openRule = (rule: BlockRuleView) => {
    if (isSessionLocked(rule, now)) {
      const session = sessions.find(item => item.rule.id === rule.id)
      setStrictNotice({
        scope: 'rule',
        title: session?.title ?? '',
        endsAt: session?.sessionEndsAt ?? null,
      })
      return
    }
    router.push({ pathname: '/block-detail', params: { id: rule.id } })
  }

  const renderSuggestionCards = () =>
    suggestedTemplates.map(template => (
      <RuleTemplateCard
        key={template.id}
        title={template.title}
        description={template.description}
        time={template.time}
        kind={template.kind}
        image={template.image}
        addLabel={template.addLabel}
        onAdd={() =>
          router.push({
            pathname: '/preset-recap',
            params: { presetId: template.presetId },
          })
        }
        style={styles.suggestionCardSlot}
      />
    ))

  return (
    <ScreenWrapper
      disableTopInset
      backgroundColor={colors.blockingCanvas}
      statusBarProps={{
        translucent: true,
        backgroundColor: colors.transparent,
      }}
    >
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.sm },
          ]}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.screenTitle}>
              {t('blocking.title')}
            </Text>
            <PurplePlusButton
              accessibilityLabel={t('blocking.add_rule')}
              onPress={() => router.push('/add-block')}
            />
          </View>

          {hasBlockedApps ? (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('blocking.blocked_apps')}
                </Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={t('blocking.unlock_all')}
                  disabled={unlockPending || unlockableApps.length === 0}
                  onPress={() => setBreathing('all')}
                  style={styles.textAction}
                >
                  <Text style={styles.actionLabel}>
                    {t('blocking.unlock_all')}
                  </Text>
                </PressableScale>
              </View>

              <View style={styles.blockedAppsRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.blockedTilesViewport}
                  contentContainerStyle={styles.blockedTilesContent}
                >
                  {blockedApps.map(app => (
                    <BlockedAppTileView
                      key={app.key}
                      tokenKey={app.key}
                      unlocked={app.unlocked}
                      reprievedUntil={app.reprievedUntil}
                      label={
                        app.unlocked
                          ? t('blocking.reblock_app.action')
                          : t('blocking.unlock')
                      }
                      disabled={unlockPending || reblockPending}
                      onPress={() => {
                        if (app.unlocked) {
                          setReblocking(app.key)
                          return
                        }
                        const strict = strictSessionForApp(app)
                        if (strict) {
                          setStrictNotice({
                            scope: 'app',
                            title: strict.title,
                            endsAt: strict.sessionEndsAt,
                          })
                          return
                        }
                        setBreathing(app.key)
                      }}
                    />
                  ))}
                </ScrollView>
              </View>
            </>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {t('blocking.blocked_apps')}
                </Text>
              </View>
              <EmptyBlockedAppsPanel
                availableLabel={t('blocking.empty_rules.no_apps_blocked')}
                troubleLabel={t('blocking.empty_rules.trouble_hint')}
                restartLabel={t('blocking.empty_rules.restart_cta')}
                onRestart={reloadSection}
                restartPending={reloading || blockedLoading}
                loadingLabel={t('common.loading')}
              />
            </>
          )}

          <View style={styles.rulesHeader}>
            <Text style={styles.sectionTitle}>{t('blocking.rules_title')}</Text>
            <IconSvg
              name={IconName.FORWARD}
              size={spacing.lg}
              color={colors.textSecondary}
            />
          </View>

          <View style={styles.grid}>
            {isPending ? (
              <ActivityIndicator
                accessibilityLabel={t('common.loading')}
                color={colors.blockingAccentLight}
                style={styles.loader}
              />
            ) : hasNoRules ? (
              <>
                <NewRuleSuggestionCard
                  label={t('blocking.add_rule')}
                  style={styles.suggestionCardSlot}
                />
                {renderSuggestionCards()}
              </>
            ) : (
              <>
                {sessions.map(session => {
                  const badges = appBadges(session.rule)
                  return (
                    <BlockingRuleCard
                      key={session.rule.id}
                      title={session.title}
                      description={configLine(session.rule)}
                      status={sessionStatus(session, now)}
                      kind={glyphKind(session.rule)}
                      apps={badges.apps}
                      extraApps={badges.extraApps}
                      ruleId={session.rule.id}
                      progress={sessionProgress(session)}
                      active={session.state === 'running'}
                      onPress={() => openRule(session.rule)}
                      style={styles.cardSlot}
                    />
                  )
                })}
                {/* Les préréglages restent proposés même une fois des règles
                    créées — jamais cachés après la première protection. */}
                {renderSuggestionCards()}
              </>
            )}
          </View>
        </ScrollView>

        <BreathingPauseModal
          visible={breathing !== null}
          tokenKey={breathing === 'all' ? undefined : (breathing ?? undefined)}
          allApps={breathing === 'all'}
          onCancel={() => setBreathing(null)}
          onContinue={continueAfterBreathing}
        />

        <UnlockDurationSheet
          visible={unlocking !== null}
          tokenKey={unlocking === 'all' ? undefined : (unlocking ?? undefined)}
          allApps={unlocking === 'all'}
          pending={unlockPending}
          onCancel={() => setUnlocking(null)}
          onPick={confirmUnlockApp}
        />

        <StrictBlockSheet
          visible={strictNotice != null}
          scope={strictNotice?.scope ?? 'rule'}
          ruleTitle={strictNotice?.title}
          endsAt={strictNotice?.endsAt}
          onClose={() => setStrictNotice(null)}
        />

        <ReblockAppSheet
          visible={reblockingApp?.unlocked === true}
          tokenKey={reblockingApp?.key}
          reprievedUntil={reblockingApp?.reprievedUntil}
          rules={reblockingRules}
          pending={reblockPending}
          onCancel={() => setReblocking(null)}
          onConfirm={confirmReblockApp}
        />
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.blockingCanvas,
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: layout.blockingScrollBottom,
  },
  header: {
    minHeight: spacing.xxxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenTitle: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.blockingTitleSize,
    lineHeight: typography.blockingTitleLineHeight,
    letterSpacing: typography.blockingTitleLetterSpacing,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  textAction: {
    minHeight: spacing.xxxxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  actionLabel: {
    ...fonts.regular,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  blockedAppsRow: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  blockedTilesContent: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  blockedTilesViewport: {
    flexGrow: 0,
    height:
      layout.blockingLockedTileSize +
      typography.blockingCompactTitleLineHeight +
      spacing.xs,
  },
  unlockLabel: {
    ...fonts.medium,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg + RULES_TITLE_SPACE_ABOVE,
    marginBottom: RULES_TITLE_SPACE_BELOW,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    marginTop: spacing.xs,
  },
  cardSlot: {
    width: layout.blockingCardColumnWidth,
    height: layout.blockingTemplateCardMinHeight,
  },
  suggestionCardSlot: {
    width: layout.blockingCardColumnWidth,
    height: layout.blockingTemplateCardMinHeight,
  },
  loader: {
    width: '100%',
    marginVertical: spacing.xl,
  },
  newRuleCard: {
    minHeight: layout.blockingTemplateCardMinHeight,
    borderRadius: radius.visual,
    backgroundColor: colors.blockingSurfaceCool,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: shadow.blockingSubtle.shadowColor,
    shadowOpacity: shadow.blockingSubtle.shadowOpacity,
    shadowRadius: shadow.blockingSubtle.shadowRadius,
    shadowOffset: shadow.blockingSubtle.shadowOffset,
  },
  newRulePlus: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  newRuleLabel: {
    ...fonts.semiBold,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
  },
  emptyPanel: {
    height: layout.blockingLockedTileSize + spacing.xl,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  emptyPanelTiles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.4,
  },
  emptyPanelTile: {
    width: layout.blockingLockedTileSize,
    height: layout.blockingLockedTileSize,
    borderRadius: radius.panel,
    backgroundColor: colors.blockingSurfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  emptyPanelCopy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  emptyAvailable: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
  },
  emptyHint: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.micro,
  },
  emptyHintLink: {
    ...fonts.semiBold,
    color: colors.blockingAccentLight,
    textDecorationLine: 'underline',
  },
  emptyHintLinkPending: {
    opacity: 0.5,
  },
})
