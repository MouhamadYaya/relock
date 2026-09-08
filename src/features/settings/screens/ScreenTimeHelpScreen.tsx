import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SettingsHeader } from '@/features/settings/components/SettingsHeader'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { requireScreenTime } from '@/shared/native/screen-time-gate'
import { settingsTheme } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'
import { showToast } from '@/shared/utils/toast'

const { colors, radius, size, spacing, type } = settingsTheme

/**
 * Le seul écran de l'app qui s'adresse à quelqu'un dont l'autorisation Temps
 * d'écran est REFUSÉE — et la sortie du cul-de-sac.
 *
 * CE QU'IL REMPLACE
 * Trois messages qui promettaient tous la même chose et tenaient tous la même
 * promesse : rien. « Ouvre Réglages > Temps d'écran et autorise Relock » sur
 * l'Accueil, un toast d'erreur brut dans les Réglages, une alerte « Active
 * l'accès Temps d'écran » à chaque création de règle. Les trois appelaient
 * `requestAuthorization()` — qui, une fois le statut passé à `.denied`, ne
 * présente plus jamais de fenêtre — puis renvoyaient vers `openSettings()`,
 * c'est-à-dire la fiche Réglages de Relock, où l'interrupteur annoncé n'existe
 * pas. On demandait à quelqu'un d'aller chercher une chose absente, en boucle,
 * sans jamais lui dire ce qui s'était réellement passé.
 *
 * CE QU'IL DIT À LA PLACE
 * La vérité, dans l'ordre où elle est utile : ce qui ne marche plus, le seul
 * endroit d'iOS où l'autorisation peut encore être rendue, et — quand elle n'y
 * est pas — le seul geste qui la remet vraiment à zéro, la réinstallation.
 * Cette dernière phrase coûte cher à écrire, et c'est précisément pour ça
 * qu'elle doit être écrite : la taire ne la rend pas fausse, elle laisse juste
 * la personne la découvrir seule, ou désinstaller pour de bon.
 *
 * La note sur le compte n'est pas de la consolation : sans elle, « supprime
 * l'app » se lit « perds ta série, tes règles et ton abonnement », et personne
 * ne le fait.
 *
 * IL SE RÉPARE TOUT SEUL
 * « Vérifier à nouveau » passe par `requireScreenTime` : si l'autorisation a
 * été rendue depuis les Réglages, l'écran se referme et l'app repart ; si
 * elle n'a en fait jamais été demandée (`notDetermined`), la fenêtre système
 * s'ouvre ici même.
 */
