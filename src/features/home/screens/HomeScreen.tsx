import { IconName } from '@assets/icons'
import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { fonts } from '@/shared/theme/tokens/fonts'

// Police Inter par poids (le fichier ExtraBold n'est pas lié → 800 rendu en Bold)
const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => ({ fontFamily: FW[w] })

// Couleurs exactes de la maquette
const C = {
  bg: '#0B0C10',
  surface: '#161821',
  surface2: '#1C1F2B',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  border: 'rgba(148,152,178,0.16)',
  ambient: 'rgba(164,154,254,0.14)',
}

const WEEK = [
  { d: 'L', done: true },
  { d: 'M', done: true },
  { d: 'M', done: true },
  { d: 'J', done: true },
  { d: 'V', done: true },
  { d: 'S', done: true },
  { d: 'D', done: false },
]

const BLOCKS = [
  {
    icon: IconName.CLOCK,
    title: 'Délai progressif',
    sub: 'TikTok, Instagram +1',
  },
  {
    icon: IconName.CALENDAR,
    title: 'Plages horaires',
    sub: 'TikTok · 22h – 8h',
  },
]

function Toggle() {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleKnob} />
    </View>
  )
}

export default function HomeScreen() {
  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[f(800), styles.brand]}>Blocus</Text>
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

          {/* Salutation + phrase */}
          <View style={{ marginTop: 10 }}>
            <Text style={[f(500), { fontSize: 15, color: C.ink2 }]}>
              Bonjour, Léa
            </Text>
            <Text
              style={[
                f(700),
                {
                  fontSize: 22,
                  color: C.ink,
                  lineHeight: 28,
                  marginTop: 7,
                  letterSpacing: -0.3,
                },
              ]}
            >
              Aujourd'hui, tu as résisté à{' '}
              <Text style={[f(700), { color: C.accent }]}>7 ouvertures</Text>.
            </Text>
          </View>

          {/* Carte série */}
          <View
            style={[
              styles.card,
              { marginTop: 12, padding: 16, paddingBottom: 14 },
            ]}
          >
            <View style={styles.rowBetween}>
              <Text style={[f(500), { fontSize: 14, color: C.ink2 }]}>
                Série en cours
              </Text>
              <View style={styles.badge}>
                <IconSvg name={IconName.FLAME} size={13} color={C.accent} />
                <Text style={[f(700), { fontSize: 13, color: C.accent }]}>
                  Record 18j
                </Text>
              </View>
            </View>

            <View style={styles.streakRow}>
              <Text
                style={[
                  f(800),
                  styles.tnum,
                  {
                    fontSize: 46,
                    color: C.accent,
                    letterSpacing: -2,
                    lineHeight: 46,
                  },
                ]}
              >
                12
              </Text>
              <Text style={[f(600), { fontSize: 17, color: C.ink }]}>
                jours de contrôle
              </Text>
            </View>

            <View style={styles.week}>
              {WEEK.map((w, i) => (
                <View key={`${w.d}-${i}`} style={styles.weekCell}>
                  <View
                    style={[
                      styles.weekBar,
                      w.done
                        ? { backgroundColor: C.accent }
                        : {
                            borderWidth: 1.5,
                            borderStyle: 'dashed',
                            borderColor: 'rgba(164,154,254,0.55)',
                            backgroundColor: 'rgba(164,154,254,0.1)',
                          },
                    ]}
                  />
                  <Text
                    style={[
                      f(w.done ? 500 : 700),
                      {
                        fontSize: 11,
                        color: w.done ? C.ink3 : C.accent,
                        marginTop: 6,
                      },
                    ]}
                  >
                    {w.d}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Deux stats */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={[styles.statCard]}>
              <Text style={[f(500), { fontSize: 12.5, color: C.ink2 }]}>
                Temps regagné
              </Text>
              <Text
                style={[
                  f(800),
                  styles.tnum,
                  {
                    fontSize: 26,
                    color: C.ink,
                    letterSpacing: -0.8,
                    marginTop: 8,
                  },
                ]}
              >
                1 h 47
              </Text>
              <Text
                style={[
                  f(400),
                  { fontSize: 11.5, color: C.ink3, marginTop: 3 },
                ]}
              >
                aujourd'hui
              </Text>
            </View>
            <View style={[styles.statCard]}>
              <Text style={[f(500), { fontSize: 12.5, color: C.ink2 }]}>
                Interceptions
              </Text>
              <Text
                style={[
                  f(800),
                  styles.tnum,
                  {
                    fontSize: 26,
                    color: C.ink,
                    letterSpacing: -0.8,
                    marginTop: 8,
                  },
                ]}
              >
                9
              </Text>
              <Text
                style={[
                  f(400),
                  { fontSize: 11.5, color: C.ink3, marginTop: 3 },
                ]}
              >
                scrolls stoppés
              </Text>
            </View>
          </View>

          {/* Blocages actifs */}
          <View style={{ marginTop: 14 }}>
            <View style={[styles.rowBetween, { marginBottom: 12 }]}>
              <Text
                style={[
                  f(700),
                  { fontSize: 16, color: C.ink, letterSpacing: -0.2 },
                ]}
              >
                Blocages actifs
              </Text>
              <Pressable onPress={() => navigate(ROUTES.ADD_BLOCK)} hitSlop={8}>
                <Text style={[f(600), { fontSize: 13, color: C.accent }]}>
                  Gérer
                </Text>
              </Pressable>
            </View>
            {BLOCKS.map((b, i) => (
              <View
                key={b.title}
                style={[styles.blockRow, i === 0 && { marginBottom: 8 }]}
              >
                <View style={styles.blockIcon}>
                  <IconSvg name={b.icon} size={20} color={C.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                    {b.title}
                  </Text>
                  <Text
                    style={[
                      f(400),
                      { fontSize: 13, color: C.ink2, marginTop: 2 },
                    ]}
                  >
                    {b.sub}
                  </Text>
                </View>
                <Toggle />
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable
            accessibilityRole="button"
            onPress={() => navigate(ROUTES.ADD_BLOCK)}
            style={[styles.cta, { marginTop: 'auto' }]}
          >
            <IconSvg name={IconName.BLOCK} size={19} color={C.bg} />
            <Text style={[f(700), { fontSize: 16, color: C.bg }]}>
              Bloquer maintenant
            </Text>
          </Pressable>

          <View style={{ height: 8 }} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 24, color: C.ink, letterSpacing: -0.6 },
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
  card: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.ambient,
    borderRadius: 99,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 11,
    marginTop: 12,
  },
  tnum: { fontVariant: ['tabular-nums'] },
  week: { flexDirection: 'row', gap: 7, marginTop: 14 },
  weekCell: { flex: 1, alignItems: 'center' },
  weekBar: { alignSelf: 'stretch', height: 26, borderRadius: 8 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  blockRow: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  blockIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 99,
    backgroundColor: C.accent,
    justifyContent: 'center',
  },
  toggleKnob: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.bg,
  },
  cta: {
    height: 54,
    borderRadius: 16,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
})
