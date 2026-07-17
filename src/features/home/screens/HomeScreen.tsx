import { IconName } from '@assets/icons'
import { type NavigationProp, useNavigation } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
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
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useFreshInstallPrompt } from '@/features/blocking/hooks/useFreshInstallPrompt'
import { useHomeStats } from '@/features/blocking/hooks/useHomeStats'
import { useRuleReconciler } from '@/features/blocking/hooks/useRuleReconciler'
import { timedRunning } from '@/features/blocking/types'
import { ScreenTimeHero } from '@/features/home/components/ScreenTimeHero'
import { TryNextCard } from '@/features/home/components/TryNextCard'
import { useNotificationReconciler } from '@/features/notifications/useNotificationReconciler'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import type { HomeTabParamList } from '@/navigation/root-param-list'
import { ROUTES } from '@/navigation/routes'
import { TAB_BAR_CLEARANCE } from '@/navigation/tabs/AnimatedTabBar'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { fonts } from '@/shared/theme/tokens/fonts'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => FW[w]

// Palette exacte de la maquette « Relock Home ».
const C = {
  card: '#1C1C1E',
  accent: '#A5A1F5',
  onAccent: '#131318',
  ink: '#F5F5F7',
  ink55: 'rgba(235,235,245,0.55)',
  ink50: 'rgba(235,235,245,0.5)',
  ink45: 'rgba(235,235,245,0.45)',
  ink35: 'rgba(235,235,245,0.35)',
  ink32: 'rgba(235,235,245,0.32)',
  ink85: 'rgba(235,235,245,0.85)',
  subtleBg: 'rgba(255,255,255,0.055)',
  sep: 'rgba(255,255,255,0.06)',
  iconTint: 'rgba(165,161,245,0.13)',
  iconStroke: '#B4B0F8',
  switchOff: 'rgba(120,120,128,0.3)',
  danger: '#F87171',
  dangerInk: '#FCA5A5',
  dangerInk2: 'rgba(252,165,165,0.75)',
  dangerBg: 'rgba(239,68,68,0.10)',
  dangerBorder: 'rgba(248,113,113,0.35)',
  dangerIconBg: 'rgba(239,68,68,0.16)',
}

