import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  PaywallBanner,
  PaywallButton,
  PaywallLegalLinks,
  PaywallMark,
  PaywallPrice,
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
 * L'offre de rattrapage, en feuille — présentée UNIQUEMENT après une
 * annulation avérée de la feuille de paiement du store (ou depuis l'aperçu
 * de développement).
 *
 * Hiérarchie : 1. le ruban « −50 % À VIE » — 2. le prix — 3. le CTA —
 * 4. le titre et la lune de marque — 5. la facturation et l'avertissement.
 *
 * Deux gestes font toute la feuille. Le ruban CHEVAUCHE son bord haut :
 * posé à cheval sur deux plans, il annonce la remise avant qu'on lise le
 * prix et il donne à la feuille sa personnalité. Et la page derrière reste
 * LISIBLE sous son voile : l'offre doit se lire comme quelque chose qui
 * arrive par-dessus une page qu'on connaît déjà.
 *
 * La feuille elle-même est en nuit violette, pas en blanc. Un aplat clair
 * plein cadre au milieu d'un parcours nocturne éblouit — voir `paper`.
 */
export function PaywallOffer({
  regular,
  offer,
  onPurchase,
  busy = false,
}: {
  regular: PaywallPlan
  offer: PaywallPlan
  onPurchase: () => void
  busy?: boolean
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const compact = useWindowDimensions().height < PW.layout.compactHeight
  const percent = offerReduction(regular, offer)
  const monthly = pricePerMonth(offer)

  return (
    // Le conteneur ne rogne RIEN : c'est ce qui laisse le ruban déborder.
    <View style={styles.dock} accessibilityViewIsModal>
      <View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, PW.space.lg) },
        ]}
        testID="paywall-offer-sheet"
      >
        <View style={styles.grip} />

        <View style={[styles.content, compact && styles.compactContent]}>
          <PaywallMark
            size={compact ? PW.layout.mark * 0.8 : PW.layout.mark}
            glow={false}
          />

          <Text
            accessibilityRole="header"
            style={[styles.title, compact && styles.compactTitle]}
            maxFontSizeMultiplier={1.15}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {t('paywall_reference.offer_title')}
          </Text>

          {/*
            Le prix barré doit être comparable au prix affiché : un équivalent
            MENSUEL face à un équivalent mensuel. Barrer « 69,99 $ » (par an) à
            côté de « 2,92 $/mois » comparait deux périodes différentes et
            gonflait la remise perçue.
          */}
          <PaywallPrice
            value={monthly}
            unit={t('paywall_reference.per_month_unit')}
            strikethrough={pricePerMonth(regular)}
            tone="paper"
            compact={compact}
          />

          <Text style={styles.billing}>
            {t('paywall_reference.offer_billed', {
              price: offer.priceString,
            })}
          </Text>

          <View style={styles.action}>
            <PaywallButton
              label={
                busy
                  ? t('paywall_reference.processing')
                  : t('paywall_reference.offer_cta')
              }
              onPress={onPurchase}
              disabled={busy}
              tone="deep"
              compact={compact}
            />
            <View style={styles.warning}>
              <IconSvg
                name={IconName.CLOCK}
                size={PW.space.md}
                color={PW.color.paperMuted}
              />
              <Text style={styles.warningText}>
                {t('paywall_reference.offer_warning')}
              </Text>
            </View>
            {/*
              Conditions et confidentialité, exigées par la 3.1.2 sur toute
              surface qui propose un abonnement — celle-ci en est une. `paper`
              parce que la feuille est en nuit violette : le ton `muted`, réglé
              pour le fond de l'app, s'y éteint.
            */}
            <PaywallLegalLinks tone="paper" />
          </View>
        </View>
      </View>

      <PaywallBanner
        label={`${t('paywall_reference.discount', { percent })} ${t('paywall_reference.forever')}`}
        style={styles.banner}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  dock: { width: '100%', maxWidth: PW.layout.maxWidth, alignSelf: 'center' },
  sheet: {
    backgroundColor: PW.color.paper,
    borderTopLeftRadius: PW.radius.xl,
    borderTopRightRadius: PW.radius.xl,
    // La feuille n'est plus claire : une ombre portée ne suffit plus à la
    // détacher d'un fond sombre (noir sur noir ne dessine rien). Le liseré
    // haut fait le travail — la même lumière tombant d'en haut que les
    // cartes de l'onboarding.
    borderTopWidth: PW.layout.hairline,
    borderColor: PW.color.paperEdge,
    ...PW.shadow.sheet,
  },
  grip: {
    alignSelf: 'center',
    width: PW.layout.sheetGrip,
    height: 4,
    borderRadius: PW.radius.capsule,
    backgroundColor: PW.color.paperMuted,
    opacity: 0.3,
    marginTop: PW.space.sm,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: PW.layout.page,
    // Le ruban mord sur le haut de la feuille : le contenu commence dessous.
    paddingTop: PW.space.xl,
    gap: PW.space.sm,
  },
  compactContent: { paddingTop: PW.space.md, gap: PW.space.xs },
  /**
   * À cheval sur le bord : la moitié du ruban sort de la feuille. `top`
   * négatif d'une demi-hauteur, et le conteneur ne rogne pas.
   */
  banner: {
    position: 'absolute',
    top: -PW.layout.banner / 2,
    alignSelf: 'center',
    marginLeft: -PW.space.section,
  },
  title: {
    ...fonts.bold,
    fontSize: PW.text.h1,
    lineHeight: PW.text.h1Line,
    letterSpacing: PW.text.tight,
    // Sur la nuit violette de la feuille, `violetDeep` s'éteindrait : le
    // titre prend la lavande de la marque.
    color: PW.color.paperAccent,
    textAlign: 'center',
  },
  compactTitle: {
    fontSize: PW.text.compactH1,
    lineHeight: PW.text.compactH1Line,
  },
  billing: {
    ...fonts.regular,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.paperMuted,
    textAlign: 'center',
  },
  action: { alignSelf: 'stretch', paddingTop: PW.space.sm, gap: PW.space.sm },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: PW.space.xs,
    paddingHorizontal: PW.space.xs,
  },
  warningText: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.paperMuted,
    flexShrink: 1,
    textAlign: 'center',
  },
})
