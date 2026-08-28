/**
 * Onglet Blocages — répond à UNE seule question : « qu'est-ce qui protège mon
 * temps en ce moment ? ». Rien d'autre n'a le droit d'être ici : pas
 * d'historique, pas de stats, pas de réglages, pas de type écrit, pas de liste
 * d'apps. Chaque élément doit gagner sa place.
 *
 * Deux sections (+ une 3ᵉ si quelque chose est suspendu) couvrent 100 % des
 * règles — voir `session.ts` pour le modèle règle/session.
 */
import { router } from 'expo-router'
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useLimitSteps } from '@/features/blocking/hooks/useLimitSteps'
import { useRuleAutoCleanup } from '@/features/blocking/hooks/useRuleAutoCleanup'
import {
  buildSessions,
  daysLabel,
  type Indicator,
  type RuleSession,
  ruleDays,
  scheduleNextStart,
  suspendedUntil,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { fonts } from '@/shared/theme/tokens/fonts'

// Tokens repris de la maquette `relock-blocages-v2.html`.
const C = {
  card: '#1C1C1E',
  cardOn: '#17151E',
  cardOnRing: 'rgba(167,139,250,0.22)',
  cardPaused: '#1A1712',
  cardPausedRing: 'rgba(232,163,61,0.18)',
  card2: '#1F1F23',
  line: '#2A2A2E',
  violet: '#A78BFA',
  amber: '#E8A33D',
  red: '#FF453A',
  txt: '#FFFFFF',
  txt2: '#8E8E96',
  txt3: '#57575E',
}

const F = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof F) => F[w]

// ── Libellés d'état (langage naturel, chiffre clé mis en valeur) ───────

const hhmm = (d: Date) =>
  d.getMinutes()
    ? `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getHours()} h`

