import { formatReprieveRemaining } from '@/features/blocking/components/ReblockAppSheet'
import {
  clampUnlockMinutes,
  UNLOCK_MAX_MINUTES,
  UNLOCK_MIN_MINUTES,
  unlockMinutesForPickerOffset,
} from '@/features/blocking/components/UnlockDurationSheet'
import { mergeBlockedApps } from '@/features/blocking/hooks/useBlockedApps'

describe('individual app unlock flow', () => {
  it('keeps native app identity linked to every active rule', () => {
    expect(
      mergeBlockedApps(['app-a', 'app-b'], { 'app-b': 2_000 }, [
        { ruleId: 'focus', keys: ['app-a', 'app-b'] },
        { ruleId: 'evening', keys: ['app-b'] },
      ]),
    ).toEqual([
      {
        key: 'app-a',
        unlocked: false,
        reprievedUntil: undefined,
        ruleIds: ['focus'],
      },
      {
        key: 'app-b',
        unlocked: true,
        reprievedUntil: 2_000,
        ruleIds: ['focus', 'evening'],
      },
    ])
  })

  it('enforces the 5 to 30 minute product boundary', () => {
    expect(clampUnlockMinutes(1)).toBe(UNLOCK_MIN_MINUTES)
    expect(clampUnlockMinutes(18)).toBe(18)
    expect(clampUnlockMinutes(90)).toBe(UNLOCK_MAX_MINUTES)
    expect(UNLOCK_MAX_MINUTES).toBe(30)
  })

  it('maps the custom wheel from 5 through 30 minutes only', () => {
    expect(unlockMinutesForPickerOffset(0)).toBe(5)
    expect(unlockMinutesForPickerOffset(13 * 48)).toBe(18)
    expect(unlockMinutesForPickerOffset(25 * 48)).toBe(30)
    expect(unlockMinutesForPickerOffset(99 * 48)).toBe(30)
    expect(unlockMinutesForPickerOffset(-48)).toBe(5)
  })

  it('formats the live reblock countdown without going below zero', () => {
    expect(formatReprieveRemaining(1_030, 1_000_000)).toBe('0:30')
    expect(formatReprieveRemaining(1_125, 1_000_000)).toBe('2:05')
    expect(formatReprieveRemaining(900, 1_000_000)).toBe('0:00')
  })
})
