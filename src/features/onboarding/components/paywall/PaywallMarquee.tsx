import { IconName } from '@assets/icons'
import React, { useId } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Les quatre tons d'une carte.
 *
 * `quiet` est la voix normale ; les trois autres sont des accents, et ils
 * sont RATIONNÉS — trois cartes allumées sur douze. Au-delà, la mosaïque
 * cesse d'avoir un point de regard et devient un sapin de Noël.
 */
type Tone = 'quiet' | 'solid' | 'light' | 'deep'

/**
 * Les trois rangées, dans l'ordre d'affichage.
 *
 * Chaque libellé est une intention, pas une fonctionnalité : on ne vend pas
 * un bloqueur d'applications, on vend ce qu'on récupère.
 *
 * Les pictogrammes sont dessinés pour cet écran. La plupart sont des
 * SILHOUETTES PLEINES plutôt que des traits fins ; `book`, `heart` et
 * `headphones` restent en contour, parce qu'à cette taille leurs formes
 * pleines devenaient des taches illisibles. Les icônes génériques du jeu (traits de
 * 2 px uniformes, façon Feather) disparaissaient à 24 pt sur une carte
 * sombre et faisaient bon marché ; une forme pleine tient son poids optique
 * et rattrape la matière des cartes.
 *
 * `offset` décale la rangée vers la gauche. Les trois valeurs sont
 * différentes à dessein : c'est ce désalignement qui fait la mosaïque, et
 * c'est lui aussi qui garantit que chaque rangée soit coupée par les DEUX
 * bords de l'écran au lieu de s'y arrêter proprement.
 *
 * Elles sont calculées, pas choisies au jugé. Chaque rangée est rendue en
 * double (~940 pt de large pour une fenêtre de 393), et l'`offset` place
 * cette fenêtre de façon que les trois cartes allumées — « Mieux dormir »,
 * « Être vraiment là », « Apprendre » — tombent EN ENTIER dans le champ,
 * pendant que leurs voisines sont mordues par les bords. Déplacer une valeur
 * sans refaire ce calcul fait sortir un accent de l'écran.
 */
const ROWS = [
  {
    offset: 40,
    cards: [
      {
        key: 'paywall_reference.intent_out',
        icon: IconName.COMPASS,
        tone: 'quiet',
      },
      {
        key: 'paywall_reference.intent_write',
        icon: IconName.PEN,
        tone: 'solid',
      },
      {
        key: 'paywall_reference.intent_reconnect',
        icon: IconName.HEADPHONES,
        tone: 'quiet',
      },
      {
        key: 'paywall_reference.intent_move',
        icon: IconName.GROWTH,
        tone: 'quiet',
      },
    ],
  },
  {
    offset: 100,
    cards: [
      {
        key: 'paywall_reference.intent_focus',
        icon: IconName.FOCUS,
        tone: 'quiet',
      },
      {
        key: 'paywall_reference.intent_present',
        icon: IconName.HEART,
        tone: 'light',
      },
      {
        key: 'paywall_reference.intent_create',
        icon: IconName.BRIEFCASE,
        tone: 'quiet',
      },
      {
        key: 'paywall_reference.intent_breathe',
        icon: IconName.BREATHE,
        tone: 'quiet',
      },
    ],
  },
  {
    offset: 150,
    cards: [
      {
        key: 'paywall_reference.intent_wake',
        icon: IconName.SUNRISE,
        tone: 'quiet',
      },
      {
        key: 'paywall_reference.intent_time',
        icon: IconName.CUP,
        tone: 'quiet',
      },
      {
        key: 'paywall_reference.intent_learn',
        icon: IconName.BOOK,
        tone: 'deep',
      },
      {
        key: 'paywall_reference.intent_sleep',
        icon: IconName.SLEEP,
        tone: 'quiet',
      },
    ],
  },
] as const

/** Les dégradés des cartes allumées. Un aplat violet sur du noir fait autocollant. */
const GRADIENT: Partial<Record<Tone, readonly [string, string]>> = {
  solid: [PW.color.violetInk, PW.color.violetDeep],
  light: [PW.color.grad[1], PW.color.accent],
}

/** La couleur du trait d'une icône, ton par ton. */
const ICON_COLOR: Record<Tone, string> = {
  quiet: PW.color.inkFaint,
  solid: PW.color.onViolet,
  light: PW.color.onAccent,
  deep: PW.color.accent,
}

/** Un dégradé plein cadre, posé sous le contenu d'une carte. */
function Field({ colors }: { colors: readonly [string, string] }) {
  const id = useId()
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0%" y1="0%" x2="30%" y2="100%">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  )
}

/**
 * Une carte : le pictogramme au-dessus, le libellé en dessous.
 *
 * L'ombre et le rognage ne peuvent pas vivre sur la même vue — `overflow:
 * 'hidden'` couperait l'ombre portée sur iOS. D'où les deux niveaux : la
 * coque porte l'ombre, le corps porte le rayon, la bordure et le dégradé.
 */
