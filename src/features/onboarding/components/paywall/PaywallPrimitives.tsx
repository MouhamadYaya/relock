import { IconName } from '@assets/icons'
import React from 'react'
import {
  Linking,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { links } from '@/config/app-config'
import { Moon } from '@/features/onboarding/bits'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { haptic } from '@/features/onboarding/tokens'
import { i18n } from '@/i18n'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Les deux liens juridiques du bas de paywall.
 *
 * Ce n'est PAS un ornement. Les Guidelines de l'App Store (3.1.2) exigent
 * qu'un écran vendant un abonnement à renouvellement automatique porte un
 * lien FONCTIONNEL vers les conditions d'utilisation et vers la politique de
 * confidentialité ; leur absence est un motif de rejet à la revue. D'où leur
 * présence sur les DEUX écrans qui encaissent — la grille de formules et
 * l'offre de sortie — et non sur la seule première.
 *
 * L'URL suit la langue de l'app. Le site n'existe qu'en anglais et en
 * français : tout ce qui n'est pas `fr` lit la version anglaise.
 */
export function PaywallLegalLinks({
  tone = 'muted',
}: {
  tone?: 'muted' | 'paper'
}) {
  const t = useT()
  const fr = i18n.language.startsWith('fr')
  const open = (url: string) => {
    Linking.openURL(url).catch(() => {})
  }

  return (
    <View style={styles.legal} testID="paywall-legal">
      <PaywallTextButton
        testID="paywall-terms"
        tone={tone}
        label={t('paywall.terms')}
        onPress={() => open(fr ? links.termsFr : links.terms)}
      />
      <Text style={[styles.legalDot, tone === 'paper' && styles.legalDotPaper]}>
        ·
      </Text>
      <PaywallTextButton
        testID="paywall-privacy"
        tone={tone}
        label={t('paywall.privacy')}
        onPress={() => open(fr ? links.privacyFr : links.privacy)}
      />
    </View>
  )
}

/** Étoile pleine, tracée sur un cercle de rayon 11 dans un cadre de 24. */
const STAR =
  'M12 1 L14.7 8.28 L22.46 8.6 L16.38 13.42 L18.47 20.9 L12 16.6 ' +
  'L5.53 20.9 L7.62 13.42 L1.54 8.6 L9.3 8.28 Z'

const RATING = 5

/** Le logotype, à plat, dans la graisse de l'interface. */
export function PaywallWordmark() {
  const t = useT()
  return (
    <Text
      accessibilityRole="image"
      accessibilityLabel={t('paywall_reference.brand')}
      style={styles.wordmark}
      maxFontSizeMultiplier={1.2}
    >
      {t('paywall_reference.brand')}
    </Text>
  )
}

/**
 * L'action principale.
 *
 * Deux tons, parce qu'il y a deux fonds : `accent` pose la lavande de
 * l'onboarding avec une encre sombre (la variante qui existe déjà dans
 * `Pill`), `deep` pose un violet profond avec du blanc — c'est le ton des
 * panneaux promotionnels (`paper`), où la lavande, déjà prise par le titre
 * et le chiffre, ne peut plus servir de fond d'action sans tout aplatir.
 */
export function PaywallButton({
  label,
  onPress,
  disabled = false,
  compact = false,
  tone = 'accent',
  testID,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  compact?: boolean
  tone?: 'accent' | 'deep'
  testID?: string
}) {
  const deep = tone === 'deep'
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
      style={[
        styles.button,
        deep && styles.buttonDeep,
        compact && styles.compactButton,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={[styles.buttonText, deep && styles.buttonTextDeep]}
        maxFontSizeMultiplier={1.25}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

/**
 * Le refus, bordé — la référence le dessine comme un vrai bouton et non
 * comme un lien, parce qu'il doit rester trouvable sans jamais rivaliser
 * avec l'action. Il est donc plus court que le CTA, et vide.
 */
export function PaywallOutlineButton({
  label,
  onPress,
  disabled = false,
  compact = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  compact?: boolean
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.outline,
        compact && styles.compactOutline,
        disabled && styles.disabled,
      ]}
    >
      <Text
        style={styles.outlineText}
        maxFontSizeMultiplier={1.25}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

/** Lien texte discret (« Passer », « Restaurer »). */
export function PaywallTextButton({
  label,
  onPress,
  disabled = false,
  tone = 'muted',
  testID,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  /**
   * `bright` est réservé aux commandes posées SUR une illustration : à 72 %
   * d'opacité (`muted`), un libellé se perd dans les cartes de la mosaïque.
   */
  tone?: 'muted' | 'paper' | 'bright'
  testID?: string
}) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.textButton}
    >
      <Text
        style={[
          styles.textButtonLabel,
          tone === 'paper' && styles.textButtonPaper,
          tone === 'bright' && styles.textButtonBright,
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  )
}

export function PaywallClose({
  onPress,
  tone = 'dark',
  testID = 'paywall-close',
}: {
  onPress: () => void
  tone?: 'dark' | 'paper' | 'bright'
  /** Deux croix coexistent (l'écran des formules, la feuille d'offre) : les
   * tests doivent pouvoir viser l'une sans attraper l'autre. */
  testID?: string
}) {
  const t = useT()
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('paywall.close')}
      onPress={onPress}
      style={styles.close}
    >
      <IconSvg
        name={IconName.CLOSE}
        size={PW.layout.icon}
        color={
          tone === 'paper'
            ? PW.color.paperMuted
            : tone === 'bright'
              ? PW.color.onViolet
              : PW.color.ink
        }
      />
    </PressableScale>
  )
}

/**
 * L'emblème de marque : la lune de l'onboarding, l'asset réel.
 *
 * Le petit croissant vectoriel qui occupait cette place se lisait comme un
 * gabarit non rempli. Relock a déjà un logo, il traverse tout l'onboarding —
 * c'est lui qui doit apparaître sur la feuille d'offre.
 */
export function PaywallMark({
  size = PW.layout.mark,
  glow = true,
}: {
  size?: number
  glow?: boolean
}) {
  return <Moon size={size} glow={glow} />
}

/** Cinq étoiles pleines, dessinées plutôt qu'écrites. */
export function PaywallStars({
  tone = 'dark',
  size = PW.layout.star,
}: {
  tone?: 'dark' | 'paper'
  size?: number
}) {
  const t = useT()
  return (
    <View
      style={styles.stars}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('paywall_reference.rating')}
    >
      {Array.from({ length: RATING }, (_, index) => (
        <Svg key={index} width={size} height={size} viewBox="0 0 24 24">
          <Path
            d={STAR}
            fill={tone === 'paper' ? PW.color.paperAccent : PW.color.accent}
          />
        </Svg>
      ))}
    </View>
  )
}

