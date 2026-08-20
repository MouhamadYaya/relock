// Barre d'onglets FLOTTANTE, façon Apple : capsule frosted, trois onglets
// (Accueil · Bloquer · Activité), icône PLEINE au-dessus du texte.
//
// Plus de bouton « + » ici : la création vit désormais en haut à droite de
// l'onglet Blocages, à côté de ce qu'elle produit.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'
import { ROUTES } from '@/navigation/routes'
import { fonts } from '@/shared/theme/tokens/fonts'

/** Hauteur à réserver en bas des écrans à onglets pour laisser flotter la barre. */
export const TAB_BAR_CLEARANCE = 116

const C = {
  pill: 'rgba(32,32,40,0.94)',
  pillRing: 'rgba(255,255,255,0.09)',
  activeInk: '#F5F5F7',
  inactiveInk: 'rgba(235,235,245,0.45)',
  // Bulle « verre » : un fond à peine laiteux et un liseré clair — c'est le
  // liseré qui fait la lentille, pas l'opacité du fond.
  glass: 'rgba(255,255,255,0.13)',
  glassRing: 'rgba(255,255,255,0.22)',
}

/** Largeur d'un onglet : fixe, sinon la bulle ne peut pas savoir où glisser. */
const TAB_W = 104
const PILL_PAD = 5

/**
 * Ressort de la bulle. Sur-amorti (aucun rebond) et vif : c'est le réglage
 * Apple — le mouvement doit se terminer net, pas osciller. Un rebond fait jouet.
 */
const TRAVEL = { damping: 26, stiffness: 230, mass: 0.75 }

/** Icônes PLEINES : à cette taille, un contour se lit comme un dessin, pas
 *  comme un symbole. Apple ne remplit pas par style — c'est plus lisible. */
function TabGlyph({ route, color }: { route: string; color: string }) {
  if (route === ROUTES.TAB_ACTIVITY) {
    return (
      <Svg width={23} height={23} viewBox="0 0 20 20">
        <Rect x={3.6} y={10.4} width={2.9} height={6} rx={1.45} fill={color} />
        <Rect
          x={8.55}
          y={4.6}
          width={2.9}
          height={11.8}
          rx={1.45}
          fill={color}
        />
        <Rect
          x={13.5}
          y={7.8}
          width={2.9}
          height={8.6}
          rx={1.45}
          fill={color}
        />
      </Svg>
    )
  }
  if (route === ROUTES.TAB_BLOCKS) {
    // Main levée : le geste d'arrêter. Un bouclier disait « je suis protégé » —
    // passif ; la main dit « stop », et c'est l'utilisateur qui la lève.
    return (
      <Svg width={23} height={23} viewBox="0 0 20 20">
        {/* Pouce, à part : c'est lui qui fait lire « main » plutôt que
            « peigne ». */}
        <Rect
          x={3.5}
          y={9.1}
          width={2}
          height={5.2}
          rx={1}
          fill={color}
          transform="rotate(-30 4.5 11.7)"
        />
        <Rect
          x={6.3}
          y={7.7}
          width={2.05}
          height={5.6}
          rx={1.02}
          fill={color}
        />
        <Rect
          x={8.5}
          y={3.9}
          width={2.05}
          height={9.4}
          rx={1.02}
          fill={color}
        />
        <Rect
          x={10.7}
          y={3.5}
          width={2.05}
          height={9.8}
          rx={1.02}
          fill={color}
        />
        <Rect
          x={12.9}
          y={4.9}
          width={2.05}
          height={8.4}
          rx={1.02}
          fill={color}
        />
        {/* Paume : le bas est arrondi, la main n'est pas une boîte. */}
        <Path
          d="M6.3 10.6h8.65v2.6a4.32 4.32 0 0 1-8.65 0v-2.6Z"
          fill={color}
        />
      </Svg>
    )
  }
  return (
    <Svg width={23} height={23} viewBox="0 0 20 20">
      <Path
        d="M9.3 3.1a1.1 1.1 0 0 1 1.4 0l5.5 4.66c.25.21.4.53.4.86v6.53a1.6 1.6 0 0 1-1.6 1.6h-2.9v-3.9a2.1 2.1 0 0 0-4.2 0v3.9H5a1.6 1.6 0 0 1-1.6-1.6V8.62c0-.33.15-.65.4-.86L9.3 3.1Z"
        fill={color}
      />
    </Svg>
  )
}

const TAB_META: Record<string, { label: string }> = {
  [ROUTES.TAB_HOME]: { label: 'Accueil' },
  [ROUTES.TAB_BLOCKS]: { label: 'Bloquer' },
  [ROUTES.TAB_ACTIVITY]: { label: 'Activité' },
}

/** Un onglet : l'icône enfle légèrement à la sélection, en même temps que la
 *  bulle arrive — les deux mouvements doivent être un seul geste. */
function TabItem({
  route,
  focused,
  onPress,
}: {
  route: string
  focused: boolean
  onPress: () => void
}) {
  const k = useSharedValue(focused ? 1 : 0)
  useEffect(() => {
    k.value = withSpring(focused ? 1 : 0, TRAVEL)
  }, [focused, k])
  const pop = useAnimatedStyle(() => ({
    transform: [{ scale: 0.94 + k.value * 0.06 }],
  }))

  const label = TAB_META[route]?.label ?? route
  const color = focused ? C.activeInk : C.inactiveInk
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={pop}>
        <TabGlyph route={route} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  )
}

export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // La bulle GLISSE d'un onglet à l'autre au lieu d'apparaître sous le doigt :
  // le mouvement raconte d'où l'on vient, un fond qui change ne dit rien.
  const target = useSharedValue(state.index * TAB_W)
  const x = useSharedValue(state.index * TAB_W)
  useEffect(() => {
    target.value = state.index * TAB_W
    x.value = withSpring(state.index * TAB_W, TRAVEL)
  }, [state.index, x, target])

  // Étirement : la bulle s'allonge d'autant qu'il lui reste de chemin, et
  // reprend sa forme en arrivant. C'est ce retard de la matière sur le geste
  // qui fait « verre liquide » — sans lui, un rectangle se téléporte.
  const stretch = useDerivedValue(() => {
    const gap = Math.abs(target.value - x.value) / TAB_W
    return 1 + Math.min(gap, 1) * 0.14
  })
  const bubble = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scaleX: stretch.value }],
  }))

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 16) }]}
    >
      <View style={styles.pill}>
        <Animated.View pointerEvents="none" style={[styles.bubble, bubble]} />
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          return (
            <TabItem
              key={route.key}
              route={route.name}
              focused={isFocused}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                })
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name)
                }
              }}
            />
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.pill,
    borderRadius: 999,
    padding: PILL_PAD,
    borderWidth: 1,
    borderColor: C.pillRing,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tab: {
    width: TAB_W,
    alignItems: 'center',
    gap: 2,
    paddingTop: 7,
    paddingBottom: 6,
    borderRadius: 999,
  },
  bubble: {
    position: 'absolute',
    left: PILL_PAD,
    top: PILL_PAD,
    bottom: PILL_PAD,
    width: TAB_W,
    borderRadius: 999,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassRing,
  },
  label: {
    ...fonts.semiBold,
    fontSize: 11,
  },
})
