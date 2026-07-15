/**
 * Onboarding premium Relock — flow autonome (un composant pilote les étapes,
 * pas 16 routes). Arc émotionnel : accroche → diagnostic → MIROIR (choc) →
 * renversement (ce n'est pas ta faute) → personnalisation → engagement.
 *
 * Ligne Opal (sombre, minimal), tutoiement coach, l'utilisateur doit se sentir
 * COMPRIS. Le paywall est VISUEL (bouton « Ignorer » en haut à droite).
 *
 * ⚠️ Connexion Apple/Google : l'écran est prêt, mais l'OAuth réel demande la
 * config des providers Supabase + une lib native (suivi séparé). Pour l'instant
 * les boutons font avancer le flow ; l'app tourne en mode mock.
 */
import React, { useEffect, useState } from 'react'
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { constants } from '@/config/constants'
import { resetRoot } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { ScreenTime } from '@/shared/native/screen-time'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { ChoiceCard, f, OB, OBButton, Shell, Sub, Title } from './ui'

// ── Données du diagnostic ──────────────────────────────────────────────
type Answers = {
  name: string
  trigger: string | null
  apps: string[]
  moment: string | null
  estimateHours: number | null
}
const INITIAL: Answers = {
  name: '',
  trigger: null,
  apps: [],
  moment: null,
  estimateHours: null,
}

const TRIGGERS = [
  'Je perds trop de temps',
  'Je scrolle avant de dormir',
  "Je n'arrive plus à me concentrer",
  'Je veux juste reprendre le contrôle',
]
const APPS = [
  'TikTok',
  'Instagram',
  'YouTube',
  'Snapchat',
  'X',
  'Reddit',
  'Facebook',
  'Autre',
]
const MOMENTS = [
  'Le soir, au lit',
  'Au réveil',
  'Pendant le travail ou les cours',
  'Un peu partout dans la journée',
]
const ESTIMATES: { label: string; h: number }[] = [
  { label: "Moins d'1 h", h: 0.5 },
  { label: '1 – 2 h', h: 1.5 },
  { label: '3 – 4 h', h: 3.5 },
  { label: '5 – 6 h', h: 5.5 },
  { label: '7 h ou plus', h: 7.5 },
]

/** Jours/an « perdus » au rythme estimé (heures/jour × 365 ÷ 24). */
function daysPerYear(hoursPerDay: number): number {
  return Math.round((hoursPerDay * 365) / 24)
}

// Étapes, dans l'ordre. Les écrans-récit n'ont pas de barre de progression.
const STEPS = [
  'welcome',
  'hook',
  'name',
  'trigger',
  'apps',
  'moment',
  'estimate',
  'beat',
  'mirror',
  'reversal',
  'reformulation',
  'loading',
  'success',
  'permissions',
  'signin',
  'paywall',
] as const
type Step = (typeof STEPS)[number]

// Progression affichée seulement sur la phase « diagnostic ».
const DIAG: Step[] = ['name', 'trigger', 'apps', 'moment', 'estimate']

