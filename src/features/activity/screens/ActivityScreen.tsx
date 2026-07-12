import { IconName } from '@assets/icons'
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { type AppId, AppLogo } from '@/shared/components/ui/AppLogo'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
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
const DATES = [
  { d: 'D', n: 5 },
  { d: 'L', n: 6 },
  { d: 'M', n: 7 },
  { d: 'M', n: 8 },
  { d: 'J', n: 9 },
  { d: 'V', n: 10 },
  { d: 'S', n: 11, active: true },
]
const HOURS = [
  18, 8, 5, 5, 12, 22, 40, 58, 35, 28, 20, 44, 66, 52, 38, 30, 48, 72, 100, 64,
  42, 26, 14, 8,
]
const TOP_APPS: { app: AppId; name: string; time: string; ratio: number }[] = [
  { app: 'tiktok', name: 'TikTok', time: '24 m 54 s', ratio: 1 },
  { app: 'instagram', name: 'Instagram', time: '18 m 10 s', ratio: 0.73 },
  { app: 'youtube', name: 'YouTube', time: '8 m 32 s', ratio: 0.34 },
]

export default function ActivityScreen() {
  const [seg, setSeg] = useState(2)

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                f(800),
                { fontSize: 24, color: C.ink, letterSpacing: -0.6 },
              ]}
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

          {/* Segmented */}
          <View style={styles.segment}>
            {SEGMENTS.map((s, i) => {
              const active = seg === i
              return (
                <Pressable
                  key={s}
                  onPress={() => setSeg(i)}
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

          {/* Date band */}
          <View style={styles.dateBand}>
            {DATES.map((d, i) => (
              <View key={`${d.d}-${i}`} style={styles.dateCol}>
                <Text
                  style={[
                    f(d.active ? 700 : 600),
                    {
                      fontSize: 12,
                      color: d.active ? C.accent : C.ink3,
                      marginBottom: 8,
                    },
                  ]}
                >
                  {d.d}
                </Text>
                <View
                  style={[
                    styles.dateBubble,
                    d.active && { backgroundColor: C.accent },
                  ]}
                >
                  <Text
                    style={[
                      f(d.active ? 700 : 600),
                      styles.tnum,
                      { fontSize: 15, color: d.active ? C.bg : C.ink2 },
                    ]}
                  >
                    {d.n}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Résumé */}
          <View style={[styles.card, { marginTop: 20, padding: 20 }]}>
            <Text style={[f(500), { fontSize: 13, color: C.ink3 }]}>
              Aujourd'hui, 11 juillet
            </Text>
            <View style={styles.heroRow}>
              <Text
                style={[
                  f(800),
                  styles.tnum,
                  { fontSize: 40, color: C.ink, letterSpacing: -1.5 },
                ]}
              >
                1 h 12
              </Text>
              <Text style={[f(500), { fontSize: 14, color: C.ink2 }]}>
                de scroll
              </Text>
            </View>
            <View style={styles.hr} />
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[f(700), styles.tnum, { fontSize: 22, color: C.ink }]}
                >
                  23
                </Text>
                <Text
                  style={[
                    f(500),
                    { fontSize: 13, color: C.ink2, marginTop: 2 },
                  ]}
                >
                  Ouvertures
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    f(700),
                    styles.tnum,
                    { fontSize: 22, color: C.accent },
                  ]}
                >
                  9
                </Text>
                <Text
                  style={[
                    f(500),
                    { fontSize: 13, color: C.ink2, marginTop: 2 },
                  ]}
                >
                  Interceptions
                </Text>
              </View>
            </View>
          </View>

          {/* Graph */}
          <View style={{ marginTop: 24 }}>
            <Text
              style={[
                f(700),
                {
                  fontSize: 16,
                  color: C.ink,
                  letterSpacing: -0.2,
                  marginBottom: 12,
                },
              ]}
            >
              Temps d'écran par heure
            </Text>
            <View
              style={[
                styles.card,
                { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 14 },
              ]}
            >
              <View style={styles.chart}>
                {HOURS.map((h, i) => (
                  <View
                    key={`h-${i}`}
                    style={{
                      flex: 1,
                      height: `${h}%`,
                      backgroundColor: C.accent,
                      borderRadius: 3,
                    }}
                  />
                ))}
              </View>
              <View style={styles.axis}>
                {['0 h', '06 h', '12 h', '18 h'].map(l => (
                  <Text
                    key={l}
                    style={[f(500), { fontSize: 11, color: C.ink3 }]}
                  >
                    {l}
                  </Text>
                ))}
              </View>
            </View>
          </View>

          {/* App la plus ouverte */}
          <View style={{ marginTop: 22 }}>
            <Text
              style={[
                f(700),
                {
                  fontSize: 16,
                  color: C.ink,
                  letterSpacing: -0.2,
                  marginBottom: 14,
                },
              ]}
            >
              App la plus ouverte
            </Text>
            {TOP_APPS.map((a, i) => (
              <View
                key={a.name}
                style={[
                  styles.appRow,
                  i < TOP_APPS.length - 1 && { marginBottom: 16 },
                ]}
              >
                <AppLogo app={a.app} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.appTop}>
                    <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                      {a.name}
                    </Text>
                    <Text
                      style={[
                        f(600),
                        styles.tnum,
                        { fontSize: 14, color: C.ink2 },
                      ]}
                    >
                      {a.time}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View
                      style={{
                        width: `${a.ratio * 100}%`,
                        height: 6,
                        borderRadius: 99,
                        backgroundColor: C.accent,
                      }}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          <View style={{ height: 8 }} />
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
  dateBand: {
    flexDirection: 'row',
    marginTop: 18,
  },
  dateCol: { flex: 1, alignItems: 'center' },
  dateBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  appTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  track: {
    height: 6,
    borderRadius: 99,
    backgroundColor: C.surface2,
    overflow: 'hidden',
  },
})
