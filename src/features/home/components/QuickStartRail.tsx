// « Commencer rapidement » — rail fixe des 3 préréglages phares de la
// maquette Accueil (Focus / Repos / Réseaux limités). Remplace l'ancienne
// suggestion unique tournante : ici les trois entrées sont montrées en
// permanence, chacune disparaissant dès qu'elle est déjà adoptée (jamais on
// ne republicise un blocage déjà en place, cf. `availablePresets`).
//
// Maquette : un CONTENEUR englobant (titre + 3 lignes), et à l'intérieur
// trois cartes séparées (pas une carte fusionnée à séparateurs) — chacune
// son propre fond, coins arrondis, liseré violet, une icône illustrée et un
// motif décoratif qui déborde derrière le chevron.
import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  availablePresets,
  type Preset,
  presetDetail,
} from '@/features/blocking/presets'
import type { BlockRuleView } from '@/features/blocking/types'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

const C = {
  outer: '#0B0A12',
  outerBorder: 'rgba(148,158,181,0.14)',
  card: '#141320',
  cardBorder: 'rgba(148,158,181,0.14)',
  ink: '#F5F5F7',
  ink55: 'rgba(210,212,224,0.5)',
  ink32: 'rgba(210,212,224,0.75)',
}

const FW = { 400: fonts.regular, 700: fonts.bold } as const
const f = (w: keyof typeof FW) => FW[w]

const RAIL_ORDER = ['focus', 'nuit', 'dose'] as const
type RailId = (typeof RAIL_ORDER)[number]

const RAIL_ICON: Record<RailId, number> = {
  focus: require('@assets/home-boule.png'),
  nuit: require('@assets/home-lune-nuage.png'),
  dose: require('@assets/home-bouclier.png'),
}
const RAIL_BLEED: Record<RailId, number> = {
  focus: require('@assets/home-etoilefilante.png'),
  nuit: require('@assets/home-nuage-fumee.png'),
  dose: require('@assets/home-grille.png'),
}

export function QuickStartRail({ rules }: { rules: BlockRuleView[] }) {
  const items = useMemo(() => {
    const available = availablePresets(rules)
    return RAIL_ORDER.map(id => available.find(p => p.id === id)).filter(
      (p): p is Preset => !!p,
    )
  }, [rules])

  if (items.length === 0) return null

  return (
    <View style={s.outer}>
      <Text style={[f(700), s.title]}>Commencer rapidement</Text>
      {items.map((preset, i) => {
        const id = preset.id as RailId
        return (
          <Pressable
            key={preset.id}
            accessibilityRole="button"
            accessibilityLabel={`${preset.title} — ${presetDetail(preset)}`}
            onPress={() =>
              router.push({
                pathname: '/preset-recap',
                params: { presetId: preset.id },
              })
            }
            style={[s.row, i === items.length - 1 && s.rowLast]}
          >
            <Image
              source={RAIL_BLEED[id]}
              style={s.bleed}
              resizeMode="contain"
            />
            <Image source={RAIL_ICON[id]} style={s.icon} resizeMode="contain" />
            <View style={s.rowText}>
              <Text style={[f(700), s.rowTitle]}>{preset.title}</Text>
              <Text style={[f(400), s.rowDetail]} numberOfLines={1}>
                {presetDetail(preset)}
              </Text>
            </View>
            <IconSvg name={IconName.FORWARD} size={16} color={C.ink32} />
          </Pressable>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  outer: {
    marginTop: 18,
    backgroundColor: C.outer,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.outerBorder,
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: {
    fontSize: 17,
    color: C.ink,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
    marginTop: 2,
    marginBottom: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 9,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  rowLast: { marginBottom: 0 },
  bleed: {
    position: 'absolute',
    right: -16,
    top: -12,
    width: 105,
    height: 105,
    opacity: 0.6,
  },
  icon: { width: 42, height: 42 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, color: C.ink },
  rowDetail: { fontSize: 12.5, color: C.ink55, marginTop: 2 },
})