/** Bandeau plein d'une carte de formule (« MEILLEUR TARIF »). */
export function PaywallRibbon({ label }: { label: string }) {
  return (
    <View style={styles.ribbon}>
      <Text
        style={styles.ribbonText}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
      >
        {label}
      </Text>
    </View>
  )
}

/**
 * Le ruban promotionnel qui chevauche le bord haut de la feuille d'offre :
 * légèrement incliné, posé à cheval sur deux plans. C'est lui qui donne à la
 * feuille sa personnalité et qui annonce la remise avant même qu'on lise le
 * prix.
 */
export function PaywallBanner({
  label,
  style,
}: {
  label: string
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[styles.banner, style]} testID="paywall-banner">
      <Text
        style={styles.bannerText}
        numberOfLines={1}
        maxFontSizeMultiplier={1.15}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {label}
      </Text>
    </View>
  )
}

/** Petit titre en capitales espacées, au-dessus d'un bloc. */
export function PaywallEyebrow({
  label,
  tone = 'muted',
}: {
  label: string
  tone?: 'muted' | 'paper' | 'bright'
}) {
  return (
    <Text
      style={[
        styles.eyebrow,
        tone === 'paper' && styles.eyebrowPaper,
        tone === 'bright' && styles.eyebrowBright,
      ]}
      maxFontSizeMultiplier={1.3}
    >
      {label}
    </Text>
  )
}

/**
 * Le couple « ancien prix barré / prix actuel ». Le montant porte la taille,
 * l'unité l'accompagne — jamais deux tailles héroïques côte à côte.
 */