export default function OnboardingFlow() {
  const [i, setI] = useState(0)
  const [a, setA] = useState<Answers>(INITIAL)
  const step = STEPS[i]

  const next = () => setI(v => Math.min(v + 1, STEPS.length - 1))
  const back = () => setI(v => Math.max(v - 1, 0))
  const patch = (p: Partial<Answers>) => setA(prev => ({ ...prev, ...p }))

  const finish = () => {
    kvStorage.setString(constants.ONBOARDING_DONE, '1')
    resetRoot({ index: 0, routes: [{ name: ROUTES.ROOT_APP as never }] })
  }

  const who = a.name.trim() || 'toi'
  const progress = DIAG.includes(step)
    ? (DIAG.indexOf(step) + 1) / DIAG.length
    : undefined
  const showBack = i > 1 && step !== 'loading' // pas de retour sur accroche/chargement

  const common = {
    progress,
    onBack: showBack ? back : undefined,
    animKey: step,
  }

  switch (step) {
    case 'welcome':
      return (
        <Shell
          animKey={step}
          footer={<OBButton label="Commencer" onPress={next} />}
        >
          <View style={styles.center}>
            <View style={styles.logoDot} />
            <Title style={styles.centerTitle}>
              Reprends le contrôle de ton temps.
            </Title>
            <Sub style={{ textAlign: 'center' }}>
              Relock t'aide à sortir du scroll sans fin — un pas à la fois.
            </Sub>
          </View>
        </Shell>
      )

    case 'hook':
      return (
        <Shell
          animKey={step}
          footer={<OBButton label="Je me reconnais" onPress={next} />}
        >
          <View style={styles.storyCenter}>
            <Title
              style={{ textAlign: 'center', fontSize: 28, lineHeight: 36 }}
            >
              Chaque jour, des heures disparaissent.{'\n'}Sans même que tu t'en
              rendes compte.
            </Title>
          </View>
        </Shell>
      )

    case 'name':
      return (
        <NameScreen
          {...common}
          value={a.name}
          onNext={n => {
            patch({ name: n })
            next()
          }}
        />
      )

    case 'trigger':
      return (
        <ChoiceScreen
          {...common}
          question={`Qu'est-ce qui t'amène ici${a.name ? `, ${a.name}` : ''} ?`}
          options={TRIGGERS}
          value={a.trigger ? [a.trigger] : []}
          multi={false}
          onChange={v => patch({ trigger: v[0] ?? null })}
          onNext={next}
        />
      )

    case 'apps':
      return (
        <ChoiceScreen
          {...common}
          question="Quelles apps te volent le plus de temps ?"
          hint="Tu pourras les bloquer juste après."
          options={APPS}
          value={a.apps}
          multi
          onChange={v => patch({ apps: v })}
          onNext={next}
        />
      )

    case 'moment':
      return (
        <ChoiceScreen
          {...common}
          question="Quand est-ce que tu perds le fil ?"
          options={MOMENTS}
          value={a.moment ? [a.moment] : []}
          multi={false}
          onChange={v => patch({ moment: v[0] ?? null })}
          onNext={next}
        />
      )

    case 'estimate':
      return (
        <ChoiceScreen
          {...common}
          question="Combien de temps par jour, à ton avis ?"
          hint="Une estimation honnête, personne ne juge."
          options={ESTIMATES.map(e => e.label)}
          value={
            a.estimateHours != null
              ? [ESTIMATES.find(e => e.h === a.estimateHours)?.label ?? '']
              : []
          }
          multi={false}
          onChange={v =>
            patch({
              estimateHours: ESTIMATES.find(e => e.label === v[0])?.h ?? null,
            })
          }
          onNext={next}
        />
      )

    case 'beat':
      return (
        <Shell
          animKey={step}
          footer={<OBButton label="Continuer" onPress={next} />}
        >
          <View style={styles.storyCenter}>
            <Title
              style={{ textAlign: 'center', fontSize: 27, lineHeight: 35 }}
            >
              Une nouvelle difficile.{'\n'}Et une bonne.
            </Title>
          </View>
        </Shell>
      )

    case 'mirror':
      return (
        <MirrorScreen
          animKey={step}
          who={who}
          hours={a.estimateHours ?? 3.5}
          onNext={next}
        />
      )

    case 'reversal':
      return (
        <Shell
          animKey={step}
          footer={<OBButton label="Alors, on commence ?" onPress={next} />}
        >
          <View style={styles.storyCenter}>
            <Title
              style={{ textAlign: 'center', fontSize: 27, lineHeight: 36 }}
            >
              Mais tu n'es pas le problème.
            </Title>
            <Sub style={{ textAlign: 'center', marginTop: 18 }}>
              Ces apps sont conçues, à la milliseconde près, pour t'accrocher.
              C'est un combat truqué. Relock rééquilibre les règles — à ton
              avantage.
            </Sub>
          </View>
        </Shell>
      )

    case 'reformulation':
      return (
        <Shell
          animKey={step}
          footer={<OBButton label="Construire mon plan" onPress={next} />}
        >
          <View style={styles.storyCenter}>
            <Title
              style={{ textAlign: 'center', fontSize: 25, lineHeight: 34 }}
            >
              On va bloquer{' '}
              <Text style={{ color: OB.accent }}>
                {a.apps.length ? a.apps.slice(0, 2).join(', ') : 'tes apps'}
              </Text>
              {a.moment ? `,\nsurtout ${a.moment.toLowerCase()}.` : '.'}
            </Title>
            <Sub style={{ textAlign: 'center', marginTop: 16 }}>
              Exactement là où tu en as besoin.
            </Sub>
          </View>
        </Shell>
      )

    case 'loading':
      return <LoadingScreen animKey={step} onDone={next} />

    case 'success':
      return (
        <SuccessScreen
          animKey={step}
          who={who}
          appsCount={a.apps.length}
          days={daysPerYear(a.estimateHours ?? 3.5)}
          onNext={next}
        />
      )

    case 'permissions':
      return <PermissionsScreen animKey={step} onNext={next} />

    case 'signin':
      return <SignInScreen animKey={step} onNext={next} />

    case 'paywall':
      return <PaywallScreen animKey={step} onDone={finish} />
  }
}

