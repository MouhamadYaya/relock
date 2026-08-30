// Carte héro Accueil — au moins un blocage existe. Maquette
// « HomePourUserAyantAuMoinsUnBlocage » : badge d'état, apps bloquées,
// anneau (temps restant), actions, ligne de plage horaire concurrente.
import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { RingProgress } from '@/features/blocking/components/RingProgress'
import { stateLine } from '@/features/blocking/screens/BlocagesScreen'
import { type RuleSession, ruleTitle } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { appsSubtitle, blockEndDate, ringInfo } from '@/features/blocking/types'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

const C = {
  card: '#0E0D16',
  cardBorder: 'rgba(148,158,181,0.16)',
  ink: '#F5F5F7',
  ink70: 'rgba(235,235,245,0.7)',
  ink55: 'rgba(235,235,245,0.55)',
  ink40: 'rgba(235,235,245,0.4)',
  accent: '#957FFA',
  accentSoft: '#C7BBFB',
  onAccent: '#161226',
  green: '#3ED17D',
  greenBg: 'rgba(62,209,125,0.12)',
  grey: '#8E8E96',
  greyBg: 'rgba(142,142,150,0.12)',
  sep: 'rgba(255,255,255,0.07)',
  outline: 'rgba(167,139,250,0.5)',
  shieldBorder: 'rgba(180,176,248,0.5)',
}

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
} as const
const f = (w: keyof typeof FW) => FW[w]

function hhmm(d: Date): string {
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
}

