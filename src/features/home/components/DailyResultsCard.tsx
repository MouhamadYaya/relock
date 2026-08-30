// « Résultats du jour » — temps regagné cette semaine + distractions évitées
// aujourd'hui. Données réelles (`useHomeStats`), jamais un « 0 » pendant que
// la synchro tourne encore.
//
// Maquette : le titre vit DANS la carte (première ligne), pas au-dessus —
// contrairement au rail « Commencer rapidement ». Les valeurs de durée
// suivent le même habillage grand/petit que le héro « 3h 12min ».
import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

const C = {
  card: '#100F19',
  cardBorder: 'rgba(148,158,181,0.16)',
  ink: '#F5F5F7',
  ink55: 'rgba(235,235,245,0.55)',
  sep: 'rgba(255,255,255,0.07)',
  iconBg: '#8E7EF5',
  onIcon: '#161226',
}

const FW = { 400: fonts.regular, 500: fonts.medium, 700: fonts.bold } as const
const f = (w: keyof typeof FW) => FW[w]

/** « 2 h 46 » découpé en segments grand/petit, comme le héro « 3h 12min ». */
function DurationValue({ min }: { min: number }) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) {
    return (
      <Text style={[f(700), s.valueBig]}>
        {m}
        <Text style={[f(500), s.valueSmall]}> min</Text>
      </Text>
    )
  }
  return (
    <Text style={[f(700), s.valueBig]}>
      {h}
      <Text style={[f(500), s.valueSmall]}> h </Text>
      {String(m).padStart(2, '0')}
    </Text>
  )
}

export function DailyResultsCard({
  savedMinutesWeek,
  interceptions,
  isPending,
}: {
  savedMinutesWeek: number
  interceptions: number
  isPending: boolean
}) {
  return (
    <View style={s.card}>
      <Text style={[f(700), s.title]}>Résultats du jour</Text>

      <View style={s.row}>
        <View style={s.icon}>
          <IconSvg name={IconName.CLOCK} size={18} color={C.onIcon} />
        </View>
        <View style={s.rowText}>
          <Text style={[f(700), s.rowTitle]}>Temps regagné</Text>
          <Text style={[f(400), s.rowSub]}>Cette semaine</Text>
        </View>
        {isPending ? (
          <Text style={[f(700), s.valueBig]}>—</Text>
        ) : (
          <DurationValue min={savedMinutesWeek} />
        )}
      </View>

      <View style={[s.row, s.rowSep]}>
        <View style={s.icon}>
          <IconSvg name={IconName.CHECK} size={17} color={C.onIcon} />
        </View>
        <View style={s.rowText}>
          <Text style={[f(700), s.rowTitle]}>Distractions évitées</Text>
          <Text style={[f(400), s.rowSub]}>Aujourd'hui</Text>
        </View>
        <Text style={[f(700), s.valueBig]}>
          {isPending ? '—' : interceptions}
        </Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  title: {
    fontSize: 18,
    color: C.ink,
    letterSpacing: -0.3,
    paddingTop: 16,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
  },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15.5, color: C.ink },
  rowSub: { fontSize: 12.5, color: C.ink55, marginTop: 2 },
  valueBig: {
    fontSize: 22,
    color: C.ink,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  valueSmall: {
    fontSize: 13,
    color: C.ink55,
    fontVariant: ['tabular-nums'],
  },
})