// ── Écrans bespoke ─────────────────────────────────────────────────────

function NameScreen({
  value,
  onNext,
  progress,
  onBack,
}: {
  value: string
  onNext: (n: string) => void
  progress?: number
  onBack?: () => void
}) {
  const [name, setName] = useState(value)
  return (
    <Shell
      animKey="name"
      progress={progress}
      onBack={onBack}
      footer={
        <OBButton
          label="Continuer"
          onPress={() => {
            Keyboard.dismiss()
            onNext(name)
          }}
        />
      }
    >
      <Title>Comment tu t'appelles ?</Title>
      <Sub>On va rendre tout ça personnel.</Sub>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Ton prénom"
        placeholderTextColor={OB.ink3}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => onNext(name)}
        style={[f(600), styles.input]}
      />
    </Shell>
  )
}

function ChoiceScreen({
  question,
  hint,
  options,
  value,
  multi,
  onChange,
  onNext,
  progress,
  onBack,
}: {
  question: string
  hint?: string
  options: string[]
  value: string[]
  multi: boolean
  onChange: (v: string[]) => void
  onNext: () => void
  progress?: number
  onBack?: () => void
}) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(
        value.includes(opt) ? value.filter(o => o !== opt) : [...value, opt],
      )
    } else {
      onChange([opt])
    }
  }
  return (
    <Shell
      animKey={question}
      progress={progress}
      onBack={onBack}
      footer={
        <OBButton
          label="Continuer"
          onPress={onNext}
          disabled={value.length === 0}
        />
      }
    >
      <Title>{question}</Title>
      {hint ? <Sub>{hint}</Sub> : null}
      <View style={{ gap: 12, marginTop: 26 }}>
        {options.map(opt => (
          <ChoiceCard
            key={opt}
            label={opt}
            selected={value.includes(opt)}
            onPress={() => toggle(opt)}
          />
        ))}
      </View>
    </Shell>
  )
}

function MirrorScreen({
  who,
  hours,
  onNext,
  animKey,
}: {
  who: string
  hours: number
  onNext: () => void
  animKey: string
}) {
  const days = daysPerYear(hours)
  return (
    <Shell
      animKey={animKey}
      footer={<OBButton label="Je veux changer ça" onPress={onNext} />}
    >
      <View style={styles.storyCenter}>
        <Sub style={{ textAlign: 'center', marginTop: 0 }}>
          {who}, à ce rythme, ton scroll représente
        </Sub>
        <Text style={[f(800), styles.mirrorNum]}>~{days}</Text>
        <Title style={{ textAlign: 'center', fontSize: 24 }}>
          jours par an.
        </Title>
        <Sub style={{ textAlign: 'center', marginTop: 18 }}>
          {days} journées entières, envolées dans le vide. Chaque année.
        </Sub>
      </View>
    </Shell>
  )
}

const LOAD_STEPS = [
  'Analyse de tes réponses…',
  'Calibrage de tes blocages…',
  'Préparation de ton tableau de bord…',
  'Presque prêt…',
]

