// Barre d'onglets flottante (maquette Blocus) :
// pilule en verre avec Accueil + Activité (icônes seules) + un gros bouton "+"
// central qui ouvre l'écran Ajout. Les Réglages se font via l'engrenage des écrans.

import { IconName } from '@assets/icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'

const C = {
  bg: '#0B0C10',
  pill: '#14161E',
  border: 'rgba(148,152,178,0.16)',
  ambient: 'rgba(164,154,254,0.14)',
  accent: '#A49AFE',
  inactive: '#6B6F82',
  divider: 'rgba(148,152,178,0.16)',
}

function iconForRoute(routeName: string): IconName {
  if (routeName === ROUTES.TAB_ACTIVITY) return IconName.CHART
  return IconName.HOME
}

export function AnimatedTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 12) }]}
    >
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
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
              onPress={onPress}
              style={[styles.tab, isFocused && styles.tabActive]}
            >
              <IconSvg
                name={iconForRoute(route.name)}
                size={22}
                color={isFocused ? C.accent : C.inactive}
              />
            </Pressable>
          )
        })}

        <View style={styles.divider} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nouveau blocage"
          onPress={() => navigate(ROUTES.ADD_BLOCK)}
          style={styles.fab}
        >
          <IconSvg name={IconName.PLUS} size={22} color={C.bg} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: C.bg,
    paddingTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 26,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: C.ambient,
  },
  divider: {
    width: 1,
    height: 26,
    backgroundColor: C.divider,
    marginHorizontal: 6,
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
})
