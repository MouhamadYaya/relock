import React from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, { Rect } from 'react-native-svg'
import {
  PaywallBenefitThumb,
  PaywallComparisonPhoto,
} from '@/features/onboarding/components/paywall/PaywallArtwork'
import {
  PaywallButton,
  PaywallStars,
} from '@/features/onboarding/components/paywall/PaywallPrimitives'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { useT } from '@/i18n/useT'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Hauteurs des barres, en fraction de la plus haute semaine « avant ». Les
 * deux histogrammes partagent la MÊME échelle : c'est ce qui rend la
 * comparaison honnête — l'après est court parce qu'il est court.
 */
const USAGE_BARS = {
  before: [0.68, 1, 0.88, 0.65],
  after: [0.28, 0.34, 0.3],
} as const

// Barres étroites : à 14 pt de large, les trois barres « après » (28 % de la
// hauteur, c'est la donnée) devenaient trois carrés. Plus fines, elles
// restent des barres sans qu'on ait à mentir sur le rapport.
const BAR = { width: 11, pitch: 17, radius: 2.5 } as const

const BENEFITS = ['focus', 'time', 'presence'] as const

/**
 * L'histogramme d'usage. Aplats pleins, pas de dégradé : la couleur porte le
 * jugement — gris pour la semaine subie, lavande pour la semaine reprise.
 *
 * ⚠️ Pas de `viewBox` : avec une `viewBox` et une hauteur fixe,
 * react-native-svg met le dessin à l'échelle PUIS le centre, et les barres
 * décollaient de la marge. Sans elle, les coordonnées sont des points.
 */
function UsageBars({ after, compact }: { after: boolean; compact: boolean }) {
  const ratios = after ? USAGE_BARS.after : USAGE_BARS.before
  const height = compact ? PW.layout.compactChart : PW.layout.chart

  return (
    <Svg height={height} width="100%" accessibilityElementsHidden>
      {ratios.map((ratio, index) => (
        <Rect
          key={index}
          x={index * BAR.pitch}
          y={height * (1 - ratio)}
          width={BAR.width}
          height={height * ratio}
          rx={BAR.radius}
          fill={after ? PW.color.accent : PW.color.inkFaint}
        />
      ))}
    </Svg>
  )
}

/**
 * L'écran de conversion « Avant / Après ».
 *
 * Hiérarchie : 1. le contraste chiffré 6h 32m → 1h 49m et ses histogrammes —
 * 2. la promesse « plus de 2 heures » — 3. le bouton — 4. les trois
 * bénéfices et leurs vignettes — 5. le diptyque photo et la preuve sociale.
 *
 * La page se lit en deux colonnes séparées par un filet, comme la référence :
 * c'est la colonne, pas le libellé, qui dit « avant » et « après ». Le
 * diptyque montre le MÊME homme — la nuit, seul, le visage dans l'écran, puis
 * le matin, en train de parler à quelqu'un — et le voile de l'« après » est
 * volontairement plus léger : à luminosité égale, la transformation ne se
 * démontre pas.
 */
