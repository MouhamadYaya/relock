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
import { navigationStorage } from '@/shared/services/storage/mmkv'
import {
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

  it('does not persist a modal route that cannot be restored without params', async () => {
    mockPathname = '/preset-recap'

    await act(async () => {
      create(<TestHarness enabled />)
    })
    await flush()

    expect(navigationStorage.getString(KEY)).toBeNull()
  })
})
