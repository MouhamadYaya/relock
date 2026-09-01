/**
 * Fiche d'un blocage — refonte « Opal » (§8).
 *
 * Ce qu'on voit d'abord, c'est CE QUI EST PROTÉGÉ : le badge du type, le temps
 * qu'il reste, puis les apps réellement sous bouclier. Les réglages viennent
 * après, en deux lignes. Et tout en bas, deux sorties seulement — jamais un
 * empilement de boutons destructeurs.
 *
 * Friction : les DEUX sorties passent par la respiration de six secondes.
 * Ouvrir une app et arrêter le blocage sont deux décisions qu'on ne prend pas
 * en réflexe ; ce qui se décide vite se regrette vite.
 *
 * Mode strict : quand la session est verrouillée, les deux sorties sont
 * éteintes et la ligne « Déblocages autorisés » passe à « Non ». Il n'y a rien
 * à négocier — c'est l'utilisateur lucide d'hier qui a décidé.
 */
import { IconName } from '@assets/icons'
import { router, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import {
  BLOCKED_APP_SLOT_HEIGHT,
  BlockedAppTileView,
} from '@/features/blocking/components/BlockedAppTileView'
import {
  RuleTemplateFlowBadge,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import {
  BlockingCardSurface,
  BrandActionSurface,
  SheetBloom,
} from '@/features/blocking/components/BlockingSurfaces'
import { BreathingPauseModal } from '@/features/blocking/components/BreathingPauseModal'
import { HalfSheet } from '@/features/blocking/components/HalfSheet'
import { HoldToDeleteSheet } from '@/features/blocking/components/HoldToDeleteSheet'
import { PauseDurationSheet } from '@/features/blocking/components/PauseDurationSheet'
import { StrictBlockSheet } from '@/features/blocking/components/StrictBlockSheet'
import { UnlockAppsSheet } from '@/features/blocking/components/UnlockAppsSheet'
import { UnlockDurationSheet } from '@/features/blocking/components/UnlockDurationSheet'
import {
  durationLabel,
  durationLabelFromMinutes,
  hhmm,
} from '@/features/blocking/format'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useDeleteRuleMutation } from '@/features/blocking/hooks/useDeleteRuleMutation'
import { useSuspendRuleMutation } from '@/features/blocking/hooks/useSuspendRuleMutation'
import {
  daysLabel,
  deriveSession,
  isSessionLocked,
  ruleDays,
  scheduleNextStart,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { showErrorToast } from '@/shared/utils/toast'

const { colors, layout, opacity, radius, shadow, typography } = relockMaterial

/** Étapes du parcours. Une seule feuille est ouverte à la fois. */
type Flow =
  | null
  | 'breathing-unlock'
  | 'apps'
  | 'duration'
  | 'breathing-quit'
  | 'pause'
  | 'delete'

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' ? value : fallback

function glyphKind(rule: BlockRuleView): RuleTypeGlyphKind {
  if (rule.type === 'progressive_delay') return 'session'
  if (rule.type === 'daily_limit') return 'limit'
  return 'schedule'
}

const hhmmParts = (h: unknown, m: unknown) =>
  `${String(num(h, 0)).padStart(2, '0')}:${String(num(m, 0)).padStart(2, '0')}`

/** Cadenas ouvert — l'action « ouvrir », pas l'état « bloqué ». */
function OpenLockGlyph({ color }: { color: string }) {
  return (
    <Svg width={spacing.lg} height={spacing.lg} viewBox="0 0 24 24">
      <Path
        d="M16.5 10.5V7a4.5 4.5 0 0 0-9 0"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Rect
        x={4.5}
        y={10.5}
        width={15}
        height={10}
        rx={3}
        fill="none"
        stroke={color}
        strokeWidth={1.9}
      />
    </Svg>
  )
}

/** Deux barres — « quitter en avance » met la règle en pause, pas au rebut. */
function PauseGlyph({ color }: { color: string }) {
  return (
    <Svg width={spacing.md} height={spacing.md} viewBox="0 0 24 24">
      <Rect x={6.5} y={4} width={4} height={16} rx={2} fill={color} />
      <Rect x={13.5} y={4} width={4} height={16} rx={2} fill={color} />
    </Svg>
  )
}

/** Une ligne de réglage : ce qu'on a choisi, à droite, en clair. */
function InfoRow({
  label,
  value,
  last,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

export default function BlockDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useT()
  const { rules } = useBlockRulesQuery()
  const suspend = useSuspendRuleMutation()
  const del = useDeleteRuleMutation()

  const [now, setNow] = useState(() => new Date())
  const [flow, setFlow] = useState<Flow>(null)
  const [appKeys, setAppKeys] = useState<string[]>([])
  const [reprieved, setReprieved] = useState<Record<string, number>>({})
  // Apps visées par le déblocage en cours : une seule (raccourci depuis une
  // tuile) ou celles cochées dans la feuille de sélection.
  const [targets, setTargets] = useState<string[]>([])
  const [shortcutKey, setShortcutKey] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [strictNotice, setStrictNotice] = useState(false)

  const rule = rules.find(item => item.id === id)

  const loadApps = useCallback(async () => {
    if (!id || !ScreenTime.isAvailable) return
    const [keys, reprievedKeys] = await Promise.all([
      ScreenTime.appKeys(id).catch((): string[] => []),
      ScreenTime.reprievedKeys().catch((): Record<string, number> => ({})),
    ])
    setAppKeys(keys)
    setReprieved(reprievedKeys)
  }, [id])

  useEffect(() => {
    loadApps()
  }, [loadApps])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Le sursis le plus proche fixe le prochain rafraîchissement : la rangée se
  // reverrouille toute seule, sans que l'écran soit rouvert.
  useEffect(() => {
    const next = Object.values(reprieved).sort((a, b) => a - b)[0]
    if (next == null) return
    const delay = Math.max(0, next * 1000 - Date.now() + 100)
    const timer = setTimeout(() => loadApps(), delay)
    return () => clearTimeout(timer)
  }, [reprieved, loadApps])

  if (!rule) return null

  const session = deriveSession(rule, now)
  const locked = isSessionLocked(rule, now)
  const config = rule.config ?? {}
  const lockedKeys = appKeys.filter(key => reprieved[key] == null)

  /** La ligne d'accent : le type, puis le seul chiffre qui compte. */
  const headline = (): string => {
    if (session.state === 'suspended') {
      return t('blocking.session_sheet.headline_paused')
    }
    if (rule.type === 'daily_limit') {
      return t('blocking.session_sheet.headline_limit', {
        time: durationLabelFromMinutes(num(config.limit_min, 60)),
      })
    }
    if (session.state === 'upcoming') {
      return t('blocking.session_sheet.headline_upcoming', {
        time: hhmm(scheduleNextStart(rule, now)),
      })
    }
    if (rule.type === 'schedule' && session.sessionEndsAt) {
      return t('blocking.session_sheet.headline_schedule', {
        time: hhmm(session.sessionEndsAt),
      })
    }
    if (session.sessionEndsAt) {
      return t('blocking.session_sheet.headline_session', {
        time: durationLabel(session.sessionEndsAt.getTime() - now.getTime()),
      })
    }
    return t('blocking.session_sheet.headline_paused')
  }

  /** « Pendant » : la durée choisie, dite dans les mots du type de règle. */
  const duringValue = (): string => {
    if (rule.type === 'schedule') {
      const range = `${hhmmParts(config.start_hour, config.start_minute)} → ${hhmmParts(config.end_hour, config.end_minute)}`
      const days = ruleDays(rule)
      return days ? `${range} · ${daysLabel(days)}` : range
    }
    if (rule.type === 'daily_limit') {
      return durationLabelFromMinutes(num(config.limit_min, 60))
    }
    return durationLabelFromMinutes(num(config.duration_min, 30))
  }

  const closeSheet = (close: () => void) => close()

  /**
   * Passe d'une feuille à la suivante en laissant UNE frame sans rien de
   * présenté. iOS refuse de présenter une modale tant que la précédente est
   * encore en train de se fermer — enchaîner dans le même rendu perdait la
   * seconde feuille (même parade que la rangée « Apps bloquées »).
   */
  const goToFlow = (next: Flow) => {
    setFlow(null)
    requestAnimationFrame(() => setFlow(next))
  }

  const startUnlock = () => {
    setShortcutKey(null)
    setFlow('breathing-unlock')
  }

  const startQuit = () => setFlow('breathing-quit')

  /** Tuile : ouvrir CETTE app (respiration incluse), ou la refermer tout de suite. */
  const onTilePress = async (key: string) => {
    if (reprieved[key] != null) {
      // Refermer va dans le sens de la protection : aucune friction à ajouter.
      try {
        await ScreenTime.reblockAppKey(key)
      } catch (error) {
        showErrorToast(error)
      }
      await loadApps()
      return
    }
    if (locked) {
      // Un tap sans effet passerait pour un bug : on dit pourquoi, et
      // jusqu'à quand.
      setStrictNotice(true)
      return
    }
    setShortcutKey(key)
    setFlow('breathing-unlock')
  }

  const afterBreathingUnlock = () => {
    if (shortcutKey) {
      setTargets([shortcutKey])
      goToFlow('duration')
      return
    }
    goToFlow('apps')
  }

  const confirmUnlock = async (minutes: number) => {
    if (targets.length === 0) return
    setPending(true)
    try {
      for (const key of targets) {
        await ScreenTime.unblockAppKey(key, minutes)
      }
      setFlow(null)
      setTargets([])
      setShortcutKey(null)
    } catch (error) {
      showErrorToast(error)
    } finally {
      await loadApps()
      setPending(false)
    }
  }

  const confirmPause = (until: Date | null, close: () => void) => {
    setPending(true)
    suspend.mutate(
      { rule, until },
      {
        onError: error => {
          setPending(false)
          showErrorToast(error)
        },
        onSuccess: () => {
          setPending(false)
          setFlow(null)
          close()
        },
      },
    )
  }

  const confirmDelete = (close: () => void) => {
    setPending(true)
    if (ScreenTime.isAvailable) {
      ScreenTime.clearRuleData(rule.id, nativeKindOf(rule.type)).catch(() => {})
    }
    del.mutate(
      { id: rule.id },
      {
        onError: error => {
          setPending(false)
          showErrorToast(error)
        },
        onSuccess: () => {
          setPending(false)
          setFlow(null)
          close()
        },
      },
    )
  }

  return (
    <HalfSheet onClose={() => router.back()}>
      {close => (
        <View style={styles.wrap}>
          {/* La feuille porte la couleur de Relock, pas le gris du système. */}
          <View pointerEvents="none" style={styles.bloom}>
            <SheetBloom />
          </View>

          <View style={styles.topBar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.session_sheet.close')}
              onPress={() => closeSheet(close)}
              style={styles.roundAction}
            >
              <IconSvg
                name={IconName.CLOSE}
                size={spacing.lg}
                color={colors.textPrimary}
              />
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.session_sheet.edit')}
              // On empile l'éditeur PAR-DESSUS la fiche : en le refermant on
              // retombe sur la fiche, déjà rafraîchie par l'invalidation.
              onPress={() =>
                router.push({
                  pathname: '/block-editor',
                  params: { id: rule.id },
                })
              }
              style={styles.editAction}
            >
              <Text style={styles.editLabel}>
                {t('blocking.session_sheet.edit')}
              </Text>
            </PressableScale>
          </View>

          <View style={styles.identity}>
            <RuleTemplateFlowBadge kind={glyphKind(rule)} />
            <Text style={styles.headline}>{headline()}</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {session.title}
            </Text>
          </View>

          <View style={styles.panel}>
            <BlockingCardSurface cornerRadius={radius.panel} />
            <Text style={styles.panelTitle}>
              {t('blocking.session_sheet.blocked_title')}
            </Text>
            {appKeys.length === 0 ? (
              <Text style={styles.panelEmpty}>
                {t('blocking.session_sheet.no_apps')}
              </Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tilesViewport}
                contentContainerStyle={styles.tilesContent}
              >
                {appKeys.map(key => (
                  <BlockedAppTileView
                    key={key}
                    tokenKey={key}
                    unlocked={reprieved[key] != null}
                    reprievedUntil={reprieved[key]}
                    label={
                      reprieved[key] != null
                        ? t('blocking.reblock_app.action')
                        : t('blocking.unlock')
                    }
                    disabled={pending}
                    onPress={() => onTilePress(key)}
                  />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.infoCard}>
            <BlockingCardSurface cornerRadius={radius.panel} />
            <InfoRow
              label={t('blocking.session_sheet.during')}
              value={duringValue()}
            />
            <InfoRow
              label={t('blocking.session_sheet.unlocks_allowed')}
              value={
                locked
                  ? t('blocking.session_sheet.allowed_no')
                  : t('blocking.session_sheet.allowed_yes')
              }
              last
            />
          </View>

          {locked ? (
            <Text style={styles.strictNotice}>
              {t('blocking.session_sheet.strict_notice')}
            </Text>
          ) : null}

          <PressableScale
            testID="session-unlock-apps"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.session_sheet.unlock_apps')}
            accessibilityState={{ disabled: locked || lockedKeys.length === 0 }}
            disabled={locked || lockedKeys.length === 0 || pending}
            onPress={startUnlock}
            style={[
              styles.primaryAction,
              (locked || lockedKeys.length === 0) && styles.actionDisabled,
            ]}
          >
            <BrandActionSurface />
            <OpenLockGlyph color={colors.onAccent} />
            <Text style={styles.primaryLabel}>
              {t('blocking.session_sheet.unlock_apps')}
            </Text>
          </PressableScale>

          <PressableScale
            testID="session-quit-early"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.session_sheet.quit_early')}
            accessibilityState={{ disabled: locked }}
            disabled={locked || pending}
            onPress={startQuit}
            style={[styles.secondaryAction, locked && styles.actionDisabled]}
          >
            <PauseGlyph color={colors.textPrimary} />
            <Text style={styles.secondaryLabel}>
              {t('blocking.session_sheet.quit_early')}
            </Text>
          </PressableScale>

          <StrictBlockSheet
            visible={strictNotice}
            scope="app"
            ruleTitle={session.title}
            endsAt={session.sessionEndsAt}
            onClose={() => setStrictNotice(false)}
          />

          <BreathingPauseModal
            visible={flow === 'breathing-unlock'}
            tokenKey={shortcutKey ?? undefined}
            allApps={!shortcutKey}
            onCancel={() => setFlow(null)}
            onContinue={afterBreathingUnlock}
          />

          <UnlockAppsSheet
            visible={flow === 'apps'}
            appKeys={lockedKeys}
            pending={pending}
            onCancel={() => setFlow(null)}
            onConfirm={keys => {
              setTargets(keys)
              goToFlow('duration')
            }}
          />

          <UnlockDurationSheet
            visible={flow === 'duration'}
            tokenKey={targets.length === 1 ? targets[0] : undefined}
            allApps={targets.length > 1}
            pending={pending}
            onCancel={() => setFlow(null)}
            onPick={confirmUnlock}
          />

          <BreathingPauseModal
            visible={flow === 'breathing-quit'}
            allApps
            onCancel={() => setFlow(null)}
            onContinue={() => goToFlow('pause')}
          />

          <PauseDurationSheet
            visible={flow === 'pause'}
            pending={pending}
            onBack={() => setFlow(null)}
            onConfirm={until => confirmPause(until, close)}
            onDelete={() => goToFlow('delete')}
          />

          <HoldToDeleteSheet
            visible={flow === 'delete'}
            pending={pending}
            onCancel={() => goToFlow('pause')}
            onConfirm={() => confirmDelete(close)}
          />
        </View>
      )}
    </HalfSheet>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xxs,
    paddingBottom: spacing.xxs,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundAction: {
    width: layout.headerActionSize,
    height: layout.headerActionSize,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingGlass,
  },
  editAction: {
    minHeight: spacing.xxxl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingGlass,
  },
  editLabel: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  identity: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  headline: {
    ...fonts.medium,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
    textAlign: 'center',
    marginTop: spacing.micro,
  },
  // Le halo déborde du contenu pour toucher les bords de la feuille — c'est
  // elle qui le rogne (`overflow: hidden`), il n'en sort donc jamais.
  bloom: {
    position: 'absolute',
    top: -spacing.xxxxl,
    bottom: 0,
    left: -spacing.xxxl,
    right: -spacing.xxxl,
  },
  panel: {
    borderRadius: radius.panel,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    marginTop: spacing.lg,
  },
  panelTitle: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
  },
  panelEmpty: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    paddingVertical: spacing.sm,
  },
  // Hauteur EXPLICITE : tuile + espace réel du slot + ligne de légende. Le
  // précédent calcul utilisait la mauvaise line-height et rognait 6 points.
  tilesViewport: {
    flexGrow: 0,
    height: BLOCKED_APP_SLOT_HEIGHT,
    marginTop: spacing.sm,
  },
  tilesContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingRight: spacing.xs,
  },
  infoCard: {
    borderRadius: radius.panel,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  infoRow: {
    minHeight: spacing.xxxxl + spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.blockingBorder,
  },
  infoLabel: {
    ...fonts.medium,
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  infoValue: {
    ...fonts.medium,
    flexShrink: 1,
    maxWidth: '62%',
    color: colors.blockingAccentLight,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  strictNotice: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  primaryAction: {
    minHeight: layout.primaryActionHeight,
    flexDirection: 'row',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.capsule,
    marginTop: spacing.lg,
    // Halo violet plutôt que l'ombre neutre : l'action principale RAYONNE.
    shadowColor: shadow.glow.shadowColor,
    shadowOpacity: shadow.glow.shadowOpacity,
    shadowRadius: shadow.glow.shadowRadius,
    shadowOffset: shadow.glow.shadowOffset,
  },
  primaryLabel: {
    ...fonts.semiBold,
    color: colors.onAccent,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  secondaryAction: {
    minHeight: spacing.xxxxl + spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  secondaryLabel: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  actionDisabled: {
    opacity: opacity.disabled,
  },
})
