import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import React from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ProfileAvatar } from '@/features/settings/components/ProfileAvatar'
import { SettingsHeader } from '@/features/settings/components/SettingsHeader'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import {
  birthDateBounds,
  formatBirthDate,
  formatMemberSince,
  parseBirthDate,
  toIsoDate,
} from '@/features/settings/services/birth-date'
import {
  useProfile,
  useUpdateAvatar,
  useUpdateBirthDate,
  useUpdateName,
} from '@/features/user/hooks/useProfile'
import { i18n } from '@/i18n'
import { useT } from '@/i18n/useT'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { isImageKitConfigured } from '@/shared/services/imagekit'
import { captureError } from '@/shared/services/monitoring/sentry'
import { settingsTheme } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'
import { showErrorToast, showToast } from '@/shared/utils/toast'

const { colors, radius, size, spacing, type } = settingsTheme

/** Longueur au-delà de laquelle un « prénom » n'en est plus un. */
const NAME_MAX_LENGTH = 40
/** Diamètre de la photo sur sa carte — la seule zone qui ouvre la galerie. */
const AVATAR_SIZE = 96

export default function ProfileScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { name, displayName, email, avatar, birthDate, createdAt } =
    useProfile()
  const updateName = useUpdateName()
  const updateAvatar = useUpdateAvatar()
  const updateBirthDate = useUpdateBirthDate()

  const [draftName, setDraftName] = React.useState(name ?? '')
  const [draftBirth, setDraftBirth] = React.useState<string | null>(birthDate)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const [pressedPhoto, setPressedPhoto] = React.useState(false)
  const [pressedSave, setPressedSave] = React.useState(false)

  // Le serveur a le dernier mot tant que rien n'a été saisi : sans ceci, le
  // champ resterait vide le temps du premier chargement, puis figé dessus.
  const hydrated = React.useRef(false)
  React.useEffect(() => {
    if (hydrated.current) return
    if (name === null && birthDate === null) return
    hydrated.current = true
    setDraftName(name ?? '')
    setDraftBirth(birthDate)
  }, [name, birthDate])

  const trimmedName = draftName.trim()
  const nameChanged = trimmedName !== (name ?? '')
  const birthChanged = draftBirth !== birthDate
  const dirty = nameChanged || birthChanged
  const saving = updateName.isPending || updateBirthDate.isPending

  const bounds = React.useMemo(() => birthDateBounds(), [])
  const birthValue = parseBirthDate(draftBirth) ?? bounds.max
  const birthLabel = formatBirthDate(draftBirth, i18n.language)
  const memberSince = formatMemberSince(createdAt, i18n.language)

  /**
   * Choix d'une photo de profil, puis upload ImageKit.
   *
   * Aucune demande de permission « photothèque » : le sélecteur système
   * s'exécute hors du processus de l'app et ne lui transmet QUE l'image
   * choisie. Réclamer l'accès à toute la bibliothèque serait plus intrusif
   * sans rien apporter.
   */
  const pickAndUploadAvatar = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Recadrage carré côté système : ce que l'utilisateur valide est
      // exactement ce qu'il verra ensuite dans la pastille.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (picked.canceled) return

    const asset = picked.assets[0]
    if (!asset?.uri) return

    const mimeType = asset.mimeType ?? 'image/jpeg'
    // Un nom est obligatoire côté ImageKit ; l'extension doit suivre le type
    // réel, sinon le fichier est servi avec un mauvais Content-Type.
    const fallbackName = `avatar.${mimeType.split('/')[1] ?? 'jpg'}`

    updateAvatar.mutate(
      { uri: asset.uri, fileName: asset.fileName ?? fallbackName, mimeType },
      {
        onSuccess: () => showToast(t('settings.profile.photo_updated')),
        onError: e => showErrorToast(e),
      },
    )
  }

  const onPickAvatar = () => {
    haptics.selectionTick()
    if (!isImageKitConfigured()) {
      showErrorToast(t('settings.profile.photo_unavailable'))
      return
    }
    pickAndUploadAvatar().catch(e => {
      captureError(e, { tags: { feature: 'settings', op: 'avatar-pick' } })
      showErrorToast(t('settings.profile.photo_error'))
    })
  }

  const onChangeBirth = (event: DateTimePickerEvent, date?: Date) => {
    // Android referme son sélecteur lui-même et signale l'annulation ; iOS le
    // garde ouvert et ne notifie que les changements.
    if (Platform.OS === 'android') setPickerOpen(false)
    if (event.type === 'dismissed' || !date) return
    setDraftBirth(toIsoDate(date))
  }

  /**
   * Enregistre les deux champs, puis rend la main.
   *
   * Chaque champ n'est écrit que s'il a bougé : sans ce filtre, ouvrir la
   * fiche et appuyer sur « Enregistrer » réécrirait la date de naissance —
   * et échouerait sur une base où la colonne n'existe pas encore, pour une
   * modification que personne n'a demandée.
   */
  const save = () => {
    if (!dirty || saving) return
    haptics.impactLight()
    void (async () => {
      try {
        if (nameChanged) await updateName.mutateAsync(trimmedName)
        if (birthChanged) await updateBirthDate.mutateAsync(draftBirth)
        showToast(t('settings.profile.saved'))
        router.back()
      } catch (e) {
        showErrorToast(e)
      }
    })()
  }

  return (
    <ScreenWrapper
      disableBottomInset
      backgroundColor={colors.bg}
      statusBarProps={{ backgroundColor: colors.bg }}
    >
      <SettingsHeader
        title={t('settings.profile.title')}
        backLabel={t('settings.back')}
        onBack={() => router.back()}
      />

      <ScrollView
        testID="profile-scroll"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.sectionGap * 2 },
        ]}
      >
        {/* La photo, en grand et seule sur sa carte : c'est la seule zone de
            l'écran dont l'appui ouvre la galerie, elle ne peut donc pas être
            confondue avec un champ voisin. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.profile.photo_action')}
          accessibilityHint={t('settings.profile.photo_hint')}
          accessibilityState={{ busy: updateAvatar.isPending }}
          disabled={updateAvatar.isPending}
          onPress={onPickAvatar}
          onPressIn={() => setPressedPhoto(true)}
          onPressOut={() => setPressedPhoto(false)}
          style={pressedPhoto ? styles.photoCardPressed : styles.photoCard}
        >
          <ProfileAvatar
            avatar={avatar}
            displayName={displayName}
            size={AVATAR_SIZE}
            badge
            busy={updateAvatar.isPending}
          />
          <Text style={styles.photoHint}>
            {t('settings.profile.photo_hint')}
          </Text>
          {memberSince ? (
            <Text style={styles.memberSince}>
              {t('settings.profile.member_since', { date: memberSince })}
            </Text>
          ) : null}
        </Pressable>

        <SettingsSection caption={t('settings.profile.identity_footnote')}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('settings.profile.name')}</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder={t('settings.profile.name_placeholder')}
              placeholderTextColor={colors.textTertiary}
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              selectionColor={colors.accent}
              style={styles.fieldInput}
              accessibilityLabel={t('settings.profile.name')}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>
                {t('settings.profile.birth_date')}
              </Text>
              {draftBirth ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.profile.birth_date_clear')}
                  hitSlop={8}
                  onPress={() => {
                    haptics.selectionTick()
                    setDraftBirth(null)
                  }}
                >
                  <Text style={styles.clear}>{t('common.delete')}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* iOS affiche une pastille native qui ouvre son propre calendrier
                — inutile de la doubler d'un bouton. Android n'a pas cet
                affichage compact : on y garde une ligne qui ouvre le dialogue
                système. */}
            {Platform.OS === 'ios' ? (
              <View style={styles.dateRow}>
                <DateTimePicker
                  mode="date"
                  display="compact"
                  themeVariant="dark"
                  value={birthValue}
                  minimumDate={bounds.min}
                  maximumDate={bounds.max}
                  onChange={onChangeBirth}
                  accessibilityLabel={t('settings.profile.birth_date')}
                />
                {!draftBirth ? (
                  <Text style={styles.fieldEmpty}>
                    {t('settings.profile.birth_date_empty')}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('settings.profile.birth_date')}
                onPress={() => setPickerOpen(true)}
              >
                <Text
                  style={draftBirth ? styles.fieldValue : styles.fieldEmpty}
                >
                  {birthLabel ?? t('settings.profile.birth_date_empty')}
                </Text>
              </Pressable>
            )}
            {pickerOpen && Platform.OS === 'android' ? (
              <DateTimePicker
                mode="date"
                display="default"
                value={birthValue}
                minimumDate={bounds.min}
                maximumDate={bounds.max}
                onChange={onChangeBirth}
              />
            ) : null}
          </View>
        </SettingsSection>

        <SettingsSection caption={t('settings.profile.email_footnote')}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('settings.profile.email')}</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>
              {email ?? t('settings.profile.email_empty')}
            </Text>
          </View>
        </SettingsSection>

        {/* Le bouton n'existe que s'il y a quelque chose à enregistrer : un
            bouton grisé en permanence apprend à ignorer le bas de l'écran. */}
        {dirty ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
            accessibilityState={{ busy: saving }}
            disabled={saving}
            onPress={save}
            onPressIn={() => setPressedSave(true)}
            onPressOut={() => setPressedSave(false)}
            style={pressedSave ? styles.savePressed : styles.save}
          >
            {saving ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <Text style={styles.saveLabel}>{t('common.save')}</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </ScreenWrapper>
  )
}

