// Barre d'onglets FLOTTANTE (réf. concurrent) :
// pilule « frosted » translucide qui flotte PAR-DESSUS le contenu (aucune bande
// de fond opaque). Accueil + Activité avec icônes PLEINES + label, l'onglet
// actif surélevé et en accent, les inactifs en blanc. À droite, nettement
// séparé, un bouton circulaire violet (accent app) « + » façon CTA.

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
  // Pilule frosted : nettement plus claire que le fond near-black.
  pill: 'rgba(38,41,54,0.92)',
  pillBorder: 'rgba(255,255,255,0.10)',
  // Segment actif surélevé, nettement plus clair.
  selected: 'rgba(255,255,255,0.13)',
  selectedBorder: 'rgba(255,255,255,0.16)',
  accent: '#A49AFE',
  // Inactif en blanc (visibilité) plutôt qu'en gris.
  inactive: '#F2F2F6',
}

/** Icônes PLEINES (premium) rendues en SVG, teintées selon l'état. */
function TabGlyph({
  route,
  color,
  size,
}: {
  route: string
  color: string
  size: number
}) {
  if (route === ROUTES.TAB_ACTIVITY) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x={3.5} y={12} width={4.4} height={8.5} rx={1.7} fill={color} />
        <Rect x={9.8} y={3.5} width={4.4} height={17} rx={1.7} fill={color} />
        <Rect x={16.1} y={8.5} width={4.4} height={12} rx={1.7} fill={color} />
      </Svg>
    )
  }
  // Accueil : maison pleine.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M11.06 2.82 3.4 8.9A2.4 2.4 0 0 0 2.5 10.8v8.05c0 .9.74 1.65 1.65 1.65H8.6a1 1 0 0 0 1-1v-4.55a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1V19.5a1 1 0 0 0 1 1h4.45c.91 0 1.65-.74 1.65-1.65V10.8a2.4 2.4 0 0 0-.9-1.88l-7.66-6.1a1.5 1.5 0 0 0-1.88 0z"
        fill={color}
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
          const color = isFocused ? C.accent : C.inactive
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
              <TabGlyph route={route.name} color={color} size={22} />
              <Text style={[styles.label, { color }]}>{label}</Text>
            </Pressable>
          )
        })}
      </View>

      {/* Bouton « + » circulaire détaché (violet accent, façon CTA) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouveau blocage"
        onPress={() => navigate(ROUTES.ADD_BLOCK)}
        style={styles.fab}
      >
        {/* « + » premium : glyphe massif à barres arrondies, en accent. */}
        <Svg width={30} height={30} viewBox="0 0 24 24">
          <Rect
            x={9.7}
            y={3.4}
            width={4.6}
            height={17.2}
            rx={2.3}
            fill={C.accent}
          />
          <Rect
            x={3.4}
            y={9.7}
            width={17.2}
            height={4.6}
            rx={2.3}
            fill={C.accent}
          />
        </Svg>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  // Flotte par-dessus le contenu : aucune bande de fond opaque.
  outer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 38,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: C.pillBorder,
    borderRadius: 28,
    padding: 5,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tab: {
    minWidth: 90,
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabActive: {
    backgroundColor: C.selected,
    borderWidth: 1,
    borderColor: C.selectedBorder,
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    // Fond frosted transparent (comme la pilule) → « + » violet qui ressort
    // sans jamais se confondre avec le contenu derrière.
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: C.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
})