function LoadingScreen({
  onDone,
  animKey,
}: {
  onDone: () => void
  animKey: string
}) {
  const [li, setLi] = useState(0)
  const w = useSharedValue(0)
  const bar = useAnimatedStyle(() => ({ width: `${w.value}%` }))

  useEffect(() => {
    w.value = withTiming(100, { duration: 3200 })
    const id = setInterval(
      () => setLi(v => Math.min(v + 1, LOAD_STEPS.length - 1)),
      800,
    )
    const done = setTimeout(onDone, 3500)
    return () => {
      clearInterval(id)
      clearTimeout(done)
    }
  }, [w, onDone])

  return (
    <Shell animKey={animKey}>
      <View style={styles.storyCenter}>
        <Title style={{ textAlign: 'center', fontSize: 26 }}>
          On construit ton plan…
        </Title>
        <View style={styles.loadTrack}>
          <Animated.View style={[styles.loadFill, bar]} />
        </View>
        <Text style={[f(500), styles.loadLabel]}>{LOAD_STEPS[li]}</Text>
      </View>
    </Shell>
  )
}

function SuccessScreen({
  who,
  appsCount,
  days,
  onNext,
  animKey,
}: {
  who: string
  appsCount: number
  days: number
  onNext: () => void
  animKey: string
}) {
  return (
    <Shell
      animKey={animKey}
      footer={<OBButton label="Voir mon plan" onPress={onNext} />}
    >
      <View style={styles.storyCenter}>
        <View style={styles.check}>
          <Text style={{ fontSize: 34, color: OB.accentInk }}>✓</Text>
        </View>
        <Title style={{ textAlign: 'center', marginTop: 22 }}>
          Ton plan est prêt, {who}.
        </Title>
        <View style={styles.recap}>
          <Recap k={`${appsCount || 'tes'}`} v="apps à reprendre en main" />
          <Recap k={`~${days} j`} v="à regagner sur un an" />
          <Recap k="Sur-mesure" v="calé sur tes moments faibles" />
        </View>
      </View>
    </Shell>
  )
}

function Recap({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={[f(700), { fontSize: 17, color: OB.accent, minWidth: 84 }]}>
        {k}
      </Text>
      <Text style={[f(400), { fontSize: 15, color: OB.ink2, flex: 1 }]}>
        {v}
      </Text>
    </View>
  )
}

function PermissionsScreen({
  onNext,
  animKey,
}: {
  onNext: () => void
  animKey: string
}) {
  const grant = async () => {
    try {
      if (ScreenTime.isAvailable) await ScreenTime.requestAuthorization()
    } catch {
      // on avance quoi qu'il arrive — l'utilisateur pourra réautoriser plus tard
    }
    onNext()
  }
  return (
    <Shell
      animKey={animKey}
      footer={
        <>
          <OBButton label="Activer la protection" onPress={grant} />
          <OBButton label="Plus tard" variant="ghost" onPress={onNext} />
        </>
      }
    >
      <Title>Une dernière chose pour que ça marche.</Title>
      <Sub>
        Relock a besoin de l'accès « Temps d'écran » pour bloquer réellement tes
        apps. Tout reste sur ton téléphone — on ne voit jamais ton contenu.
      </Sub>
      <View style={{ gap: 12, marginTop: 26 }}>
        <ChoiceCard
          label="Bloquer tes apps"
          sublabel="Le cœur de Relock — indispensable"
          selected
          onPress={grant}
        />
        <ChoiceCard
          label="Te soutenir aux bons moments"
          sublabel="Rappels utiles, jamais de spam"
          selected
          onPress={grant}
        />
      </View>
    </Shell>
  )
}

function SignInScreen({
  onNext,
  animKey,
}: {
  onNext: () => void
  animKey: string
}) {
  return (
    <Shell
      animKey={animKey}
      footer={
        <>
          <OBButton label="Continuer avec Apple" onPress={onNext} />
          <OBButton
            label="Continuer avec Google"
            variant="ghost"
            onPress={onNext}
          />
        </>
      }
    >
      <View style={styles.storyCenter}>
        <View style={styles.logoDot} />
        <Title style={{ textAlign: 'center', marginTop: 22 }}>
          Sauvegarde ta progression.
        </Title>
        <Sub style={{ textAlign: 'center' }}>
          Crée ton compte en un geste pour ne jamais perdre ta série ni tes
          blocages.
        </Sub>
      </View>
    </Shell>
  )
}

const PLANS = [
  {
    id: 'year',
    title: 'Annuel',
    price: '39,99 €/an',
    note: '3,33 €/mois · 7 jours offerts',
    best: true,
  },
  {
    id: 'month',
    title: 'Mensuel',
    price: '6,99 €/mois',
    note: 'sans engagement',
    best: false,
  },
]

