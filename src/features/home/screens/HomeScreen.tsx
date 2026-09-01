import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AppState,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useExtendTimedBlockMutation } from '@/features/blocking/hooks/useExtendTimedBlockMutation'
import { useFreshInstallReset } from '@/features/blocking/hooks/useFreshInstallReset'
import { useHomeStats } from '@/features/blocking/hooks/useHomeStats'
import { useLimitSteps } from '@/features/blocking/hooks/useLimitSteps'
import { useRuleAutoCleanup } from '@/features/blocking/hooks/useRuleAutoCleanup'
import { useRuleReconciler } from '@/features/blocking/hooks/useRuleReconciler'
import { buildSessions, type RuleSession } from '@/features/blocking/session'
import { ActiveProtectionCard } from '@/features/home/components/ActiveProtectionCard'
import { DailyResultsCard } from '@/features/home/components/DailyResultsCard'
import { EmptyProtectionCard } from '@/features/home/components/EmptyProtectionCard'
import { QuickStartRail } from '@/features/home/components/QuickStartRail'
import { ScreenTimeHero } from '@/features/home/components/ScreenTimeHero'
import { useNotificationReconciler } from '@/features/notifications/useNotificationReconciler'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => FW[w]

const { colors, layout, radius, typography } = relockMaterial

