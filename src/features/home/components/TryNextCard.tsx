/**
 * « Essayez ceci ensuite » — une suggestion à la fois, tirée au sort, qui change
 * toutes les 10 s.
 *
 * Une seule à la fois, parce qu'une liste de choix redemande de choisir : c'est
 * précisément ce qui bloque. Une proposition concrète se juge en une seconde —
 * oui, ou j'attends la suivante. La carte reste en permanence : il y a toujours
 * un moment de plus à protéger.
 *
 * On ne suggère jamais un blocage déjà en place — une suggestion qu'on a déjà
 * suivie ne suggère plus rien, elle fait de la publicité.
 */
import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { availablePresets, presetDetail } from '@/features/blocking/presets'
import type { BlockRuleView } from '@/features/blocking/types'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { fonts } from '@/shared/theme/tokens/fonts'

const ROTATE_MS = 10_000

const C = {
  card: '#1C1C1E',
  ink: '#F5F5F7',
  ink55: 'rgba(235,235,245,0.55)',
  ink35: 'rgba(235,235,245,0.35)',
  accent: '#B4B0F8',
  accentTint: 'rgba(165,161,245,0.13)',
}

const FW = { 400: fonts.regular, 500: fonts.medium, 700: fonts.bold } as const
const f = (w: keyof typeof FW) => FW[w]

export function TryNextCard({ rules }: { rules: BlockRuleView[] }) {
  const pool = useMemo(() => availablePresets(rules), [rules])
  const [step, setStep] = useState(() => Math.floor(Math.random() * 100))

  useEffect(() => {
    if (pool.length < 2) return
    const id = setInterval(() => {
      // Avancer d'un pas aléatoire NON NUL : on ne retombe jamais sur la
      // suggestion qu'on vient d'afficher, et l'ordre reste imprévisible.
      setStep(n => n + 1 + Math.floor(Math.random() * (pool.length - 1)))
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [pool.length])

  // Tout est déjà en place : il n'y a plus rien d'honnête à suggérer.
  if (pool.length === 0) return null
  const preset = pool[step % pool.length]

  return (
    // Le titre vit HORS de la carte, comme les autres sections de l'Accueil :
    // il annonce le bloc, il n'en fait pas partie.
    <View style={s.wrap}>
      <Text style={[f(700), s.title]}>Essayez ceci ensuite</Text>

      <Animated.View
        key={preset.id}
        entering={FadeIn.duration(340)}
        exiting={FadeOut.duration(160)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${preset.title} — ${presetDetail(preset)}`}
          onPress={() => navigate(ROUTES.PRESET_RECAP, { presetId: preset.id })}
          style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        >
          <View style={s.rowText}>
            <Text style={[f(500), s.rowTitle]}>{preset.title}</Text>
            <Text style={[f(400), s.rowDetail]}>{presetDetail(preset)}</Text>
            <Text style={[f(400), s.rowPitch]}>{preset.pitch}</Text>
          </View>
          <Text style={[f(400), s.chevron]}>›</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { marginTop: 26 },
  title: { fontSize: 18, color: C.ink, letterSpacing: -0.3, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 12,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 16, color: C.ink },
  rowDetail: { fontSize: 13, color: C.accent },
  rowPitch: { fontSize: 12.5, color: C.ink55, lineHeight: 17, marginTop: 3 },
  chevron: { fontSize: 24, color: C.ink35, marginTop: -2 },
})
