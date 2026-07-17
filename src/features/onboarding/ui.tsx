/**
 * Design-system de l'onboarding Relock — ligne « Opal » : sombre, minimal,
 * beaucoup de vide, une idée par écran, accent lavande. Ton : tutoiement,
 * coach bienveillant. Objectif émotionnel : que l'utilisateur se sente COMPRIS.
 */
import React from 'react'
import {
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { fonts } from '@/shared/theme/tokens/fonts'

export const OB = {
  bg: '#0B0C10',
  ink: '#F5F5F7',
  ink2: 'rgba(235,235,245,0.62)',
  ink3: 'rgba(235,235,245,0.34)',
  accent: '#A49AFE',
  accentInk: '#0B0C10',
  accentDim: 'rgba(164,154,254,0.16)',
  card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.09)',
  selBorder: '#A49AFE',
  selBg: 'rgba(164,154,254,0.12)',
  danger: '#F87171',
  track: 'rgba(255,255,255,0.10)',
}

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
export const f = (w: keyof typeof FW): TextStyle => FW[w]

/** Titre d'écran — grand, gras, aligné à gauche (accroche émotionnelle). */
export function Title({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<TextStyle>
}) {
  return <Text style={[f(700), styles.title, style]}>{children}</Text>
}

/** Sous-titre / corps — calme, secondaire. */
export function Sub({
  children,
  style,
}: {
  children: React.ReactNode
  style?: StyleProp<TextStyle>
}) {
  return <Text style={[f(400), styles.sub, style]}>{children}</Text>
}

/** Barre de progression fine en haut. `value` ∈ [0,1]. */
export function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[styles.progressFill, { width: `${Math.round(value * 100)}%` }]}
      />
    </View>
  )
}

/** Bouton principal (pilule lavande) ou fantôme (texte discret). */
export function OBButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const ghost = variant === 'ghost'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        ghost ? styles.btnGhost : styles.btnPrimary,
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={[f(700), ghost ? styles.btnGhostTxt : styles.btnPrimaryTxt]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Carte de choix (sélectionnable). Icône optionnelle à gauche. */
export function ChoiceCard({
  label,
  sublabel,
  selected,
  onPress,
  left,
}: {
  label: string
  sublabel?: string
  selected: boolean
  onPress: () => void
  left?: React.ReactNode
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSel]}
    >
      {left ? <View style={styles.choiceLeft}>{left}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[f(600), styles.choiceLabel]}>{label}</Text>
        {sublabel ? (
          <Text style={[f(400), styles.choiceSub]}>{sublabel}</Text>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSel]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  )
}

/**
 * Coquille d'écran : fond sombre, progression + retour optionnels en haut,
 * contenu animé (fondu), zone de bouton en bas. `insetTop/Bottom` en points.
 */
export function Shell({
  children,
  footer,
  progress,
  onBack,
  insetTop = 60,
  insetBottom = 40,
  animKey,
}: {
  children: React.ReactNode
  footer?: React.ReactNode
  progress?: number
  onBack?: () => void
  insetTop?: number
  insetBottom?: number
  animKey?: string | number
}) {
  return (
    <View style={[styles.shell, { paddingTop: insetTop }]}>
      {(progress != null || onBack) && (
        <View style={styles.topBar}>
          {onBack ? (
            <Pressable
              accessibilityLabel="Retour"
              onPress={onBack}
              hitSlop={12}
              style={styles.backBtn}
            >
              <Text style={[f(600), { fontSize: 24, color: OB.ink2 }]}>‹</Text>
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}
          {progress != null ? <ProgressBar value={progress} /> : <View />}
        </View>
      )}

      {/* Défilable : certaines questions ont assez d'options pour dépasser
          l'écran — sans ça, le bouton du bas les recouvre. `flexGrow` garde
          les écrans-récit centrés malgré le ScrollView. */}
      <Animated.View
        key={animKey}
        entering={FadeIn.duration(360)}
        style={styles.body}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </Animated.View>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: insetBottom }]}>
          {footer}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: OB.bg, paddingHorizontal: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    height: 34,
    marginBottom: 8,
  },
  backBtn: { width: 26, height: 34, justifyContent: 'center' },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1, paddingBottom: 8 },
  footer: { paddingTop: 12, gap: 10 },
  title: { fontSize: 30, lineHeight: 37, color: OB.ink, letterSpacing: -0.6 },
  sub: {
    fontSize: 16,
    lineHeight: 24,
    color: OB.ink2,
    letterSpacing: -0.1,
    marginTop: 14,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: OB.track,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: OB.accent },
  btn: {
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnPrimary: { backgroundColor: OB.accent },
  btnPrimaryTxt: { fontSize: 17, color: OB.accentInk, letterSpacing: -0.2 },
  btnGhost: { backgroundColor: 'transparent', height: 44 },
  btnGhostTxt: { fontSize: 15, color: OB.ink3 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 18,
    backgroundColor: OB.card,
    borderWidth: 1.5,
    borderColor: OB.cardBorder,
  },
  choiceSel: { backgroundColor: OB.selBg, borderColor: OB.selBorder },
  choiceLeft: { width: 30, alignItems: 'center' },
  choiceLabel: { fontSize: 16, color: OB.ink, letterSpacing: -0.2 },
  choiceSub: { fontSize: 13, color: OB.ink2, marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: OB.ink3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSel: { borderColor: OB.accent },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: OB.accent,
  },
})