export default function HomeScreen() {
  const insets = useSafeAreaInsets()
  const { rules, isPending: rulesPending } = useBlockRulesQuery()
  const stats = useHomeStats()
  useFreshInstallReset()
  // Auto-réparation : iOS peut perdre la surveillance native (réinstall,
  // mise à jour) — on ré-arme les règles persistantes actives au lancement.
  useRuleReconciler(rules, !rulesPending)
  // Timers terminés / suspensions échues : retirés d'office, comme sur
  // l'onglet Blocages — sans ça un timer fini traînerait sur l'Accueil.
  useRuleAutoCleanup(rules)

  // Les libellés « encore X min » sont temporels : on retick régulièrement.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const limitSteps = useLimitSteps()
  const sessions = useMemo(
    () => buildSessions(rules, now, limitSteps),
    [rules, now, limitSteps],
  )
  // Tant que les règles n'ont pas encore chargé, `rules` vaut `[]` par
  // défaut : `hasAnyBlockage` seul y lirait à tort « aucun blocage » et
  // ferait clignoter un utilisateur protégé sur l'état « nouvel
  // utilisateur » le temps du premier chargement.
  const hasAnyBlockage = sessions.length > 0
  const isActive = !rulesPending && hasAnyBlockage

  // Priorité au « Bloquer maintenant » en cours pour piloter l'anneau/apps/
  // +15 min ; une plage horaire simultanément active s'affiche en ligne
  // d'info sous la carte plutôt que de prendre sa place.
  const running = sessions.filter(s => s.state === 'running')
  const runningTimed = running.find(s => s.rule.type === 'progressive_delay')
  const runningSchedule = running.find(s => s.rule.type === 'schedule')
  // Une limite quotidienne est toujours « en cours » tant que la règle est
  // active (cf. deriveSession) : sans ce dernier repli, un utilisateur dont
  // la SEULE protection est une limite se voyait afficher « Aucune
  // protection active » alors qu'elle protège réellement.
  const runningLimit = running.find(s => s.rule.type === 'daily_limit')
  const primary = runningTimed ?? runningSchedule ?? runningLimit ?? null
  const scheduleFooter =
    primary && primary.rule.type !== 'schedule'
      ? (runningSchedule ?? null)
      : null
  // Rien de « live » : on montre la protection la plus proche (à venir ou
  // suspendue) pour dire ce qui se passe, plutôt qu'un vide muet.
  const idleSession: RuleSession | null = primary
    ? null
    : (sessions.find(s => s.state === 'upcoming') ??
      sessions.find(s => s.state === 'suspended') ??
      sessions[0] ??
      null)

  useNotificationReconciler(stats.streak, running.length > 0)

  const extendMutation = useExtendTimedBlockMutation()
  const onExtend = () => {
    if (!runningTimed) return
    extendMutation.mutate(
      { rule: runningTimed.rule, addMinutes: 15 },
      { onError: e => showErrorToast(e) },
    )
  }

  // Autorisation Temps d'écran : sans elle rien ne bloque.
  const [needsScreenTime, setNeedsScreenTime] = useState(false)
  useEffect(() => {
    if (!ScreenTime.isAvailable) return
    const check = () => {
      ScreenTime.authorizationStatus()
        .then(s => setNeedsScreenTime(s !== 'approved'))
        .catch(() => {})
    }
    check()
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') check()
    })
    return () => sub.remove()
  }, [])

  const requestScreenTimeAuth = () => {
    const toSettings = () =>
      Alert.alert(
        'Autorisation requise',
        "Ouvre Réglages > Temps d'écran et autorise Relock à gérer le temps d'écran.",
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir Réglages', onPress: () => Linking.openSettings() },
        ],
      )
    ScreenTime.requestAuthorization()
      .then(s => {
        const ok = s === 'approved'
        setNeedsScreenTime(!ok)
        if (!ok) toSettings()
      })
      .catch(() => toSettings())
  }

  return (
    <ScreenWrapper
      disableTopInset
      statusBarProps={{
        backgroundColor: colors.transparent,
        translucent: true,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.container,
            { paddingTop: insets.top + layout.headerTop },
          ]}
        >
          {/* Header : logo + série + réglages */}
          <View style={styles.header}>
            <Image
              source={require('../../../../assets/relock-wordmark.png')}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="Relock"
            />
            <View style={styles.headerActions}>
              {stats.streak > 0 && (
                <Image
                  source={require('@assets/home-flamme.png')}
                  style={styles.flame}
                  resizeMode="contain"
                  accessibilityLabel={`Série de ${stats.streak} jour${stats.streak > 1 ? 's' : ''}`}
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Réglages"
                onPress={() => router.push('/settings')}
                hitSlop={10}
                style={styles.gear}
              >
                <IconSvg
                  name={IconName.SETTINGS}
                  size={layout.headerIconSize}
                  color={colors.textPrimary}
                />
              </Pressable>
            </View>
          </View>

          {!rulesPending &&
            (isActive ? (
              <ScreenTimeHero />
            ) : (
              <View style={styles.welcome}>
                <Text style={[f(600), styles.welcomeKicker]}>
                  Bienvenue dans Relock
                </Text>
                <Text style={[f(400), styles.welcomeSub]}>
                  Commence par protéger un premier{'\n'}moment de ta journée.
                </Text>
              </View>
            ))}

          {/* L'alerte passe AVANT le reste : sans cette autorisation rien ne
              bloque, donc ce qui suit ne veut rien dire. */}
          {needsScreenTime && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Activer le contrôle du temps d'écran"
              onPress={requestScreenTimeAuth}
              style={styles.alertCard}
            >
              <View style={styles.alertIcon}>
                <IconSvg
                  name={IconName.MONITOR}
                  size={typography.sectionTitleSize}
                  color={colors.alertText}
                />
              </View>
              <View style={styles.alertCopy}>
                <Text style={[f(700), styles.alertTitle]}>
                  Active le contrôle du temps d'écran
                </Text>
                <Text style={[f(400), styles.alertSub]}>
                  Sans cette autorisation, Relock ne peut pas bloquer tes apps.
                  Appuie pour l'activer.
                </Text>
              </View>
              <IconSvg
                name={IconName.FORWARD}
                size={typography.sectionTitleSize}
                color={colors.alertText}
              />
            </Pressable>
          )}

          {!rulesPending &&
            (isActive ? (
              <ActiveProtectionCard
                primaryRule={primary?.rule ?? null}
                scheduleFooterRule={scheduleFooter?.rule ?? null}
                idleSession={idleSession}
                now={now}
                onExtend={onExtend}
                extending={extendMutation.isPending}
              />
            ) : (
              <EmptyProtectionCard />
            ))}

          {!rulesPending &&
            (isActive ? (
              <DailyResultsCard
                savedMinutesWeek={stats.savedMinutesWeek}
                interceptions={stats.interceptions}
                isPending={stats.isPending}
              />
            ) : (
              <QuickStartRail rules={rules} />
            ))}
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenHorizontal,
    paddingBottom: layout.bottomNavigationClearance + layout.scrollBottom,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLogo: {
    width: layout.headerLogoWidth,
    height: layout.headerLogoHeight,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.welcomeCopyGap,
  },
  flame: {
    width: layout.headerFlameSize,
    height: layout.headerFlameSize,
  },
  gear: {
    width: layout.headerActionSize,
    height: layout.headerActionSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcome: {
    marginTop: layout.headerBottom,
    marginBottom: layout.welcomeBottom,
  },
  welcomeKicker: {
    fontSize: typography.welcomeTitleSize,
    lineHeight: typography.welcomeTitleLineHeight,
    color: colors.accentViolet,
  },
  welcomeSub: {
    fontSize: typography.welcomeBodySize,
    color: colors.textSecondary,
    lineHeight: typography.welcomeBodyLineHeight,
    marginTop: layout.welcomeCopyGap,
  },

  // Alerte autorisation
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.panelPadding,
    marginBottom: layout.sectionGap,
    padding: layout.panelPadding,
    borderRadius: radius.action,
    backgroundColor: colors.alertBackground,
    borderWidth: 1,
    borderColor: colors.alertBorder,
  },
  alertIcon: {
    width: layout.headerActionSize,
    height: layout.headerActionSize,
    borderRadius: radius.compact,
    backgroundColor: colors.alertBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCopy: {
    flex: 1,
    minWidth: 0,
  },
  alertTitle: {
    fontSize: typography.welcomeBodySize,
    lineHeight: typography.welcomeBodyLineHeight,
    color: colors.alertText,
  },
  alertSub: {
    fontSize: typography.quickTitleSize - 3,
    color: colors.alertTextMuted,
    marginTop: layout.welcomeCopyGap,
    lineHeight: typography.welcomeBodyLineHeight - 3,
  },
})
