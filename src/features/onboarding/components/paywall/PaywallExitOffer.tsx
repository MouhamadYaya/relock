import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { PaywallSparkle } from '@/features/onboarding/components/paywall/PaywallArtwork'
import {
  PaywallButton,
  PaywallEyebrow,
  PaywallLegalLinks,
  PaywallOutlineButton,
  PaywallPrice,
  PaywallRibbon,
} from '@/features/onboarding/components/paywall/PaywallPrimitives'
import {
  offerReduction,
  pricePerMonth,
} from '@/features/onboarding/components/paywall/paywall-pricing'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import type { PaywallPlan } from '@/features/onboarding/types/paywall'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Les étoiles autour du panneau, en fraction de sa boîte. Six points, jamais
 * symétriques deux à deux : une constellation posée à la main, pas une
 * bordure.
 */
const SPARKLES = [
  { top: '14%', left: '2%', scale: 0.75 },
  { top: '38%', left: '-2%', scale: 1.15 },
  { top: '68%', left: '4%', scale: 0.6 },
  { top: '12%', right: '3%', scale: 1 },
  { top: '44%', right: '-2%', scale: 0.7 },
  { top: '72%', right: '2%', scale: 1.05 },
] as const

/**
 * L'offre unique, plein écran.
 *
 * Hiérarchie : 1. « −50 % À VIE » dans le grand panneau de remise — 2. le prix —
 * 3. le CTA — 4. la carte annuelle et l'urgence — 5. le kicker, le refus
 * bordé et la réassurance.
 *
 * La page est REMPLIE, pas centrée : deux blocs denses, haut et bas, et le
 * champ violet entre les deux. C'est ce qui fait qu'aucun intervalle ne se
 * lit comme un trou — un vide coloré est une respiration, un vide noir est
 * un oubli.
 *
 * Contrainte inchangée : tout tient sur un écran, sans défilement. Aucun
 * `ScrollView` ici — un test le vérifie.
 */
