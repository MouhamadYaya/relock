/**
 * Récapitulatif d'un préréglage — l'utilisateur voit TOUT ce qui va être créé,
 * puis valide d'un bouton. Rien n'est créé avant ce bouton.
 *
 * La seule chose qu'on ne peut pas faire à sa place : choisir les apps. Le
 * sélecteur d'Apple rend un jeton opaque, aucune API ne permet de pré-cocher
 * quoi que ce soit — et on ne réutilise JAMAIS la sélection d'une règle
 * précédente : un préréglage dit QUAND bloquer, jamais QUOI. Le parcours est
 * donc toujours le même : récapitulatif → choix des apps → activer.
 */
import { router, useLocalSearchParams } from 'expo-router'
import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { HalfSheet } from '@/features/blocking/components/HalfSheet'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import { returnToBlocks } from '@/features/blocking/navigation/return-to-blocks'
import { findPreset, presetLines } from '@/features/blocking/presets'
import { armRule } from '@/features/blocking/services/arm'
import type { BlockRuleView } from '@/features/blocking/types'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'
import { genUUID } from '@/shared/utils/uuid'

const C = {
  group: '#111113',
  sep: '#202024',
  violet: '#A78BFA',
  onViolet: '#131318',
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

export default function PresetRecapScreen() {
  const { presetId } = useLocalSearchParams<{ presetId: string }>()
  const preset = findPreset(presetId)
  const createRule = useCreateRuleMutation()
  // ⚠️ On part TOUJOURS de zéro, jamais du dernier choix global du picker.
  // Un préréglage dit QUAND bloquer, pas QUOI : hériter de la sélection d'une
  // règle précédente activait le blocage sur des apps que l'utilisateur
  // n'avait pas choisies pour CELUI-CI (et sautait l'étape sans rien dire).
  // Le parcours est donc invariable : récapitulatif → choix des apps → activer.
  const [count, setCount] = useState<number>(0)
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState(false)

  if (!preset) return null

  const pickApps = async () => {
    try {
      const auth = await ScreenTime.requestAuthorization()
      if (auth !== 'approved') return
      const { count: picked } = await ScreenTime.presentPicker()
      setCount(picked)
    } catch (e) {
      showErrorToast(e)
    }
  }

  const activate = async () => {
    if (working || !count) return
    setWorking(true)
    // Id CLIENT : lie la mécanique native à la future ligne DB.
    const id = genUUID()
    let armed = false
    try {
      if (ScreenTime.isAvailable) {
        const auth = await ScreenTime.requestAuthorization()
        if (auth !== 'approved') return
        await ScreenTime.bindSelection(id)
        await armRule({
          id,
          type: preset.type,
          config: preset.config,
        } as BlockRuleView)
        armed = true
      }
      await createRule.mutateAsync({
        id,
        type: preset.type,
        appIds: [],
        count,
        config: preset.config,
      })
      setDone(true)
    } catch (e) {
      // La ligne DB a échoué : on désarme, sinon iOS bloquerait pour un
      // blocage que l'app ne connaît pas — invisible et impossible à retirer.
      if (armed) {
        await ScreenTime.clearRuleData(id, nativeKindOf(preset.type)).catch(
          () => {},
        )
      }
      showErrorToast(e)
    } finally {
      setWorking(false)
    }
  }

  if (done) {
    return (
      <HalfSheet onClose={returnToBlocks}>
        {close => (
          <View style={s.wrap}>
            <Text style={[f(700), s.title]}>C'est en place.</Text>
            <Text style={[f(400), s.pitch]}>
              « {preset.title} » bloque maintenant {count} app
              {(count ?? 0) > 1 ? 's' : ''}. Tu la retrouveras dans l'onglet
              Blocages — pour la suspendre ou la retirer quand tu veux.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={s.primary}
            >
              <Text style={[f(600), s.primaryTxt]}>Terminé</Text>
            </Pressable>
          </View>
        )}
      </HalfSheet>
    )
  }

  const needsApps = count === 0

  return (
    <HalfSheet onClose={() => router.back()}>
      {close => (
        <View style={s.wrap}>
          <Text style={[f(700), s.title]}>{preset.title}</Text>
          <Text style={[f(400), s.pitch]}>{preset.pitch}</Text>

          <View style={s.group}>
            {presetLines(preset).map((l, i) => (
              <View key={l.label} style={[s.row, i > 0 && s.rowSep]}>
                <Text style={[f(400), s.rowLabel]}>{l.label}</Text>
                <Text style={[f(500), s.rowValue]}>{l.value}</Text>
              </View>
            ))}
            <View style={[s.row, s.rowSep]}>
              <Text style={[f(400), s.rowLabel]}>Apps</Text>
              <Text style={[f(500), s.rowValue]}>
                {needsApps
                  ? 'À choisir'
                  : `${count} app${count > 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>

          {needsApps && (
            <Text style={[f(400), s.note]}>
              Apple ne laisse aucune app choisir les tiennes à ta place : tu les
              désignes toi-même, une fois.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={working}
            onPress={needsApps ? pickApps : activate}
            style={[s.primary, working && s.primaryOff]}
          >
            {working ? (
              <ActivityIndicator color={C.onViolet} />
            ) : (
              <Text style={[f(600), s.primaryTxt]}>
                {needsApps ? 'Choisir les apps' : 'Activer ce blocage'}
              </Text>
            )}
          </Pressable>

          <Pressable accessibilityRole="button" onPress={close} style={s.ghost}>
            <Text style={[f(500), s.ghostTxt]}>Pas maintenant</Text>
          </Pressable>
        </View>
      )}
    </HalfSheet>
  )
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
  title: { fontSize: 22, color: C.txt, letterSpacing: -0.4 },
  pitch: {
    fontSize: 14,
    color: C.txt2,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  group: { backgroundColor: C.group, borderRadius: 16, paddingHorizontal: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 16,
  },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.sep },
  rowLabel: { fontSize: 14, color: C.txt2 },
  rowValue: { fontSize: 14, color: C.txt, flexShrink: 1, textAlign: 'right' },
  note: {
    fontSize: 12,
    color: C.txt3,
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  primary: {
    marginTop: 18,
    height: 52,
    borderRadius: 15,
    backgroundColor: C.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryOff: { opacity: 0.45 },
  primaryTxt: { fontSize: 16, color: C.onViolet },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostTxt: { fontSize: 14, color: C.txt2 },
})
