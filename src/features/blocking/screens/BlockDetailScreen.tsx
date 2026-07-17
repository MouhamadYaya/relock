/**
 * Sheet d'une protection (§6) — trois choix, pas quatre.
 *
 * Vocabulaire : jamais « protection », qui ne décrit rien — on nomme la chose
 * telle qu'elle est (« la plage horaire », « la limite », « le blocage »), et on
 * dit toujours la conséquence concrète.
 *
 * Friction : le bouton de suppression est INERTE 8 s, et se remplit de rouge
 * pendant ce temps. Assez long pour laisser passer une impulsion, assez court
 * pour ne pas se sentir prisonnier. Le délai EST la confirmation — aucune boîte
 * de dialogue derrière. Un délai invisible passerait pour un bug : le bouton
 * lui-même sert donc de jauge.
 *
 * Mode strict : quand la SESSION en cours est verrouillée, tout est éteint. Il
 * n'y a rien à négocier — c'est l'utilisateur lucide d'hier qui a décidé.
 *
 * ⚠️ « Modifier » (prévu au §6) est absent : il demande un mode ÉDITION dans le
 * flow de création, que le §7 demandait de ne pas toucher. À trancher.
 */
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import React, { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { HalfSheet } from '@/features/blocking/components/HalfSheet'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useDeleteRuleMutation } from '@/features/blocking/hooks/useDeleteRuleMutation'
import {
  useResumeRuleMutation,
  useSuspendRuleMutation,
} from '@/features/blocking/hooks/useSuspendRuleMutation'
import {
  configLine,
  IndicatorView,
  stateText,
} from '@/features/blocking/screens/BlocagesScreen'
import { deriveSession, isSessionLocked } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { goBack } from '@/navigation/helpers/navigation-helpers'
import type { RootStackParamList } from '@/navigation/root-param-list'
import type { ROUTES } from '@/navigation/routes'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'

const C = {
  group: '#111113',
  sep: '#202024',
  violet: '#A78BFA',
  amber: '#E8A33D',
  red: '#FF453A',
  redArming: '#6A2E2C', // rouge désaturé : bouton encore inerte
  txt: '#FFFFFF',
  txt2: '#8E8E96',
  txt3: '#57575E',
}

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
} as const
const f = (w: keyof typeof FW) => FW[w]

/** Délai d'inertie du bouton destructeur (secondes). */
const ARM_SECONDS = 8

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ROUTES.BLOCK_DETAIL
>

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

/** Le mot exact pour CE blocage. « Protection » ne dit pas de quoi il s'agit. */
function ruleNoun(rule: BlockRuleView): string {
  if (rule.type === 'daily_limit') return 'la limite'
  if (rule.type === 'schedule') return 'la plage horaire'
  return 'le blocage'
}

