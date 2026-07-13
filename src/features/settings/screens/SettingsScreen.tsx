import { IconName } from '@assets/icons'
import React from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useProfile, useUpdateName } from '@/features/user/hooks/useProfile'
import { appConfig } from '@/config/app-config'
import { goBack, navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'

function initialsFrom(s: string | null): string {
  if (!s) return '?'
  const parts = s.trim().split(/\s+/).filter(Boolean)
  const letters = parts.slice(0, 2).map(w => w[0]).join('')
  return (letters || '?').toUpperCase()
}

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
  green: '#4ADE80',
  border: 'rgba(148,152,178,0.16)',
  divider: 'rgba(148,152,178,0.12)',
  ambient: 'rgba(164,154,254,0.14)',
}

type RowProps = {
  icon: IconName
  label: string
  value?: string
  onPress?: () => void
  right?: React.ReactNode
  last?: boolean
}

function Row({ icon, label, value, onPress, right, last }: RowProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={styles.row}
      >
        <View style={styles.rowIcon}>
          <IconSvg name={icon} size={16} color={C.accent} />
        </View>
        <Text style={[f(500), { flex: 1, fontSize: 15, color: C.ink }]}>
          {label}
        </Text>
        {value ? (
          <Text style={[f(400), { fontSize: 14, color: C.ink2 }]}>{value}</Text>
        ) : null}
        {right}
        <IconSvg name={IconName.FORWARD} size={18} color={C.ink3} />
      </Pressable>
      {last ? null : <View style={styles.rowDivider} />}
    </View>
  )
}

export default function SettingsScreen() {
  const { name, displayName, email } = useProfile()
  const updateName = useUpdateName()

  const onEditName = () => {
    Alert.prompt(
      'Ton prénom',
      "Comment veux-tu qu'on t'appelle ?",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Enregistrer',
          onPress: (text?: string) => {
            if (text != null) {
              updateName.mutate(text, { onError: e => showErrorToast(e) })
            }
          },
        },
      ],
      'plain-text',
      name ?? '',
    )
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: 8 }}>
          {/* Header : retour + titre */}
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour à l'accueil"
              onPress={() => goBack()}
              hitSlop={8}
              style={styles.backBtn}
            >
              <IconSvg name={IconName.BACK} size={18} color={C.ink} />
            </Pressable>
            <Text style={[f(800), styles.title]}>Réglages</Text>
          </View>

          {/* Profil */}
          <Pressable style={styles.profile} onPress={onEditName}>
            <View style={styles.avatar}>
              <Text style={[f(700), { fontSize: 20, color: C.bg }]}>
                {initialsFrom(displayName)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[f(700), { fontSize: 17, color: C.ink }]}>
                {displayName ?? 'Ajoute ton prénom'}
              </Text>
              <Text
                style={[
                  f(400),
                  { fontSize: 13.5, color: C.ink2, marginTop: 2 },
                ]}
              >
                {email ?? ''}
              </Text>
            </View>
            <IconSvg name={IconName.FORWARD} size={20} color={C.ink3} />
          </Pressable>

          {/* Préférences */}
          <Text style={[f(600), styles.groupLabel]}>Préférences</Text>
          <View style={styles.card}>
            <Row
              icon={IconName.MOON}
              label="Apparence"
              value="Sombre"
              onPress={() => {}}
            />
            <Row
              icon={IconName.GLOBE}
              label="Langue"
              value="Français"
              onPress={() => {}}
            />
            <Row
              icon={IconName.BELL}
              label="Notifications & rappels"
              onPress={() => {}}
              last
            />
          </View>

          {/* Système */}
          <Text style={[f(600), styles.groupLabel]}>Système</Text>
          <View style={styles.card}>
            <Row
              icon={IconName.MONITOR}
              label="Permissions · Temps d'écran"
              right={
                <View style={styles.statusOn}>
                  <View style={styles.dot} />
                  <Text style={[f(600), { fontSize: 13, color: C.green }]}>
                    Activé
                  </Text>
                </View>
              }
            />
            <Row
              icon={IconName.SHIELD}
              label="Abonnement"
              onPress={() => {}}
              right={
                <View style={styles.badge}>
                  <Text style={[f(700), { fontSize: 12, color: C.accent }]}>
                    Premium
                  </Text>
                </View>
              }
              last
            />
          </View>

          {/* Divers */}
          <View style={[styles.card, { marginTop: 22 }]}>
            <Row icon={IconName.INFO} label="À propos" onPress={() => {}} />
            <Row
              icon={IconName.LOCK}
              label="Confidentialité"
              onPress={() => {}}
            />
            <Row
              icon={IconName.CLOCK}
              label="Aperçu du rituel de pause"
              onPress={() => navigate(ROUTES.PAUSE_RITUAL)}
              last
            />
          </View>

          <Text style={[f(400), styles.footer]}>
            Relock · version {appConfig.version}
          </Text>

          <View style={{ height: 32 }} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    color: C.ink,
    letterSpacing: -0.7,
  },
  profile: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLabel: {
    fontSize: 12.5,
    color: C.ink3,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingTop: 22,
    paddingLeft: 24,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDivider: {
    height: 1,
    backgroundColor: C.divider,
    marginLeft: 58,
  },
  statusOn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green },
  badge: {
    backgroundColor: C.ambient,
    borderRadius: 99,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: C.ink3,
    paddingTop: 22,
  },
})
