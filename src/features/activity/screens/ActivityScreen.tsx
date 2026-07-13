import { IconName } from '@assets/icons'
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useHomeStats } from '@/features/blocking/hooks/useHomeStats'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { TAB_BAR_CLEARANCE } from '@/navigation/tabs/AnimatedTabBar'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTimeReport } from '@/shared/native/ScreenTimeReport'
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
  divider: 'rgba(148,152,178,0.16)',
}

const SEGMENTS = ['Mois', 'Semaine', 'Jour']
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août',
  'septembre', 'octobre', 'novembre', 'décembre',
]

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

function todayLabel(): string {
  const d = new Date()
  return `Aujourd'hui, ${d.getDate()} ${MOIS[d.getMonth()]}`
}

export default function ActivityScreen() {
  const [seg, setSeg] = useState(2) // Jour par défaut
  const stats = useHomeStats()
  const period = 2 - seg // Jour(2)->0, Semaine(1)->1, Mois(0)->2

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[f(800), { fontSize: 24, color: C.ink, letterSpacing: -0.6 }]}
            >
              Activité
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Réglages"
              onPress={() => navigate(ROUTES.SETTINGS)}
              hitSlop={8}
              style={styles.gear}
            >
              <IconSvg name={IconName.SETTINGS} size={19} color={C.ink2} />
            </Pressable>
          </View>

          {/* Période */}
          <View style={styles.segment}>
            {SEGMENTS.map((s, i) => {
              const active = seg === i
              return (
                <Pressable
                  key={s}
                  onPress={() => setSeg(i)}
                  style={[styles.segItem, active && { backgroundColor: C.accent }]}
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

          {/* Résumé Relock (nos vraies métriques, aujourd'hui) */}
          <View style={[styles.card, { marginTop: 18, padding: 20 }]}>
            <Text style={[f(500), { fontSize: 13, color: C.ink3 }]}>
              {todayLabel()}
            </Text>
            <View style={styles.heroRow}>
              <Text
                style={[
                  f(800),
                  styles.tnum,
                  { fontSize: 40, color: C.ink, letterSpacing: -1.5 },
                ]}
              >
                {fmtDuration(stats.savedMinutes)}
              </Text>
              <Text style={[f(500), { fontSize: 14, color: C.ink2 }]}>regagné</Text>
            </View>
            <View style={styles.hr} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={[f(700), styles.tnum, { fontSize: 22, color: C.ink }]}>
                  {stats.resisted}
                </Text>
                <Text style={[f(500), { fontSize: 13, color: C.ink2, marginTop: 2 }]}>
                  Résistances
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[f(700), styles.tnum, { fontSize: 22, color: C.accent }]}
                >
                  {stats.interceptions}
                </Text>
                <Text style={[f(500), { fontSize: 13, color: C.ink2, marginTop: 2 }]}>
                  Interceptions
                </Text>
              </View>
            </View>
          </View>

          {/* Temps d'écran réel (vue native système) */}
          <Text style={[f(700), styles.sectionTitle]}>
            Temps d'écran & utilisation des apps
          </Text>
          <View style={styles.reportCard}>
            <ScreenTimeReport
              style={styles.report}
              period={period}
              fallback={
                <View style={styles.fallback}>
                  <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                    Temps d'écran indisponible
                  </Text>
                  <Text style={[f(400), styles.fallbackSub]}>
                    La vue système ne s'est pas affichée. On règle ça.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gear: {
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
  tnum: { fontVariant: ['tabular-nums'] },
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 6,
  },
  hr: {
    height: 1,
    backgroundColor: C.divider,
    marginTop: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    color: C.ink,
    letterSpacing: -0.2,
    marginTop: 24,
    marginBottom: 12,
  },
  reportCard: {
    height: 480,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
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
