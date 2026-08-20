import { IconName } from '@assets/icons'
import React from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { appConfig } from '@/config/app-config'
import { NotificationService } from '@/features/notifications/notification.service'
import {
  getNotifPrefs,
  type NotifPrefs,
  setNotifPrefs,
} from '@/features/notifications/prefs'
import { useProfile, useUpdateName } from '@/features/user/hooks/useProfile'
import { i18n } from '@/i18n'
import { goBack, navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import { useTheme } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'

const THEME_LABEL: Record<string, string> = {
  dark: 'Sombre',
  light: 'Clair',
  system: 'Système',
}

const LANGUAGE_LABEL: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
}

/** Dev : bilan de santé natif (build, journal, vie des extensions). */
function showNativeDiagnostics() {
  if (!ScreenTime.isAvailable) {
    Alert.alert('Diagnostic natif', 'Module natif indisponible (simulateur ?).')
    return
  }
  ScreenTime.getDiagnostics()
    .then(d => {
      const lines = [
        `Build natif : ${d.nativeBuiltAt}`,
        `Autorisation : ${d.authorized ? 'accordée' : 'ABSENTE'}`,
        `App Group : ${d.appGroupOK ? 'OK' : 'INACCESSIBLE'}`,
        `Journal : ${d.eventLogCount} événement(s)`,
        `Résistances (total) : ${d.totalResisted}`,
        `Fenêtres actives : ${d.activeWindows.join(', ') || 'aucune'}`,
        // La vérité d'iOS, pas la nôtre : une règle absente d'ici ne
        // bloquera jamais rien, quoi qu'en dise la DB.
        `Armées côté iOS : ${d.armedActivities?.join(', ') || 'AUCUNE'}`,
        `Moniteur réveillé : ${d.monitorLastWakeAt}`,
        `  → ${d.monitorLastWakeWhat}`,
        `Bouclier affiché : ${d.shieldShownTotal ?? 0}× (dernier : ${d.shieldLastShownAt ?? 'jamais'})`,
        `Bouclier tapé : ${d.shieldLastActionAt}`,
        `Quotas du jour : ${
          Object.entries(d.limitProgress ?? {})
            .map(([k, v]) => `${k.slice(14, 22)}…=${v}`)
            .join(', ') || 'aucun palier franchi'
        }`,
        '',
        ...d.eventLogTail.map(e => `· ${e.kind} (${e.at})`),
      ]
      Alert.alert('Diagnostic natif', lines.join('\n'))
    })
    .catch(e => showErrorToast(e))
}

function initialsFrom(s: string | null): string {
  if (!s) return '?'
  const parts = s.trim().split(/\s+/).filter(Boolean)
  const letters = parts
    .slice(0, 2)
    .map(w => w[0])
    .join('')
  return (letters || '?').toUpperCase()
}

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => FW[w]

const C = {
  bg: '#0B0C10',
  surface: '#1C1C1E',
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

function SwitchRow({
  icon,
  label,
  value,
  onValueChange,
  last,
}: {
  icon: IconName
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
  last?: boolean
}) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <IconSvg name={icon} size={16} color={C.accent} />
        </View>
        <Text style={[f(500), { flex: 1, fontSize: 15, color: C.ink }]}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ true: C.accent, false: C.surface2 }}
          ios_backgroundColor={C.surface2}
        />
      </View>
      {last ? null : <View style={styles.rowDivider} />}
    </View>
  )
}

export default function SettingsScreen() {
  const { name, displayName, email } = useProfile()
  const updateName = useUpdateName()
  const { mode } = useTheme()

  // Notifications : préférences persistées, appliquées IMMÉDIATEMENT.
  const [notif, setNotif] = React.useState<NotifPrefs>(getNotifPrefs)
  const updateNotif = (patch: Partial<NotifPrefs>) => {
    const next = { ...notif, ...patch }
    setNotif(next)
    setNotifPrefs(next)
    const turningOn = next.master && Object.values(patch).some(v => v === true)
    ;(async () => {
      if (turningOn) await NotificationService.ensurePermission()
      await NotificationService.reconcileFromLast()
    })().catch(() => {})
  }

  // Statut réel de l'autorisation Temps d'écran (jamais codé en dur).
  const [authorized, setAuthorized] = React.useState(false)
  React.useEffect(() => {
    if (!ScreenTime.isAvailable) return
    ScreenTime.authorizationStatus()
      .then(s => setAuthorized(s === 'approved'))
      .catch(() => {})
  }, [])

  const requestScreenTime = () => {
    if (!ScreenTime.isAvailable) {
      Alert.alert(
        "Temps d'écran",
        'Disponible uniquement sur iPhone (Family Controls).',
      )
      return
    }
    ScreenTime.requestAuthorization()
      .then(s => setAuthorized(s === 'approved'))
      .catch(e => showErrorToast(e))
  }

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
              value={THEME_LABEL[mode] ?? 'Sombre'}
              onPress={() => navigate(ROUTES.MODAL_THEME_PICKER)}
            />
            <Row
              icon={IconName.GLOBE}
              label="Langue"
              value={LANGUAGE_LABEL[i18n.language] ?? i18n.language}
              onPress={() => navigate(ROUTES.MODAL_LANGUAGE_PICKER)}
              last
            />
          </View>

          {/* Notifications — peu, mais utiles ; jamais de spam */}
          <Text style={[f(600), styles.groupLabel]}>Notifications</Text>
          <View style={styles.card}>
            <SwitchRow
              icon={IconName.BELL}
              label="Notifications"
              value={notif.master}
              onValueChange={v => updateNotif({ master: v })}
              last={!notif.master}
            />
            {notif.master ? (
              <>
                <SwitchRow
                  icon={IconName.CLOCK}
                  label="Rappels (série, retour)"
                  value={notif.reminders}
                  onValueChange={v => updateNotif({ reminders: v })}
                />
                <SwitchRow
                  icon={IconName.STAR}
                  label="Progression (bilan, jalons)"
                  value={notif.progression}
                  onValueChange={v => updateNotif({ progression: v })}
                  last
                />
              </>
            ) : null}
          </View>

          {/* Système */}
          <Text style={[f(600), styles.groupLabel]}>Système</Text>
          <View style={styles.card}>
            <Row
              icon={IconName.MONITOR}
              label="Permissions · Temps d'écran"
              onPress={requestScreenTime}
              right={
                <View style={styles.statusOn}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: authorized ? C.green : C.ink3 },
                    ]}
                  />
                  <Text
                    style={[
                      f(600),
                      { fontSize: 13, color: authorized ? C.green : C.ink3 },
                    ]}
                  >
                    {authorized ? 'Activé' : 'À activer'}
                  </Text>
                </View>
              }
              last={!__DEV__}
            />
            {__DEV__ ? (
              <Row
                icon={IconName.MONITOR}
                label="Diagnostic natif (dev)"
                onPress={showNativeDiagnostics}
                last
              />
            ) : null}
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
