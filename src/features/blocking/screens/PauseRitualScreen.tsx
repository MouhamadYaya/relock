import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import React, { useEffect, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { AppLogo } from '@/shared/components/ui/AppLogo'
import { fonts } from '@/shared/theme/tokens/fonts'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => FW[w]

const C = {
  bg: '#08090C',
  track: '#1C1F2B',
  accent: '#A49AFE',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const RING = 236
const STROKE = 12
const R = 104
const CIRC = 2 * Math.PI * R

// Not currently wired to any route (kept for future re-use) — local param
// type instead of the app-wide param list so this file compiles standalone.
type PauseRitualParams = { appName?: string; seconds?: number }
type Props = NativeStackScreenProps<
  { PauseRitual: PauseRitualParams | undefined },
  'PauseRitual'
>

export default function PauseRitualScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets()
  const { width: winW, height: winH } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const total = route.params?.seconds ?? 30
  const appName = route.params?.appName ?? 'TikTok'

  const [remaining, setRemaining] = useState(total)
  const progress = useSharedValue(reduceMotion ? 1 : 0)

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1
      return
    }
    progress.value = withTiming(1, {
      duration: total * 1000,
      easing: Easing.linear,
    })
    return () => cancelAnimation(progress)
  }, [progress, reduceMotion, total])

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(id)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - progress.value),
  }))

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack()
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Halo ambiant — glow de marque derrière le rituel (écran signature) */}
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width={winW}
        height={winH}
      >
        <Defs>
          <RadialGradient
            id="pauseGlow"
            gradientUnits="userSpaceOnUse"
            cx={winW / 2}
            cy={winH * 0.38}
            r={260}
          >
            <Stop offset="0" stopColor="#A49AFE" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#A49AFE" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={winW} height={winH} fill="url(#pauseGlow)" />
      </Svg>

      {/* Pilule app */}
      <View style={[styles.pill, { marginTop: 44 }]}>
        <AppLogo app="tiktok" size={24} />
        <Text style={[f(600), { fontSize: 14, color: C.ink2 }]}>
          {appName} · en pause
        </Text>
      </View>

      {/* Anneau */}
      <View style={[styles.ringWrap, { marginTop: 56 }]}>
        <Svg
          width={RING}
          height={RING}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          <Circle
            cx={118}
            cy={118}
            r={R}
            fill="none"
            stroke={C.track}
            strokeWidth={STROKE}
          />
          <AnimatedCircle
            cx={118}
            cy={118}
            r={R}
            fill="none"
            stroke={C.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            animatedProps={ringProps}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text
            style={[f(800), { fontSize: 68, color: C.ink, letterSpacing: -2 }]}
          >
            {remaining}
          </Text>
          <Text style={[f(500), { fontSize: 14, color: C.ink2, marginTop: 4 }]}>
            secondes restantes
          </Text>
        </View>
      </View>

      {/* Texte */}
      <View style={{ marginTop: 52, paddingHorizontal: 32 }}>
        <Text
          style={[
            f(700),
            {
              fontSize: 25,
              color: C.ink,
              letterSpacing: -0.4,
              lineHeight: 32,
              textAlign: 'center',
            },
          ]}
        >
          Qu'est-ce que tu cherches, vraiment ?
        </Text>
        <Text
          style={[
            f(400),
            {
              fontSize: 14.5,
              color: C.ink2,
              lineHeight: 22,
              textAlign: 'center',
              marginTop: 14,
            },
          ]}
        >
          Prends une respiration. Dans quelques secondes, tu pourras décider en
          conscience.
        </Text>
      </View>

      {/* Actions */}
      <View
        style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 34) }]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={styles.primary}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M9 6l-6 6 6 6"
              fill="none"
              stroke={C.bg}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M3 12h13a5 5 0 0 1 0 10h-1"
              fill="none"
              stroke={C.bg}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={[f(700), { fontSize: 16, color: C.bg }]}>
            Revenir en arrière
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={styles.secondary}
        >
          <Text style={[f(500), { fontSize: 14, color: C.ink3 }]}>
            Ouvrir quand même
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148,152,178,0.16)',
    borderRadius: 99,
    paddingVertical: 7,
    paddingLeft: 8,
    paddingRight: 14,
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 'auto',
    width: '100%',
    paddingHorizontal: 32,
  },
  primary: {
    height: 54,
    borderRadius: 16,
    backgroundColor: C.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    shadowColor: C.accent,
    shadowOpacity: 0.55,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  secondary: {
    alignItems: 'center',
    marginTop: 18,
  },
})
