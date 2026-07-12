import { IconName } from '@assets/icons'
import React, { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { goBack } from '@/navigation/helpers/navigation-helpers'
import { type AppId, AppLogo } from '@/shared/components/ui/AppLogo'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast, showToast } from '@/shared/utils/toast'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => ({ fontFamily: FW[w] })

const C = {
  bg: '#0B0C10',
  surface: '#161821',
  surface2: '#1C1F2B',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  border: 'rgba(148,152,178,0.16)',
  ambient08: 'rgba(164,154,254,0.08)',
  ambient16: 'rgba(164,154,254,0.16)',
  radioBorder: 'rgba(148,152,178,0.4)',
}

const TYPES = [
  {
    key: 'progressive_delay',
    icon: IconName.CLOCK,
    title: 'Délai progressif',
    desc: 'Un temps d’attente qui grandit à chaque ouverture',
  },
  {
    key: 'schedule',
    icon: IconName.CALENDAR,
    title: 'Plages horaires',
    desc: 'Bloque à certaines heures (ex : 22h – 8h)',
  },
  {
    key: 'daily_limit',
    icon: IconName.CHART,
    title: 'Limite d’ouvertures / jour',
    desc: 'Un nombre max d’ouvertures par jour',
  },
] as const

const APPS: { id: AppId; name: string }[] = [
  { id: 'tiktok', name: 'TikTok' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'snapchat', name: 'Snapchat' },
  { id: 'reddit', name: 'Reddit' },
  { id: 'x', name: 'X' },
]

export default function AddScreen() {
  const [type, setType] = useState<string>('progressive_delay')
  const [apps, setApps] = useState<Set<string>>(
    () => new Set(['tiktok', 'instagram']),
  )
  const createRule = useCreateRuleMutation()

  const toggleApp = (id: string) =>
    setApps(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const onSubmit = () => {
    if (apps.size === 0 || createRule.isPending) return
    createRule.mutate(
      { type: type as BlockRuleType, appIds: [...apps] as AppId[] },
      {
        onSuccess: () => {
          showToast('Blocage activé')
          goBack()
        },
        onError: e => showErrorToast(e),
      },
    )
  }

  const submitting = createRule.isPending
  const disabled = apps.size === 0 || submitting

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              onPress={() => goBack()}
              hitSlop={8}
              style={styles.backBtn}
            >
              <IconSvg name={IconName.BACK} size={18} color={C.ink} />
            </Pressable>
            <Text style={[f(700), { fontSize: 17, color: C.ink }]}>
              Nouveau blocage
            </Text>
            <View style={{ width: 36 }} />
          </View>

          {/* Type de blocage */}
          <Text style={[f(600), styles.sectionLabel]}>Type de blocage</Text>
          <View style={{ gap: 10 }}>
            {TYPES.map(tp => {
              const sel = type === tp.key
              return (
                <Pressable
                  key={tp.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                  onPress={() => setType(tp.key)}
                  style={[
                    styles.typeCard,
                    sel
                      ? {
                          backgroundColor: C.ambient08,
                          borderColor: C.accent,
                          borderWidth: 1.5,
                        }
                      : {
                          backgroundColor: C.surface,
                          borderColor: C.border,
                          borderWidth: 1,
                        },
                  ]}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: sel ? C.ambient16 : C.surface2 },
                    ]}
                  >
                    <IconSvg
                      name={tp.icon}
                      size={21}
                      color={sel ? C.accent : C.ink2}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                      {tp.title}
                    </Text>
                    <Text
                      style={[
                        f(400),
                        {
                          fontSize: 12.5,
                          color: C.ink2,
                          marginTop: 2,
                          lineHeight: 17,
                        },
                      ]}
                    >
                      {tp.desc}
                    </Text>
                  </View>
                  {sel ? (
                    <View style={styles.radioOn}>
                      <IconSvg name={IconName.CHECK} size={14} color={C.bg} />
                    </View>
                  ) : (
                    <View style={styles.radioOff} />
                  )}
                </Pressable>
              )
            })}
          </View>

          {/* Applications */}
          <View
            style={[styles.rowBetween, { marginTop: 22, marginBottom: 14 }]}
          >
            <Text style={[f(600), { fontSize: 13, color: C.ink2 }]}>
              Applications
            </Text>
            <Text style={[f(600), { fontSize: 13, color: C.accent }]}>
              Toutes les apps
            </Text>
          </View>
          <View style={styles.grid}>
            {APPS.map(app => {
              const sel = apps.has(app.id)
              return (
                <Pressable
                  key={app.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={app.name}
                  onPress={() => toggleApp(app.id)}
                  style={[
                    styles.tile,
                    sel
                      ? {
                          backgroundColor: C.ambient08,
                          borderColor: C.accent,
                          borderWidth: 1.5,
                        }
                      : {
                          backgroundColor: C.surface,
                          borderColor: C.border,
                          borderWidth: 1,
                        },
                  ]}
                >
                  {sel ? (
                    <View style={styles.tileCheckOn}>
                      <IconSvg name={IconName.CHECK} size={11} color={C.bg} />
                    </View>
                  ) : (
                    <View style={styles.tileCheckOff} />
                  )}
                  <AppLogo app={app.id} size={38} />
                  <Text style={[f(600), { fontSize: 12, color: C.ink }]}>
                    {app.name}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {/* CTA */}
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onSubmit}
            style={[
              styles.cta,
              { backgroundColor: disabled ? C.surface2 : C.accent },
            ]}
          >
            <Text
              style={[f(700), { fontSize: 16, color: disabled ? C.ink3 : C.bg }]}
            >
              {submitting ? 'Activation…' : 'Activer le blocage'}
            </Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    color: C.ink2,
    marginTop: 22,
    marginBottom: 12,
  },
  typeCard: {
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOff: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.radioBorder,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  tile: {
    width: '31.5%',
    flexGrow: 1,
    borderRadius: 16,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  tileCheckOn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tileCheckOff: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.radioBorder,
    zIndex: 1,
  },
  cta: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
})
