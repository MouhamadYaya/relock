// Barre d'onglets FLOTTANTE : pilule frosted, trois onglets côte à côte
// (Accueil · Bloquer · Activité), icône au-dessus du texte, actif en
// surbrillance douce.
//
// Plus de bouton « + » ici : la création vit désormais en haut à droite de
// l'onglet Blocages, à côté de ce qu'elle produit.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { ROUTES } from '@/navigation/routes'
import { fonts } from '@/shared/theme/tokens/fonts'

/** Hauteur à réserver en bas des écrans à onglets pour laisser flotter la barre. */
export const TAB_BAR_CLEARANCE = 124

const C = {
  pill: 'rgba(32,32,40,0.94)',
  pillRing: 'rgba(255,255,255,0.09)',
  activeBg: 'rgba(255,255,255,0.12)',
  activeInk: '#F5F5F7',
  inactiveInk: 'rgba(235,235,245,0.5)',
}

/** Icônes contour (maquette), teintées selon l'état. */
function TabGlyph({ route, color }: { route: string; color: string }) {
  if (route === ROUTES.TAB_ACTIVITY) {
    return (
      <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
        <Path
          d="M4.5 16.5V11M10 16.5V5.5M15.5 16.5V8.5"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    )
  }
  if (route === ROUTES.TAB_BLOCKS) {
    // Main levée : le geste d'arrêter. Un bouclier disait « je suis protégé » —
    // passif ; la main dit « stop », et c'est l'utilisateur qui la lève.
    return (
      <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
        <Path
          d="M6.3 10.2V5.6a1.05 1.05 0 0 1 2.1 0v3.2M8.4 8.8V4.3a1.05 1.05 0 0 1 2.1 0v4.5M10.5 8.8V4.9a1.05 1.05 0 0 1 2.1 0v3.9M12.6 9.4V6.9a1.05 1.05 0 0 1 2.1 0v5.2c0 3.1-2 5.2-5 5.2s-5-1.9-5-4.8v-1.8a1.05 1.05 0 0 1 2.1 0v1.1"
          stroke={color}
          strokeWidth={1.55}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    )
  }
  return (
    <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4 9.3 10 4l6 5.3V16a1.4 1.4 0 0 1-1.4 1.4h-2.7V13a1.9 1.9 0 0 0-3.8 0v4.4H5.4A1.4 1.4 0 0 1 4 16V9.3Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const TAB_META: Record<string, { label: string }> = {
  [ROUTES.TAB_HOME]: { label: 'Accueil' },
  [ROUTES.TAB_BLOCKS]: { label: 'Bloquer' },
  [ROUTES.TAB_ACTIVITY]: { label: 'Activité' },
}

export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 16) }]}
    >
      {/* Pilule Accueil + Activité */}
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const label = TAB_META[route.name]?.label ?? route.name
          const color = isFocused ? C.activeInk : C.inactiveInk
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              style={[styles.tab, isFocused && styles.tabActive]}
            >
              <TabGlyph route={route.name} color={color} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
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
    borderRadius: 26,
    padding: 5,
    borderWidth: 1,
    borderColor: C.pillRing,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Icône au-dessus, texte en dessous : la cible est plus large à toucher, et
  // trois onglets tiennent sans se serrer sur petit écran.
  tab: {
    alignItems: 'center',
    gap: 5,
    paddingTop: 9,
    paddingBottom: 8,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  tabActive: { backgroundColor: C.activeBg },
  label: {
    ...fonts.semiBold,
    fontSize: 11.5,
  },
})
