import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Linking, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { NotificationService } from '@/features/notifications/notification.service'
import { ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'
import {
  AppleMark,
  Footnote,
  GhostLink,
  GoogleMark,
  GradientLine,
  MockDialog,
  Moon,
  Pill,
  RedAlert,
  Starfield,
} from './bits'
import { Reveal } from './motion'
import { haptic, OB } from './tokens'

// ─── Acte 4 · Temps d'écran (blocage DUR) ───────────────────────────────

/**
 * LA permission qui fait exister le produit. Amorcée façon Opal : réplique
 * du dialogue iOS, choix « autoriser » lumineux, l'autre éteint. Refus →
 * alerte rouge minimaliste intégrée, et on ne passe PAS. Après un second
 * refus, iOS ne re-présente plus le dialogue : on envoie vers Réglages, et
 * on avance tout seul dès que l'autorisation apparaît.
 */
export function ScenePermission({ onNext }: { onNext: () => void }) {
  const [denied, setDenied] = useState(0)
  const [busy, setBusy] = useState(false)
  const advanced = useRef(false)

  const advance = () => {
    if (!advanced.current) {
      advanced.current = true
      haptic.success()
      onNext()
    }
  }

  // Retour de Réglages : si l'autorisation a été accordée là-bas, on
  // continue sans exiger un tap de plus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: abonnement au montage uniquement (advance protégé par ref)
  useEffect(() => {
    if (!ScreenTime.isAvailable) return
    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') return
      ScreenTime.authorizationStatus()
        .then(st => {
          if (st === 'approved') advance()
        })
        .catch(() => {})
    })
    return () => sub.remove()
  }, [])

  const request = async () => {
    if (!ScreenTime.isAvailable) {
      advance()
      return
    }
    setBusy(true)
    try {
      const s = await ScreenTime.requestAuthorization()
      if (s === 'approved') {
        advance()
        return
      }
      setDenied(d => d + 1)
    } catch {
      setDenied(d => d + 1)
    } finally {
      setBusy(false)
    }
  }

  const openSettings = () => {
    Linking.openSettings().catch(() => {})
  }

  return (
    <View style={styles.scene}>
      <View style={styles.permTop}>
        <Reveal index={0}>
          <Text style={styles.h1}>Débloque le vrai blocage.</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>
            iOS exige ton accord pour laisser Relock bloquer des apps. Sans lui,
            rien ne peut fonctionner.
          </Text>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 24 }}>
          <MockDialog
            title="« Relock » souhaite accéder à Temps d'écran"
            body="Relock pourra restreindre certains contenus et limiter l'utilisation des apps. Ton activité reste sur ton téléphone."
            allowLabel="Continuer"
            denyLabel="Refuser"
          />
        </Reveal>
        {denied > 0 ? (
          <View style={{ marginTop: 18 }}>
            <RedAlert text="Relock ne peut pas fonctionner sans cette autorisation. Rien ne quitte ton téléphone, rien ne nous est transmis." />
          </View>
        ) : null}
      </View>
      <Reveal index={3} style={styles.bottom}>
        {denied >= 2 ? (
          <Pill label="Ouvrir les Réglages" onPress={openSettings} />
        ) : (
          <Pill
            label={denied === 1 ? 'Réessayer' : 'Activer la protection'}
            onPress={request}
            disabled={busy}
          />
        )}
        {__DEV__ ? (
          // Échappatoire DEV uniquement : le simulateur a le module mais ne
          // peut pas finir le parcours d'autorisation (code de l'appareil).
          // En production, le blocage est absolu.
          <GhostLink label="Passer (dev)" onPress={advance} dim />
        ) : null}
      </Reveal>
    </View>
  )
}

// ─── Acte 4 · Notifications (refusables) ────────────────────────────────

