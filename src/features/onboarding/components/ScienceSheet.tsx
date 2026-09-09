import React from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { haptic } from '@/features/onboarding/tokens'
import { useT } from '@/i18n/useT'
import { fonts } from '@/shared/theme/tokens/fonts'
import { OB } from '../tokens'
import { MarkCost, MarkDelay, MarkLoop } from './ScienceMarks'

/**
 * « Soutenu par la science » — la démonstration, au toucher du badge.
 *
 * POURQUOI ELLE EXISTE
 * Le premier écran affirme qu'on récupère deux heures par jour. Une affirmation
 * pareille, posée nue, est une promesse publicitaire de plus. La feuille dit
 * ce qu'il y a derrière : trois MÉCANISMES d'attention documentés, qui
 * expliquent pourquoi retarder l'ouverture d'une app change le nombre
 * d'ouvertures.
 *
 * POURQUOI ELLE EST SI COURTE
 * Un point = un dessin, un titre, UNE phrase. Ce n'est pas un article : c'est
 * la caution du badge, lue en dix secondes par quelqu'un qui veut surtout
 * continuer. Les vignettes (`ScienceMarks`) portent l'explication que les
 * paragraphes portaient avant — c'est ce qui a permis de les couper.
 *
 * ⚠️ CE QU'ELLE NE DIT PAS, ET POURQUOI
 * Aucun pourcentage, aucun nom d'étude, aucune université. Relock n'a jamais
 * été publié : le moindre chiffre attribué à ses utilisateurs serait inventé,
 * et un blason d'université serait une affiliation imaginaire (cf.
 * `unverified-claims.test.ts`, qui garde exactement cette frontière ailleurs
 * dans le parcours). Les trois mécanismes se décrivent donc
 * QUALITATIVEMENT — c'est vrai, et ça n'a besoin d'aucune caution empruntée.
 * La dernière ligne le dit à voix haute : ces travaux portent sur l'attention
 * en général, pas sur cette app.
 *
 * Si un jour une mesure RÉELLE existe (cohorte, avant/après), elle prend la
 * place du dernier paragraphe — pas celle des mécanismes.
 */

const POINTS = [
  { id: 'friction', Mark: MarkDelay },
  { id: 'habit', Mark: MarkLoop },
  { id: 'focus', Mark: MarkCost },
] as const

export function ScienceSheet({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          testID="science-backdrop"
          style={StyleSheet.absoluteFill}
          onPressIn={() => haptic.tick()}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('onboarding_intro.science.close_a11y')}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 18) + 6 },
          ]}
        >
          <View style={styles.grip} />
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <Text accessibilityRole="header" style={styles.title}>
              {t('onboarding_intro.science.title')}
            </Text>
            <Text style={styles.lede}>
              {t('onboarding_intro.science.lede')}
            </Text>

            {POINTS.map(({ id, Mark }) => (
              <View key={id} style={styles.point}>
                <View style={styles.mark}>
                  <Mark />
                </View>
                <View style={styles.pointCopy}>
                  <Text style={styles.pointTitle}>
                    {t(`onboarding_intro.science.${id}_title`)}
                  </Text>
                  <Text style={styles.pointBody}>
                    {t(`onboarding_intro.science.${id}_body`)}
                  </Text>
                </View>
              </View>
            ))}

            <Text style={styles.caveat}>
              {t('onboarding_intro.science.caveat')}
            </Text>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            onPressIn={() => haptic.tick()}
            onPress={onClose}
            style={styles.close}
          >
            <Text style={styles.closeLabel}>
              {t('onboarding_intro.science.close')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: OB.card2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  grip: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    backgroundColor: OB.ink28,
    marginBottom: 16,
  },
  body: { paddingBottom: 18 },
  title: {
    ...fonts.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: OB.ink,
  },
  lede: {
    ...fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: OB.ink70,
    marginTop: 8,
  },
  // Une rangée par mécanisme : la vignette porte le schéma, le texte se
  // contente de le nommer. Plus de filets de séparation — les vignettes
  // rythment la liste toutes seules.
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 18,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(164,154,254,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(164,154,254,0.22)',
  },
  pointCopy: { flex: 1, gap: 3 },
  pointTitle: {
    ...fonts.semiBold,
    fontSize: 15.5,
    letterSpacing: -0.2,
    color: OB.ink,
  },
  pointBody: {
    ...fonts.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: OB.ink55,
  },
  caveat: {
    ...fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: OB.ink40,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OB.hairline,
  },
  close: {
    minHeight: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(164,154,254,0.16)',
    marginTop: 14,
  },
  closeLabel: { ...fonts.semiBold, fontSize: 16, color: OB.ink },
})
