import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { HOLD_MS } from '@/features/blocking/components/HoldToConfirmButton'
import { ResumeRuleSheet } from '@/features/blocking/components/ResumeRuleSheet'
import { deriveSession, type RuleSession } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { haptics } from '@/shared/utils/platform/haptics'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

// La grille d'icônes interroge le natif : hors de propos ici, et absent.
jest.mock('@/features/blocking/components/RuleAppIcons', () => ({
  RuleAppIcons: () => null,
}))

const NOW = new Date('2026-09-07T21:00:00')

function pausedSchedule(config: Record<string, unknown> = {}): RuleSession {
  const rule: BlockRuleView = {
    id: 'rule-1',
    type: 'schedule',
    appIds: [],
    isActive: false,
    count: 3,
    config: {
      name: 'Sommeil profond',
      start_hour: 22,
      start_minute: 0,
      end_hour: 6,
      end_minute: 0,
      ...config,
    },
    createdAt: NOW.toISOString(),
  }
  return deriveSession(rule, NOW)
}

const holdable = (renderer: ReactTestRenderer | undefined, testID: string) =>
  renderer?.root
    .findAllByProps({ testID })
    .find(node => typeof node.props.onPressIn === 'function')

const pressable = (renderer: ReactTestRenderer | undefined, testID: string) =>
  renderer?.root
    .findAllByProps({ testID })
    .find(node => typeof node.props.onPress === 'function')

describe('ResumeRuleSheet', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(haptics, 'rumble').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  const render = (session: RuleSession) => {
    const onConfirm = jest.fn()
    const onCancel = jest.fn()
    act(() => {
      renderer = create(
        <ResumeRuleSheet
          visible
          session={session}
          status="Reprend dans 2 h"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />,
      )
    })
    return { onConfirm, onCancel }
  }

  const texts = () =>
    renderer?.root
      .findAllByType('Text' as never)
      .map(node => String(node.props.children))
      .join('|') ?? ''

  it('récapitule ce qui va reprendre : apps, type, créneau et état', () => {
    render(pausedSchedule())

    const joined = texts()
    expect(joined).toContain('Sommeil profond')
    expect(joined).toContain('blocking.resume_sheet.apps_plural:3')
    expect(joined).toContain('blocking.rule_types.schedule')
    // Le créneau ET les jours : « pendant quoi » n'est pas qu'une heure.
    expect(joined).toContain('22:00 → 06:00')
    expect(joined).toContain('Tous les jours')
    expect(joined).toContain('Reprend dans 2 h')
  })

  it('annonce le mode strict quand la règle qui reprend en porte un', () => {
    render(pausedSchedule({ strict: true }))
    expect(texts()).toContain('blocking.resume_sheet.strict_on')
  })

  it('reste muet sur le strict quand la règle est souple', () => {
    render(pausedSchedule())
    expect(texts()).not.toContain('blocking.resume_sheet.strict_on')
  })

  it('accorde le singulier à une règle qui ne couvre qu’une app', () => {
    const session = pausedSchedule()
    render({ ...session, rule: { ...session.rule, count: 1 } })
    expect(texts()).toContain('blocking.resume_sheet.apps_single:1')
  })

  it('ne rétablit la protection qu’après un maintien complet', () => {
    const { onConfirm } = render(pausedSchedule())

    act(() => holdable(renderer, 'resume-rule-confirm')?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS - 50)
    })
    expect(onConfirm).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('abandonne la reprise si le doigt part en cours de route', () => {
    const { onConfirm } = render(pausedSchedule())

    act(() => holdable(renderer, 'resume-rule-confirm')?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS / 2)
    })
    act(() => holdable(renderer, 'resume-rule-confirm')?.props.onPressOut())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS)
    })

    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('laisse la règle en pause quand on refuse', () => {
    const { onConfirm, onCancel } = render(pausedSchedule())

    act(() => pressable(renderer, 'resume-rule-cancel')?.props.onPress())
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
