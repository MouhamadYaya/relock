/**
 * Carte de préréglage, version onboarding.
 *
 * Même modèle que `RuleTemplateCard` (onglet Blocages / Nouvelle règle) :
 * image PLEIN CADRE, fondu vers le bas, texte posé dessus — l'image porte la
 * carte, elle n'est pas une vignette. Quatre écarts assumés, pas un de plus :
 *
 * - Pas de « + » : sur cet écran on SÉLECTIONNE, on n'ajoute pas ; un badge
 *   d'ajout promettrait une action qui n'existe pas encore.
 * - État sélectionné explicite : liseré blanc + pastille de coche LAVANDE
 *   (`OB.accent`, la couleur de sélection du sélecteur d'apps et du paywall).
 *   Elle voisine le « ? » blanc : deux pastilles blanches côte à côte se
 *   liraient comme deux badges du même type.
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
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { OnboardingAppIcons } from './OnboardingAppIcons'
import { OB } from './tokens'

/**
 * Fond du bouton d'aide : BLANC PLEIN, glyphe noir.
 *
 * Le gris `systemGray3` d'origine (`#C7C7CC`) portait un « ? » sombre : sur
 * des photos claires, disque ET glyphe tombaient dans la même valeur que
 * l'image — le bouton disparaissait purement et simplement. Le blanc est la
 * seule valeur qu'aucune de ces huit photos n'atteint, donc la seule qui
 * garantit le contraste sur toutes.
 *
 * Volontairement OPAQUE : un blanc translucide reprendrait la valeur de la
 * photo dessous et changerait d'aspect d'une carte à l'autre.
 */
const HELP_BG = '#FFFFFF'

/** Blanc légèrement enfoncé au toucher (`systemGray5` clair). */
const HELP_BG_PRESSED = '#E5E5EA'

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
  const t = useT()
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${time}. ${description}. ${appsLabel}`}
      accessibilityHint={
        selected
          ? t('onboarding_rule_info.deselect_hint')
          : t('onboarding_rule_info.select_hint')
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

          Les deux pastilles font la même taille et se touchent presque : ce
          qui les sépare est la COULEUR, pas la forme — lavande = « choisie »,
          blanc = « explique-moi ». Ne jamais leur redonner le même fond.
        */}
        <View style={styles.topRight}>
          {selected ? (
            <View pointerEvents="none" style={styles.check}>
              <IconSvg name={IconName.CHECK} size={18} color={OB.onAccent} />
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding_rule_info.what_rule_does', {
              title,
            })}
            accessibilityHint={t('onboarding_rule_info.open_explanation')}
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
    // Lavande, pas blanc : le blanc est passé au bouton d'aide voisin, et
    // c'est déjà la couleur qui dit « sélectionné » sur l'écran de choix des
    // apps (`pickCardDone`) comme sur le paywall. Le glyphe reste en encre
    // sombre — du blanc sur cette lavande tombe sous le seuil de contraste.
    backgroundColor: OB.accent,
  },
  help: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    // Disque BLANC plein, glyphe noir : l'inverse exact du fond de la carte,
    // donc le seul couple qui reste lisible sur les huit photos — y compris
    // les plus claires, où le gris précédent se fondait dans l'image.
    backgroundColor: HELP_BG,
    // Un bord, même sur un ciel blanc : le liseré empêche le disque de fuir
    // dans les zones les plus lumineuses des photos.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  helpPressed: {
    backgroundColor: HELP_BG_PRESSED,
  },
  helpGlyph: {
    ...fonts.bold,
    fontSize: 19,
    lineHeight: 22,
    textAlign: 'center',
    // Encre quasi noire sur le disque blanc : le contraste maximal dont on
    // dispose, indépendant de la photo qui passe dessous.
    color: OB.onAccent,
    // Le « ? » de SF est bien plus haut que large : sans cette reprise, il
    // flotte au-dessus du centre optique du disque.
    marginTop: -1,
  },
})
