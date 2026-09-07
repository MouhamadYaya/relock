import { IconName } from '@assets/icons'
import React from 'react'
import { Alert } from 'react-native'
import { AuthService } from '@/features/auth/services/auth/auth.service'
import { DangerScreen } from '@/features/settings/components/DangerScreen'
import { useDeleteAccount } from '@/features/user/hooks/useProfile'
import { REAUTH_REQUIRED } from '@/features/user/services/profile/profile.service'
import { useT } from '@/i18n/useT'
import { signOutToAuth } from '@/session/bootstrap'
import { captureError } from '@/shared/services/monitoring/sentry'
import { haptics } from '@/shared/utils/platform/haptics'
import { showErrorToast, showToast } from '@/shared/utils/toast'

/**
 * Suppression définitive du compte.
 *
 * L'écran énumère ce qui disparaît et dit ce qui NE disparaît PAS —
 * l'abonnement, que seul Apple peut résilier. Sans cette dernière ligne, on
 * supprime son compte en croyant arrêter les prélèvements.
 *
 * Le serveur peut exiger une authentification récente (une session vieille de
 * plusieurs jours ne suffit pas à effacer un compte). On renvoie alors vers la
 * connexion en le disant, plutôt que d'afficher un échec que rien ne permet de
 * comprendre ni de corriger.
 */
export default function DeleteAccountScreen() {
  const t = useT()
  const deleteAccount = useDeleteAccount()

  const confirm = () => {
    haptics.impactMedium()
    Alert.alert(t('settings.delete_title'), t('settings.delete_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.delete_cta'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteAccount.mutateAsync()
              // Le compte n'existe plus côté serveur : la session locale, elle,
              // survivrait jusqu'à l'expiration du jeton. On la ferme nous-mêmes
              // avant de rouvrir la porte « compte ».
              await AuthService.logout().catch(() => undefined)
              showToast(t('settings.delete_done'))
              signOutToAuth()
            } catch (e) {
              if ((e as { code?: string | null })?.code === REAUTH_REQUIRED) {
                showErrorToast(t('settings.delete_reauth'))
                await AuthService.logout().catch(() => undefined)
                signOutToAuth()
                return
              }
              captureError(e, {
                tags: { feature: 'settings', op: 'delete-account' },
              })
              showErrorToast(t('settings.delete_error'))
            }
          })()
        },
      },
    ])
  }

  return (
    <DangerScreen
      headerTitle={t('settings.delete_account')}
      backLabel={t('settings.back')}
      icon={IconName.TRASH}
      title={t('settings.delete_title')}
      intro={t('settings.delete_intro')}
      items={[
        t('settings.delete_item_profile'),
        t('settings.delete_item_rules'),
        t('settings.delete_item_history'),
      ]}
      note={{
        label: t('settings.delete_keep_subscription'),
        icon: IconName.INFO,
        tone: 'warning',
      }}
      ctaLabel={t('settings.delete_cta')}
      cancelLabel={t('common.cancel')}
      busy={deleteAccount.isPending}
      onConfirm={confirm}
    />
  )
}
