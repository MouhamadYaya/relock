import { IconName } from '@assets/icons'
import React, { useId, useState } from 'react'
import {
  type LayoutChangeEvent,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { featureFlags } from '@/config/feature-flags'
import { PaywallMarquee } from '@/features/onboarding/components/paywall/PaywallMarquee'
import {
  PaywallButton,
  PaywallLegalLinks,
  PaywallStars,
} from '@/features/onboarding/components/paywall/PaywallPrimitives'
import { pricePerWeek } from '@/features/onboarding/components/paywall/paywall-pricing'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { haptic } from '@/features/onboarding/tokens'
import type { PaywallPlan } from '@/features/onboarding/types/paywall'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { fonts } from '@/shared/theme/tokens/fonts'

/** Les avis supplémentaires, sous la ligne de flottaison. */
const EXTRA_REVIEWS = [2, 3] as const

/**
 * L'écran de choix de formule.
 *
 * Ordre de lecture : 1. la bande — 2. le titre — 3. les deux formules —
 * 4. l'avis — 5. la promesse d'annulation et le bouton.
 *
 * **Le rythme vertical est écrit, pas négocié.** Tous les écarts sont des
 * constantes ; seule la bande est élastique et absorbe la hauteur en trop.
 * La version précédente faisait l'inverse — un `space-between` répartissait
 * le rab également entre les quatre blocs et creusait ~50 pt de vide
 * partout, y compris entre le titre et le prix, là où il ne doit y en avoir
 * presque aucun.
 *
 * La bande est purement décorative : aucun libellé cliquable, aucune zone
 * tactile, aucun état sélectionné. Ce qui se choisit, ce sont les deux
 * cartes en dessous.
 *
 * La fermeture et la restauration ne vivent pas ici : ce sont deux actions
 * natives que `PaywallFlow` pose en surimpression de la bande.
 */
export function PaywallPlans({
  plans,
  selected,
  onSelect,
  onPurchase,
  busy = false,
}: {
  plans: readonly PaywallPlan[]
  selected: PaywallPlan
  onSelect: (plan: PaywallPlan) => void
  onPurchase: () => void
  /** Un achat OU une restauration est en cours : l'écran se verrouille. */
  busy?: boolean
}) {
  const t = useT()
  const compact = useWindowDimensions().height < PW.layout.compactHeight
  const locked = busy
  const [fold, setFold] = useState(0)
  const measureFold = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (layout.height !== fold) setFold(layout.height)
  }

  return (
    <View style={styles.screen} testID="paywall-plans">
      <ScrollView
        testID="paywall-scroll"
        bounces
        onLayout={measureFold}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
      >
        <View
          testID="paywall-fold"
          style={[
            styles.fold,
            compact && styles.compactFold,
            fold > 0 && { minHeight: fold },
          ]}
        >
          {/*
            La bande annule la marge de page pour toucher les deux bords :
            c'est la seule chose de l'écran qui sorte de la colonne de texte,
            et le seul bloc à qui on laisse de la hauteur à prendre.
          */}
          <View testID="paywall-marquee-slot" style={styles.marqueeSlot}>
            <PaywallMarquee />
          </View>

          {/*
            Le titre bascule en lavande sur sa seconde ligne. La couleur
            n'est pas un ornement : elle annonce le violet des cartes de prix
            qui arrivent seize points plus bas, et fait lire les deux lignes
            comme une bascule — l'écran d'un côté, la vie de l'autre.
          */}
          <View style={styles.heading}>
            <Text
              accessibilityRole="header"
              style={[styles.title, compact && styles.compactTitle]}
              maxFontSizeMultiplier={1.2}
            >
              {t('paywall_reference.plans_title')}
              {'\n'}
              <Text style={styles.titleAccent}>
                {t('paywall_reference.plans_title_accent')}
              </Text>
            </Text>
            {/*
              Ce que l'écran vend, écrit noir sur blanc. Sans cette ligne, le
              titre promet un bénéfice mais rien ne dit qu'on est devant un
              abonnement payant — l'utilisateur doit savoir ce qu'il achète
              avant d'atteindre le bouton.
            */}
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.3}>
              {t('paywall_reference.plans_subtitle')}
            </Text>
          </View>

          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('paywall.choose_plan')}
            style={styles.plans}
          >
            {plans.map(plan => (
              <PaywallPlanCard
                key={plan.id}
                plan={plan}
                selected={plan.id === selected.id}
                disabled={locked}
                compact={compact}
                onSelect={() => onSelect(plan)}
              />
            ))}
          </View>

          {/*
            Avis d'ouverture — masqué par `featureFlags.showUnverifiedSocialProof`,
            avec le bloc de preuves plus bas et pour la même raison : la citation
            et son auteur (« Alex R. ») sont écrits par nous, sur une app jamais
            publiée. C'est la signature nommée qui fait basculer l'argument
            publicitaire en faux témoignage — et c'est l'écran qui encaisse.

            Le texte reste dans les locales : le flag porte la marche à suivre
            pour le rallumer avec de vrais avis.
          */}
          {featureFlags.showUnverifiedSocialProof ? (
            <PaywallReview
              quote={t('paywall_reference.testimonial')}
              author={t('paywall_reference.author')}
              testID="paywall-reference-testimonial"
              style={styles.leadReview}
            />
          ) : null}
        </View>

        {featureFlags.showUnverifiedSocialProof ? (
          <View style={styles.moreProof} testID="paywall-more-proof">
            <View style={styles.proofHeading}>
              <PaywallStars size={PW.layout.star + 4} />
              <Text style={styles.proofTitle}>
                {t('paywall_reference.reviews')}
              </Text>
              <Text style={styles.proofBody}>
                {t('paywall_reference.users')}
              </Text>
            </View>
            {EXTRA_REVIEWS.map(index => (
              <PaywallReview
                key={index}
                quote={t(`paywall_reference.testimonial_${index}`)}
                author={t(`paywall_reference.author_${index}`)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.reassurance}>
          <IconSvg
            name={IconName.SHIELDFILL}
            size={PW.space.md}
            color={PW.color.accent}
          />
          <Text style={styles.reassuranceText} maxFontSizeMultiplier={1.3}>
            {t('paywall_reference.cancel')}
          </Text>
        </View>
        <PaywallButton
          label={
            busy
              ? t('paywall_reference.processing')
              : t('paywall_reference.continue')
          }
          onPress={onPurchase}
          disabled={locked}
          compact={compact}
        />
        <PaywallLegalLinks />
      </View>
    </View>
  )
}

/**
 * Un avis : les étoiles à gauche, le nom à droite, la citation en pleine
 * encre. La référence ne l'enferme dans aucune carte — c'est la taille des
 * étoiles et le contraste du texte qui lui donnent son poids, pas un cadre.
 */
function PaywallReview({
  quote,
  author,
  testID,
  style,
}: {
  quote: string
  author: string
  testID?: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View testID={testID} style={[styles.review, style]}>
      <View style={styles.reviewHeading}>
        <PaywallStars size={PW.layout.star + 6} />
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
      </View>
      <Text style={styles.quote} maxFontSizeMultiplier={1.2}>
        {quote}
      </Text>
    </View>
  )
}

/**
 * Une formule.
 *
 * Le ruban n'est PAS une bandelette posée sur la carte : le ruban et la
 * carte forment un seul objet — une coque violette arrondie dont la bande
 * haute porte le texte et dont le corps sombre est encastré à quatre points.
 * C'est ce détail d'assemblage, plus que la couleur, qui sépare un paywall
 * correct d'un paywall cher : deux rectangles empilés se lisent comme deux
 * éléments, une coque se lit comme un produit.
 *
 * La coque reste sur la formule annuelle même NON sélectionnée — « le
 * meilleur tarif » est une promesse permanente, pas une conséquence du
 * choix — mais son violet s'éteint alors, et le halo disparaît.
 *
 * La formule hebdomadaire n'a pas de coque : rien à y annoncer. Quand c'est
 * elle qui est choisie, c'est sa bordure qui passe en lavande.
 */
export function PaywallPlanCard({
  plan,
  selected,
  onSelect,
  disabled = false,
  compact = false,
}: {
  plan: PaywallPlan
  selected: boolean
  onSelect: () => void
  disabled?: boolean
  compact?: boolean
}) {
  const t = useT()
  const annual = plan.period === 'year'
  const title = annual
    ? t('paywall_reference.annual')
    : t('paywall_reference.weekly')
  // Le gros chiffre est un équivalent hebdomadaire ; la ligne du dessous porte
  // le montant RÉELLEMENT facturé, tel que le store l'écrit.
  const price = pricePerWeek(plan)
  const billing = annual
    ? t('paywall_reference.annual_billing', { price: plan.priceString })
    : undefined

  const body = (
    <View
      style={[
        styles.body,
        !annual && styles.bareBody,
        !annual && selected && styles.bareBodyOn,
        compact && styles.compactBody,
      ]}
    >
      <View style={styles.planCopy}>
        <Text style={[styles.planTitle, selected && styles.planTitleOn]}>
          {title}
        </Text>
        {billing ? (
          <Text style={[styles.planBilling, selected && styles.planBillingOn]}>
            {billing}
          </Text>
        ) : null}
      </View>
      <Text
        style={[styles.planPrice, selected && styles.planTitleOn]}
        maxFontSizeMultiplier={1.2}
      >
        {price}
        <Text style={[styles.planUnit, selected && styles.planBillingOn]}>
          {t('paywall_reference.per_week_unit')}
        </Text>
      </Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? (
          <IconSvg
            name={IconName.CHECK}
            size={PW.space.md}
            /* Encre sombre, jamais blanc : du blanc sur la lavande `accent`
               tombe sous le seuil de contraste et le check disparaît. */
            color={PW.color.onAccent}
          />
        ) : null}
      </View>
    </View>
  )

  return (
    <PressableScale
      testID={`paywall-plan-${plan.id}`}
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${t('paywall_reference.per_week', { price })}${billing ? `, ${billing}` : ''}`}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.select()
        onSelect()
      }}
      /* Le halo vit sur la vue extérieure : la coque rogne (`overflow`) pour
         contenir son dégradé, et un rognage couperait l'ombre portée. */
      style={selected ? PW.shadow.select : undefined}
    >
      {annual ? (
        <View style={styles.shell}>
          <PaywallShellField selected={selected} />
          <Text
            style={styles.shellRibbon}
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
          >
            {t('paywall_reference.lowest')}
          </Text>
          {body}
        </View>
      ) : (
        body
      )}
    </PressableScale>
  )
}

/** Le dégradé de la coque : vif quand la formule est choisie, éteint sinon. */
function PaywallShellField({ selected }: { selected: boolean }) {
  const id = useId()
  // Choisie : un violet franc mais assagi — l'ancien couple partait de
  // `violetInk`, deux crans plus clair, et l'aplat écrasait le prix qu'il
  // portait. Non choisie : le violet éteint.
  const colors = selected
    ? [PW.color.violetDeep, PW.color.violetShade]
    : [PW.color.halo, PW.color.violetMuted]
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0%" y1="0%" x2="20%" y2="100%">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: PW.layout.page },
  /**
   * Le rythme vertical de l'écran, écrit écart par écart.
   *
   * Il n'y a plus de `justifyContent` : chaque espace est une constante, et
   * c'est la bande (`marqueeSlot`, seule à porter `flexGrow`) qui absorbe la
   * hauteur en trop. Le budget mesuré sur un iPhone 15 (852 pt) :
   *
   *   59 barre d'état (LIBRE : aucune carte ne la touche) · 211 mosaïque ·
   *   20 · 104 titre + promesse · 24 · 162 formules · 28 · 118 avis · 4 ·
   *   92 pied (promesse + bouton) · 34 safe area
   *
   * Les seize points entre le titre et les formules sont volontaires et
   * volontairement petits : le titre doit toucher le prix. Le seul grand
   * écart est SOUS les formules, pour détacher la preuve sociale de l'achat.
   *
   * La version d'avant faisait exactement l'inverse — un `space-between`
   * répartissait le rab également entre les quatre blocs et creusait ~50 pt
   * de vide partout, y compris là où il n'en faut aucun.
   */
  fold: { paddingBottom: PW.space.xxs, gap: PW.space.lg },
  compactFold: { paddingBottom: PW.space.xs, gap: PW.space.md },
  // La marge négative annule `content.paddingHorizontal` : la bande est le
  // seul élément qui touche les deux bords de l'écran, et le seul à qui on
  // laisse de la hauteur à prendre.
  marqueeSlot: {
    marginHorizontal: -PW.layout.page,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: PW.layout.marqueeMin,
    maxHeight: PW.layout.marqueeMax,
  },
  title: {
    ...fonts.bold,
    color: PW.color.ink,
    fontSize: PW.text.h1,
    lineHeight: PW.text.h1Line,
    letterSpacing: PW.text.tight,
    textAlign: 'center',
  },
  heading: { gap: PW.space.xxs },
  compactTitle: {
    fontSize: PW.text.compactH1,
    lineHeight: PW.text.compactH1Line,
  },
  /**
   * La seconde ligne bascule en lavande. La couleur n'est pas un ornement :
   * elle annonce le violet des formules seize points plus bas et fait lire
   * les deux lignes comme une bascule — l'écran d'un côté, la vie de l'autre.
   */
  titleAccent: { color: PW.color.accent },
  /** La promesse se lit APRÈS le titre : deux crans plus bas en contraste. */
  subtitle: {
    ...fonts.regular,
    color: PW.color.inkFaint,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    textAlign: 'center',
  },
  /**
   * Les deux formules ont leur propre bulle d'air, au-dessus comme en
   * dessous : c'est le bloc qui décide de l'achat, il ne doit pas se lire
   * comme la suite du titre ni comme le début de l'avis. Les 16 pt qu'elle
   * coûte ont été repris sur l'écart des rangées de la mosaïque, sur
   * l'interligne de l'avis et sur les rembourrages du pied.
   */
  plans: {
    gap: PW.space.xxs + 6,
    marginTop: PW.space.xxs,
    marginBottom: PW.space.xs,
  },
  /**
   * La coque : elle réunit le ruban et la carte en un seul objet. Son
   * `padding` de quatre points est ce qui fait apparaître le liseré violet
   * autour du corps sombre — c'est tout le geste. Deux rectangles empilés se
   * lisent comme deux éléments ; une coque se lit comme un produit.
   */
  shell: {
    borderRadius: PW.radius.lg,
    overflow: 'hidden',
    padding: PW.layout.shellPad,
  },
  shellRibbon: {
    ...fonts.bold,
    height: PW.layout.shellRibbon,
    lineHeight: PW.layout.shellRibbon,
    fontSize: PW.text.eyebrow - 1,
    letterSpacing: PW.text.tracking,
    color: PW.color.onViolet,
    textAlign: 'center',
  },
  /** Le corps sombre, encastré dans la coque ou posé seul (hebdomadaire). */
  body: {
    borderRadius: PW.radius.md,
    backgroundColor: PW.color.surface,
    minHeight: PW.layout.planBody,
    flexDirection: 'row',
    alignItems: 'center',
    gap: PW.space.sm,
    paddingHorizontal: PW.space.md,
    paddingVertical: PW.space.sm,
  },
  compactBody: {
    minHeight: PW.layout.compactPlanBody,
    paddingHorizontal: PW.space.sm,
  },
  // Sans coque, c'est la bordure qui porte l'état. Le liseré haut plus clair
  // est le même geste que sur les cartes de la bande : la lumière d'en haut.
  bareBody: {
    borderWidth: 2,
    borderColor: PW.color.edge,
    borderTopColor: PW.color.edgeTop,
  },
  bareBodyOn: {
    borderColor: PW.color.accent,
    borderTopColor: PW.color.accent,
  },
  planCopy: { flex: 1, gap: 2 },
  planTitle: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.inkMuted,
  },
  planTitleOn: { color: PW.color.ink },
  planBilling: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkFaint,
  },
  planBillingOn: { color: PW.color.inkMuted },
  planPrice: {
    ...fonts.bold,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.tight,
    color: PW.color.inkMuted,
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  planUnit: {
    ...fonts.bold,
    fontSize: PW.text.fine,
    color: PW.color.inkFaint,
  },
  radio: {
    width: PW.layout.check,
    height: PW.layout.check,
    borderRadius: PW.radius.capsule,
    borderWidth: 2,
    borderColor: PW.color.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: PW.color.accent,
    backgroundColor: PW.color.accent,
  },
  review: { gap: PW.space.xs },
  // L'avis se détache du prix par le seul écart du conteneur : le supplément
  // qu'il portait a été rendu à la mosaïque, qui en avait plus besoin.
  leadReview: {},
  reviewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PW.space.sm,
  },
  author: {
    ...fonts.medium,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.inkFaint,
    flexShrink: 1,
  },
  quote: {
    ...fonts.regular,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine - 1,
    color: PW.color.ink,
  },
  moreProof: {
    paddingTop: PW.space.section,
    paddingBottom: PW.space.section,
    gap: PW.space.xl,
    borderTopWidth: PW.layout.hairline,
    borderTopColor: PW.color.hairline,
  },
  proofHeading: { alignItems: 'center', gap: PW.space.xs },
  proofTitle: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.ink,
  },
  proofBody: {
    ...fonts.regular,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.inkFaint,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: PW.layout.page,
    paddingTop: PW.space.xxs + 2,
    gap: PW.space.xs,
  },
  reassurance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: PW.space.xs,
  },
  reassuranceText: {
    ...fonts.medium,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.inkMuted,
  },
})
