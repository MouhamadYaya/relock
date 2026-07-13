// Barre d'onglets FLOTTANTE (réf. concurrent) :
// pilule « frosted » translucide qui flotte PAR-DESSUS le contenu (aucune bande
// de fond opaque). Accueil + Activité (icône + label), l'onglet actif surélevé
// et en accent, les inactifs en blanc. À droite, nettement séparé, un bouton
// circulaire « glassy » clair « + » qui ouvre l'écran Ajout.

import { IconName } from '@assets/icons'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { navigate } from '@/navigation/helpers/navigation-helpers'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'

/** Hauteur à réserver en bas des écrans à onglets pour laisser flotter la barre. */
export const TAB_BAR_CLEARANCE = 118

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
  // Bouton circulaire « + » détaché : fond sombre transparent (comme la
  // pilule) avec un « + » blanc bien visible façon CTA.
  fab: 'rgba(38,41,54,0.92)',
  fabBorder: 'rgba(255,255,255,0.14)',
  fabIcon: '#FFFFFF',
}

const TAB_META: Record<string, { icon: IconName; label: string }> = {
  [ROUTES.TAB_HOME]: { icon: IconName.HOME, label: 'Accueil' },
  [ROUTES.TAB_ACTIVITY]: { icon: IconName.CHART, label: 'Activité' },
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
          const meta = TAB_META[route.name] ?? {
            icon: IconName.HOME,
            label: route.name,
          }
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
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={[styles.tab, isFocused && styles.tabActive]}
            >
              <IconSvg
                name={meta.icon}
                size={23}
                color={isFocused ? C.accent : C.inactive}
              />
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? C.accent : C.inactive },
                ]}
              >
                {meta.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Bouton « + » circulaire détaché */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nouveau blocage"
        onPress={() => navigate(ROUTES.ADD_BLOCK)}
        style={styles.fab}
      >
        <IconSvg name={IconName.PLUS} size={30} color={C.fabIcon} />
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
    gap: 30,
    paddingTop: 10,
    backgroundColor: 'transparent',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: C.pillBorder,
    borderRadius: 30,
    padding: 6,
    // Ombre douce → effet flottant.
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tab: {
    minWidth: 92,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabActive: {
    backgroundColor: C.selected,
    borderWidth: 1,
    borderColor: C.selectedBorder,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  label: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: -0.1,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.fab,
    borderWidth: 1,
    borderColor: C.fabBorder,
    alignItems: 'center',
    justifyContent: 'center',
    // Ombre douce (flottant) + léger halo lavande pour ressortir comme un CTA.
    shadowColor: C.accent,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
})
