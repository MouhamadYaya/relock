/**
 * « C'est quoi, cette règle ? » — la réponse, au toucher du « ? » d'une carte.
 *
 * L'écran des règles proposées demandait un choix sans jamais dire ce qu'on
 * choisissait : une carte « Travail · 09:00 – 17:00 » ne dit ni sur QUELLES
 * apps elle agit, ni ce qui se passe à 09:00, ni si c'est réversible. Trois
 * inconnues pour un écran qui arme un vrai blocage.
 *
 * La feuille répond aux trois, dans cet ordre, pour CETTE règle-là — pas une
 * aide générique : le créneau et les jours sortent de `presetLines`, la même
 * source que le récapitulatif de création. Une seule définition de « ce que
 * fait Travail », donc jamais deux versions qui divergent.
 *
 * Textes FR en dur, comme le reste de l'onboarding (exception i18n assumée de
 * cet espace narratif — cf. l'en-tête de `scenes-tutorial.tsx`).
 */
import { IconName } from '@assets/icons'
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
import { findPreset, presetLines } from '@/features/blocking/presets'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { OnboardingAppIcons } from './OnboardingAppIcons'
import { OB } from './tokens'

export interface RuleInfoTarget {
  presetId: string
  title: string
}

interface Props {
  /** null ⇒ feuille fermée. */
  target: RuleInfoTarget | null
  onClose: () => void
  /** Clés des apps du sélecteur, pour montrer de quoi on parle. */
  appKeys: string[]
  /** Total annoncé par le sélecteur d'Apple (apps + catégories + domaines). */
  appCount: number
}

function Section({
  icon,
  title,
  children,
}: {
  icon: IconName
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <IconSvg name={icon} size={16} color={OB.accent} strokeWidth={1.9} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

export function RuleInfoSheet({ target, onClose, appKeys, appCount }: Props) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReducedMotion()
  const preset = target ? findPreset(target.presetId) : undefined

  // `appCount` est le total du sélecteur, `appKeys` les seules apps qui ont une
  // icône : une catégorie cochée compte dans le premier, pas dans le second. On
  // parle donc du total — c'est ce que l'écran précédent a annoncé.
  const scope =
    appCount > 0
      ? `${appCount === 1 ? 'L’app' : `Les ${appCount} apps`} que tu viens de choisir. ${
          appCount === 1 ? 'La même' : 'Les mêmes'
        } pour toutes les règles de cet écran.`
      : 'Les apps que tu choisiras. Aucune règle ne bloque quoi que ce soit tant que la liste est vide.'

  return (
    <Modal
      visible={target !== null}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          testID="rule-info-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer l’explication"
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
              {target?.title}
            </Text>
            <Text style={styles.lede}>
              Une règle, c’est un moment de la journée que Relock protège pour
              toi. Celle-ci s’allume toute seule, sans que tu aies rien à faire.
            </Text>

            <Section icon={IconName.CLOCK} title="Quand">
              {(preset ? presetLines(preset) : []).map(line => (
                <View key={line.label} style={styles.line}>
                  <Text style={styles.lineLabel}>{line.label}</Text>
                  <Text style={styles.lineValue}>{line.value}</Text>
                </View>
              ))}
            </Section>

            <Section icon={IconName.LOCK} title="Sur quelles apps">
              <View style={styles.scopeRow}>
                <OnboardingAppIcons keys={appKeys} size={30} max={4} />
                <Text style={styles.paragraph}>{scope}</Text>
              </View>
            </Section>

            <Section icon={IconName.SHIELD} title="Ce qui se passe">
              <Text style={styles.paragraph}>
                Pendant ce créneau, ouvrir l’une de ces apps affiche un mur
                Relock à la place. Pour passer outre, il faut d’abord traverser
                le rituel de pause — le temps de se demander si on en avait
                vraiment envie.
              </Text>
            </Section>

            <Text style={styles.footnote}>
              Rien n’est figé : horaires, jours et apps se modifient à tout
              moment dans l’onglet Règles.
            </Text>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="J’ai compris"
            onPress={onClose}
            style={styles.cta}
          >
            <Text style={styles.ctaLabel}>J’ai compris</Text>
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
    // Plafonné : sur un petit écran, une feuille qui monte jusqu'à la status
    // bar ne se lit plus comme une explication posée par-dessus l'écran, mais
    // comme une nouvelle page — et on perd le fil du carrousel derrière.
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
  section: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OB.hairline,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    ...fonts.semiBold,
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: OB.accent,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 4,
  },
  lineLabel: {
    ...fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: OB.ink55,
  },
  lineValue: {
    ...fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    color: OB.ink,
    flexShrink: 1,
    textAlign: 'right',
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paragraph: {
    ...fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: OB.ink70,
    flexShrink: 1,
  },
  footnote: {
    ...fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: OB.ink40,
    marginTop: 20,
  },
  cta: {
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: OB.ink,
  },
  ctaLabel: {
    ...fonts.semiBold,
    fontSize: 16,
    color: OB.onAccent,
  },
})
