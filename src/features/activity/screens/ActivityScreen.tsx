import { IconName } from '@assets/icons'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { TAB_BAR_CLEARANCE } from '@/navigation/tabs/AnimatedTabBar'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import {
  isScreenTimeReportAvailable,
  ScreenTimeReport,
} from '@/shared/native/ScreenTimeReport'
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
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  border: 'rgba(148,152,178,0.16)',
}

export default function ActivityScreen() {
  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[f(800), { fontSize: 24, color: C.ink, letterSpacing: -0.6 }]}>
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

        {/* Temps d'écran réel (rendu par iOS via l'extension) */}
        <View style={styles.card}>
          {isScreenTimeReportAvailable ? (
            <ScreenTimeReport style={styles.report} />
          ) : (
            <View style={styles.fallback}>
              <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                Disponible sur iPhone
              </Text>
              <Text style={[f(400), styles.fallbackSub]}>
                Le vrai temps d'écran par app (avec les icônes) est fourni par
                iOS et ne s'affiche que sur un iPhone physique.
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
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
  card: {
    flex: 1,
    marginTop: 18,
    marginBottom: 12,
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
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
