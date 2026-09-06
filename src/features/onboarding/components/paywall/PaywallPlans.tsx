import { IconName } from '@assets/icons'
import React, { useState } from 'react'
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { PaywallTiles } from '@/features/onboarding/components/paywall/PaywallArtwork'
import {
  PaywallButton,
  PaywallRibbon,
  PaywallStars,
  PaywallTextButton,
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
 * Hiérarchie : 1. les deux formules — 2. le bouton — 3. le titre — 4. la
 * grille de quatre visuels — 5. l'avis et la promesse d'annulation.
 *
 * La grille 2 × 2 tient le premier tiers de la page, comme la référence.
 * Elle est DÉCORATIVE : sans libellé, sans zone tactile, sans état
 * sélectionné — quatre scènes qui racontent la vie qu'on achète, pas quatre
 * options à choisir. Ce qui se choisit, ce sont les deux cartes en dessous,
 * et la sélectionnée s'INVERSE en clair : le geste de `ChoiceCard` dans
 * l'onboarding, où le contraste maximal fait office de couleur.
 *
 * Le pli reste mesuré (`onLayout`) plutôt que deviné : tout ce qui décide de
 * l'achat tient dans le premier écran, le reste de la preuve vit dessous.
 */
export function PaywallPlans({
  plans,
  selected,
  onSelect,
  onPurchase,
  onWindow,
  onRestore,
  busy = false,
}: {
  plans: readonly PaywallPlan[]
  selected: PaywallPlan
  onSelect: (plan: PaywallPlan) => void
  onPurchase: () => void
  onWindow?: () => void
  onRestore: () => void
  busy?: boolean
}) {
  const t = useT()
  const compact = useWindowDimensions().height < PW.layout.compactHeight
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
          <Text
            accessibilityRole="header"
            style={[styles.title, compact && styles.compactTitle]}
            maxFontSizeMultiplier={1.2}
          >
            {t('paywall_reference.plans_title')}
          </Text>

          {/* Seul bloc élastique : la décoration cède, jamais le prix. */}
          <View
            testID="paywall-tiles-slot"
            style={[styles.tilesSlot, compact && styles.compactTilesSlot]}
          >
            <PaywallTiles />
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
                disabled={busy}
                compact={compact}
                onSelect={() => onSelect(plan)}
              />
            ))}
          </View>

          {__DEV__ ? (
            <PaywallReview
              quote={t('paywall_reference.testimonial')}
              author={t('paywall_reference.author')}
              testID="paywall-reference-testimonial"
            />
          ) : null}
        </View>

        {__DEV__ ? (
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
            <View style={styles.devFooter}>
              <PaywallTextButton
                label={t('paywall.restore')}
                onPress={onRestore}
              />
              {onWindow ? (
                <PaywallTextButton
                  label={t('paywall_reference.dev_window')}
                  onPress={onWindow}
                />
              ) : null}
            </View>
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
          disabled={busy}
          compact={compact}
        />
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
}: {
  quote: string
  author: string
  testID?: string
}) {
  return (
    <View testID={testID} style={styles.review}>
      <View style={styles.reviewHeading}>
        <PaywallStars size={PW.layout.star + 3} />
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
      style={[styles.plan, selected && styles.planSelected]}
    >
      {annual ? <PaywallRibbon label={t('paywall_reference.lowest')} /> : null}
      <View style={[styles.planBody, compact && styles.compactPlanBody]}>
        <View style={styles.planCopy}>
          <Text style={[styles.planTitle, selected && styles.planTitleOn]}>
            {title}
          </Text>
          {billing ? (
            <Text
              style={[styles.planBilling, selected && styles.planBillingOn]}
            >
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
              color={PW.color.paper}
            />
          ) : null}
        </View>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: PW.layout.page },
  // `space-between` : la hauteur en trop se répartit dans le rythme vertical
  // au lieu de creuser un seul grand vide sous le dernier bloc.
  fold: {
    justifyContent: 'space-between',
    paddingBottom: PW.space.md,
    gap: PW.space.md,
  },
  compactFold: { paddingBottom: PW.space.sm, gap: PW.space.sm },
  title: {
    ...fonts.bold,
    color: PW.color.ink,
    fontSize: PW.text.h1,
    lineHeight: PW.text.h1Line,
    letterSpacing: PW.text.tight,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: PW.text.compactH1,
    lineHeight: PW.text.compactH1Line,
  },
  tilesSlot: {
    height: PW.layout.tiles,
    minHeight: PW.layout.minTiles,
    maxHeight: PW.layout.maxTiles,
    flexGrow: 1,
    flexShrink: 1,
  },
  compactTilesSlot: { height: PW.layout.minTiles },
  plans: { gap: PW.space.xs },
  /**
   * Non sélectionnée : une surface nocturne, discrète. Sélectionnée : la
   * carte s'INVERSE en clair — impossible de se tromper sur celle qui est
   * active, même à 20 % de zoom.
   */
  plan: {
    borderRadius: PW.radius.md,
    overflow: 'hidden',
    backgroundColor: PW.color.surface,
    borderWidth: 1.5,
    borderColor: PW.color.hairline,
  },
  planSelected: {
    backgroundColor: PW.color.paper,
    borderColor: PW.color.accent,
  },
  planBody: {
    minHeight: PW.layout.planBody,
    flexDirection: 'row',
    alignItems: 'center',
    gap: PW.space.sm,
    paddingHorizontal: PW.space.md,
    paddingVertical: PW.space.sm,
  },
  compactPlanBody: {
    minHeight: PW.layout.compactPlanBody,
    paddingHorizontal: PW.space.sm,
  },
  planCopy: { flex: 1, gap: 2 },
  planTitle: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.inkMuted,
  },
  planTitleOn: { color: PW.color.paperInk },
  planBilling: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkFaint,
  },
  planBillingOn: { color: PW.color.paperMuted },
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
    borderColor: PW.color.violetDeep,
    backgroundColor: PW.color.violetDeep,
  },
  review: { gap: PW.space.xs },
  reviewHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PW.space.sm,
  },
  author: {
    ...fonts.medium,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkFaint,
    flexShrink: 1,
  },
  quote: {
    ...fonts.regular,
    fontSize: PW.text.compactBody,
    lineHeight: PW.text.compactBodyLine,
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
  devFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: PW.space.xl,
  },
  footer: {
    paddingHorizontal: PW.layout.page,
    paddingTop: PW.space.xs,
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