/**
 * ⚠️ Aucun `style` en FONCTION ni en TABLEAU sur les `Pressable` : le style
 * était perdu à l'exécution et la vue retombait sur `flexDirection: 'column'`.
 * Voir la note détaillée dans `SettingsRow`.
 */
const PHOTO_CARD = {
  alignItems: 'center' as const,
  marginTop: spacing.sectionGap,
  paddingVertical: 28,
  paddingHorizontal: spacing.rowH,
  backgroundColor: colors.card,
  borderRadius: radius.card,
  borderWidth: size.hairline,
  borderColor: colors.cardBorder,
}
const SAVE = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  minHeight: 54,
  marginTop: spacing.sectionGap,
  borderRadius: radius.pill,
  backgroundColor: colors.accent,
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screenH },
  photoCard: PHOTO_CARD,
  photoCardPressed: { ...PHOTO_CARD, opacity: 0.7 },
  photoHint: {
    color: colors.textSecondary,
    fontSize: type.rowValue.size,
    fontWeight: type.rowValue.weight,
    marginTop: 14,
  },
  memberSince: {
    color: colors.textTertiary,
    fontSize: type.caption.size,
    fontWeight: type.caption.weight,
    marginTop: 4,
  },
  field: {
    paddingHorizontal: spacing.rowH,
    paddingVertical: 14,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: type.caption.size,
    fontWeight: type.caption.weight,
  },
  fieldInput: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: type.rowTitle.weight,
    // Le champ n'a ni cadre ni fond : c'est la carte qui fait la surface. Le
    // padding vertical nul évite qu'iOS ajoute sa propre marge au-dessus.
    paddingVertical: 0,
    marginTop: 4,
  },
  fieldValue: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: type.rowTitle.weight,
    marginTop: 4,
  },
  fieldEmpty: {
    color: colors.textTertiary,
    fontSize: type.rowTitle.size,
    fontWeight: '400',
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    // Le sélecteur natif s'aligne à gauche comme les autres valeurs.
    marginLeft: -10,
  },
  clear: {
    color: colors.danger,
    fontSize: type.caption.size,
    fontWeight: '600',
  },
  save: SAVE,
  savePressed: { ...SAVE, opacity: 0.7 },
  saveLabel: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: '600',
  },
})