export function SceneNotifs({ onNext }: { onNext: () => void }) {
  const [busy, setBusy] = useState(false)

  const request = async () => {
    setBusy(true)
    try {
      await NotificationService.ensurePermission()
    } catch {
      // Refus accepté : les rappels sont un plus, pas une condition.
    } finally {
      setBusy(false)
      onNext()
    }
  }

  return (
    <View style={styles.scene}>
      <View style={styles.permTop}>
        <Reveal index={0}>
          <Text style={styles.h1}>Un encouragement au bon moment.</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>
            Quand tu résistes, on te le dit. Quand ta série grandit, on la
            célèbre. Jamais de spam, désactivable quand tu veux.
          </Text>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 24 }}>
          <MockDialog
            title="« Relock » souhaite t'envoyer des notifications"
            body="Elles peuvent inclure des alertes, des sons et des pastilles."
            allowLabel="Autoriser"
            denyLabel="Ne pas autoriser"
          />
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        <Pill label="Activer les rappels" onPress={request} disabled={busy} />
        <GhostLink label="Plus tard" onPress={onNext} dim />
      </Reveal>
    </View>
  )
}

// ─── Acte 4 · Sauvegarde (factice, en attendant OAuth) ──────────────────

export function SceneSignin({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.scene}>
      <Starfield count={40} />
      <View style={[styles.permTop, styles.signinCenter]}>
        <Reveal index={0} style={styles.signinMoon}>
          <Moon size={210} glow />
        </Reveal>
        <Reveal index={1}>
          <GradientLine text="Sauvegarde ta" size={32} weight="800" />
          <GradientLine text="progression." size={32} weight="800" />
        </Reveal>
        <Reveal index={2}>
          <Text style={[styles.subLeft, styles.center, styles.signinSub]}>
            Retrouve tes habitudes, tes blocages et tes statistiques,
            synchronisés en toute sécurité sur tous tes appareils.
          </Text>
        </Reveal>
        <Reveal index={3} style={styles.signinBtns}>
          <Pill
            label="Continuer avec Apple"
            onPress={onNext}
            icon={<AppleMark />}
            glow
          />
          <Pill
            label="Continuer avec Google"
            onPress={onNext}
            kind="ghost"
            icon={<GoogleMark />}
          />
        </Reveal>
      </View>
    </View>
  )
}

// ─── Acte 5 · Paywall (niveau Opal, paiement non branché) ───────────────

const TIMELINE = [
  {
    k: "Aujourd'hui",
    v: 'Accès complet à Relock, gratuitement.',
  },
  {
    k: 'Jour 5',
    v: "On te prévient que l'essai se termine bientôt.",
  },
  {
    k: 'Jour 7',
    v: 'Premier prélèvement. Annulable avant, en un geste.',
  },
]

export function ScenePaywall({
  onDone,
  onSkip,
}: {
  onDone: () => void
  onSkip: () => void
}) {
  const [plan, setPlan] = useState<'year' | 'month'>('year')

  return (
    <View style={styles.scene}>
      <View style={styles.paywallTopRow}>
        <GhostLink label="Plus tard" onPress={onSkip} dim />
      </View>
      <View style={styles.paywallBody}>
        <Reveal index={0}>
          <Text style={styles.h1}>Débloque ton plan.</Text>
        </Reveal>
        <Reveal index={1} style={styles.timeline}>
          {TIMELINE.map((t, i) => (
            <View key={t.k} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineDot,
                    i === 0 && { backgroundColor: OB.accent },
                  ]}
                />
                {i < TIMELINE.length - 1 ? (
                  <View style={styles.timelineLine} />
                ) : null}
              </View>
              <View style={styles.timelineText}>
                <Text style={styles.timelineK}>{t.k}</Text>
                <Text style={styles.timelineV}>{t.v}</Text>
              </View>
            </View>
          ))}
        </Reveal>
        <Reveal index={2} style={styles.plans}>
          <PlanCard
            title="Annuel"
            price="39,99 € par an"
            sub="Soit 3,33 € par mois. 7 jours offerts."
            badge="7 JOURS OFFERTS"
            selected={plan === 'year'}
            onPress={() => setPlan('year')}
          />
          <PlanCard
            title="Mensuel"
            price="6,99 € par mois"
            sub="Sans engagement."
            selected={plan === 'month'}
            onPress={() => setPlan('month')}
          />
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        <Pill
          label="Commencer mes 7 jours gratuits"
          sub="Aucun paiement aujourd'hui"
          onPress={onDone}
          kind="danger"
        />
        <Footnote text="Prix indicatifs. Le paiement n'est pas activé dans cette version." />
      </Reveal>
    </View>
  )
}