export function PaywallExitOffer({
  regular,
  offer,
  onClose,
  onPurchase,
  busy = false,
}: {
  /** La formule annuelle au plein tarif, qui sert de repère barré. */
  regular: PaywallPlan
  /** Le produit remisé RÉELLEMENT achetable — jamais un montant écrit à la main. */
  offer: PaywallPlan
  onClose: () => void
  onPurchase: () => void
  busy?: boolean
}) {
  const t = useT()
  const compact = useWindowDimensions().height < PW.layout.compactHeight
  const percent = offerReduction(regular, offer)
  const monthly = pricePerMonth(offer)
  const yearly = offer.priceString

  return (
    <View
      testID="paywall-offer-full"
      style={[styles.screen, compact && styles.compactScreen]}
    >
      <View style={[styles.top, compact && styles.compactTop]}>
        <PaywallEyebrow
          label={t('paywall_reference.exclusive')}
          tone="bright"
        />

        <View style={styles.promoSlot}>
          <View
            style={[styles.promo, compact && styles.compactPromo]}
            testID="paywall-promo"
          >
            <Text
              accessibilityRole="header"
              style={[styles.discount, compact && styles.compactDiscount]}
              maxFontSizeMultiplier={1.05}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {t('paywall_reference.discount', { percent })}
            </Text>
            <Text
              style={[styles.forever, compact && styles.compactForever]}
              maxFontSizeMultiplier={1.1}
              numberOfLines={1}
            >
              {t('paywall_reference.forever')}
            </Text>
          </View>
          {SPARKLES.map(({ scale, ...position }, index) => (
            <PaywallSparkle
              key={index}
              size={PW.layout.sparkle * scale}
              style={[styles.sparkle, position]}
            />
          ))}
        </View>

        <PaywallPrice
          value={monthly}
          unit={t('paywall_reference.per_month_unit')}
          strikethrough={pricePerMonth(regular)}
          compact={compact}
        />
      </View>

      <View style={[styles.bottom, compact && styles.compactBottom]}>
        <View style={styles.urgency}>
          <IconSvg
            name={IconName.CLOCK}
            size={PW.space.md}
            color={PW.color.accent}
          />
          <Text style={styles.urgencyText} maxFontSizeMultiplier={1.2}>
            {t('paywall_reference.offer_warning')}
          </Text>
        </View>

        <View style={styles.plan} testID="paywall-exit-plan">
          <PaywallRibbon label={t('paywall_reference.lowest')} />
          <View style={[styles.planBody, compact && styles.compactPlanBody]}>
            <View style={styles.planCopy}>
              <Text style={styles.planTitle}>
                {t('paywall_reference.annual')}
              </Text>
              <Text style={styles.planBilling}>
                {t('paywall_reference.annual_billing', { price: yearly })}
              </Text>
            </View>
            <Text style={styles.planPrice} maxFontSizeMultiplier={1.2}>
              {monthly}
              <Text style={styles.planUnit}>
                {t('paywall_reference.per_month_unit')}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <PaywallButton
            label={
              busy
                ? t('paywall_reference.processing')
                : t('paywall_reference.exit_cta')
            }
            onPress={onPurchase}
            disabled={busy}
            compact={compact}
          />
          <PaywallOutlineButton
            label={t('paywall_reference.exit_decline')}
            onPress={onClose}
            disabled={busy}
            compact={compact}
          />
        </View>

        <Text style={styles.footer}>{t('paywall_reference.exit_footer')}</Text>
        <PaywallLegalLinks />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // `space-between` plutôt que `center` : la référence remplit la page de
  // haut en bas, et le champ violet fait le liant.
  screen: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: PW.layout.page,
    paddingTop: PW.space.md,
    paddingBottom: PW.space.xs,
  },
  compactScreen: { paddingTop: PW.space.xs },
  top: { gap: PW.space.xl },
  compactTop: { gap: PW.space.md },
  bottom: { gap: PW.space.md },
  compactBottom: { gap: PW.space.sm },

  /** Le panneau et sa constellation partagent la même boîte. */
  promoSlot: { justifyContent: 'center' },
  // Le renversement de valeur, en nuit violette plutôt qu'en blanc : le
  // panneau reste le seul plan ÉCLAIRÉ du parcours, sans en être la lampe.
  // Le liseré haut et le halo violet font le relief que l'aplat clair
  // obtenait gratuitement par sa seule luminosité.
  promo: {
    height: PW.layout.promo,
    marginHorizontal: PW.space.xl,
    borderRadius: PW.radius.lg,
    backgroundColor: PW.color.paper,
    borderWidth: PW.layout.hairline,
    borderColor: PW.color.paperEdge,
    alignItems: 'center',
    justifyContent: 'center',
    ...PW.shadow.promo,
  },
  compactPromo: { height: PW.layout.compactPromo },
  sparkle: { position: 'absolute', opacity: PW.opacity.sparkle },
  discount: {
    ...fonts.bold,
    fontSize: PW.text.display,
    lineHeight: PW.text.displayLine,
    letterSpacing: PW.text.tighter,
    // Le chiffre porte le violet : sur la nuit violette du panneau, c'est
    // la lavande qui le tient — `violetDeep` y disparaîtrait.
    color: PW.color.paperAccent,
    fontVariant: ['tabular-nums'],
  },
  compactDiscount: {
    fontSize: PW.text.compactDisplay,
    lineHeight: PW.text.compactDisplayLine,
  },
  forever: {
    ...fonts.bold,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.trackingWide,
    color: PW.color.paperInk,
  },
  compactForever: {
    fontSize: PW.text.compactH2,
    lineHeight: PW.text.compactH2Line,
  },

  urgency: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: PW.space.xs,
  },
  urgencyText: {
    ...fonts.semiBold,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.ink,
    flexShrink: 1,
  },
  plan: {
    overflow: 'hidden',
    borderRadius: PW.radius.md,
    backgroundColor: PW.color.accentDim,
    borderWidth: 1.5,
    borderColor: PW.color.accent,
  },
  planBody: {
    minHeight: PW.layout.planBody,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: PW.space.sm,
    paddingHorizontal: PW.space.md,
  },
  compactPlanBody: { minHeight: PW.layout.compactPlanBody },
  planCopy: { gap: 2 },
  planTitle: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.ink,
  },
  planBilling: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkMuted,
  },
  planPrice: {
    ...fonts.bold,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.tight,
    color: PW.color.ink,
    fontVariant: ['tabular-nums'],
  },
  planUnit: { ...fonts.bold, fontSize: PW.text.fine, color: PW.color.inkMuted },
  actions: { gap: PW.space.xs },
  footer: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkMuted,
    textAlign: 'center',
  },
})
