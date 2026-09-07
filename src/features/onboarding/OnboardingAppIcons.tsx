/**
 * Les apps que l'utilisateur vient de choisir, en VRAIES icônes.
 *
 * Sert à répondre visuellement à la question que posait l'écran des règles :
 * « ces règles s'appliquent à QUOI ? ». Poser les icônes d'Instagram et TikTok
 * dans la carte « Travail » dit en un coup d'œil ce qu'un paragraphe explique
 * mal — et raccroche l'écran au précédent.
 *
 * Jumeau volontaire de `features/blocking/RuleAppIcons`, avec deux écarts qui
 * justifient un fichier à part plutôt qu'un prop de plus :
 *
 * - la source : ici la sélection n'est liée à AUCUNE règle (elle ne le sera
 *   qu'à l'activation), donc les clés viennent du brouillon du sélecteur
 *   (`ScreenTime.draftAppKeys`) et non de `appKeys(ruleId)` ;
 * - la palette : l'onboarding a son propre noir (`OB`), pas celui de l'app.
 *
 * Les clés sont résolues UNE fois par écran et redescendues en props : huit
 * cartes qui interrogeraient le natif chacune de leur côté feraient huit
 * allers-retours pour la même réponse.
 */
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { BlockedAppIcons } from '@/shared/native/BlockedAppIcons'
import { fonts } from '@/shared/theme/tokens/fonts'
import { OB } from './tokens'

interface Props {
  /** Clés stables des jetons (cf. `ScreenTime.draftAppKeys`). */
  keys: string[]
  /**
   * Éléments choisis SANS icône propre — catégories et domaines web. Ils
   * gonflent le « +N » pour que le compte reste honnête vis-à-vis de ce que
   * l'écran précédent a annoncé.
   */
  others?: number
  /** Vignettes montrées avant de basculer sur « +N ». */
  max?: number
  size?: number
}

export function OnboardingAppIcons({
  keys,
  others = 0,
  max = 3,
  size = 26,
}: Props) {
  const shown = keys.slice(0, max)
  const extra = keys.length - shown.length + others
  // Aucune icône résolue (Android, iOS < 16, simulateur, binaire antérieur à
  // `draftAppKeys`) : on ne dessine RIEN. Un « +5 » orphelin ne renseigne
  // personne, et une icône devinée serait un mensonge — Apple ne livre jamais
  // l'identité des apps.
  if (shown.length === 0) return null

  const tile = { width: size, height: size, borderRadius: size * 0.26 }
  return (
    <View
      // Le sens est déjà porté par le libellé de la carte, qui annonce les
      // apps sélectionnées : répéter ici ferait lire la même chose deux fois.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.row}
    >
      {shown.map(key => (
        <View key={key} style={[styles.tile, tile]}>
          <BlockedAppIcons tokenKey={key} style={StyleSheet.absoluteFill} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[styles.extra, { height: size, borderRadius: size * 0.26 }]}
        >
          <Text style={styles.extraText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tile: {
    overflow: 'hidden',
    // Le fond sombre tient la place tant que la vue native n'a pas résolu le
    // jeton : sans lui, la rangée « saute » quand les icônes arrivent.
    backgroundColor: 'rgba(3,5,4,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  extra: {
    minWidth: 26,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,5,4,0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  extraText: {
    ...fonts.medium,
    fontSize: 12,
    color: OB.ink70,
    fontVariant: ['tabular-nums'],
  },
})