function MarqueeCard({
  label,
  icon,
  tone,
}: {
  label: string
  icon: IconName
  tone: Tone
}) {
  const gradient = GRADIENT[tone]
  return (
    <View
      style={[
        styles.cardShadow,
        tone === 'solid' && PW.shadow.lift,
        tone === 'light' && PW.shadow.liftSoft,
      ]}
    >
      <View style={[styles.card, styles[tone]]}>
        {gradient ? <Field colors={gradient} /> : null}
        <IconSvg
          name={icon}
          size={PW.layout.marqueeIcon}
          color={ICON_COLOR[tone]}
        />
        <Text
          style={[styles.label, styles[`${tone}Label`]]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.2}
        >
          {label}
        </Text>
      </View>
    </View>
  )
}

/**
 * La mosaïque décorative de l'écran des formules.
 *
 * Trois rangées de cartes désalignées, coupées par les deux bords de
 * l'écran. Elle est IMMOBILE et n'a AUCUN fond à elle : les cartes se posent
 * simplement sur le fond unique de la page (`PaywallBackdrop`), qui court
 * d'un bord à l'autre sans interruption.
 *
 * Ces deux points sont des corrections, pas des choix esthétiques ouverts.
 * La version précédente faisait dériver les rangées et fondait le bas de la
 * mosaïque vers le noir : ce fondu dessinait une ligne horizontale en
 * travers de la page et donnait l'impression d'un écran coupé en deux. Il ne
 * doit pas revenir — pas plus qu'un fond, une bordure ou un rayon posés
 * autour de l'ensemble, ni aucune animation.
 *
 * Elle est décorative : aucune carte n'est tactile, aucune ne porte d'état
 * sélectionné, et le tout est masqué aux lecteurs d'écran. Ce qui se choisit
 * sur cet écran, ce sont les deux formules.
 */
export function PaywallMarquee() {
  const t = useT()
  return (
    <View
      testID="paywall-marquee"
      style={styles.marquee}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ROWS.map(row => (
        <View key={row.cards[0].key} style={styles.row}>
          {/*
            Les cartes sont rendues en double pour que la rangée dépasse
            largement l'écran des deux côtés. Une seule série s'arrêterait
            avant le bord droit sur les grands appareils, et la mosaïque
            aurait l'air de finir au lieu d'être coupée. Une carte et sa copie
            sont distantes de ~470 pt : plus large que n'importe quelle
            fenêtre, donc jamais visibles ensemble.
          */}
          {[0, 1].map(pass => (
            <View
              key={pass}
              style={[styles.track, pass === 0 && { marginLeft: -row.offset }]}
            >
              {row.cards.map(card => (
                <MarqueeCard
                  key={card.key}
                  icon={card.icon}
                  tone={card.tone}
                  label={t(card.key)}
                />
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // Aucun `backgroundColor` ici, et aucun voile : le fond de la page est le
  // seul fond, les cartes sont juste posées dessus.
  marquee: { flex: 1, gap: PW.layout.marqueeRowGap },
  row: {
    flex: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: PW.layout.marqueeGap,
  },
  // `alignSelf: 'flex-start'` : sans lui, la piste hériterait de la largeur
  // de l'écran et compresserait ses cartes au lieu de déborder des deux bords.
  track: {
    height: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: PW.layout.marqueeGap,
  },
  cardShadow: { borderRadius: PW.radius.sm },
  card: {
    borderRadius: PW.radius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    gap: PW.space.xxs + 2,
    minWidth: PW.layout.marqueeCard,
    paddingHorizontal: PW.layout.marqueeCardPad,
    paddingVertical: PW.space.xxs + 6,
  },
  label: {
    ...fonts.semiBold,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    letterSpacing: -0.2,
    textAlign: 'center',
  },

  // ── Les quatre tons ────────────────────────────────────────────────────
  // Le liseré du HAUT est deux fois plus clair que les trois autres côtés :
  // sur du quasi-noir, c'est ce déséquilibre qui simule une lumière tombant
  // d'en haut et creuse le relief. Une bordure uniforme reste plate.
  quiet: {
    backgroundColor: PW.color.surface,
    borderWidth: 1,
    borderColor: PW.color.edge,
    borderTopColor: PW.color.edgeTop,
  },
  quietLabel: { color: PW.color.inkMuted },
  solid: {},
  solidLabel: { color: PW.color.onViolet },
  light: {},
  lightLabel: { color: PW.color.onAccent },
  deep: {
    backgroundColor: PW.color.halo,
    borderWidth: 1,
    borderColor: PW.color.accentDim,
    borderTopColor: PW.color.accentDim,
  },
  deepLabel: { color: PW.color.accent },
})
