import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { BlockingRuleCard } from '@/features/blocking/components/BlockingRuleCard'
import { ReblockAppSheet } from '@/features/blocking/components/ReblockAppSheet'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({
  IconSvg: () => null,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

describe('ReblockAppSheet', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('shows every affected rule and confirms the reblock action', () => {
    const onConfirm = jest.fn()
    act(() => {
      renderer = create(
        <ReblockAppSheet
          visible
          tokenKey="app-a"
          reprievedUntil={Date.now() / 1000 + 300}
          rules={[
            {
              id: 'focus',
              title: 'Focus',
              description: 'Blocage minuté',
              status: 'En cours',
              kind: 'session',
              apps: [],
              extraApps: 0,
              progress: 0.4,
              active: true,
              onPress: jest.fn(),
            },
            {
              id: 'sleep',
              title: 'Sommeil',
              description: '22h → 7h',
              status: 'Programmée',
              kind: 'schedule',
              apps: [],
              extraApps: 0,
              progress: null,
              active: false,
              onPress: jest.fn(),
            },
          ]}
          onCancel={jest.fn()}
          onConfirm={onConfirm}
        />,
      )
    })

    expect(renderer?.root.findByProps({ children: 'Focus' })).toBeTruthy()
    expect(renderer?.root.findByProps({ children: 'Sommeil' })).toBeTruthy()
    expect(renderer?.root.findAllByType(BlockingRuleCard)).toHaveLength(2)

    const confirm = renderer?.root.findByProps({ testID: 'reblock-confirm' })
    act(() => confirm?.props.onPress())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
