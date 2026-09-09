import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React from 'react'
import { Alert } from 'react-native'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { resetAllData } from '@/features/blocking/services/reset.service'
import { DangerScreen } from '@/features/settings/components/DangerScreen'
import { useT } from '@/i18n/useT'
import { captureError } from '@/shared/services/monitoring/sentry'
import { haptics } from '@/shared/utils/platform/haptics'
import { showErrorToast, showToast } from '@/shared/utils/toast'

/**
 * Remise à zéro de l'application.
 *
 * Même patron que la suppression de compte, à une ligne près — et c'est celle
 * qui compte : ici le compte survit. Sans elle, « réinitialiser » et
 * « supprimer mon compte » se ressemblent trop pour qu'on ose l'un ou
 * l'autre.
 */
export default function ResetAppScreen() {
  const t = useT()
  const { rules } = useBlockRulesQuery()
  const [busy, setBusy] = React.useState(false)

  const confirm = () => {
    // Ce bouton ouvre la porte de l'irréversible : deux temps égaux, ni
    // montée ni descente. Rien n'est encore fait, et ça doit s'entendre.
    haptics.warning()
    Alert.alert(t('settings.reset_title'), t('settings.reset_intro'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.reset_cta'),
        style: 'destructive',
        onPress: () => {
          setBusy(true)
          void (async () => {
            try {
              const wiped = await resetAllData(rules)
              showToast(
                wiped ? t('settings.reset_done') : t('settings.reset_partial'),
              )
              router.back()
            } catch (e) {
              captureError(e, {
                tags: { feature: 'settings', op: 'reset-app' },
              })
              showErrorToast(e)
            } finally {
              setBusy(false)
            }
          })()
        },
      },
    ])
  }

  return (
    <DangerScreen
      headerTitle={t('settings.reset')}
      backLabel={t('settings.back')}
      icon={IconName.LAYERS}
      title={t('settings.reset_title')}
      intro={t('settings.reset_intro')}
      items={[
        t('settings.reset_item_rules'),
        t('settings.reset_item_history'),
        t('settings.reset_item_streak'),
      ]}
      note={{
        label: t('settings.reset_keeps'),
        icon: IconName.CHECK,
        tone: 'keep',
      }}
      ctaLabel={t('settings.reset_cta')}
      cancelLabel={t('common.cancel')}
      busy={busy}
      onConfirm={confirm}
    />
  )
}