function PlanCard({
  title,
  price,
  sub,
  badge,
  selected,
  onPress,
}: {
  title: string
  price: string
  sub: string
  badge?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Text
      accessibilityRole="button"
      onPress={() => {
        haptic.select()
        onPress()
      }}
      style={[styles.plan, selected && styles.planSelected]}
    >
      {badge ? (
        <>
          <Text style={styles.planBadge}>{badge}</Text>
          {'\n'}
        </>
      ) : null}
      <Text style={styles.planTitle}>{title}</Text>
      {'\n'}
      <Text style={styles.planPrice}>{price}</Text>
      {'\n'}
      <Text style={styles.planSub}>{sub}</Text>
    </Text>
  )
}

// ─── Acte 5 · L'artefact ────────────────────────────────────────────────

/** Clôture en élévation : le ciel, la lune, une maxime. Pas de confetti. */
export function SceneArtifact({ onEnter }: { onEnter: () => void }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        key: `s${i}`,
        x: (i * 137.5) % 100,
        y: ((i * 61.8) % 88) + 4,
        r: 0.6 + ((i * 7) % 10) / 9,
        o: 0.25 + ((i * 13) % 10) / 22,
      })),
    [],
  )
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1400)
    return () => clearTimeout(t)
  }, [])

  return (
    <View style={styles.artifact}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0E0B1E" />
            <Stop offset="100%" stopColor="#050507" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sky)" />
        {stars.map(s => (
          <Circle
            key={s.key}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="#FFFFFF"
            opacity={s.o}
          />
        ))}
      </Svg>
      <View style={styles.artifactCenter}>
        <Reveal index={0}>
          <Moon size={148} glow />
        </Reveal>
        <Reveal index={2} style={{ marginTop: 34, alignSelf: 'stretch' }}>
          <GradientLine text="Ton attention est ton bien" size={22} />
          <GradientLine text="le plus précieux." size={22} />
        </Reveal>
        <Reveal index={3}>
          <Text style={styles.artifactSub}>Bienvenue dans Relock.</Text>
        </Reveal>
      </View>
      {ready ? (
        <Animated.View entering={FadeIn.duration(600)} style={styles.bottom}>
          <Pill label="Entrer" onPress={onEnter} />
        </Animated.View>
      ) : (
        <View style={styles.bottomSpacer} />
      )}
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scene: { flex: 1, paddingHorizontal: 20 },
  bottom: { gap: 8, paddingBottom: 10 },
  bottomSpacer: { height: 76 },
  center: { textAlign: 'center' },

  h1: {
    ...fonts.bold,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: OB.ink,
  },
  subLeft: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: OB.ink55,
    marginTop: 10,
  },

  permTop: { flex: 1, paddingTop: 12 },

  signinCenter: { justifyContent: 'center' },
  signinSub: { paddingHorizontal: 30 },
  signinMoon: { alignItems: 'center', marginBottom: 28 },
  signinBtns: { gap: 12, marginTop: 64 },

  paywallTopRow: { alignItems: 'flex-end', paddingTop: 2 },
  paywallBody: { flex: 1 },
  timeline: { marginTop: 20 },
  timelineRow: { flexDirection: 'row', gap: 14 },
  timelineRail: { alignItems: 'center', width: 18 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 3,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(164,154,254,0.28)',
    marginVertical: 3,
  },
  timelineText: { flex: 1, paddingBottom: 16 },
  timelineK: { ...fonts.semiBold, fontSize: 15, color: OB.ink },
  timelineV: {
    ...fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: OB.ink55,
    marginTop: 2,
  },

  plans: { flexDirection: 'row', gap: 10, marginTop: 8 },
  plan: {
    flex: 1,
    backgroundColor: OB.card,
    borderRadius: 20,
    borderWidth: 1.6,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
    lineHeight: 22,
  },
  planSelected: { borderColor: OB.accent, backgroundColor: '#191721' },
  planTitle: { ...fonts.semiBold, fontSize: 15, color: OB.ink },
  planPrice: { ...fonts.bold, fontSize: 16, color: OB.ink },
  planSub: { ...fonts.regular, fontSize: 12.5, color: OB.ink55 },
  planBadge: {
    ...fonts.bold,
    fontSize: 10.5,
    color: OB.accent,
    letterSpacing: 0.6,
  },

  artifact: { flex: 1, paddingHorizontal: 20 },
  artifactCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artifactSub: {
    ...fonts.medium,
    fontSize: 14.5,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 14,
  },
})
