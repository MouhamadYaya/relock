import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import { LOGO_LABEL_KEY } from '@/features/settings/constants/logo-copy'
import { useT } from '@/i18n/useT'
import { AppIconPreview } from '@/shared/components/ui/AppIconPreview'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { APP_LOGOS, type AppLogo } from '@/shared/constants/app-logo'
import { AppIcon } from '@/shared/native/app-icon'
import { usePreferences } from '@/shared/stores/preferences.store'
import { settingsTheme } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'
import { showErrorToast } from '@/shared/utils/toast'

const { colors, radius, size, spacing } = settingsTheme

/**
 * Côté MAXIMAL du cadre d'une icône. Assez grand pour qu'on RECONNAISSE le
 * dessin — c'est tout le point de cet écran : on choisit ce qu'on va voir sur
 * son écran d'accueil, et il n'y a rien d'autre à savoir.
 */
const FRAME_MAX = 92

/** Épaisseur de l'anneau de sélection, et donc du cadre transparent. */
const RING = 3

/** Écart entre l'icône et son anneau. */
const RING_GAP = 4

/** Écart minimal entre deux cadres, sur l'écran le plus étroit. */
const MIN_GAP = 16

/** Rapport d'arrondi d'une icône iOS, repris pour le cadre. */
const RADIUS_RATIO = 0.2237

/**
 * La taille des trois cadres, calculée pour la largeur réelle de l'écran.
 *
 * Trois cadres de 92 pt plus leurs écarts ne tiennent pas sur un iPhone SE :
 * en `flexWrap: 'nowrap'`, ils ne passeraient pas à la ligne, ils
 * déborderaient hors de la feuille. La taille cède donc avant la mise en
 * page — c'est le seul des deux qui puisse céder sans casser l'écran.
 */
function frameSize(screenWidth: number): number {
  const inner =
    screenWidth - 2 * spacing.screenH - 2 * spacing.rowH - 2 * MIN_GAP
  return Math.max(56, Math.min(FRAME_MAX, Math.floor(inner / 3)))
}

/**
 * Le choix de l'icône de l'app, depuis Réglages › Personnalisation.
 *
 * Trois icônes, à leur taille, et rien d'autre. Ce que cet écran change se
 * voit SUR L'ÉCRAN D'ACCUEIL DE L'IPHONE, pas dans l'app : la seule question
 * posée ici est « laquelle veux-tu voir ? », et une image y répond mieux que
 * son nom. La version précédente était une liste de lignes — un intitulé
 * (« Orbe », « Phases ») avec une vignette de 34 pt en bout de ligne : on
 * lisait trois mots qui ne veulent rien dire hors contexte, et le dessin,
 * lui, était trop petit pour départager deux marques proches.
 *
 * Les noms n'ont pas disparu pour autant : ils portent chaque tuile pour
 * VoiceOver, où l'image ne dit rien.
 *
 * La pose est ASYNCHRONE et peut échouer (nom absent du binaire, système qui
 * refuse). Tant qu'iOS n'a pas confirmé, on ne touche ni à la préférence
 * locale ni à l'anneau : un écran qui affiche un choix que le système n'a pas
 * pris est pire que pas de choix du tout.
 */
export default function LogoPickerModal() {
  const t = useT()
  const current = usePreferences(state => state.appLogo)
  const setAppLogo = usePreferences(state => state.setAppLogo)
  const [busy, setBusy] = useState<AppLogo | null>(null)
  const frame = frameSize(useWindowDimensions().width)
  const tile = frame - 2 * (RING + RING_GAP)

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
      <View style={styles.grid}>
        {APP_LOGOS.map(logo => {
          const selected = logo === current
          const pending = busy === logo
          const locked = busy !== null && !pending

          return (
            <Pressable
              key={logo}
              // `imagebutton` plutôt que `button` : sans libellé visible,
              // c'est le seul rôle qui annonce à VoiceOver qu'on choisit une
              // image et non une action.
              accessibilityRole="imagebutton"
              accessibilityLabel={t(LOGO_LABEL_KEY[logo])}
              accessibilityState={{
                selected,
                busy: pending,
                disabled: locked,
              }}
              disabled={locked}
              onPress={() => {
                void select(logo)
              }}
              onPressIn={() => {
                if (!locked) haptics.selectionTick()
              }}
              style={({ pressed }) => [
                styles.tile,
                locked && styles.tileLocked,
                pressed && styles.tilePressed,
              ]}
            >
              <View
                style={[
                  styles.frame,
                  {
                    width: frame,
                    height: frame,
                    borderRadius: Math.round(frame * RADIUS_RATIO),
                  },
                  selected && styles.frameSelected,
                ]}
              >
                <View
                  style={{
                    width: tile,
                    height: tile,
                    borderRadius: Math.round(tile * RADIUS_RATIO),
                    overflow: 'hidden',
                  }}
                >
                  <AppIconPreview logo={logo} size={tile} />
                  {pending ? (
                    <View style={styles.veil}>
                      <ActivityIndicator color={colors.textPrimary} />
                    </View>
                  ) : null}
                </View>
              </View>

              {/*
                La coche double l'anneau plutôt que de le remplacer : un
                anneau violet seul se confond avec un reflet de l'icône, et
                trois dessins colorés côte à côte ne laissent aucune couleur
                dire à eux seuls « c'est celle-ci ».
              */}
              {selected && !pending ? (
                <View style={styles.check}>
                  <IconSvg
                    name={IconName.CHECK}
                    size={14}
                    strokeWidth={2.4}
                    color={colors.bg}
                  />
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </SettingsSheet>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.rowH,
    paddingVertical: spacing.rowV,
  },
  tile: { alignItems: 'center', justifyContent: 'center' },
  tilePressed: { opacity: 0.7 },
  tileLocked: { opacity: 0.4 },
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: RING,
    // Le cadre existe TOUJOURS, transparent quand l'icône n'est pas la
    // sienne : sans lui, sélectionner déplacerait les trois tuiles de trois
    // points au moment de l'appui.
    borderColor: colors.transparent,
  },
  frameSelected: { borderColor: colors.accent },
  veil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  check: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: size.check,
    height: size.check,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: size.hairline,
    borderColor: colors.bg,
  },
})