/** Durées de pause — des choix, pas une molette : un tap et c'est réglé. */
const PAUSES: { label: string; minutes: number | null }[] = [
  { label: '5 minutes', minutes: 5 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 heure', minutes: 60 },
  { label: '2 heures', minutes: 120 },
  { label: 'Jusqu’à ce que je reprenne', minutes: null },
]

/**
 * Bouton destructeur à inertie : le rouge envahit le bouton en 8 s, puis il
 * s'active. Le bouton EST la jauge — rien à ajouter à l'écran, et on voit d'un
 * coup d'œil combien il reste.
 */
function DestroyRow({
  label,
  ready,
  onPress,
}: {
  label: string
  ready: boolean
  onPress: () => void
}) {
  const fill = useSharedValue(0)
  useEffect(() => {
    fill.value = withTiming(1, {
      duration: ARM_SECONDS * 1000,
      easing: Easing.linear,
    })
  }, [fill])
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))
  const color = ready ? C.red : C.redArming
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={onPress}
      style={[styles.item, styles.destroy]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.destroyFill, fillStyle]}
      />
      <Text style={[f(500), styles.itemIcon, { color }]}>⏻</Text>
      <Text style={[f(500), styles.itemLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

function Row({
  label,
  icon,
  note,
  tone,
  disabled,
  onPress,
  last,
}: {
  label: string
  icon: string
  note?: string
  tone?: 'warn' | 'danger' | 'arming'
  disabled?: boolean
  onPress?: () => void
  last?: boolean
}) {
  const color =
    tone === 'danger'
      ? C.red
      : tone === 'arming'
        ? C.redArming
        : tone === 'warn'
          ? C.amber
          : disabled
            ? C.txt3
            : C.txt
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.item, !last && styles.itemBorder]}
    >
      <Text style={[f(500), styles.itemIcon, { color }]}>{icon}</Text>
      <Text style={[f(500), styles.itemLabel, { color }]}>{label}</Text>
      {note ? (
        <Text
          style={[
            f(500),
            styles.itemNote,
            tone === 'arming' && { color: C.redArming },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </Pressable>
  )
}

export default function BlockDetailScreen({ route }: Props) {
  const routeRule = route.params?.rule
  // Les paramètres de navigation sont une PHOTO prise à l'ouverture : on relit
  // la règle vivante dans le cache (la liste est la source de vérité).
  const { rules } = useBlockRulesQuery()
  const del = useDeleteRuleMutation()
  const suspend = useSuspendRuleMutation()
  const resume = useResumeRuleMutation()

  const [now, setNow] = useState(() => new Date())
  const [picking, setPicking] = useState(false) // choix de durée de suspension
  const [armLeft, setArmLeft] = useState(ARM_SECONDS)

  // Inertie du bouton destructeur : décompte discret jusqu'à 0.
  useEffect(() => {
    if (armLeft <= 0) return
    const id = setTimeout(() => setArmLeft(v => v - 1), 1000)
    return () => clearTimeout(id)
  }, [armLeft])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const rule = rules.find(r => r.id === routeRule?.id) ?? routeRule
  if (!rule) return null

  const s = deriveSession(rule, now)
  const locked = isSessionLocked(rule, now)
  const isSuspended = s.state === 'suspended'
  const apps = rule.count ?? 0
  // On ne peut PAS nommer les apps : la sélection Apple est un jeton opaque.
  const consequence = apps
    ? `${apps} app${apps > 1 ? 's' : ''} redeviendr${apps > 1 ? 'ont' : 'a'} accessible${apps > 1 ? 's' : ''} immédiatement.`
    : 'Tes apps redeviendront accessibles immédiatement.'

  const doSuspend = (minutes: number | null, close: () => void) => {
    const until = minutes ? new Date(Date.now() + minutes * 60_000) : null
    suspend.mutate({ rule, until }, { onError: e => showErrorToast(e) })
    close()
  }
  const doResume = (close: () => void) => {
    resume.mutate({ rule }, { onError: e => showErrorToast(e) })
    close()
  }
  const doDeactivate = (close: () => void) => {
    if (ScreenTime.isAvailable) {
      ScreenTime.clearRuleData(rule.id, nativeKindOf(rule.type)).catch(() => {})
    }
    del.mutate({ id: rule.id }, { onError: e => showErrorToast(e) })
    close()
  }

  return (
    <HalfSheet onClose={goBack}>
      {close => (
        <View style={styles.wrap}>
          {/* En-tête : l'indicateur en grand, le nom, une ligne de contexte. */}
          <View style={styles.head}>
            {locked ? (
              <View style={styles.strictBadge}>
                <Text style={[f(700), styles.strictBadgeTxt]}>
                  🔒 MODE STRICT
                </Text>
              </View>
            ) : (
              <View style={styles.bigInd}>
                <IndicatorView ind={s.indicator} strict={s.strict} />
              </View>
            )}
            <Text style={[f(700), styles.title]}>{s.title}</Text>
            {/* Ce que c'est (réglages choisis), puis ce qui se passe (état). Un
                blocage créé par erreur doit se reconnaître ici, sans fouiller. */}
            <Text style={[f(400), styles.sub]}>{configLine(rule)}</Text>
            <Text style={[f(500), styles.subState]}>
              {locked && s.sessionEndsAt
                ? `Verrouillé jusqu'à ${hhmm(s.sessionEndsAt)} · encore ${durationLabel(s.sessionEndsAt.getTime() - now.getTime())}`
                : stateText(s, now)}
            </Text>
          </View>

          {locked ? (
            /* Strict : tout est éteint. Rien à négocier. */
            <View style={styles.group}>
              <Row
                label="Mettre en pause"
                icon="❙❙"
                note="Indisponible"
                disabled
              />
              <Row
                label={`Supprimer ${ruleNoun(rule)}`}
                icon="⏻"
                note="Indisponible"
                disabled
                last
              />
            </View>
          ) : picking ? (
            /* Combien de temps ? Une liste de durées : un tap et c'est réglé.
               « Jusqu'à ce que je reprenne » couvre les vacances sans rien
               détruire. À l'échéance, iOS remet le blocage tout seul. */
            <View style={styles.group}>
              {PAUSES.map(d => (
                <Row
                  key={d.label}
                  label={d.label}
                  icon="❙❙"
                  tone="warn"
                  onPress={() => doSuspend(d.minutes, close)}
                />
              ))}
              <Row
                label="Annuler"
                icon="↩"
                onPress={() => setPicking(false)}
                last
              />
            </View>
          ) : (
            <>
              <View style={styles.group}>
                {isSuspended ? (
                  <Row
                    label="Reprendre maintenant"
                    icon="▶"
                    tone="warn"
                    onPress={() => doResume(close)}
                    last
                  />
                ) : (
                  <Row
                    label="Mettre en pause"
                    icon="❙❙"
                    tone="warn"
                    note="5 min → 2 h"
                    onPress={() => setPicking(true)}
                    last
                  />
                )}
              </View>

              <View style={styles.group}>
                <DestroyRow
                  label={`Supprimer ${ruleNoun(rule)}`}
                  ready={armLeft <= 0}
                  onPress={() => doDeactivate(close)}
                />
              </View>
            </>
          )}

          <Text style={[f(400), styles.foot]}>
            {locked
              ? `Tu as verrouillé ce blocage${
                  rule.createdAt ? ` à ${hhmm(new Date(rule.createdAt))}` : ''
                }.\nIl n'y a rien à décider maintenant.`
              : consequence}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={close}
            style={styles.close}
          >
            <Text style={[f(700), styles.closeTxt]}>Fermer</Text>
          </Pressable>
        </View>
      )}
    </HalfSheet>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingBottom: 4 },
  head: { alignItems: 'center', paddingHorizontal: 10, paddingBottom: 18 },
  bigInd: { transform: [{ scale: 1.5 }], marginBottom: 18, marginTop: 6 },
  strictBadge: {
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  strictBadgeTxt: { fontSize: 11, color: C.violet, letterSpacing: 0.3 },
  title: { fontSize: 20, color: C.txt, letterSpacing: -0.3 },
  subState: {
    fontSize: 13.5,
    color: C.violet,
    textAlign: 'center',
    marginTop: 5,
  },
  destroy: { overflow: 'hidden' },
  destroyFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,69,58,0.16)',
  },
  sub: { fontSize: 13, color: C.txt2, marginTop: 4, textAlign: 'center' },
  group: {
    backgroundColor: C.group,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 9,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    minHeight: 52, // cible tactile ≥ 44
  },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: C.sep },
  itemIcon: { width: 20, textAlign: 'center', fontSize: 14 },
  itemLabel: { fontSize: 16 },
  itemNote: { marginLeft: 'auto', fontSize: 12, color: C.txt3 },
  foot: {
    fontSize: 11.5,
    color: C.txt3,
    textAlign: 'center',
    paddingHorizontal: 22,
    paddingTop: 11,
    paddingBottom: 4,
    lineHeight: 17,
  },
  close: {
    backgroundColor: C.group,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 5,
  },
  closeTxt: { fontSize: 16, color: C.txt },
})
