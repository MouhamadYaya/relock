/**
 * Valide le reconciler de notifications : bon déclenchement selon l'état + les
 * préférences, aucun doublon, et annulation systématique avant replanification.
 */
jest.mock('@/shared/native/notifications', () => ({
  __esModule: true,
  isNotifAvailable: true,
  Notif: {
    isAvailable: true,
    schedule: jest.fn().mockResolvedValue(true),
    cancelWithPrefix: jest.fn().mockResolvedValue(true),
    setCelebrationsEnabled: jest.fn().mockResolvedValue(true),
    requestPermission: jest.fn().mockResolvedValue('granted'),
    permissionStatus: jest.fn().mockResolvedValue('granted'),
  },
}))
jest.mock('@/features/notifications/prefs', () => ({
  getNotifPrefs: jest.fn(),
}))

import { getNotifPrefs } from '@/features/notifications/prefs'
import { NotificationService } from '@/features/notifications/notification.service'
import { Notif } from '@/shared/native/notifications'

const mockPrefs = getNotifPrefs as jest.Mock
const schedule = Notif.schedule as jest.Mock
const scheduledIds = (): string[] => schedule.mock.calls.map(c => c[0] as string)

beforeAll(() => {
  jest.useFakeTimers()
  // Lundi 13 juillet 2026, 9h00 (matin → 20h30 est dans le futur, déterministe).
  jest.setSystemTime(new Date('2026-07-13T09:00:00'))
})
afterAll(() => jest.useRealTimers())
beforeEach(() => jest.clearAllMocks())

test('interrupteur maître OFF → rien planifié, célébrations coupées', async () => {
  mockPrefs.mockReturnValue({ master: false, reminders: true, progression: true })
  await NotificationService.reconcile({ streak: 5, protectedToday: false })
  expect(Notif.cancelWithPrefix).toHaveBeenCalledWith('relock.sched.')
  expect(Notif.setCelebrationsEnabled).toHaveBeenCalledWith(false)
  expect(schedule).not.toHaveBeenCalled()
})

test('série en jeu et non protégé → rappel « série en danger » + win-back', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: true, progression: false })
  await NotificationService.reconcile({ streak: 5, protectedToday: false })
  expect(scheduledIds()).toContain('relock.sched.streakRisk')
  expect(scheduledIds()).toContain('relock.sched.winback')
  expect(scheduledIds()).not.toContain('relock.sched.weekly')
})

test('déjà protégé aujourd’hui → PAS de rappel série', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: true, progression: false })
  await NotificationService.reconcile({ streak: 5, protectedToday: true })
  expect(scheduledIds()).not.toContain('relock.sched.streakRisk')
})

test('aucune série → pas de rappel série (mais win-back oui)', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: true, progression: false })
  await NotificationService.reconcile({ streak: 0, protectedToday: false })
  expect(scheduledIds()).not.toContain('relock.sched.streakRisk')
  expect(scheduledIds()).toContain('relock.sched.winback')
})

test('catégorie Rappels OFF → ni rappel série ni win-back', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: false, progression: true })
  await NotificationService.reconcile({ streak: 5, protectedToday: false })
  expect(scheduledIds()).not.toContain('relock.sched.streakRisk')
  expect(scheduledIds()).not.toContain('relock.sched.winback')
})

test('catégorie Progression ON → bilan hebdo + célébrations activées', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: false, progression: true })
  await NotificationService.reconcile({ streak: 0, protectedToday: false })
  expect(Notif.setCelebrationsEnabled).toHaveBeenCalledWith(true)
  expect(scheduledIds()).toContain('relock.sched.weekly')
})

test('annulation AVANT replanification (ardoise propre à chaque fois)', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: true, progression: true })
  await NotificationService.reconcile({ streak: 3, protectedToday: false })
  expect(Notif.cancelWithPrefix).toHaveBeenCalledWith('relock.sched.')
})

test('aucun doublon : chaque identifiant planifié est unique', async () => {
  mockPrefs.mockReturnValue({ master: true, reminders: true, progression: true })
  await NotificationService.reconcile({ streak: 3, protectedToday: false })
  const ids = scheduledIds()
  expect(new Set(ids).size).toBe(ids.length)
})
