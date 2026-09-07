import { IconName } from '@assets/icons'
import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { settingsTheme } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, size, spacing, type } = settingsTheme

export interface SettingsRowProps {
  /**
   * Icône monochrome, dans la gouttière de gauche. Omise, la gouttière reste
   * en place et vide : c'est ce qui aligne les titres d'une carte au pixel,
   * y compris quand une seule ligne n'a pas d'icône.
   */
  icon?: IconName
  label: string
  /** Explication sous l'intitulé, 2 lignes maximum. */
  hint?: string
  /** Valeur courante, alignée à droite avant le chevron (« Sombre »). */
  value?: string
  onPress?: () => void
  /** Interrupteur : fournir les deux, ou aucun des deux. */
  switchValue?: boolean
  onSwitchChange?: (value: boolean) => void
  /** Coche de sélection à droite — feuilles de choix (langue, apparence). */
  selected?: boolean
  /**
   * État d'un réglage système, affiché comme une VALEUR (aligné à droite,
   * sur la ligne du titre) et non comme une pastille sous le sous-titre.
   */
  status?: { label: string; granted: boolean }
  /** Action irréversible : l'intitulé passe au rouge. */
  danger?: boolean
  /** Opération en cours : remplace le chevron par un indicateur. */
  busy?: boolean
  disabled?: boolean
  /** Élément libre à droite (badge PRO). Rare. */
  accessory?: React.ReactNode
}

/**
 * L'unique ligne des Réglages. Trois variantes, une seule structure.
 *
 *   [ gouttière icône ] [ titre + sous-titre ] [ valeur · chevron | switch ]
 *
 * La structure est FIGÉE, et c'est le point de tout ce composant. La version
 * précédente laissait chaque appelant composer sa ligne ; il suffisait alors
 * qu'un élément puisse s'étirer ou revenir à la ligne pour que l'icône
 * bascule au-dessus du texte et le chevron sur sa propre ligne — le défaut de
 * `flexDirection` étant `column` en React Native, contrairement au web.
 *
 * Trois verrous rendent ce retour impossible :
 *   1. `flexDirection: 'row'` ET `flexWrap: 'nowrap'` explicites sur la ligne ;
 *   2. des largeurs fixes avec `flexShrink: 0` de part et d'autre ;
 *   3. des marges plutôt que `gap` — l'espacement ne dépend plus du support
 *      de `gap` par la version de Yoga embarquée.
 *
 * Le bloc de texte est le SEUL à porter `flex: 1` : c'est lui qui absorbe la
 * place restante, donc lui qui se tronque quand un libellé allemand est trop
 * long. Rien d'autre ne bouge.
 */
