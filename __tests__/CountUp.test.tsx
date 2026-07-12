/**
 * @format
 */

import React from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { CountUp } from '@/shared/components/ui/CountUp'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'

const mockedReduceMotion = useReducedMotion as unknown as jest.Mock

function wrap(ui: React.ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>
}

describe('CountUp', () => {
  afterEach(() => {
    mockedReduceMotion.mockReturnValue(false)
  })

  test('shows the final value immediately when reduced motion is on', async () => {
    mockedReduceMotion.mockReturnValue(true)
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(wrap(<CountUp value={42} />))
    })
    expect(JSON.stringify(renderer!.toJSON())).toContain('42')
  })

  test('applies the format function to the displayed value', async () => {
    mockedReduceMotion.mockReturnValue(true)
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(
        wrap(<CountUp value={9} format={n => `${n} scrolls`} />),
      )
    })
    expect(JSON.stringify(renderer!.toJSON())).toContain('9 scrolls')
  })

  test('renders without crashing when motion is enabled', async () => {
    mockedReduceMotion.mockReturnValue(false)
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(wrap(<CountUp value={12} />))
    })
    expect(renderer!.toJSON()).toBeTruthy()
  })
})