export default function HomeScreen() {
  // L'onglet Blocages est un frère : on navigue via le navigateur d'onglets.
  const tabNav = useNavigation<NavigationProp<HomeTabParamList>>()
  const { rules, isPending: rulesPending } = useBlockRulesQuery()
  const stats = useHomeStats()
  useFreshInstallPrompt()
  // Auto-réparation : iOS peut perdre la surveillance native (réinstall,
  // mise à jour) — on ré-arme les règles persistantes actives au lancement.
  useRuleReconciler(rules, !rulesPending)

  // Un « Bloquer maintenant » terminé disparaît (ponctuel).
  const visibleRules = rules.filter(
    r => !(r.type === 'progressive_delay' && !timedRunning(r)),
  )
  const protectedToday = rules.some(
    r => r.isActive && !(r.type === 'progressive_delay' && !timedRunning(r)),
  )
  useNotificationReconciler(stats.streak, protectedToday)

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
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* Header : logo + réglages */}
          <View style={styles.header}>
            <Image
              source={require('../../../../assets/relock-wordmark.png')}
              style={styles.brandLogo}
              resizeMode="contain"
              accessibilityLabel="Relock"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réglages"
              onPress={() => navigate(ROUTES.SETTINGS)}
              hitSlop={10}
              style={styles.gear}
            >
              <IconSvg name={IconName.SETTINGS} size={21} color={C.ink55} />
            </Pressable>
          </View>

          {/* Hero : temps d'écran du jour + delta + pilules par app */}
          <ScreenTimeHero />

          {/* Titre motivant, minimaliste, au-dessus de la série */}
          <Text style={[f(700), styles.streakHeading]}>
            Ne casse pas la chaîne
          </Text>

          {/* Carte série (avec stats intégrées) */}
          <View style={styles.streakCard}>
            <View style={styles.rowBetween}>
              <Text style={[f(500), { fontSize: 14, color: C.ink55 }]}>
                Série en cours
              </Text>
              <Text style={[f(500), { fontSize: 13, color: C.ink35 }]}>
                Record · {Math.max(stats.record, stats.streak)} j
              </Text>
            </View>

            <View style={styles.streakRow}>
              {/* Tant que les données ne sont pas là, « 0 » serait un mensonge :
                  un chargement ou une panne réseau s'afficherait exactement
                  comme une série réellement à zéro. */}
              <Text style={[f(700), styles.tnum, styles.streakNum]}>
                {stats.isPending ? '—' : stats.streak}
              </Text>
              <Text style={[f(600), { fontSize: 16, color: C.ink }]}>
                {stats.streak > 1 ? 'jours' : 'jour'} de contrôle
              </Text>
            </View>

            {/* Semaine — cercles L→D */}
            <View style={styles.week}>
              {stats.week.map((w, i) => (
                <View
                  key={`${w.d}-${i}`}
                  style={[
                    styles.dayCircle,
                    {
                      backgroundColor: w.done ? C.accent : C.subtleBg,
                    },
                    w.today && styles.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      f(600),
                      {
                        fontSize: 12,
                        color: w.done
                          ? C.onAccent
                          : w.today
                            ? C.ink85
                            : C.ink32,
                      },
                    ]}
                  >
                    {w.d}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.streakDivider} />

            {/* Stats intégrées : regagnées | ouverture évitée */}
            <View style={styles.streakStats}>
              <View style={{ flex: 1 }}>
                <Text style={[f(700), styles.statVal]}>
                  {stats.isPending ? '—' : fmtSaved(stats.savedMinutes)}
                </Text>
                <Text style={[f(400), styles.statLabel]}>
                  regagnées aujourd'hui
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={{ flex: 1, paddingLeft: 20 }}>
                <Text style={[f(700), styles.statVal]}>
                  {stats.isPending ? '—' : stats.interceptions}
                </Text>
                <Text style={[f(400), styles.statLabel]}>
                  ouverture{stats.interceptions > 1 ? 's' : ''} évitée
                  {stats.interceptions > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </View>

          {/* La gestion des blocages vit dans son onglet : l'Accueil montre la
              RÉCOMPENSE, pas la plomberie. Seul reste un appel à l'action, tant
              qu'aucun blocage n'existe — il disparaît dès le premier, et
              revient s'il n'en reste plus. Il renvoie vers l'onglet Blocages
              (le foyer des blocages), pas directement vers la création. */}
          {!rulesPending && visibleRules.length === 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rien ne protège ton temps — ouvrir Blocages"
              onPress={() => tabNav.navigate(ROUTES.TAB_BLOCKS)}
              style={styles.emptyBig}
            >
              <View style={styles.emptyBigIcon}>
                <IconSvg name={IconName.PLUS} size={24} color={C.iconStroke} />
              </View>
              <Text style={[f(700), styles.emptyBigTitle]}>
                Rien ne protège ton temps
              </Text>
              <Text style={[f(400), styles.emptyBigSub]}>
                Ton téléphone est grand ouvert. Choisis un premier moment à
                protéger.
              </Text>
            </Pressable>
          )}

          {/* Les suggestions, elles, ne s'en vont jamais : il y a toujours un
              moment de plus à protéger. Les deux cartes peuvent donc coexister
              à la première ouverture. */}
          <TryNextCard rules={rules} />

          {/* Alerte : Temps d'écran non autorisé */}
          {needsScreenTime && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Activer le contrôle du temps d'écran"
              onPress={requestScreenTimeAuth}
              style={styles.alertCard}
            >
              <View style={styles.alertIcon}>
                <IconSvg name={IconName.MONITOR} size={18} color={C.danger} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[f(700), { fontSize: 14.5, color: C.dangerInk }]}>
                  Active le contrôle du temps d'écran
                </Text>
                <Text style={[f(400), styles.alertSub]}>
                  Sans cette autorisation, Relock ne peut pas bloquer tes apps.
                  Appuie pour l'activer.
                </Text>
              </View>
              <IconSvg name={IconName.FORWARD} size={18} color={C.danger} />
            </Pressable>
          )}

          <View style={{ height: 8 }} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

function fmtSaved(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  // Appel à l'action agrandi : un écran vide est une invitation à agir.
  emptyBig: {
    marginTop: 26,
    backgroundColor: C.card,
    borderRadius: 22,
    paddingVertical: 30,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  emptyBigIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: C.iconTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyBigTitle: { fontSize: 18, color: C.ink, letterSpacing: -0.3 },
  emptyBigSub: {
    fontSize: 13.5,
    color: C.ink55,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 260,
  },
  scrollContent: { flexGrow: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLogo: { width: 114, height: 22 },
  gear: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tnum: { fontVariant: ['tabular-nums'] },

  // Titre motivant au-dessus de la série
  streakHeading: {
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.4,
    marginTop: 24,
    marginBottom: 11,
    paddingHorizontal: 2,
  },
  // Carte série
  streakCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 18,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 9,
    marginTop: 6,
  },
  streakNum: {
    fontSize: 40,
    color: C.accent,
    letterSpacing: -1,
    lineHeight: 42,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayToday: {
    borderWidth: 2,
    borderColor: C.accent,
  },
  streakDivider: {
    height: 1,
    backgroundColor: C.sep,
    marginTop: 14,
  },
  streakStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  statVal: {
    fontSize: 19,
    color: C.ink,
    letterSpacing: -0.4,
  },
  statLabel: { fontSize: 12, color: C.ink50, marginTop: 3 },
  statDivider: { width: 1, height: 30, backgroundColor: C.sep },

  // Alerte autorisation
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: C.dangerBg,
    borderWidth: 1,
    borderColor: C.dangerBorder,
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: C.dangerIconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertSub: {
    fontSize: 12.5,
    color: C.dangerInk2,
    marginTop: 3,
    lineHeight: 17,
  },
})
