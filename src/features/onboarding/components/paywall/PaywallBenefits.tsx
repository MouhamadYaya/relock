import { IconName } from '@assets/icons'
import React from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { PaywallTrustLogos } from '@/features/onboarding/components/paywall/PaywallArtwork'
import {
  PaywallButton,
  PaywallStars,
} from '@/features/onboarding/components/paywall/PaywallPrimitives'
import { PaywallUsageChart } from '@/features/onboarding/components/paywall/PaywallUsageChart'
import { PW } from '@/features/onboarding/components/paywall/paywall-theme'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

/**
 * Les trois bénéfices, chacun avec son pictogramme. Le picto remplace la
 * vignette photo de la version précédente : à 26 pt, une photo n'est plus
 * qu'une tache, alors qu'un trait lavande se lit et rattache la ligne à la
 * marque.
 */
const BENEFITS = [
  { key: 'focus', icon: IconName.FOCUS },
  { key: 'time', icon: IconName.CALENDAR },
  { key: 'presence', icon: IconName.USER },
] as const

/**
 * L'écran de conversion « Avant / Après ».
 *
 * Hiérarchie : 1. la carte de comparaison — deux semaines de Temps d'écran,
 * même échelle, 6 h 32 contre 1 h 49 — 2. la promesse « plus de 2 heures » —
 * 3. les trois bénéfices — 4. la preuve sociale et les marques — 5. le
 * bouton, seul élément fixe hors du défilement.
 *
 * Les données SONT l'argument : plus de photos ici. Deux graphes côte à côte
 * dans une seule carte disent la transformation mieux qu'un diptyque, parce
 * qu'ils la chiffrent au lieu de la mimer. Les libellés restent hors de la
 * carte, alignés sur leur colonne : c'est la colonne, pas l'étiquette, qui
 * dit « avant » et « après ».
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
          <View style={styles.heads}>
            {[false, true].map(after => (
              <View key={String(after)} style={styles.head}>
                <Text
                  style={[styles.side, compact && styles.compactHead]}
                  maxFontSizeMultiplier={1.2}
                >
                  {after
                    ? t('paywall_reference.after')
                    : t('paywall_reference.before')}
                </Text>
                <Text
                  accessibilityRole="header"
                  style={[styles.brand, compact && styles.compactHead]}
                  maxFontSizeMultiplier={1.2}
                >
                  {t('paywall_reference.brand')}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.card} testID="paywall-comparison-card">
            {[false, true].map(after => (
              <View key={String(after)} style={styles.panel}>
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
                <PaywallUsageChart after={after} compact={compact} />
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
          {BENEFITS.map(({ key, icon }) => (
            <View key={key} style={styles.benefit}>
              <IconSvg
                name={icon}
                size={
                  compact ? PW.layout.compactBenefitIcon : PW.layout.benefitIcon
                }
                color={PW.color.accent}
                style={styles.benefitIcon}
              />
              {/* Un seul paragraphe, l'amorce en gras : deux lignes séparées
                  hachaient la colonne en six blocs pour trois idées. */}
              <Text style={styles.benefitBody}>
                <Text style={styles.benefitLead}>
                  {t(`paywall_reference.benefit_${key}_title`)}
                </Text>{' '}
                {t(`paywall_reference.benefit_${key}_body`)}
              </Text>
            </View>
          ))}
        </View>

        {/* Chiffres d'avis, d'utilisateurs et marques universitaires : rien
            de tout cela n'est vérifié côté Relock, donc rien n'en sort du
            mode développement. Le jour où ces preuves seront réelles, c'est
            cette seule condition qui tombe — la mise en page, elle, est
            celle de la référence. */}
        {__DEV__ ? (
          <View style={styles.social} testID="paywall-reference-social-proof">
            <PaywallStars size={PW.layout.star + 3} />
            <Text style={styles.reviews}>{t('paywall_reference.reviews')}</Text>
            <Text style={styles.users}>{t('paywall_reference.users')}</Text>
            <PaywallTrustLogos compact={compact} />
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PaywallButton
          label={t('paywall_reference.benefits_cta')}
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
  comparison: { gap: PW.space.sm },
  heads: { flexDirection: 'row' },
  /**
   * Chaque libellé se centre sur SA colonne, pas sur le bord de page : à
   * gauche, il partait 60 pt avant le chiffre qu'il annonce. Les deux
   * panneaux de la carte étant symétriques dans leur cadre, le centre d'une
   * moitié de rangée tombe à 3 pt du centre du panneau — l'œil les lit
   * comme une seule colonne.
   */
  head: { flex: 1, alignItems: 'center' },
  /** « Avant » en léger, « Relock » en gras : deux lignes, un seul objet. */
  side: {
    ...fonts.regular,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.tight,
    color: PW.color.inkMuted,
  },
  brand: {
    ...fonts.bold,
    fontSize: PW.text.h2,
    lineHeight: PW.text.h2Line,
    letterSpacing: PW.text.tight,
    color: PW.color.ink,
  },
  compactHead: {
    fontSize: PW.text.compactH2,
    lineHeight: PW.text.compactH2Line,
  },
  /**
   * UNE carte pour les deux semaines. Deux cartes séparées se seraient lues
   * comme deux mesures indépendantes ; ici, le cadre commun dit qu'elles se
   * comparent — et le liseré haut plus clair est celui des autres surfaces
   * du paywall.
   */
  card: {
    flexDirection: 'row',
    gap: PW.layout.panelGap,
    padding: PW.layout.comparisonPad,
    borderRadius: PW.radius.lg,
    backgroundColor: PW.color.surface,
    borderWidth: PW.layout.hairline,
    borderColor: PW.color.edge,
    borderTopColor: PW.color.edgeTop,
  },
  panel: {
    flex: 1,
    gap: PW.space.xxs,
    padding: PW.layout.panelPad,
    borderRadius: PW.radius.sm,
    backgroundColor: PW.color.surfaceRaised,
  },
  daily: {
    ...fonts.regular,
    fontSize: PW.text.fine,
    lineHeight: PW.text.fineLine,
    color: PW.color.inkFaint,
  },
  figure: {
    ...fonts.bold,
    fontSize: PW.text.cardFigure,
    lineHeight: PW.text.cardFigureLine,
    letterSpacing: PW.text.tight,
    color: PW.color.ink,
    fontVariant: ['tabular-nums'],
  },
  compactFigure: {
    fontSize: PW.text.compactCardFigure,
    lineHeight: PW.text.compactCardFigureLine,
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
  benefit: { flexDirection: 'row', gap: PW.space.sm },
  /** Le picto s'aligne sur la PREMIÈRE ligne du texte, pas sur son centre. */
  benefitIcon: { marginTop: 1 },
  benefitBody: {
    ...fonts.regular,
    flex: 1,
    fontSize: PW.text.body,
    lineHeight: PW.text.bodyLine,
    color: PW.color.inkMuted,
  },
  benefitLead: { ...fonts.semiBold, color: PW.color.ink },
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
    // La rangée de marques suit : elle a besoin de respirer davantage que
    // l'interligne d'un bloc de texte.
    marginBottom: PW.space.xs,
  },
  footer: { paddingHorizontal: PW.layout.page, paddingTop: PW.space.xs },
})