export function SettingsRow({
  icon,
  label,
  hint,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  selected,
  status,
  danger,
  busy,
  disabled,
  accessory,
}: SettingsRowProps) {
  const [pressed, setPressed] = React.useState(false)
  const hasSwitch = switchValue !== undefined && onSwitchChange !== undefined
  const navigates = onPress !== undefined && !hasSwitch
  const inert = disabled || busy

  const toggle = () => {
    if (inert || !hasSwitch) return
    haptics.selectionTick()
    onSwitchChange(!switchValue)
  }

  const press = () => {
    if (inert) return
    haptics.selectionTick()
    onPress?.()
  }

  const body = (
    <>
      {/* La gouttière est toujours rendue, avec ou sans icône. */}
      <View style={styles.gutter}>
        {icon ? (
          <IconSvg
            name={icon}
            size={size.icon}
            strokeWidth={size.iconStroke}
            color={danger ? colors.danger : colors.icon}
          />
        ) : null}
      </View>

      <View style={styles.content}>
        <Text
          // Deux lignes, pas une : « Protection contre la désinstallation »
          // ne tient pas sur une ligne en français, et le réduire de force
          // rendrait le libellé illisible aux grandes tailles de texte.
          numberOfLines={2}
          style={[styles.title, danger && styles.titleDanger]}
        >
          {label}
        </Text>
        {hint ? (
          <Text numberOfLines={3} style={styles.subtitle}>
            {hint}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {value ? (
          <Text numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        ) : null}

        {status ? (
          <Text
            numberOfLines={1}
            style={[
              styles.value,
              status.granted ? styles.valueSuccess : styles.valueMuted,
            ]}
          >
            {status.label}
          </Text>
        ) : null}

        {accessory}

        {hasSwitch ? (
          <Switch
            // L'interrupteur porte lui-même l'intitulé : sans cela VoiceOver
            // annonce « activé » sans jamais dire de QUOI, la rangée n'étant
            // pas un élément accessible unique.
            accessibilityLabel={label}
            accessibilityHint={hint}
            value={switchValue}
            onValueChange={toggle}
            disabled={inert}
            trackColor={{ true: colors.accent, false: colors.control }}
            thumbColor={colors.textPrimary}
            ios_backgroundColor={colors.control}
          />
        ) : null}

        {selected ? (
          <IconSvg
            name={IconName.CHECK}
            size={size.check}
            strokeWidth={size.iconStroke}
            color={colors.accent}
          />
        ) : null}

        {busy ? <ActivityIndicator color={colors.textSecondary} /> : null}

        {navigates && !busy ? (
          <IconSvg
            name={IconName.FORWARD}
            size={size.chevron}
            strokeWidth={size.iconStroke}
            color={colors.textTertiary}
          />
        ) : null}
      </View>
    </>
  )

  // Une ligne à interrupteur reste tappable sur toute sa surface : viser un
  // switch de 50 pt au bout d'une ligne de 350 est un geste de précision
  // qu'on ne demande pas dans une liste de réglages.
  const handler = hasSwitch ? toggle : navigates ? press : undefined

  if (!handler) {
    return <View style={disabled ? styles.rowDimmed : styles.row}>{body}</View>
  }

  return (
    <Pressable
      accessibilityRole={hasSwitch ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={
        hasSwitch
          ? { checked: switchValue, disabled: inert }
          : { disabled: inert, selected }
      }
      disabled={inert}
      onPress={handler}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={
        disabled ? styles.rowDimmed : pressed ? styles.rowPressed : styles.row
      }
    >
      {body}
    </Pressable>
  )
}

/**
 * La géométrie d'une ligne, dupliquée telle quelle dans chaque état.
 *
 * ⚠️ NE JAMAIS repasser à un `style` en TABLEAU ou en FONCTION sur ces
 * `Pressable`. C'était la cause du défaut le plus visible de cet écran : la
 * ligne perdait tout son style à l'exécution — donc son `flexDirection` —
 * et retombait sur le défaut de React Native, `column`. L'icône passait
 * au-dessus du titre, l'interrupteur et le chevron sous le texte, alignés à
 * gauche. Rien de tout cela n'apparaît sous `react-test-renderer`, où le
 * style-fonction est correctement résolu : la panne ne se voit QUE sur
 * l'appareil, ce qui l'a rendue coûteuse à cerner.
 *
 * Un objet de style unique et statique par état supprime le problème à la
 * racine. Le coût est cette répétition, tenue par `ROW_LAYOUT`.
 */
const ROW_LAYOUT = {
  flexDirection: 'row',
  alignItems: 'center',
  // Explicite, et non hérité d'un défaut : c'est la garantie qu'aucun
  // enfant ne peut renvoyer le chevron à la ligne suivante.
  flexWrap: 'nowrap',
  minHeight: size.rowMinHeight,
  paddingVertical: spacing.rowV,
  paddingHorizontal: spacing.rowH,
} as const

const styles = StyleSheet.create({
  row: ROW_LAYOUT,
  rowPressed: { ...ROW_LAYOUT, backgroundColor: colors.pressed },
  rowDimmed: { ...ROW_LAYOUT, opacity: 0.45 },
  // Le pictogramme est CENTRÉ dans une colonne de largeur constante : une
  // icône large et une icône étroite laissent donc le texte au même x.
  gutter: {
    width: spacing.iconGutter,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.iconGap,
  },
  // Le seul bloc extensible de la ligne. `minWidth: 0` autorise la troncature
  // du texte ; sans lui, un libellé long pousse le chevron hors de l'écran.
  content: { flex: 1, minWidth: 0, marginRight: spacing.trailingGap },
  title: {
    color: colors.textPrimary,
    fontSize: type.rowTitle.size,
    fontWeight: type.rowTitle.weight,
  },
  titleDanger: { color: colors.danger },
  subtitle: {
    color: colors.textSecondary,
    fontSize: type.rowSubtitle.size,
    fontWeight: type.rowSubtitle.weight,
    lineHeight: type.rowSubtitle.lineHeight,
    marginTop: spacing.textGap,
  },
  // L'accessoire garde ses proportions : c'est le texte qui cède, jamais
  // l'interrupteur qu'on écraserait pour gagner une ligne.
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  value: {
    color: colors.textSecondary,
    fontSize: type.rowValue.size,
    fontWeight: type.rowValue.weight,
  },
  valueSuccess: { color: colors.success },
  valueMuted: { color: colors.textTertiary },
})
