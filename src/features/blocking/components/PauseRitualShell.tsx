import { IconName } from '@assets/icons'
import React from 'react'
import {
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  BlockedAppIcons,
  isBlockedAppIconsAvailable,
} from '@/shared/native/BlockedAppIcons'
import type { PauseRitual } from '@/shared/services/storage/app-preferences'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { PauseRitualChoiceSheet } from './PauseRitualChoiceSheet'
import { SwapGlyph } from './PauseRitualGlyphs'

const { colors, radius, typography } = relockMaterial

/**
 * Le décor commun aux trois rituels de pause.
 *
 * Les trois écrans ne se ressemblent pas par hasard : ils occupent le même
 * instant, celui où l'on vient de buter sur un blocage. Fond, marges, place
 * de la croix, place de la pastille d'app et place du bouton principal sont
 * donc décidés ICI, une fois. Ce qui change d'un rituel à l'autre — l'orbe,
 * le calcul, la phrase — passe par `children` ; ce qui reste — la sortie, le
 * contexte, le changement de rituel — n'est jamais réécrit.
 *
 * La coque ne connaît RIEN de la logique d'un rituel : ni décompte, ni
 * validation, ni réponse juste. Elle ne sait qu'afficher et laisser sortir.
 */
export function PauseRitualShell({
  visible,
  ritual,
  tokenKey,
  allApps = false,
  avoidKeyboard = false,
  onClose,
  pickedRitual,
  onPickRitual,
  children,
  actions,
}: {
  visible: boolean
  /** Le rituel AFFICHÉ, celui qu'on est en train de faire. */
  ritual: PauseRitual
  tokenKey?: string
  allApps?: boolean
  /** Le rituel saisit du texte : le contenu remonte au-dessus du clavier. */
  avoidKeyboard?: boolean
  onClose: () => void
  /**
   * Le rituel ENREGISTRÉ, qui s'appliquera à la pause suivante. Il diffère de
   * `ritual` juste après un changement, et c'est exactement ce que la feuille
   * doit montrer.
   */
  pickedRitual?: PauseRitual
  /** Enregistre un nouveau choix. Omis, l'indicateur n'est pas rendu. */
  onPickRitual?: (ritual: PauseRitual) => void
  children: React.ReactNode
  actions: React.ReactNode
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [switching, setSwitching] = React.useState(false)

  // Une pause qui se referme ne doit pas rouvrir sur sa feuille de choix.
  React.useEffect(() => {
    if (!visible) setSwitching(false)
  }, [visible])

  const body = (
    <View
      style={[
        styles.content,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(insets.bottom, spacing.md),
        },
      ]}
    >
      <View style={styles.topBar}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('blocking.breathing.cancel')}
          haptic="graze"
          onPress={onClose}
          style={styles.roundAction}
        >
          <IconSvg
            name={IconName.CLOSE}
            size={spacing.lg}
            color={colors.textPrimary}
          />
        </PressableScale>

        <View pointerEvents="none" style={styles.appPill}>
          <View style={styles.appIcon}>
            {tokenKey && isBlockedAppIconsAvailable ? (
              <BlockedAppIcons
                tokenKey={tokenKey}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <IconSvg
                name={IconName.LOCK}
                size={spacing.lg}
                color={colors.textPrimary}
              />
            )}
          </View>
          <Text numberOfLines={1} style={styles.appPillLabel}>
            {allApps
              ? t('blocking.breathing.all_apps')
              : t('blocking.breathing.one_app')}
          </Text>
        </View>
      </View>

      {/*
        Le bouton de changement d'écran.

        Il porte un ORDRE — « Changer d'écran » — et non le nom du rituel en
        cours. Un nom seul (« Respiration ») se lit comme une étiquette : on
        ne devine pas qu'il est tapable, ni ce qui se passe si on le tape. Le
        verbe dit les deux d'un coup.

        Il reste discret par construction — capsule translucide, texte petit,
        à l'opposé du bouton principal : on le trouve si on le cherche, on ne
        tombe pas dessus en visant « Continuer ».
      */}
      {onPickRitual ? (
        <PressableScale
          testID="pause-ritual-switch"
          accessibilityRole="button"
          accessibilityLabel={t('blocking.pause_ritual.change')}
          accessibilityHint={t('blocking.pause_ritual.applies_next')}
          hitSlop={spacing.xs}
          onPress={() => setSwitching(true)}
          style={styles.ritualChip}
        >
          <SwapGlyph size={spacing.sm} color={colors.blockingInkMuted} />
          <Text numberOfLines={1} style={styles.ritualChipLabel}>
            {t('blocking.pause_ritual.change')}
          </Text>
        </PressableScale>
      ) : null}

      {children}

      <View style={styles.actions}>{actions}</View>
    </View>
  )

  return (
    <Modal
      visible={visible}
      transparent={false}
      statusBarTranslucent
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <ImageBackground
        accessibilityViewIsModal
        source={require('@assets/blocking/breathing-mountains.png')}
        resizeMode="cover"
        style={styles.root}
      >
        <View pointerEvents="none" style={styles.imageShade} />
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {body}
          </KeyboardAvoidingView>
        ) : (
          body
        )}

        {/* Un CALQUE, pas une seconde `Modal` : voir `PauseRitualChoiceSheet`. */}
        {switching && onPickRitual ? (
          <PauseRitualChoiceSheet
            current={ritual}
            picked={pickedRitual ?? ritual}
            onPick={onPickRitual}
            onClose={() => setSwitching(false)}
          />
        ) : null}
      </ImageBackground>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: {
    flex: 1,
    backgroundColor: colors.blockingCanvas,
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingImageShade,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    minHeight: spacing.xxxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roundAction: {
    width: spacing.xxxxl,
    height: spacing.xxxxl,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  appPill: {
    maxWidth: '72%',
    minHeight: spacing.xxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.sm,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingImageChrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  appIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.compact,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingSurfaceRaised,
  },
  appPillLabel: {
    ...fonts.medium,
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
  },
  ritualChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xs,
    paddingVertical: spacing.micro,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.capsule,
  },
  ritualChipLabel: {
    ...fonts.medium,
    flexShrink: 1,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
  },
  actions: {
    alignItems: 'center',
  },
})