/** « 22:00 » — format horloge, pour la ligne « Plage horaire active ». */
function hhcolon(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const RING_SIZE = 132
const RING_STROKE = 3.5

/** Position du point lumineux en bout d'anneau (0 = 12 h, sens horaire). */
function ringDotPosition(fraction: number): { left: number; top: number } {
  const r = (RING_SIZE - RING_STROKE) / 2
  const cx = RING_SIZE / 2
  const cy = RING_SIZE / 2
  const theta = (fraction * 360 - 90) * (Math.PI / 180)
  return {
    left: cx + r * Math.cos(theta) - 4,
    top: cy + r * Math.sin(theta) - 4,
  }
}

function ringCenter(min: number): { big: string; small: string } {
  if (min < 60) return { big: String(Math.max(0, min)), small: 'min' }
  const h = Math.floor(min / 60)
  const m = min % 60
  return {
    big: m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`,
    small: 'restant',
  }
}

type Props = {
  primaryRule: BlockRuleView | null
  scheduleFooterRule: BlockRuleView | null
  idleSession: RuleSession | null
  now: Date
  onExtend: () => void
  extending: boolean
}

export function ActiveProtectionCard({
  primaryRule,
  scheduleFooterRule,
  idleSession,
  now,
  onExtend,
  extending,
}: Props) {
  const live = !!primaryRule
  const ring = primaryRule ? ringInfo(primaryRule, now) : null
  const end = primaryRule ? blockEndDate(primaryRule) : null
  const remainingMin = end
    ? Math.max(0, Math.round((end.getTime() - now.getTime()) / 60_000))
    : 0
  const center = ringCenter(remainingMin)
  const canExtend = primaryRule?.type === 'progressive_delay'

  return (
    <View style={s.card}>
      <View style={s.headRow}>
        <View style={s.shieldBadge}>
          <IconSvg name={IconName.SHIELD} size={17} color={C.accentSoft} />
        </View>
        <View
          style={[
            s.statusPill,
            { backgroundColor: live ? C.greenBg : C.greyBg },
          ]}
        >
          <View style={[s.dot, { backgroundColor: live ? C.green : C.grey }]} />
          <Text
            style={[f(600), s.statusTxt, { color: live ? C.green : C.grey }]}
          >
            {live ? 'Protection active' : 'Aucune protection active'}
          </Text>
        </View>
      </View>

      <View style={s.body}>
        <View style={s.leftCol}>
          {live && primaryRule ? (
            <>
              <Text style={[f(700), s.appsLine]}>
                {appsSubtitle(primaryRule.appIds, primaryRule.count)}
              </Text>
              <Text style={[f(500), s.remainLine]}>
                Encore{' '}
                <Text style={[f(700), s.remainKey]}>
                  {center.big} {center.small}
                </Text>
              </Text>
              {end && (
                <Text style={[f(400), s.etaLine]}>
                  Fin prévue à{' '}
                  <Text style={[f(500), s.etaKey]}>{hhmm(end)}</Text>
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[f(700), s.appsLine]}>
                {idleSession
                  ? ruleTitle(idleSession.rule)
                  : 'Rien en ce moment'}
              </Text>
              <Text style={[f(400), s.etaLine]}>
                {idleSession
                  ? (() => {
                      const l = stateLine(idleSession, now)
                      return `${l.pre ?? ''}${l.key ?? ''}${l.post ?? ''}`
                    })()
                  : 'Ton téléphone est grand ouvert.'}
              </Text>
            </>
          )}
        </View>

        <View style={s.ringWrap}>
          <Image
            source={require('@assets/home-lune-pleine.png')}
            style={s.ringMoon}
            resizeMode="contain"
          />
          <View style={s.ringGlow}>
            <RingProgress
              size={RING_SIZE}
              stroke={RING_STROKE}
              fraction={live && ring ? ring.fraction : 0}
              color={C.accent}
              track="transparent"
            >
              {live ? (
                <>
                  <Text style={[f(700), s.ringBig]}>{center.big}</Text>
                  <Text style={[f(500), s.ringSmall]}>{center.small}</Text>
                </>
              ) : (
                <IconSvg name={IconName.MOON} size={26} color="#C9C5FF" />
              )}
            </RingProgress>
          </View>
          {live && ring && (
            <View style={[s.ringDot, ringDotPosition(ring.fraction)]} />
          )}
        </View>
      </View>

      <View style={s.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir les blocages"
          onPress={() => router.navigate('/(tabs)/blocks')}
          style={s.primaryBtn}
        >
          <IconSvg name={IconName.LOCK} size={15} color={C.onAccent} />
          <Text style={[f(600), s.primaryBtnTxt]}>Voir les blocages</Text>
        </Pressable>

        {canExtend && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajouter 15 minutes"
            disabled={extending}
            onPress={onExtend}
            style={[s.secondaryBtn, extending && s.pressed]}
          >
            {extending ? (
              <ActivityIndicator color={C.accent} size="small" />
            ) : (
              <Text style={[f(600), s.secondaryBtnTxt]}>+15 min</Text>
            )}
          </Pressable>
        )}
      </View>

      {scheduleFooterRule && (
        <View style={s.footer}>
          <IconSvg name={IconName.MOON} size={15} color={C.ink40} />
          <Text style={[f(400), s.footerTxt]} numberOfLines={1}>
            Plage horaire active · {hhcolon(scheduleStart(scheduleFooterRule))}{' '}
            → {hhcolon(scheduleEnd(scheduleFooterRule))}
          </Text>
        </View>
      )}
    </View>
  )
}

function scheduleStart(r: BlockRuleView): Date {
  const c = r.config ?? {}
  const d = new Date()
  d.setHours(
    typeof c.start_hour === 'number' ? c.start_hour : 22,
    typeof c.start_minute === 'number' ? c.start_minute : 0,
    0,
    0,
  )
  return d
}

function scheduleEnd(r: BlockRuleView): Date {
  const c = r.config ?? {}
  const d = new Date()
  d.setHours(
    typeof c.end_hour === 'number' ? c.end_hour : 8,
    typeof c.end_minute === 'number' ? c.end_minute : 0,
    0,
    0,
  )
  return d
}

const s = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shieldBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: C.shieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 12.5 },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    gap: 12,
  },
  leftCol: { flex: 1, minWidth: 0 },
  appsLine: { fontSize: 21, color: C.ink, letterSpacing: -0.3 },
  remainLine: { fontSize: 16, color: C.ink70, marginTop: 10 },
  remainKey: { color: C.accent, fontSize: 16 },
  etaLine: { fontSize: 13.5, color: C.ink40, marginTop: 8, lineHeight: 19 },
  etaKey: { fontSize: 13.5, color: C.accentSoft },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMoon: { position: 'absolute', width: 134, height: 134 },
  ringGlow: {
    shadowColor: C.accent,
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  ringDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  ringBig: {
    fontSize: 32,
    color: C.ink,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  ringSmall: { fontSize: 14, color: C.ink55, marginTop: -2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.accent,
    shadowColor: C.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  primaryBtnTxt: { fontSize: 16, color: C.onAccent },
  secondaryBtn: {
    paddingHorizontal: 20,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: C.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnTxt: { fontSize: 16, color: C.accent },
  pressed: { opacity: 0.7 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.sep,
  },
  footerTxt: { fontSize: 13, color: C.ink55, flexShrink: 1 },
})
