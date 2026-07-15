// Barre d'onglets FLOTTANTE (maquette « Relock Home ») : pilule frosted avec
// Accueil + Activité (icône contour + label, côte à côte ; onglet actif en
// surbrillance douce). À droite, séparé, un bouton circulaire ACCENT PLEIN
// (façon CTA) qui ouvre la création de blocage.

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Rect } from 'react-native-svg'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { fonts } from '@/shared/theme/tokens/fonts'

/** Hauteur à réserver en bas des écrans à onglets pour laisser flotter la barre. */
export const TAB_BAR_CLEARANCE = 116

const C = {
  pill: 'rgba(32,32,40,0.94)',
  pillRing: 'rgba(255,255,255,0.09)',
  activeBg: 'rgba(255,255,255,0.12)',
  accent: '#A5A1F5',
  onAccent: '#131318',
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

      {/* Bouton « + » circulaire ACCENT PLEIN */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouveau blocage"
        onPress={() => navigate(ROUTES.ADD_BLOCK)}
        style={styles.fab}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5.5v13M5.5 12h13"
            stroke={C.onAccent}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </Svg>
      </Pressable>
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
    padding: 5,
    borderWidth: 1,
    borderColor: C.pillRing,
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  tabActive: { backgroundColor: C.activeBg },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: C.accent,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
})
