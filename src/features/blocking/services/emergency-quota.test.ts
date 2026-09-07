import { constants } from '@/config/constants'
import {
  EMERGENCY_COOLDOWN_MS,
  emergencyAvailability,
  formatNextEmergency,
  lastEmergencyUnlockAt,
  markEmergencyUnlockUsed,
} from '@/features/blocking/services/emergency-quota'
import { kvStorage } from '@/shared/services/storage/mmkv'

const NOW = new Date('2026-09-07T12:00:00Z')
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)

describe('quota du déblocage d’urgence', () => {
  beforeEach(() => kvStorage.delete(constants.EMERGENCY_UNLOCK_AT))

  it('autorise le tout premier déblocage', () => {
    expect(lastEmergencyUnlockAt()).toBeNull()
    expect(emergencyAvailability(NOW)).toEqual({ allowed: true })
  })

  it('refuse un second déblocage dans la même semaine', () => {
    markEmergencyUnlockUsed(NOW)

    for (const elapsed of [0, 1, 6]) {
      const result = emergencyAvailability(day(elapsed))
      expect(result.allowed).toBe(false)
      // La date de réouverture se compte depuis l'USAGE, pas depuis
      // l'instant où l'on retente : réessayer ne repousse pas l'échéance.
      expect((result as { nextAt: Date }).nextAt.getTime()).toBe(
        NOW.getTime() + EMERGENCY_COOLDOWN_MS,
      )
    }
  })

  it('rouvre la porte une semaine plus tard, à la minute près', () => {
    markEmergencyUnlockUsed(NOW)
    const justBefore = new Date(NOW.getTime() + EMERGENCY_COOLDOWN_MS - 1)
    const exactly = new Date(NOW.getTime() + EMERGENCY_COOLDOWN_MS)

    expect(emergencyAvailability(justBefore).allowed).toBe(false)
    expect(emergencyAvailability(exactly).allowed).toBe(true)
    expect(emergencyAvailability(day(8)).allowed).toBe(true)
  })

  it('rouvre la porte si l’horloge a reculé', () => {
    markEmergencyUnlockUsed(NOW)
    // Entre punir quelqu'un pour un réglage d'horloge et lui accorder un
    // déblocage de trop, le second est sans conséquence.
    expect(emergencyAvailability(day(-3)).allowed).toBe(true)
  })

  it('survit à une valeur stockée illisible', () => {
    kvStorage.setString(constants.EMERGENCY_UNLOCK_AT, 'pas un nombre')
    expect(lastEmergencyUnlockAt()).toBeNull()
    expect(emergencyAvailability(NOW).allowed).toBe(true)
  })

  it('persiste l’usage entre deux lectures', () => {
    markEmergencyUnlockUsed(NOW)
    // C'est MMKV qui tranche, pas un état en mémoire : le quota doit
    // survivre à la fermeture de l'app.
    expect(lastEmergencyUnlockAt()?.getTime()).toBe(NOW.getTime())
  })

  it('formate une date lisible, avec repli', () => {
    expect(formatNextEmergency(new Date(2026, 8, 14), 'fr')).toContain('14')
    expect(formatNextEmergency(new Date(2026, 8, 14), 'xx-YY')).toContain('14')
  })
})
