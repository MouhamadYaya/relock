import { useIsFocused } from '@react-navigation/native'
import React, { useEffect, useState } from 'react'
import { AppState, StyleSheet, Text, View } from 'react-native'
import {
  isScreenTimeReportAvailable,
  ScreenTimeReport,
} from '@/shared/native/ScreenTimeReport'
import { ScreenTime } from '@/shared/native/screen-time'
import { useTheme } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Hero de l'Accueil (maquette « Relock Home » v2) : « Temps d'écran
 * aujourd'hui », grand total + delta vs hier. Sans les pilules par app — la
 * carte de protection prend leur place sous ce bloc.
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
  muted: 'rgba(235,235,245,0.4)',
}

export function ScreenTimeHero() {
  const { theme } = useTheme()
  const isFocused = useIsFocused()

  // Le contenu du rapport est rendu HORS process : il peut mourir pendant que
  // l'app est en arrière-plan, et il date d'« aujourd'hui » au moment du
  // rendu. À chaque retour au premier plan, `reloadToken` demande au pont natif
  // une connexion fraîche avec les chiffres du bon jour. C'est ce qui empêche
  // le rapport de disparaître après un aller-retour.
  const [epoch, setEpoch] = useState(0)
  useEffect(() => {
    if (!isFocused) return
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') setEpoch(e => e + 1)
    })
    return () => sub.remove()
  }, [isFocused])

  // Squelettes le temps que iOS calcule et rende les scènes (asynchrone),
  // puis on les retire — la vue native a un fond transparent.
  const [showSkeleton, setShowSkeleton] = useState(true)
  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch redémarre le squelette lors d'une reconnexion native
  useEffect(() => {
    if (!isFocused) return
    setShowSkeleton(true)
    const t = setTimeout(() => setShowSkeleton(false), 2500)
    return () => clearTimeout(t)
  }, [epoch, isFocused])

  // Sans autorisation Temps d'écran, iOS ne rend RIEN dans la vue du rapport :
  // l'Accueil affichait alors un trou muet sous le titre. On dit pourquoi.
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  useEffect(() => {
    if (!ScreenTime.isAvailable) {
      setAuthorized(false)
      return
    }
    const check = () => {
      ScreenTime.authorizationStatus()
        .then(s => setAuthorized(s === 'approved'))
        .catch(() => setAuthorized(false))
    }
    check()
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') check()
    })
    return () => sub.remove()
  }, [])

  if (!isScreenTimeReportAvailable) return null

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Temps d'écran aujourd'hui</Text>

      {authorized === false ? (
        <View
          style={[
            styles.heroWrap,
            { backgroundColor: theme.colors.background },
          ]}
        >
          <Text style={styles.unavailable}>
            Autorise le Temps d'écran pour voir tes vraies données.
          </Text>
        </View>
      ) : (
        // Fond explicite (et pas juste transparent) : la vue native de
        // l'extension DeviceActivityReport ne peint RIEN tant qu'elle n'a pas
        // de données (pas d'autorisation, calcul en cours, extension tuée) —
        // sans ce fond, ce blanc système serait échantillonné par la tab bar
        // Liquid Glass (iOS 26) et la ferait paraître blanche.
        <View
          style={[
            styles.heroBlock,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {showSkeleton && (
            <View style={styles.heroSkeleton} pointerEvents="none">
              <View style={styles.skelBig} />
              <View style={styles.skelSmall} />
            </View>
          )}
          {isFocused && (
            <ScreenTimeReport
              mode="hero"
              reloadToken={epoch}
              style={styles.report}
            />
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  label: {
    ...fonts.medium,
    fontSize: 14,
    color: C.label,
    letterSpacing: -0.2,
  },
  // Hauteur fixe : doit coller à celle de HeroTotalView côté extension.
  heroWrap: { height: 82, marginTop: 4, justifyContent: 'center' },
  heroBlock: { height: 82, marginTop: 4 },
  unavailable: {
    ...fonts.medium,
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },
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
  report: { flex: 1 },
})
