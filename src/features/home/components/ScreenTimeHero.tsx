import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  isScreenTimeReportAvailable,
  ScreenTimeReport,
} from '@/shared/native/ScreenTimeReport'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Hero de l'Accueil (maquette « Relock Home ») : « Temps d'écran aujourd'hui »,
 * grand total + delta vs hier, puis la rangée de pilules par app.
 *
 * Le total et le delta sont RENDUS par l'extension DeviceActivityReport
 * (scène « TodayHero ») : le sandbox d'iOS interdit à cette extension de
 * publier le moindre chiffre vers l'app (ses écritures App Group sont
 * silencieusement perdues) — un total lu côté JS resterait donc à 0 pour
 * toujours. Seul un rendu natif dans l'extension peut afficher la vraie
 * valeur. Le delta vs hier est calculé dans la même scène (filtre sur
 * [hier → aujourd'hui]).
 */
const C = {
  label: 'rgba(235,235,245,0.55)',
  skel: 'rgba(255,255,255,0.05)',
}

export function ScreenTimeHero() {
  // Squelettes le temps que iOS calcule et rende les scènes (asynchrone),
  // puis on les retire — la vue native a un fond transparent.
  const [showSkeleton, setShowSkeleton] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 2500)
    return () => clearTimeout(t)
  }, [])

  if (!isScreenTimeReportAvailable) return null

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Temps d'écran aujourd'hui</Text>

      {/* Total du jour + delta vs hier — rendu natif (extension rapport). */}
      <View style={styles.heroWrap}>
        {showSkeleton && (
          <View style={styles.heroSkeleton} pointerEvents="none">
            <View style={styles.skelBig} />
            <View style={styles.skelSmall} />
          </View>
        )}
        <ScreenTimeReport mode="hero" style={styles.report} />
      </View>

      {/* Pilules par app (aujourd'hui) — rendu natif. */}
      <View style={styles.pillsWrap}>
        {showSkeleton && (
          <View style={styles.skeletonRow} pointerEvents="none">
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={styles.skel} />
            ))}
          </View>
        )}
        <ScreenTimeReport mode="pills" style={styles.report} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: C.label,
    letterSpacing: -0.2,
  },
  // Hauteur fixe : gros total (52) + delta (24) — la vue native remplit.
  heroWrap: { height: 82, marginTop: 4 },
  heroSkeleton: { ...StyleSheet.absoluteFillObject, gap: 8 },
  skelBig: {
    width: 150,
    height: 44,
    borderRadius: 10,
    backgroundColor: C.skel,
  },
  skelSmall: {
    width: 110,
    height: 14,
    borderRadius: 7,
    backgroundColor: C.skel,
  },
  pillsWrap: { height: 80, marginTop: 14 },
  report: { flex: 1 },
  skeletonRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  skel: { width: 66, height: 74, borderRadius: 16, backgroundColor: C.skel },
})
