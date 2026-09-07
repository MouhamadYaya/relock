import { constants } from '@/config/constants'
import { emergencyUnlock } from '@/features/blocking/services/emergency-unlock'
import { resetAllData } from '@/features/blocking/services/reset.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { getSessionQueryClient } from '@/session/session-bridge'
import { offlineQueue } from '@/shared/services/api/offline/offline-queue'
import { cacheEngine } from '@/shared/services/storage/cache-engine'
import {
  getAuthToken,
  setAuthToken,
} from '@/shared/services/storage/credentials'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { supabase } from '@/shared/services/supabase/client'

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    pullEvents: jest.fn().mockResolvedValue([]),
    ackEvents: jest.fn().mockResolvedValue(true),
  },
}))

jest.mock('@/features/blocking/services/emergency-unlock', () => ({
  emergencyUnlock: jest.fn().mockResolvedValue({ removed: 1, failed: 0 }),
}))

jest.mock('@/session/session-bridge', () => ({
  getSessionQueryClient: jest.fn(),
}))

jest.mock('@/shared/services/api/offline/offline-queue', () => ({
  offlineQueue: { clear: jest.fn() },
}))

jest.mock('@/shared/services/storage/cache-engine', () => ({
  cacheEngine: { clear: jest.fn() },
}))

jest.mock('@/shared/services/supabase/client', () => {
  const deleteResult = { error: null }
  return {
    supabase: {
      auth: { getUser: jest.fn() },
      from: jest.fn(() => ({
        delete: () => ({ eq: jest.fn().mockResolvedValue(deleteResult) }),
      })),
      __deleteResult: deleteResult,
    },
  }
})

const RULES: BlockRuleView[] = [
  { id: 'a', type: 'schedule', appIds: [], isActive: true },
]

const queryClient = {
  cancelQueries: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn(),
}

describe('resetAllData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'u1' } },
    })
    ;(getSessionQueryClient as jest.Mock).mockReturnValue(queryClient)
    kvStorage.setString(constants.RQ_CACHE, 'vieilles données')
    setAuthToken('jeton')
  })

  it('libère l’iPhone avant d’effacer quoi que ce soit', async () => {
    await resetAllData(RULES)
    // Si la suite échoue, personne ne reste enfermé derrière un bouclier dont
    // les règles viennent d'être effacées.
    expect(emergencyUnlock).toHaveBeenCalledWith(RULES)
  })

  it('efface règles, événements et statistiques du compte', async () => {
    const ok = await resetAllData(RULES)
    expect(ok).toBe(true)
    const tables = (supabase.from as jest.Mock).mock.calls.map(c => c[0])
    expect(tables).toEqual(
      expect.arrayContaining(['block_events', 'daily_stats', 'block_rules']),
    )
  })

  it('vide les caches locaux qui rejoueraient l’ancien monde', async () => {
    await resetAllData(RULES)
    expect(kvStorage.getString(constants.RQ_CACHE)).toBeNull()
    expect(offlineQueue.clear).toHaveBeenCalled()
    expect(cacheEngine.clear).toHaveBeenCalled()
    expect(queryClient.clear).toHaveBeenCalled()
  })

  it('NE déconnecte PAS : la session survit à une remise à zéro', async () => {
    await resetAllData(RULES)
    // Les identifiants vivent dans le trousseau, les caches dans MMKV. La
    // remise à zéro doit viser les seconds sans emporter les premiers : un
    // ménage n'est pas une déconnexion.
    expect(getAuthToken()).toBe('jeton')
  })

  it('signale l’échec de la purge côté compte', async () => {
    ;(supabase.from as jest.Mock).mockReturnValue({
      delete: () => ({
        eq: jest.fn().mockResolvedValue({ error: { message: 'hors ligne' } }),
      }),
    })
    // L'iPhone est libéré, mais le compte n'est pas à jour : l'écran doit le
    // dire plutôt que d'annoncer un succès.
    await expect(resetAllData(RULES)).resolves.toBe(false)
  })
})
