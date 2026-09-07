/**
 * Carte de préréglage, version onboarding.
 *
 * Même modèle que `RuleTemplateCard` (onglet Blocages / Nouvelle règle) :
 * image PLEIN CADRE, fondu vers le bas, texte posé dessus — l'image porte la
 * carte, elle n'est pas une vignette. Quatre écarts assumés, pas un de plus :
 *
 * - Pas de « + » : sur cet écran on SÉLECTIONNE, on n'ajoute pas ; un badge
 *   d'ajout promettrait une action qui n'existe pas encore.
 * - État sélectionné explicite : liseré blanc + pastille de coche.
 * - Les icônes des apps que l'utilisateur vient de choisir, posées en bas à
 *   droite : sans elles, rien ne disait que ces règles s'appliquent à SA
 *   sélection de l'écran précédent — les testeurs lisaient huit cartes
 *   décoratives sans comprendre ce qu'elles allaient bloquer.
 * - Un « ? » permanent en haut à droite : le créneau, les jours et le sort
 *   réservé aux apps ne tiennent pas sur une vignette. Plutôt que d'entasser,
 *   on ouvre `RuleInfoSheet` à la demande.
 *
 * Le fondu part plus bas et le voile est plus léger que dans l'app : la carte
 * du carrousel est deux fois plus haute que celles de la grille, donc à voile
 * égal l'image y tombait au noir — les huit cartes se ressemblaient toutes.
 *
 * Ce composant vit dans `features/onboarding/` exprès : rien de ce qu'on y
 * change ne doit toucher les cartes de l'app.
 */
import { IconName } from '@assets/icons'
import React from 'react'
import {
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  RuleTemplateFlowGlyph,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { OnboardingAppIcons } from './OnboardingAppIcons'
import { OB } from './tokens'

/**
 * Gris du bouton d'aide — `systemGray3` clair, celui des « ? » d'Apple.
 * Volontairement OPAQUE : les huit cartes portent des photos différentes, et
 * un gris translucide changeait de valeur à chaque carte.
 */
const HELP_GREY = '#C7C7CC'

interface Props {
  title: string
  description: string
  time: string
  kind: RuleTypeGlyphKind
  image: ImageSourcePropType
  selected: boolean
  onToggle: () => void
  /** Clés des apps du sélecteur — identiques pour toutes les cartes. */
  appKeys: string[]
  /** Catégories et domaines choisis : sans icône propre, ils font le « +N ». */
  appOthers: number
  /** Ce que les vignettes disent, pour VoiceOver, qui ne les voit pas. */
  appsLabel: string
  /** Ouvre l'explication de CETTE règle. */
  onInfo: () => void
}

/**
 * Fondu de lecture : transparent sur toute la moitié haute (l'image y reste
 * intacte), opaque derrière le texte seulement.
 */
function ImageFade() {
  return (
    <Svg
      pointerEvents="none"
      style={styles.fade}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="ob-rule-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={OB.bg} stopOpacity={0} />
          <Stop offset="0.5" stopColor={OB.bg} stopOpacity={0.42} />
          <Stop offset="1" stopColor={OB.bg} stopOpacity={0.94} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} fill="url(#ob-rule-fade)" />
    </Svg>
  )
}

export function OnboardingRuleCard({
  title,
  description,
  time,
  kind,
  image,
  selected,
  onToggle,
  appKeys,
  appOthers,
  appsLabel,
  onInfo,
}: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${time}. ${description}. ${appsLabel}`}
      accessibilityHint={
        selected ? 'Toucher pour désélectionner' : 'Toucher pour sélectionner'
      }
      onPress={onToggle}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <ImageBackground
        accessibilityIgnoresInvertColors
        source={image}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageCorners}
      >
        <ImageFade />
        <View style={styles.body}>
          <View style={styles.flow}>
            <RuleTemplateFlowGlyph kind={kind} />
          </View>
          <View style={styles.footer}>
            <View style={styles.copy}>
              <Text style={styles.time}>{time}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.description} numberOfLines={2}>
                {description}
              </Text>
            </View>
            <OnboardingAppIcons keys={appKeys} others={appOthers} max={2} />
          </View>
        </View>
        {/*
          Amarré à droite : la coche s'insère À GAUCHE du « ? », qui ne bouge
          donc jamais d'une carte à l'autre ni d'un état à l'autre — une aide
          qui se déplace quand on coche est une aide qu'on ne retrouve pas.
        */}
        <View style={styles.topRight}>
          {selected ? (
            <View pointerEvents="none" style={styles.check}>
              <IconSvg name={IconName.CHECK} size={18} color={OB.onAccent} />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ce que fait la règle ${title}`}
            accessibilityHint="Ouvre l’explication de cette règle"
            // Le « ? » est POSÉ SUR une carte qui bascule au toucher : sans
            // arrêter la propagation, demander l'explication cochait la règle
            // au passage. `onPress` ne remonte pas dans un Pressable imbriqué,
            // mais `onStartShouldSetResponder` verrouille aussi le survol.
            onStartShouldSetResponder={() => true}
            hitSlop={12}
            onPress={onInfo}
            style={({ pressed }) => [
              styles.help,
              pressed && styles.helpPressed,
            ]}
          >
            {/*
              Le glyphe est un « ? » de TEXTE, pas une icône dessinée : l'app
              n'impose aucune `fontFamily` (cf. `theme/tokens/fonts`), donc
              c'est San Francisco qui le rend — le caractère même que contient
              `questionmark.circle.fill` d'Apple. Aucun tracé maison ne s'en
              approche d'aussi près.
            */}
            <Text allowFontScaling={false} style={styles.helpGlyph}>
              ?
            </Text>
          </Pressable>
        </View>
      </ImageBackground>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: OB.card,
    borderWidth: 2,
    borderColor: OB.hairline,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: OB.ink,
  },
  image: {
    flex: 1,
  },
  imageCorners: {
    borderRadius: 22,
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  flow: {
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(3,5,4,0.55)',
  },
  footer: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  copy: {
    flex: 1,
  },
  time: {
    ...fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    color: OB.ink70,
    fontVariant: ['tabular-nums'],
  },
  title: {
    ...fonts.semiBold,
    fontSize: 19,
    lineHeight: 24,
    color: OB.ink,
    marginTop: 2,
  },
  description: {
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: OB.ink70,
    marginTop: 2,
  },
  topRight: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  check: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.ink,
  },
  help: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    // Le bouton d'aide d'iOS (`questionmark.circle.fill`) : disque gris PLEIN,
    // glyphe détouré en sombre. La première version — glyphe clair sur pastille
    // sombre translucide — laissait la photo de la carte transparaître, et le
    // « ? » se noyait dès que l'image était claire. Un aplat opaque ne dépend
    // plus de ce qu'il y a dessous : même lisibilité sur les huit cartes.
    backgroundColor: HELP_GREY,
    // Sur un ciel très clair, le disque gris se confondait à son tour avec le
    // fond : ce liseré sombre lui rend un bord, quelle que soit la photo.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.22)',
  },
  helpPressed: {
    backgroundColor: '#A8A8AE',
  },
  helpGlyph: {
    ...fonts.bold,
    fontSize: 19,
    lineHeight: 22,
    textAlign: 'center',
    color: OB.onAccent,
    // Le « ? » de SF est bien plus haut que large : sans cette reprise, il
    // flotte au-dessus du centre optique du disque.
    marginTop: -1,
  },
})
