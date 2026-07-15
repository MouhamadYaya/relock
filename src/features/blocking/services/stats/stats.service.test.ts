/**
 * Vérifie la CHAÎNE de stats côté JS, indépendamment du natif : étant donné un
 * journal d'événements « resisted », `syncFromDevice` DOIT incrémenter les
 * interceptions + le temps regagné dans `daily_stats`, puis acker exactement les
 * événements traités. Ça isole un éventuel bug natif (event jamais écrit) de la
 * logique de synchro : si ces tests passent, le JS est prouvé correct.
 */
import { ScreenTime } from '@/shared/native/screen-time'
import { supabase } from '@/shared/services/supabase/client'
import {
  eventDayLocal,
  MIN_SAVED_PER_RESIST,
  StatsService,
  ymd,
} from './stats.service'

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    pullEvents: jest.fn(),
    ackEvents: jest.fn().mockResolvedValue(true),
  },
}))

jest.mock('@/shared/services/supabase/client', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}))

jest.mock('@/shared/utils/normalize-error', () => ({
  normalizeError: (e: unknown) =>
    e instanceof Error ? e : new Error(String(e)),
}))

const mockPull = ScreenTime.pullEvents as jest.Mock
const mockAck = ScreenTime.ackEvents as jest.Mock
const mockGetUser = supabase.auth.getUser as unknown as jest.Mock
const mockFrom = supabase.from as unknown as jest.Mock

const resisted = (at: string) => ({ kind: 'resisted', activity: 'shield', at })

/** Câble `supabase.from('daily_stats')` : select→maybeSingle + upsert. */
function wireSupabase(existing: Record<string, number> | null) {
  const upsert = jest.fn().mockResolvedValue({ error: null })
  const maybeSingle = jest.fn().mockResolvedValue({ data: existing })
  mockFrom.mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle }) }),
    upsert,
  })
  return { upsert, maybeSingle }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
  mockAck.mockResolvedValue(true)
})

describe('eventDayLocal / ymd', () => {
  it('formate une date en jour local YYYY-MM-DD', () => {
    expect(ymd(new Date(2026, 6, 14))).toBe('2026-07-14')
  })

  it('convertit un horodatage UTC en JOUR LOCAL (pas un slice UTC)', () => {
    const at = '2026-07-14T15:00:00.000Z'
    expect(eventDayLocal(at)).toBe(ymd(new Date(at)))
  })

  it('renvoie null si absent ou invalide', () => {
    expect(eventDayLocal(undefined)).toBeNull()
    expect(eventDayLocal('pas une date')).toBeNull()
  })
})

describe('StatsService.syncFromDevice', () => {
  it('compte 1 interception + N min regagnées par « resisted »', async () => {
    const at = '2026-07-14T15:00:00.000Z'
    const day = eventDayLocal(at) as string
    const { upsert } = wireSupabase(null)
    mockPull.mockResolvedValue([
      resisted(at),
      resisted(at),
      { kind: 'window_start', activity: 'timed.x', at }, // ignoré (pas resisted)
      resisted(at),
    ])

    await StatsService.syncFromDevice()

    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert.mock.calls[0][0]).toMatchObject({
      user_id: 'u1',
      date: day,
      interceptions_count: 3,
      opens_stopped: 3,
      time_saved_minutes: 3 * MIN_SAVED_PER_RESIST,
      streak_respected: true,
    })
    // pull-ack : purge les 4 events du jour (3 resisted + 1 window_start)
    expect(mockAck).toHaveBeenCalledWith(4)
  })

  it('CUMULE sur la valeur existante (read-modify-write)', async () => {
    const at = '2026-07-14T15:00:00.000Z'
    const { upsert } = wireSupabase({
      interceptions_count: 2,
      opens_stopped: 2,
      time_saved_minutes: 10,
    })
    mockPull.mockResolvedValue([resisted(at)])

    await StatsService.syncFromDevice()

    expect(upsert.mock.calls[0][0]).toMatchObject({
      interceptions_count: 3, // 2 + 1
      time_saved_minutes: 10 + MIN_SAVED_PER_RESIST,
    })
  })

  it('sépare les jours : un upsert + un ack ciblé par jour', async () => {
    const d1 = '2026-07-13T15:00:00.000Z'
    const d2 = '2026-07-14T15:00:00.000Z'
    const { upsert } = wireSupabase(null)
    mockPull.mockResolvedValue([resisted(d1), resisted(d2), resisted(d2)])

    await StatsService.syncFromDevice()

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(mockAck).toHaveBeenNthCalledWith(1, 1) // jour 1 : 1 event
    expect(mockAck).toHaveBeenNthCalledWith(2, 2) // jour 2 : 2 events
  })

  it('SANS session : ne lit ni ne purge le journal (zéro perte)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await StatsService.syncFromDevice()
    expect(mockPull).not.toHaveBeenCalled()
    expect(mockAck).not.toHaveBeenCalled()
  })

  it('journal vide : aucun upsert, aucun ack', async () => {
    const { upsert } = wireSupabase(null)
    mockPull.mockResolvedValue([])
    await StatsService.syncFromDevice()
    expect(upsert).not.toHaveBeenCalled()
    expect(mockAck).not.toHaveBeenCalled()
  })
})