export function PaywallPrice({
  value,
  unit,
  strikethrough,
  compact = false,
  tone = 'dark',
}: {
  value: string
  unit: string
  strikethrough?: string
  compact?: boolean
  tone?: 'dark' | 'paper'
}) {
  const paper = tone === 'paper'
  return (
    <View style={styles.price}>
      {strikethrough ? (
        <Text
          style={[styles.oldPrice, paper && styles.oldPricePaper]}
          maxFontSizeMultiplier={1.2}
        >
          {strikethrough}
        </Text>
      ) : null}
      <Text
        style={[
          styles.priceValue,
          compact && styles.compactPriceValue,
          paper && styles.priceValuePaper,
        ]}
        maxFontSizeMultiplier={1.15}
      >
        {value}
        <Text
          style={[
            styles.priceUnit,
            compact && styles.compactPriceUnit,
            paper && styles.priceUnitPaper,
          ]}
        >
          {unit}
        </Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wordmark: {
    ...fonts.bold,
    fontSize: PW.layout.wordmark,
    letterSpacing: PW.text.tight,
    color: PW.color.ink,
  },
  button: {
    minHeight: PW.layout.button,
    borderRadius: PW.radius.capsule,
    backgroundColor: PW.color.accent,
    paddingHorizontal: PW.space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDeep: { backgroundColor: PW.color.violetDeep },
  compactButton: { minHeight: PW.layout.compactButton },
  disabled: { opacity: PW.opacity.disabled },
  buttonText: {
    ...fonts.semiBold,
    fontSize: PW.text.button,
    letterSpacing: -0.2,
    color: PW.color.onAccent,
    textAlign: 'center',
  },
  buttonTextDeep: { color: PW.color.onViolet },
  outline: {
    minHeight: PW.layout.buttonSecondary,
    borderRadius: PW.radius.capsule,
    borderWidth: 1.5,
    borderColor: PW.color.control,
    paddingHorizontal: PW.space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactOutline: { minHeight: PW.layout.compactButtonSecondary },
  outlineText: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    color: PW.color.ink,
    textAlign: 'center',
  },
  textButton: {
    minHeight: PW.layout.touch,
    paddingHorizontal: PW.space.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonLabel: {
    ...fonts.semiBold,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.inkMuted,
  },
  /**
   * Blanc pur, plus une ombre portée courte. L'ombre n'est pas un effet : la
   * mosaïque fait défiler sous ces commandes des cartes sombres ET des cartes
   * lavande claires, et sans elle le libellé blanc disparaît sur les
   * secondes.
   */
  textButtonBright: {
    color: PW.color.onViolet,
    textShadowColor: PW.color.scrim,
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
  textButtonPaper: { color: PW.color.paperMuted },
  close: {
    width: PW.layout.touch,
    height: PW.layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stars: { flexDirection: 'row', alignItems: 'center', gap: PW.layout.starGap },
  ribbon: {
    minHeight: PW.layout.ribbon,
    backgroundColor: PW.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: PW.space.sm,
  },
  ribbonText: {
    ...fonts.bold,
    fontSize: PW.text.fine,
    letterSpacing: PW.text.tracking,
    color: PW.color.onAccent,
  },
  banner: {
    minHeight: PW.layout.banner,
    justifyContent: 'center',
    paddingHorizontal: PW.space.lg,
    borderRadius: PW.radius.xs,
    backgroundColor: PW.color.violetDeep,
    transform: [{ rotate: PW.layout.bannerTilt }],
    ...PW.shadow.banner,
  },
  bannerText: {
    ...fonts.bold,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.tight,
    color: PW.color.onViolet,
    textAlign: 'center',
  },
  eyebrow: {
    ...fonts.semiBold,
    fontSize: PW.text.eyebrow,
    lineHeight: PW.text.eyebrowLine,
    letterSpacing: PW.text.trackingWide,
    // Les capitales sont une décision de style, pas de traduction : les
    // chaînes restent écrites normalement dans les locales.
    textTransform: 'uppercase',
    color: PW.color.inkFaint,
    textAlign: 'center',
  },
  eyebrowPaper: { color: PW.color.paperMuted },
  eyebrowBright: { color: PW.color.ink },
  price: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: PW.space.sm,
  },
  oldPrice: {
    ...fonts.medium,
    fontSize: PW.text.h2,
    color: PW.color.inkFaint,
    textDecorationLine: 'line-through',
    fontVariant: ['tabular-nums'],
  },
  oldPricePaper: { color: PW.color.paperMuted },
  priceValue: {
    ...fonts.bold,
    fontSize: PW.text.price,
    lineHeight: PW.text.priceLine,
    letterSpacing: PW.text.tight,
    color: PW.color.ink,
    fontVariant: ['tabular-nums'],
  },
  compactPriceValue: {
    fontSize: PW.text.compactPrice,
    lineHeight: PW.text.compactPriceLine,
  },
  priceValuePaper: { color: PW.color.paperInk },
  priceUnit: {
    ...fonts.bold,
    fontSize: PW.text.unit,
    color: PW.color.inkMuted,
  },
  compactPriceUnit: { fontSize: PW.text.compactUnit },
  priceUnitPaper: { color: PW.color.paperMuted },
  legal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: PW.space.xs,
  },
  legalDot: {
    ...fonts.regular,
    fontSize: PW.text.caption,
    color: PW.color.inkFaint,
  },
  legalDotPaper: { color: PW.color.paperMuted },
})
