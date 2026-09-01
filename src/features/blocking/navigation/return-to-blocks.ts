import { router } from 'expo-router'

/**
 * Dépile les écrans du flux de création jusqu'aux onglets déjà montés.
 * `replace` créerait un second navigateur Tabs dans la pile native.
 */
export function returnToBlocks() {
  router.dismissTo('/(tabs)/blocks')
}