export function PaywallBenefits({ onNext }: { onNext: () => void }) {
  const t = useT()
  const compact = useWindowDimensions().height < PW.layout.compactHeight

  return (
    <View style={styles.screen} testID="paywall-benefits">
      <ScrollView
        bounces
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
          compact && styles.compactContent,
        ]}
      >
        <View style={styles.comparison}>
          {/* Le filet central : deux zones, pas deux blocs posés côte à côte. */}
          <View style={styles.divider} pointerEvents="none" />
          <View style={styles.columns}>
            {[false, true].map(after => (
              <View key={String(after)} style={styles.column}>
                <Text
                  style={[styles.side, after && styles.sideAfter]}
                  maxFontSizeMultiplier={1.2}
                  numberOfLines={2}
                >
                  {after
                    ? t('paywall_reference.after')
                    : t('paywall_reference.before')}
                </Text>
                <View style={[styles.photo, compact && styles.compactPhoto]}>
                  <PaywallComparisonPhoto after={after} />
                </View>
                <Text style={styles.daily} maxFontSizeMultiplier={1.2}>
                  {t('paywall_reference.daily')}
                </Text>
                <Text
                  style={[styles.figure, compact && styles.compactFigure]}
                  maxFontSizeMultiplier={1.15}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {after
                    ? t('paywall_reference.after_time')
                    : t('paywall_reference.before_time')}
                </Text>
                <UsageBars after={after} compact={compact} />
              </View>
            ))}
          </View>
        </View>

        <Text
          accessibilityRole="header"
          style={[styles.title, compact && styles.compactTitle]}
          maxFontSizeMultiplier={1.2}
        >
          {t('paywall_reference.benefits_title')}{' '}
          <Text style={styles.accent}>
            {t('paywall_reference.benefits_accent')}
          </Text>
          {t('paywall_reference.benefits_end')}
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((key, index) => (
            <View key={key} style={styles.benefit}>
              <View style={[styles.thumb, compact && styles.compactThumb]}>
                <PaywallBenefitThumb index={index} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.benefitTitle}>
                  {t(`paywall_reference.benefit_${key}_title`)}
                </Text>
                <Text style={styles.benefitBody}>
                  {t(`paywall_reference.benefit_${key}_body`)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {__DEV__ ? (
          <View style={styles.social} testID="paywall-reference-social-proof">
            <PaywallStars size={PW.layout.star + 3} />
            <Text style={styles.reviews}>{t('paywall_reference.reviews')}</Text>
            <Text style={styles.users}>{t('paywall_reference.users')}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PaywallButton
          label={t('paywall_reference.continue')}
          onPress={onNext}
          compact={compact}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  // Rythme constant : une section, un intervalle. Aucun ressort, aucun grand
  // rectangle vide pour compenser un manque de hiérarchie.
  content: {
    paddingHorizontal: PW.layout.page,
    paddingTop: PW.space.xs,
    paddingBottom: PW.space.lg,
    gap: PW.space.xl,
  },
  compactContent: { gap: PW.space.md },
  comparison: { gap: PW.space.xs },
  divider: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: PW.layout.divider,
    backgroundColor: PW.color.hairline,
  },
  columns: { flexDirection: 'row', gap: PW.space.lg },
  column: { flex: 1, gap: PW.space.xxs },
  side: {
    ...fonts.bold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    letterSpacing: PW.text.tight,
    color: PW.color.inkFaint,
    marginBottom: PW.space.xxs,
  },
  sideAfter: { color: PW.color.ink },
  photo: {
    height: PW.layout.comparison,
    overflow: 'hidden',
    borderRadius: PW.radius.md,
    marginBottom: PW.space.xs,
  },
  compactPhoto: { height: PW.layout.compactComparison },
  daily: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkFaint,
  },
  figure: {
    ...fonts.bold,
    fontSize: PW.text.figure,
    lineHeight: PW.text.figureLine,
    letterSpacing: PW.text.tighter,
    color: PW.color.ink,
    fontVariant: ['tabular-nums'],
  },
  compactFigure: {
    fontSize: PW.text.compactFigure,
    lineHeight: PW.text.compactFigureLine,
  },
  /** Rang 2 : la promesse cède la vedette aux chiffres, au-dessus d'elle. */
  title: {
    ...fonts.bold,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.tight,
    color: PW.color.ink,
    textAlign: 'center',
    // Encart latéral plutôt qu'un `\n` dans les locales : la coupure tombe
    // toute seule au bon endroit dans les quatre langues, au lieu de laisser
    // « par jour » seul sur la seconde ligne.
    paddingHorizontal: PW.space.md,
  },
  compactTitle: {
    fontSize: PW.text.compactH2,
    lineHeight: PW.text.compactH2Line,
  },
  accent: { color: PW.color.accent },
  benefits: { gap: PW.space.md },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: PW.space.sm },
  /** Une vraie photo, pas un pictogramme : trois objets de la vie hors écran. */
  thumb: {
    width: PW.layout.benefitThumb,
    height: PW.layout.benefitThumb,
    borderRadius: PW.radius.sm,
    overflow: 'hidden',
    backgroundColor: PW.color.surface,
    borderWidth: PW.layout.hairline,
    borderColor: PW.color.hairline,
  },
  compactThumb: {
    width: PW.layout.compactBenefitThumb,
    height: PW.layout.compactBenefitThumb,
  },
  copy: { flex: 1, gap: 2 },
  benefitTitle: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.ink,
  },
  benefitBody: {
    ...fonts.regular,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.inkMuted,
  },
  social: { alignItems: 'center', gap: PW.space.xxs },
  reviews: {
    ...fonts.semiBold,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.ink,
  },
  users: {
    ...fonts.regular,
    fontSize: PW.text.caption,
    lineHeight: PW.text.captionLine,
    color: PW.color.inkFaint,
  },
  footer: { paddingHorizontal: PW.layout.page, paddingTop: PW.space.xs },
})
