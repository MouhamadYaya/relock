import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import { View } from 'react-native'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import { LOGO_LABEL_KEY } from '@/features/settings/constants/logo-copy'
import { useT } from '@/i18n/useT'
import { AppIconPreview } from '@/shared/components/ui/AppIconPreview'
import { APP_LOGOS, type AppLogo } from '@/shared/constants/app-logo'
import { AppIcon } from '@/shared/native/app-icon'
import { usePreferences } from '@/shared/stores/preferences.store'
import { showErrorToast } from '@/shared/utils/toast'

/** Côté de la vignette. Assez grand pour distinguer deux marques proches. */
const PREVIEW_SIZE = 34

/**
 * Le choix de l'icône de l'app, depuis Réglages › Personnalisation.
 *
 * Ce que cet écran change est SUR L'ÉCRAN D'ACCUEIL DE L'IPHONE, pas dans
 * l'app : le logotype « Relock » ne bouge pas, ni en haut de l'Accueil ni en
 * bas du splash. C'est pour ça que chaque ligne montre l'icône elle-même —
 * le résultat ne se verra qu'une fois l'app quittée, et un intitulé seul
 * (« Orbe », « Phases ») obligerait à sortir pour découvrir son erreur.
 *
 * La pose est ASYNCHRONE et peut échouer (nom absent du binaire, système qui
 * refuse). Tant qu'iOS n'a pas confirmé, on ne touche ni à la préférence
 * locale ni à la coche : un écran qui affiche un choix que le système n'a pas
 * pris est pire que pas de choix du tout.
 */
export default function LogoPickerModal() {
  const t = useT()
  const current = usePreferences(state => state.appLogo)
  const setAppLogo = usePreferences(state => state.setAppLogo)
  const [busy, setBusy] = useState<AppLogo | null>(null)

  const close = useCallback(() => router.back(), [])

  const select = useCallback(
    async (logo: AppLogo) => {
      if (busy) return
      if (logo === current) {
        router.back()
        return
      }

      setBusy(logo)
      const ok = await AppIcon.set(logo)
      setBusy(null)

      if (!ok) {
        showErrorToast(t('settings.logo.error'))
        return
      }

      // Le reflet local n'est écrit qu'APRÈS l'accord du système : c'est lui
      // qui fait autorité, et il survit à une réinstallation du binaire.
      setAppLogo(logo)
      router.back()
    },
    [busy, current, setAppLogo, t],
  )

  return (
    <SettingsSheet
      title={t('settings.logo.label')}
      closeLabel={t('common.close')}
      onClose={close}
    >
      <View>
        <SettingsSection caption={t('settings.logo.footnote')}>
          {APP_LOGOS.map(logo => (
            <SettingsRow
              key={logo}
              label={t(LOGO_LABEL_KEY[logo])}
              selected={logo === current}
              busy={busy === logo}
              disabled={busy !== null && busy !== logo}
              onPress={() => {
                void select(logo)
              }}
              accessory={
                // Décoratif : la ligne porte déjà le nom de l'icône et son
                // état de sélection. Laisser l'image accessible ferait
                // annoncer une seconde fois la même chose à VoiceOver.
                <View
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <AppIconPreview logo={logo} size={PREVIEW_SIZE} />
                </View>
              }
            />
          ))}
        </SettingsSection>
      </View>
    </SettingsSheet>
  )
}