function durationLabel(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, '0')}`
}

/** Géométrie du rail : le point est centré dessus, la carte suit. */
const DOT = 9
const RAIL_W = 2
const RAIL_GAP = 12

const hhmmParts = (h: unknown, m: unknown) =>
  `${String(typeof h === 'number' ? h : 0).padStart(2, '0')}:${String(typeof m === 'number' ? m : 0).padStart(2, '0')}`

/**
 * Ce que le blocage EST — son type, puis ses réglages. Le titre ne suffit pas :
 * quelqu'un qui a créé un blocage par erreur doit pouvoir le reconnaître sans
 * l'ouvrir, et savoir ce qu'il a choisi.
 */
export function configLine(r: BlockRuleView): string {
  const c = (r.config ?? {}) as Record<string, unknown>
  const n = (v: unknown, d: number) => (typeof v === 'number' ? v : d)
  const apps =
    r.count && r.count > 0 ? `${r.count} app${r.count > 1 ? 's' : ''}` : null
  if (r.type === 'progressive_delay') {
    return [
      'Blocage minuté',
      durationLabel(n(c.duration_min, 30) * 60_000),
      apps,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  if (r.type === 'daily_limit') {
    return [
      'Limite de temps',
      `${durationLabel(n(c.limit_min, 60) * 60_000)} par jour`,
      apps,
    ]
      .filter(Boolean)
      .join(' · ')
  }
  return [
    'Plage horaire',
    `${hhmmParts(c.start_hour, c.start_minute)} → ${hhmmParts(c.end_hour, c.end_minute)}`,
    daysLabel(ruleDays(r)),
    apps,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Segments de la ligne d'état : le chiffre clé est colorisé séparément. */
type StateLine = { pre?: string; key?: string; post?: string; tone?: 'v' | 'a' }

export function stateLine(s: RuleSession, now: Date): StateLine {
  const r = s.rule
  if (s.state === 'suspended') {
    const until = suspendedUntil(r)
    if (!until) return { pre: 'Suspendue jusqu’à ce que tu reprennes' }
    return {
      pre: 'Reprend dans ',
      key: durationLabel(until.getTime() - now.getTime()),
      tone: 'a',
    }
  }

  if (r.type === 'progressive_delay' && s.sessionEndsAt) {
    return { pre: 'Se termine à ', key: hhmm(s.sessionEndsAt), tone: 'v' }
  }

  if (r.type === 'daily_limit') {
    const ind = s.indicator as Extract<Indicator, { kind: 'limit' }>
    const limit = Number(r.config?.limit_min ?? 60)
    if (ind.reached)
      return { pre: 'Limite atteinte · rouvre à minuit', tone: 'a' }
    // Sans palier remonté par le natif, on ne prétend pas connaître la conso.
    if (ind.pct <= 0)
      return { pre: `Limite de ${durationLabel(limit * 60_000)} par jour` }
    return {
      pre: '~',
      key: durationLabel(limit * (1 - ind.pct) * 60_000),
      post: ' restantes aujourd’hui',
      tone: 'v',
    }
  }

  // Plage horaire
  if (s.state === 'running' && s.sessionEndsAt) {
    return {
      pre: 'Jusqu’à ',
      key: hhmm(s.sessionEndsAt),
      post: ` · encore ${durationLabel(s.sessionEndsAt.getTime() - now.getTime())}`,
      tone: 'v',
    }
  }
  const start = scheduleNextStart(r, now)
  const soon = start.getTime() - now.getTime() < 12 * 3_600_000
  return {
    pre: soon ? 'Démarre à ' : 'Demain à ',
    key: hhmm(start),
    post: soon
      ? ` · dans ${durationLabel(start.getTime() - now.getTime())}`
      : '',
    tone: 'v',
  }
}

// ── Indicateurs : la FORME dit le type, jamais un mot ──────────────────

/** Cadenas plein — le symbole du « impossible », pas une décoration. */
function LockGlyph({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"
        stroke={color}
        strokeWidth={2.1}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={4.5} y={10} width={15} height={10.5} rx={2.6} fill={color} />
    </Svg>
  )
}

/** Timer → anneau qui se vide. */
function TimerRing({
  fraction,
  minutes,
  strict,
}: {
  fraction: number
  minutes: number
  strict?: boolean
}) {
  const R = 18.5
  const CIRC = 2 * Math.PI * R
  // Strict : l'anneau lui-même dit « impossible » — rouge, cadenas au centre.
  // Un badge en plus aurait chargé la carte pour redire ce que la couleur dit
  // déjà, et il aurait fallu le caser là où il n'y a pas de place. Le temps
  // restant n'est pas perdu : la ligne d'état l'annonce en toutes lettres.
  const stroke = strict ? C.red : C.violet
  return (
    <View style={styles.ind}>
      <Svg width={44} height={44}>
        <G rotation={-90} origin="22, 22">
          <Circle
            cx={22}
            cy={22}
            r={R}
            fill="none"
            stroke={C.line}
            strokeWidth={3.5}
          />
          <Circle
            cx={22}
            cy={22}
            r={R}
            fill="none"
            stroke={stroke}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - fraction)}
          />
        </G>
      </Svg>
      {strict ? (
        <View style={styles.indCenter}>
          <LockGlyph color={C.red} />
        </View>
      ) : (
        <Text style={[f(700), styles.indTxt]}>{minutes}m</Text>
      )}
    </View>
  )
}

/** Limite → carré arrondi qui se remplit par le bas (ambre au-delà de 80 %). */
function LimitBox({ pct }: { pct: number }) {
  const warn = pct > 0.8
  return (
    <View style={styles.box}>
      <View
        style={[
          styles.boxFill,
          {
            height: `${Math.round(pct * 100)}%`,
            backgroundColor: warn
              ? 'rgba(232,163,61,0.5)'
              : 'rgba(167,139,250,0.5)',
          },
        ]}
      />
      <Text style={[f(800), styles.boxTxt]}>{Math.round(pct * 100)}%</Text>
    </View>
  )
}

/**
 * Plage → cadran horaire : secteur violet = le créneau, aiguille = maintenant.
 * ⚠️ C'est un SYMBOLE, pas une lecture exacte (un cadran 12 h ne peut pas
 * représenter fidèlement 22 h → 7 h). Assumé.
 */
function ScheduleDial({
  startMin,
  endMin,
  nowMin,
}: {
  startMin: number
  endMin: number
  nowMin: number
}) {
  const toAngle = (min: number) => ((min % 720) / 720) * 360 - 90
  const pt = (min: number, r: number) => {
    const a = (toAngle(min) * Math.PI) / 180
    return [22 + r * Math.cos(a), 22 + r * Math.sin(a)]
  }
  const [sx, sy] = pt(startMin, 15)
  const [ex, ey] = pt(endMin, 15)
  const span = (endMin - startMin + 1440) % 1440
  const large = span % 720 > 360 ? 1 : 0
  return (
    <View style={styles.dial}>
      <Svg width={44} height={44} viewBox="0 0 44 44">
        <Circle
          cx={22}
          cy={22}
          r={15}
          fill="none"
          stroke="#2E2E34"
          strokeWidth={1}
        />
        <Path
          d={`M22 22 L${sx} ${sy} A15 15 0 ${large} 1 ${ex} ${ey} Z`}
          fill={C.violet}
          opacity={0.38}
        />
        <Circle cx={22} cy={22} r={1.6} fill={C.txt2} />
        <Line
          x1={22}
          y1={22}
          x2={pt(nowMin, 10)[0]}
          y2={pt(nowMin, 10)[1]}
          stroke={C.txt2}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

function PauseIcon() {
  return (
    <View style={styles.pausei}>
      <Svg width={13} height={13} viewBox="0 0 12 12">
        <Path
          d="M3 1.5v9M9 1.5v9"
          stroke={C.amber}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}

export function IndicatorView({
  ind,
  strict,
}: {
  ind: Indicator
  strict?: boolean
}) {
  if (ind.kind === 'timer')
    return (
      <TimerRing
        fraction={ind.fraction}
        minutes={ind.minutesLeft}
        strict={strict}
      />
    )
  if (ind.kind === 'limit') return <LimitBox pct={ind.pct} />
  if (ind.kind === 'schedule')
    return (
      <ScheduleDial
        startMin={ind.startMin}
        endMin={ind.endMin}
        nowMin={ind.nowMin}
      />
    )
  return <PauseIcon />
}

/** La même ligne d'état, en texte plat — pour la fiche de détail. */
export function stateText(s: RuleSession, now: Date): string {
  const l = stateLine(s, now)
  return [l.pre, l.key, l.post].filter(Boolean).join('')
}

// ── Carte : titre, ce que c'est, ce qui se passe ──────────────────────

function Card({
  s,
  now,
  onPress,
}: {
  s: RuleSession
  now: Date
  onPress: () => void
}) {
  const l = stateLine(s, now)
  const tone = l.tone === 'a' ? C.amber : C.violet
  const a11y = `${s.title}. ${configLine(s.rule)}. ${[l.pre, l.key, l.post].filter(Boolean).join('')}${s.strict ? '. Mode strict' : ''}`
  return (
    <View style={styles.cardRow}>
      {/* Le point étiquette la carte sur le rail : il donne à la liste une
          colonne vertébrale, et à chaque blocage une place dessus. */}
      <View style={styles.dot} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={onPress}
        style={[
          styles.card,
          s.state === 'running' && styles.cardOn,
          s.state === 'suspended' && styles.cardPaused,
        ]}
      >
        {/* L'indicateur est décoratif : l'état est déjà annoncé par le libellé. */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <IndicatorView ind={s.indicator} strict={s.strict} />
        </View>
        <View style={styles.body}>
          <Text style={[f(600), styles.title]} numberOfLines={1}>
            {s.title}
          </Text>
          <Text style={[f(400), styles.config]} numberOfLines={2}>
            {configLine(s.rule)}
          </Text>
          <Text style={[f(400), styles.state]} numberOfLines={1}>
            {l.pre}
            {l.key ? (
              <Text style={[f(600), { color: tone }]}>{l.key}</Text>
            ) : null}
            {l.post}
            {s.lifetime ? ` · J ${s.lifetime.day} sur ${s.lifetime.total}` : ''}
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

function Section({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sec}>
      <Text style={[f(700), styles.secTitle]}>{label}</Text>
      <Text style={[f(700), styles.secCount]}>{count}</Text>
    </View>
  )
}

/** Personnage qui lit — l'opposé du scroll compulsif. */
function ReadingArt() {
  return (
    <Svg width={168} height={132} viewBox="0 0 168 132" fill="none">
      <Circle cx={84} cy={70} r={54} fill={C.violet} opacity={0.05} />
      {/* sol */}
      <Path
        d="M28 112h112"
        stroke="#2E2E36"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* jambes repliées */}
      <Path
        d="M62 112c0-16 10-22 24-22s26 4 30 12"
        stroke="#2E2E36"
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />
      {/* buste */}
      <Path
        d="M62 112c-8-10-8-30 2-42 6-7 14-9 20-7"
        stroke="#1F1F23"
        strokeWidth={13}
        strokeLinecap="round"
        fill="none"
      />
      {/* tête */}
      <Circle cx={78} cy={50} r={11} fill="#2E2E36" />
      {/* livre */}
      <Path d="M92 74l22-9v22l-22 9z" fill={C.violet} opacity={0.35} />
      <Path d="M92 74l-14-6v22l14 6z" fill="#2E2E36" />
      <Path d="M92 74v22" stroke="#1C1C1E" strokeWidth={1.5} />
      {/* bras vers le livre */}
      <Path
        d="M82 68c6 0 10 3 12 6"
        stroke="#1F1F23"
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <ReadingArt />
      <Text style={[f(700), styles.emptyTitle]}>Rien ne protège ton temps</Text>
      <Text style={[f(400), styles.emptySub]}>
        Ton téléphone est grand ouvert. Choisis un premier moment à protéger.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Créer un blocage"
        onPress={onAdd}
        style={styles.emptyBtn}
      >
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5.5v13M5.5 12h13"
            stroke="#1A1330"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
    </View>
  )
}

export default function BlocagesScreen() {
  const { rules } = useBlockRulesQuery()
  // Timers terminés / défis expirés : retirés d'office (§2).
  useRuleAutoCleanup(rules)

  // Les libellés sont temporels : on retick régulièrement (sans reduced-motion
  // concerné — c'est du texte, pas de l'animation).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  // TODO(natif) : paliers de quota (25/50/75/100 %) écrits par le monitor.
  const limitSteps = useLimitSteps()
  const sessions = useMemo(
    () => buildSessions(rules, now, limitSteps),
    [rules, now, limitSteps],
  )

  const running = sessions.filter(s => s.state === 'running')
  const upcoming = sessions.filter(s => s.state === 'upcoming')
  const suspended = sessions.filter(s => s.state === 'suspended')
  const openAdd = () => router.push('/add-block')
  const openSheet = (s: RuleSession) =>
    router.push({ pathname: '/block-detail', params: { id: s.rule.id } })

  return (
    <ScreenWrapper>
      <View style={styles.root}>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[f(800), styles.h1]}>Blocages</Text>
            <Text style={[f(400), styles.sub]}>
              {running.length === 0
                ? 'Aucun blocage actif en ce moment'
                : `${running.length} blocage${running.length > 1 ? 's' : ''} actif${running.length > 1 ? 's' : ''} en ce moment`}
            </Text>
          </View>
          {/* Rien à lister ⇒ le bouton du vide suffit : deux « + » à l'écran
              n'ajoutent pas un choix, ils ajoutent une hésitation. */}
          {sessions.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Nouveau blocage"
              onPress={openAdd}
              hitSlop={10}
              style={styles.addBtn}
            >
              <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 5.5v13M5.5 12h13"
                  stroke="#1A1330"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          )}
        </View>

        {sessions.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
          >
            {/* Le rail court derrière toute la liste : les points s'y accrochent
                et la lecture suit une seule ligne, de haut en bas. */}
            <View style={styles.timeline}>
              <View style={styles.rail} pointerEvents="none" />
              {/* Les sections vides ne s'affichent pas du tout. Ordre fixe. */}
              {running.length > 0 && (
                <Section label="EN COURS" count={running.length} />
              )}
              {running.map(s => (
                <Card
                  key={s.rule.id}
                  s={s}
                  now={now}
                  onPress={() => openSheet(s)}
                />
              ))}

              {upcoming.length > 0 && (
                <Section label="À VENIR" count={upcoming.length} />
              )}
              {upcoming.map(s => (
                <Card
                  key={s.rule.id}
                  s={s}
                  now={now}
                  onPress={() => openSheet(s)}
                />
              ))}

              {suspended.length > 0 && (
                <Section label="SUSPENDUES" count={suspended.length} />
              )}
              {suspended.map(s => (
                <Card
                  key={s.rule.id}
                  s={s}
                  now={now}
                  onPress={() => openSheet(s)}
                />
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 12,
    gap: 12,
  },
  h1: { fontSize: 34, color: C.txt, letterSpacing: -0.9 },
  sub: { fontSize: 13, color: C.txt2, marginTop: 3 },
  // Le même bouton qu'au centre de l'état vide : plein, violet, il se voit.
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.violet,
    shadowOpacity: 0.36,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  scroll: { paddingTop: 8, paddingBottom: 32 },
  timeline: { position: 'relative' },
  // Une ligne à peine là : elle structure sans réclamer l'attention.
  rail: {
    position: 'absolute',
    left: (DOT - RAIL_W) / 2,
    top: 4,
    bottom: 4,
    width: RAIL_W,
    borderRadius: RAIL_W,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: RAIL_GAP,
    marginBottom: 14,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: C.violet,
  },
  sec: {
    marginLeft: DOT + RAIL_GAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 22,
    marginBottom: 9,
  },
  secTitle: { fontSize: 11, color: C.txt3, letterSpacing: 1.1 },
  secCount: { fontSize: 11, color: C.txt3 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 13,
    paddingHorizontal: 15,
    flex: 1,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 70, // cible tactile confortable
  },
  cardOn: { backgroundColor: C.cardOn, borderColor: C.cardOnRing },
  cardPaused: { backgroundColor: C.cardPaused, borderColor: C.cardPausedRing },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 16, color: C.txt, letterSpacing: -0.2, flexShrink: 1 },
  lock: {
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  lockTxt: { fontSize: 10, color: C.violet, letterSpacing: 0.3 },
  config: { fontSize: 12.5, color: C.txt3, marginTop: 3, lineHeight: 17 },
  indCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  state: {
    fontSize: 13.5,
    color: C.txt2,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  ind: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indTxt: {
    position: 'absolute',
    fontSize: 10.5,
    color: C.violet,
    fontVariant: ['tabular-nums'],
  },
  box: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#232327',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFill: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  boxTxt: { fontSize: 10, color: '#fff', letterSpacing: -0.2 },
  dial: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#202024',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pausei: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: 'rgba(232,163,61,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 4,
  },
  emptyTitle: {
    fontSize: 21,
    color: C.txt,
    letterSpacing: -0.4,
    marginTop: 26,
  },
  emptySub: {
    fontSize: 14,
    color: C.txt2,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 6,
    maxWidth: 280,
  },
  emptyBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    shadowColor: C.violet,
    shadowOpacity: 0.36,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
})
