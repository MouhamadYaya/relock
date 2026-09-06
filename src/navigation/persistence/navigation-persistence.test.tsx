/**
 * Régression : `usePersistLastPath` doit persister le chemin courant dès que
 * `useRestoreLastPath` a tranché (Linking.getInitialURL réglé), même quand
 * le pathname n'a jamais changé — sinon rien n'est jamais écrit tant que
 * l'utilisateur n'a pas navigué une première fois.
 */
import React from 'react'
import { Linking } from 'react-native'
import { act, create } from 'react-test-renderer'
import { constants } from '@/config/constants'
import { router } from 'expo-router'
import { navigationStorage } from '@/shared/services/storage/mmkv'
import {
  _resetExternalEntryForTests,
  claimExternalEntry,
  usePersistLastPath,
  useRestoreLastPath,
} from './navigation-persistence'

const KEY = constants.NAVIGATION_STATE_V1

let mockPathname = '/blocks'

jest.mock('expo-router', () => ({
  router: { replace: jest.fn() },
  usePathname: () => mockPathname,
}))

function TestHarness({ enabled }: { enabled: boolean }) {
  usePersistLastPath()
  useRestoreLastPath(enabled)
  return null
}

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('usePersistLastPath / useRestoreLastPath', () => {
  beforeEach(() => {
    mockPathname = '/blocks'
    navigationStorage.delete(KEY)
    _resetExternalEntryForTests()
    ;(router.replace as jest.Mock).mockClear()
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null)
  })

  it('persists the current pathname once restoration settles, even if it never changed', async () => {
    expect(navigationStorage.getString(KEY)).toBeNull()

    await act(async () => {
      create(<TestHarness enabled />)
    })
    await flush()

    expect(navigationStorage.getString(KEY)).toBe('/blocks')
  })

  // Le mur système ouvre Relock SANS deep link : sans cette règle, la
  // restauration du dernier onglet écrasait la destination demandée par le
  // mur, et la demande — consommée côté natif — était perdue pour de bon.
  it('ne restaure rien quand une entrée externe revendique la navigation', async () => {
    navigationStorage.setString(KEY, '/home')
    claimExternalEntry(Promise.resolve(true))

    await act(async () => {
      create(<TestHarness enabled />)
    })
    await flush()

    expect(router.replace).not.toHaveBeenCalled()
  })

  it('restaure normalement quand l’entrée externe n’a rien à ouvrir', async () => {
    // `usePersistLastPath` réécrit le chemin courant dès que la restauration a
    // tranché une première fois (état de module, partagé entre les cas) : on
    // fait donc coïncider chemin courant et chemin stocké, sinon c'est la
    // persistance — pas la restauration — que ce test observerait.
    mockPathname = '/home'
    navigationStorage.setString(KEY, '/home')
    claimExternalEntry(Promise.resolve(false))

    await act(async () => {
      create(<TestHarness enabled />)
    })
    await flush()

    expect(router.replace).toHaveBeenCalledWith('/home')
  })

  it('does not persist a modal route that cannot be restored without params', async () => {
    mockPathname = '/preset-recap'

    await act(async () => {
      create(<TestHarness enabled />)
    })
    await flush()

    expect(navigationStorage.getString(KEY)).toBeNull()
  })
})