export default function ScreenTimeHelpScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [checking, setChecking] = useState(false)
  const [pressedPrimary, setPressedPrimary] = useState(false)
  const [pressedSecondary, setPressedSecondary] = useState(false)

  const steps = [
    {
      title: t('settings.screen_time_help_step1_title'),
      body: t('settings.screen_time_help_step1_body'),
    },
    {
      title: t('settings.screen_time_help_step2_title'),
      body: t('settings.screen_time_help_step2_body'),
    },
  ]

  const recheck = useCallback(async () => {
    if (checking) return
    setChecking(true)
    try {
      if ((await requireScreenTime()) === 'approved') {
        haptics.impactLight()
        showToast(t('settings.screen_time_help_granted'))
        router.back()
      } else {
        showToast(t('settings.screen_time_help_still_denied'))
      }
    } finally {
      setChecking(false)
    }
  }, [checking, t])

  return (
    <ScreenWrapper
      disableBottomInset
      backgroundColor={colors.bg}
      statusBarProps={{ backgroundColor: colors.bg }}
    >
      <SettingsHeader
        title={t('settings.screen_time')}
        backLabel={t('settings.back')}
        onBack={() => router.back()}
      />

      <View
        style={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.rowV },
        ]}
      >
        <View style={styles.mark}>
          <IconSvg
            name={IconName.MONITOR}
            size={26}
            strokeWidth={size.iconStroke}
            color={colors.danger}
          />
        </View>

        <Text style={styles.title}>{t('settings.screen_time_help_title')}</Text>
        <Text style={styles.intro}>{t('settings.screen_time_help_intro')}</Text>

        <View style={styles.card}>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.badge}>
                {/* Un chiffre, pas un libellé : rien à traduire ici. */}
                <Text style={styles.badgeLabel}>{index + 1}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.note}>
          <IconSvg
            name={IconName.INFO}
            size={size.icon}
            strokeWidth={size.iconStroke}
            color={colors.success}
          />
          <Text style={styles.noteLabel}>
            {t('settings.screen_time_help_note')}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.permission_open_settings')}
            accessibilityHint={t('settings.screen_time_help_step1_body')}
            onPress={() => Linking.openSettings().catch(() => {})}
            onPressIn={() => {
              setPressedPrimary(true)
              haptics.impactLight()
            }}
            onPressOut={() => setPressedPrimary(false)}
            style={pressedPrimary ? styles.primaryPressed : styles.primary}
          >
            <Text style={styles.primaryLabel}>
              {t('home.permission_open_settings')}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings.screen_time_help_recheck')}
            accessibilityState={{ busy: checking }}
            disabled={checking}
            onPress={() => {
              recheck().catch(() => {})
            }}
            onPressIn={() => {
              setPressedSecondary(true)
              if (!checking) haptics.selectionTick()
            }}
            onPressOut={() => setPressedSecondary(false)}
            style={
              pressedSecondary ? styles.secondaryPressed : styles.secondary
            }
          >
            {checking ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.secondaryLabel}>
                {t('settings.screen_time_help_recheck')}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScreenWrapper>
  )
}

/**
 * ⚠️ Aucun `style` en FONCTION ni en TABLEAU sur les `Pressable` : le style
 * était perdu à l'exécution et la vue retombait sur `flexDirection: 'column'`.
 * Voir la note détaillée dans `SettingsRow`.
 */
const BUTTON = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  minHeight: 54,
  borderRadius: radius.pill,
}
const PRIMARY = { ...BUTTON, backgroundColor: colors.card }
const SECONDARY = {
  ...BUTTON,
  marginTop: 10,
  borderWidth: size.hairline,
  borderColor: colors.cardBorder,
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.rowV,
  },

  mark: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: 18,
  },
  intro: {
    color: colors.textSecondary,
    fontSize: type.rowTitle.size,
    fontWeight: '400',
    lineHeight: 23,
    marginTop: 8,
  },

  card: {
    marginTop: spacing.rowV + 4,
    padding: spacing.rowH,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
  },
  step: { flexDirection: 'row', paddingVertical: 8 },
  badge: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
    marginRight: 12,
  },
  badgeLabel: {
    color: colors.textSecondary,
    fontSize: type.rowSubtitle.size,
    fontWeight: '600',
  },
  stepText: { flex: 1 },
  stepTitle: {
    color: colors.textPrimary,
    fontSize: type.rowValue.size,
    fontWeight: '600',
  },
  stepBody: {
    color: colors.textSecondary,
    fontSize: type.rowSubtitle.size,
    fontWeight: '400',
    lineHeight: type.rowSubtitle.lineHeight,
    marginTop: 4,
  },

  note: {
    flexDirection: 'row',
    marginTop: spacing.rowV,
    padding: 14,
    borderRadius: radius.card - 6,
    borderWidth: size.hairline,
    borderColor: colors.success,
    backgroundColor: colors.card,
  },
  noteLabel: {
    flex: 1,
    marginLeft: 12,
    color: colors.success,
    fontSize: type.rowSubtitle.size,
    fontWeight: '400',
    lineHeight: type.rowSubtitle.lineHeight,
  },

  actions: { marginTop: 'auto', paddingTop: spacing.rowV },
  primary: PRIMARY,
  primaryPressed: { ...PRIMARY, opacity: 0.7 },
  primaryLabel: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: '600',
  },
  secondary: SECONDARY,
  secondaryPressed: { ...SECONDARY, opacity: 0.7 },
  secondaryLabel: {
    color: colors.textSecondary,
    fontSize: type.rowTitle.size,
    fontWeight: '600',
  },
})
