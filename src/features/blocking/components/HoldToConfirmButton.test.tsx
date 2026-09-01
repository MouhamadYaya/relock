import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  HOLD_MS,
  HoldToConfirmButton,
} from '@/features/blocking/components/HoldToConfirmButton'
import { haptics } from '@/shared/utils/platform/haptics'

describe('HoldToConfirmButton', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(haptics, 'impactHeavy').mockImplementation(() => {})
    jest.spyOn(haptics, 'impactRigid').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  const button = () =>
    renderer?.root
      .findAllByProps({ testID: 'activate-block' })
      .find(node => typeof node.props.onPressIn === 'function')

  const label = () => button()?.findByType('Text' as never).props.children

  const render = (props: Partial<{ disabled: boolean }> = {}) => {
    const onConfirm = jest.fn()
    act(() => {
      renderer = create(
        <HoldToConfirmButton
          testID="activate-block"
          idleLabel="Maintenir pour activer"
          holdingLabel="Continuer de maintenir…"
          onConfirm={onConfirm}
          {...props}
        />,
      )
    })
    return onConfirm
  }

  it('activates only after the full hold, and says so while holding', () => {
    const onConfirm = render()

    expect(label()).toBe('Maintenir pour activer')

    act(() => button()?.props.onPressIn())
    expect(label()).toBe('Continuer de maintenir…')

    act(() => {
      jest.advanceTimersByTime(HOLD_MS - 1)
    })
    expect(onConfirm).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(label()).toBe('Maintenir pour activer')
  })

  it('inverts the ink once the bright fill has passed the label', () => {
    render()
    const ink = () => button()?.findByType('Text' as never).props.style

    act(() => button()?.props.onPressIn())
    const early = JSON.stringify(ink())

    act(() => {
      jest.advanceTimersByTime(HOLD_MS * 0.6)
    })
    // Du blanc resté blanc sur un violet clair serait illisible pile au
    // moment où l'utilisateur doit lire « Continuer de maintenir… ».
    expect(JSON.stringify(ink())).not.toBe(early)
  })

  it('never fires while no app has been chosen', () => {
    const onConfirm = render({ disabled: true })

    act(() => button()?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS * 2)
    })

    expect(onConfirm).not.toHaveBeenCalled()
    expect(haptics.impactHeavy).not.toHaveBeenCalled()
  })
})
