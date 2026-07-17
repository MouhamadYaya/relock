import { IconName } from '@assets/icons'
import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  DeviceEventEmitter,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTimeReport } from '@/shared/native/ScreenTimeReport'
import { ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => ({ fontFamily: FW[w] })

const C = {
  bg: '#0B0C10',
  surface: '#161821',
  surface2: '#1C1F2B',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  border: 'rgba(148,152,178,0.16)',
}

const SEGMENTS = ['Mois', 'Semaine', 'Jour']
const DOW = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] // getDay() 0=dimanche
const MONTHS_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

/** 7 derniers jours (plus ancien → aujourd'hui), avec décalage jour. */
function lastSevenDays(): { offset: number; letter: string; day: number }[] {
  const out: { offset: number; letter: string; day: number }[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    out.push({ offset, letter: DOW[d.getDay()], day: d.getDate() })
  }
  return out
}

/** Lundi (00:00) de la semaine de `d` — les semaines FR commencent lundi. */
function mondayOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/**
 * Nombre de périodes passées proposées. iOS ne conserve qu'un historique
 * court de temps d'écran : au-delà, les rapports reviennent vides. Trois
 * périodes couvrent ce qu'iOS sait réellement fournir.
 */
const PAST_PERIODS = 3

/** 3 dernières semaines (plus récente d'abord), avec décalage semaine. */
function lastWeeks(): { offset: number; label: string }[] {
  const out: { offset: number; label: string }[] = []
  const monday = mondayOf(new Date())
  for (let offset = 0; offset < PAST_PERIODS; offset++) {
    if (offset === 0) {
      out.push({ offset, label: 'Cette semaine' })
      continue
    }
    const d = new Date(monday)
    d.setDate(monday.getDate() - 7 * offset)
    out.push({
      offset,
      label: `Sem. du ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`,
    })
  }
  return out
}