function PaywallScreen({
  onDone,
  animKey,
}: {
  onDone: () => void
  animKey: string
}) {
  const [sel, setSel] = useState('year')
  return (
    <View style={styles.pwRoot}>
      {/* Bouton IGNORER en haut à droite (paywall visuel). */}
      <Pressable
        accessibilityLabel="Ignorer"
        onPress={onDone}
        hitSlop={12}
        style={styles.pwSkip}
      >
        <Text style={[f(500), { fontSize: 15, color: OB.ink3 }]}>Ignorer</Text>
      </Pressable>

      <Animated.View entering={FadeIn.duration(360)} style={styles.pwBody}>
        <Title style={{ fontSize: 28 }}>Passe à Relock illimité.</Title>
        <Sub>
          Tout ce qu'il te faut pour reprendre le contrôle, sans limite.
        </Sub>

        <View style={{ gap: 10, marginTop: 22 }}>
          {[
            'Blocages illimités',
            'Statistiques complètes',
            'Mode strict incassable',
            'Rappels intelligents',
          ].map(feat => (
            <View key={feat} style={styles.pwFeat}>
              <Text style={{ color: OB.accent, fontSize: 15 }}>✓</Text>
              <Text style={[f(500), { fontSize: 15, color: OB.ink }]}>
                {feat}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ gap: 12, marginTop: 24 }}>
          {PLANS.map(p => (
            <Pressable
              key={p.id}
              onPress={() => setSel(p.id)}
              style={[styles.pwPlan, sel === p.id && styles.pwPlanSel]}
            >
              <View style={{ flex: 1 }}>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                >
                  <Text style={[f(700), { fontSize: 16, color: OB.ink }]}>
                    {p.title}
                  </Text>
                  {p.best ? (
                    <View style={styles.pwBadge}>
                      <Text
                        style={[
                          f(700),
                          { fontSize: 10.5, color: OB.accentInk },
                        ]}
                      >
                        POPULAIRE
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    f(400),
                    { fontSize: 13, color: OB.ink2, marginTop: 3 },
                  ]}
                >
                  {p.note}
                </Text>
              </View>
              <Text style={[f(700), { fontSize: 15, color: OB.ink }]}>
                {p.price}
              </Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>

      <View style={styles.pwFooter}>
        <OBButton label="Commencer l'essai gratuit" onPress={onDone} />
        <Text style={[f(400), styles.pwLegal]}>
          Annulable à tout moment. Sans engagement.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  centerTitle: { textAlign: 'center', fontSize: 30, lineHeight: 38 },
  storyCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
  },
  logoDot: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: OB.accent,
  },
  input: {
    marginTop: 34,
    fontSize: 26,
    color: OB.ink,
    borderBottomWidth: 2,
    borderBottomColor: OB.cardBorder,
    paddingVertical: 12,
  },
  mirrorNum: {
    fontSize: 92,
    lineHeight: 100,
    color: OB.accent,
    letterSpacing: -3,
    marginTop: 8,
  },
  loadTrack: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    backgroundColor: OB.track,
    overflow: 'hidden',
    marginTop: 34,
  },
  loadFill: { height: 6, borderRadius: 3, backgroundColor: OB.accent },
  loadLabel: { fontSize: 14, color: OB.ink2, marginTop: 18 },
  check: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: OB.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recap: { alignSelf: 'stretch', gap: 14, marginTop: 34 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Paywall
  pwRoot: {
    flex: 1,
    backgroundColor: OB.bg,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  pwSkip: { position: 'absolute', top: 60, right: 22, zIndex: 2, padding: 6 },
  pwBody: { flex: 1, marginTop: 14 },
  pwFeat: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pwPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: OB.card,
    borderWidth: 1.5,
    borderColor: OB.cardBorder,
  },
  pwPlanSel: { borderColor: OB.selBorder, backgroundColor: OB.selBg },
  pwBadge: {
    backgroundColor: OB.accent,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pwFooter: { paddingBottom: 40, paddingTop: 8, gap: 10 },
  pwLegal: { fontSize: 12, color: OB.ink3, textAlign: 'center' },
})
