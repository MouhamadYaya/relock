import React from 'react'
import { Modal } from 'react-native'
import { trigger } from 'react-native-haptic-feedback'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { UnlockDurationSheet } from '@/features/blocking/components/UnlockDurationSheet'
import { spacing } from '@/shared/theme/tokens/spacing'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string, values?: { count?: number }) =>
    values?.count == null ? key : `${key}:${values.count}`,
}))

jest.mock('@/features/blocking/components/BlockingCanvas', () => ({
  BlockingCanvas: () => null,
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({
  IconSvg: () => null,
}))

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('UnlockDurationSheet', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.clearAllMocks()
  })

  it('uses a full-screen picker, ticks on selection and confirms that minute', () => {
    const onPick = jest.fn()
    act(() => {
      renderer = create(
        <UnlockDurationSheet
          visible
          tokenKey="app-a"
          onCancel={jest.fn()}
          onPick={onPick}
        />,
      )
    })

    expect(
      renderer?.root.findByProps({
        children: 'blocking.unlock_app.picker_title',
      }),
    ).toBeTruthy()
    expect(renderer?.root.findByType(Modal).props.transparent).toBe(false)

    const picker = renderer?.root.findByProps({
      snapToInterval: spacing.xxxxl,
    })
    act(() =>
      picker?.props.onScroll({
        nativeEvent: { contentOffset: { y: spacing.xxxxl * 3 } },
      }),
    )
    expect(trigger).toHaveBeenCalledWith(
      'selection',
      expect.objectContaining({ enableVibrateFallback: false }),
    )

    act(() =>
      picker?.props.onScroll({
        nativeEvent: { contentOffset: { y: spacing.xxxxl * 4 } },
      }),
    )
    expect(trigger).toHaveBeenCalledTimes(2)

    const confirm = renderer?.root.findByProps({
      testID: 'unlock-duration-confirm',
    })
    expect(confirm?.props.accessibilityLabel).toBe('blocking.unlock')
    expect(confirm?.props.accessibilityHint).toBe(
      'blocking.unlock_app.minutes:9',
    )
    act(() => confirm?.props.onPress())
    expect(onPick).toHaveBeenCalledWith(9)
  })
})
