import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SettingsSurface } from '@/features/settings/components/SettingsSurface'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'

const { colors, layout, shadow, typography } = relockMaterial

interface Props {
  /** Intitulé de la famille, en capitales. Facultatif : la carte de profil
   *  n'en porte pas — elle se présente d'elle-même. */
  title?: string
  /**
   * Note sous la carte. C'est là que va ce qu'on serait tenté de mettre dans
   * une alerte : la conséquence d'un réglage, une limite du système. Un
   * réglage qu'il faut expliquer APRÈS l'avoir touché est un réglage raté.
   */
  footnote?: string
  children: React.ReactNode
}

/**
 * Une famille de réglages : un intitulé, une carte de verre, des lignes
 * séparées par un filet.
 *
 * Les séparateurs sont posés ICI et non par les lignes elles-mêmes. Une ligne
 * qui doit savoir si elle est la dernière du groupe est une ligne qu'on
 * casse dès qu'on en insère une conditionnelle avant elle — exactement ce que
 * fait cet écran, où plusieurs lignes n'existent que sur iPhone ou qu'en
 * développement.
 */
export function SettingsGroup({ title, footnote, children }: Props) {
  const rows = React.Children.toArray(children).filter(Boolean)
  if (rows.length === 0) return null

  return (
    <View style={styles.group}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.card}>
        <SettingsSurface />
        {rows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: l'ordre des lignes est statique dans un groupe donné.
          <React.Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>

      {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { marginTop: layout.settingsGroupGap },
  title: {
    ...fonts.semiBold,
    color: colors.textTertiary,
    fontSize: typography.settingsGroupLabelSize,
    lineHeight: typography.settingsGroupLabelLineHeight,
    letterSpacing: typography.settingsGroupLabelLetterSpacing,
    textTransform: 'uppercase',
    paddingHorizontal: layout.settingsGroupLabelHorizontal,
    paddingBottom: layout.settingsGroupLabelBottom,
  },
  card: {
    borderRadius: layout.settingsCardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeGlassBorder,
    // Découpe l'arête haute du verre sur les angles arrondis.
    overflow: 'hidden',
    ...shadow.glass,
  },
  // Décalé sous la pastille : le filet part du texte, jamais du bord de la
  // carte — c'est ce qui fait lire les lignes comme une liste et non comme
  // des tuiles empilées.
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.homeGlassBorder,
    marginLeft: layout.settingsDividerInset,
  },
  footnote: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.settingsRowHintSize,
    lineHeight: typography.settingsRowHintLineHeight,
    paddingTop: layout.settingsGroupLabelBottom,
    paddingHorizontal: layout.settingsGroupLabelHorizontal,
  },
})