/** 3 derniers mois (plus récent d'abord), avec décalage mois. */
function lastMonths(): { offset: number; label: string }[] {
  const out: { offset: number; label: string }[] = []
  const now = new Date()
  for (let offset = 0; offset < PAST_PERIODS; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const year =
      d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`
    out.push({
      offset,
      label: offset === 0 ? 'Ce mois-ci' : `${MONTHS[d.getMonth()]}${year}`,
    })
  }
  return out
}

function ReloadIcon({ color, size = 19 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export default function ActivityScreen() {
  const [seg, setSeg] = useState(2) // Jour par défaut
  // Décalage en unités de la période courante (jours/semaines/mois). 0 = actuel.
  const [offset, setOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const period = 2 - seg // Jour(2)->0, Semaine(1)->1, Mois(0)->2

  // Les listes de dates sont recalculées à chaque rechargement ET au retour au
  // premier plan : figées au montage, elles proposaient encore « hier » comme
  // dernier jour lorsque l'app passait minuit ouverte, et l'offset 0 ne
  // désignait alors plus aujourd'hui.
  const [dateEpoch, setDateEpoch] = useState(0)
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') setDateEpoch(e => e + 1)
    })
    return () => sub.remove()
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: recalcul volontaire au réveil / rechargement
  const days = useMemo(() => lastSevenDays(), [dateEpoch, reloadKey])
  // biome-ignore lint/correctness/useExhaustiveDependencies: idem
  const weeks = useMemo(() => lastWeeks(), [dateEpoch, reloadKey])
  // biome-ignore lint/correctness/useExhaustiveDependencies: idem
  const months = useMemo(() => lastMonths(), [dateEpoch, reloadKey])

  // Voile « Chargement… » : le rapport natif ne signale pas sa fin de rendu.
  // On l'efface après un délai borné (il est purement décoratif) — sinon il
  // masque définitivement le message des périodes sans données.
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 2500)
    return () => clearTimeout(t)
  }, [])

  // Sans autorisation Temps d'écran, iOS ne lance MÊME PAS l'extension de
  // rapport : les trois vues restent muettes et l'écran n'affichait qu'un
  // grand rectangle vide, sans la moindre explication. On le dit, et on
  // propose de l'accorder — comme le fait déjà l'Accueil.
  const [authorized, setAuthorized] = useState(true)
  useEffect(() => {
    if (!ScreenTime.isAvailable) return
    const check = () => {
      ScreenTime.authorizationStatus()
        .then(s => setAuthorized(s === 'approved'))
        .catch(() => {})
    }
    check()
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') check()
    })
    return () => sub.remove()
  }, [])

  const askAuthorization = () => {
    ScreenTime.requestAuthorization()
      .then(s => {
        setAuthorized(s === 'approved')
        if (s !== 'approved') Linking.openSettings()
      })
      .catch(() => Linking.openSettings())
  }

  const selectSegment = (i: number) => {
    setSeg(i)
    setOffset(0) // chaque période repart sur « actuel »
  }

  // Dev : pilotage des filtres par le pont de test (validation scriptée).
  useEffect(() => {
    if (!__DEV__) return
    const sub = DeviceEventEmitter.addListener(
      'relock-dev-activity-period',
      (p: { period: number; offset: number }) => {
        setSeg(2 - p.period)
        setOffset(p.offset)
      },
    )
    return () => sub.remove()
  }, [])

  return (
    <ScreenWrapper>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[f(800), styles.title]}>Activité</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rafraîchir"
              onPress={() => setReloadKey(k => k + 1)}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <ReloadIcon color={C.ink2} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réglages"
              onPress={() => navigate(ROUTES.SETTINGS)}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <IconSvg name={IconName.SETTINGS} size={19} color={C.ink2} />
            </Pressable>
          </View>
        </View>

        {/* Période */}
        <View style={styles.segment}>
          {SEGMENTS.map((s, i) => {
            const active = seg === i
            return (
              <Pressable
                key={s}
                onPress={() => selectSegment(i)}
                style={[
                  styles.segItem,
                  active && { backgroundColor: C.accent },
                ]}
              >
                <Text
                  style={[
                    f(active ? 700 : 600),
                    { fontSize: 14, color: active ? C.bg : C.ink2 },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Sélecteur de jour (mode Jour uniquement) — hauteur bornée pour ne
            pas étirer le ScrollView horizontal et pousser la carte en bas. */}
        {period === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.daysScroll}
            contentContainerStyle={styles.daysRow}
          >
            {days.map(d => {
              const active = d.offset === offset
              return (
                <Pressable
                  key={d.offset}
                  onPress={() => setOffset(d.offset)}
                  style={styles.dayCol}
                >
                  <Text style={[f(600), styles.dayLetter]}>{d.letter}</Text>
                  <View
                    style={[styles.dayCircle, active && styles.dayCircleActive]}
                  >
                    <Text
                      style={[
                        f(active ? 700 : 500),
                        { fontSize: 16, color: active ? C.bg : C.ink },
                      ]}
                    >
                      {d.day}
                    </Text>
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        {/* Sélecteur de semaine / mois — 6 dernières périodes, même principe
            que les 7 derniers jours (décalage passé au rapport natif). */}
        {period !== 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chipsRow}
          >
            {(period === 1 ? weeks : months).map(p => {
              const active = p.offset === offset
              return (
                <Pressable
                  key={p.offset}
                  onPress={() => setOffset(p.offset)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text
                    style={[
                      f(active ? 700 : 500),
                      { fontSize: 13.5, color: active ? C.bg : C.ink },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
        )}

        {/* Rapport système. Trois vues natives empilées — résumé, graphe,
            classement — car leurs filtres diffèrent : iOS ne fournit les
            activations/notifications QUE sur des tranches quotidiennes, alors
            que le graphe du jour a besoin de tranches horaires. Un même
            DeviceActivityReport ne portant qu'un seul filtre, c'est le seul
            moyen de garder le graphe AU MILIEU.

            Le défilement est celui de CE ScrollView : les rapports ont une
            hauteur fixe et `pointerEvents="none"` (ils n'ont aucune zone
            tactile), sinon la vue système capterait le geste et la page
            resterait figée. */}
        {!authorized && ScreenTime.isAvailable ? (
          <Pressable
            accessibilityRole="button"
            onPress={askAuthorization}
            style={[styles.reportCard, styles.authCard]}
          >
            <View style={styles.authIcon}>
              <IconSvg name={IconName.MONITOR} size={22} color={C.accent} />
            </View>
            <Text style={[f(700), styles.authTitle]}>
              Autorise le Temps d'écran
            </Text>
            <Text style={[f(400), styles.authSub]}>
              iOS ne communique aucune donnée d'usage tant que Relock n'y est
              pas autorisé. Appuie pour l'activer.
            </Text>
          </Pressable>
        ) : (
          <ScrollView
            style={styles.reportCard}
            contentContainerStyle={styles.reportContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Le rapport iOS se rend par-dessus quand il est prêt. Ce voile
              DOIT s'effacer tout seul : sinon, quand la période ne contient
              rien (iOS ne conserve qu'un historique court) ou que
              l'autorisation manque, « Chargement… » restait affiché POUR
              TOUJOURS, masquant le message d'explication en dessous. */}
            {loading && (
              <View style={styles.reportLoading} pointerEvents="none">
                <ActivityIndicator color={C.accent} />
                <Text style={[f(500), styles.reportLoadingText]}>
                  Chargement du rapport…
                </Text>
              </View>
            )}
            <ScreenTimeReport
              key={`s-${reloadKey}-${period}-${offset}`}
              style={styles.summary}
              pointerEvents="none"
              mode="summary"
              period={period}
              offset={offset}
              fallback={
                <View style={styles.fallback}>
                  <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                    Disponible sur iPhone
                  </Text>
                  <Text style={[f(400), styles.fallbackSub]}>
                    Le vrai temps d'écran par app (avec les icônes) est fourni
                    par iOS et ne s'affiche que sur un iPhone physique.
                  </Text>
                </View>
              }
            />
            <ScreenTimeReport
              key={`c-${reloadKey}-${period}-${offset}`}
              style={styles.chart}
              pointerEvents="none"
              mode="chart"
              period={period}
              offset={offset}
            />
            <ScreenTimeReport
              key={`a-${reloadKey}-${period}-${offset}`}
              style={styles.apps}
              pointerEvents="none"
              mode="apps"
              period={period}
              offset={offset}
            />
          </ScrollView>
        )}
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 24, color: C.ink, letterSpacing: -0.6 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: C.surface2,
    borderRadius: 14,
    padding: 4,
    marginTop: 18,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 11,
  },
  daysScroll: { flexGrow: 0, maxHeight: 96 },
  daysRow: { gap: 10, paddingVertical: 16, paddingRight: 4 },
  chipsScroll: { flexGrow: 0, maxHeight: 70 },
  chipsRow: { gap: 8, paddingVertical: 16, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: C.surface2,
  },
  chipActive: { backgroundColor: C.accent },
  dayCol: { alignItems: 'center', gap: 8 },
  dayLetter: { fontSize: 12, color: C.ink3 },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: { backgroundColor: C.accent },
  // Pas de conteneur de fond : les cartes du rapport se suffisent à elles-mêmes
  // et s'alignent directement sur les filtres au-dessus.
  reportCard: { flex: 1, marginTop: 4, marginBottom: 12 },
  reportContent: { paddingBottom: 8 },
  authCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
  },
  authIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(164,154,254,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  authTitle: { fontSize: 17, color: C.ink, letterSpacing: -0.3 },
  authSub: {
    fontSize: 13.5,
    color: C.ink2,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Hauteurs calées sur le contenu des vues natives : hébergeant un rapport
  // système rendu hors process, elles ne peuvent pas s'auto-dimensionner.
  // Résumé = date + total + libellé + 2 stats ; graphe = titre + carte de
  // 128 pt + axe X ; classement = en-tête + 6 lignes au plus. Marges des
  // vues comprises (6 pt en haut et en bas).
  summary: { height: 152 },
  chart: { height: 212 },
  apps: { height: 452 },
  reportLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  reportLoadingText: { fontSize: 13, color: C.ink3 },
  report: { flex: 1 },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  fallbackSub: {
    fontSize: 13,
    color: C.ink2,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
})
