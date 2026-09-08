import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { settingsTheme } from '@/shared/theme'

const { colors, radius, size, spacing, type } = settingsTheme

interface Props {
  /** Titre de section, en clair et lisible (« Compte », « Personnaliser »). */
  title?: string
  /**
   * Note sous la carte, en gris. C'est là que va ce qu'on serait tenté de
   * mettre dans une alerte : la conséquence d'un réglage, une limite du
   * système.
   */
  caption?: string
  children: React.ReactNode
}

/**
 * Une section : un titre, une carte à coins très arrondis, des lignes
 * séparées par un filet.
 *
 * Les séparateurs sont posés ICI, jamais par les lignes. Une ligne qui doit
 * savoir si elle est la dernière est une ligne qu'on casse dès qu'on insère
 * une ligne conditionnelle avant elle — exactement ce que fait cet écran, où
 * plusieurs entrées n'existent que sur iPhone, qu'en développement, ou selon
 * une permission. Ici, le filet ne peut structurellement pas suivre la
 * dernière ligne : il n'est dessiné qu'AVANT chaque ligne, à partir de la
 * seconde.
 *
 * Son retrait à gauche vaut exactement la gouttière d'icône plus le padding
 * de ligne : le filet démarre donc sous le texte, jamais sous les icônes.
 * C'est ce qui fait lire une carte comme une liste et non comme des tuiles
 * empilées.
 */
export function SettingsSection({ title, caption, children }: Props) {
  const rows = React.Children.toArray(children).filter(Boolean)
  // Une section sans entrée ne s'affiche pas — pas de titre orphelin au-dessus
  // d'une carte vide.
  if (rows.length === 0) return null

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}

      <View style={styles.card}>
        {rows.map((row, index) => (
          // L'index suffit : dans une section donnée, l'ordre des lignes est
          // décidé à l'écriture de l'écran, jamais réordonné à l'exécution.
          <React.Fragment key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>

      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.sectionGap },
  title: {
    color: colors.textPrimary,
    fontSize: type.sectionTitle.size,
    fontWeight: type.sectionTitle.weight,
    marginBottom: spacing.titleGap,
    paddingHorizontal: spacing.sectionTitleH,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: size.hairline,
    borderColor: colors.cardBorder,
    // Découpe le retour au doigt d'une ligne sur les angles de la carte.
    overflow: 'hidden',
  },
  // Début aligné sur la colonne de TEXTE, fin avant la marge intérieure
  // droite. Un filet qui court jusqu'au bord de la carte se lit comme une
  // coupure ; en retrait des deux côtés, il se lit comme une liste.
  divider: {
    height: size.hairline,
    backgroundColor: colors.divider,
    marginLeft: spacing.rowH + spacing.iconGutter + spacing.iconGap,
    marginRight: spacing.rowH,
  },
  caption: {
    color: colors.textTertiary,
    fontSize: type.caption.size,
    fontWeight: type.caption.weight,
    lineHeight: type.caption.lineHeight,
    marginTop: spacing.captionGap,
    paddingHorizontal: spacing.sectionTitleH,
  },
})
