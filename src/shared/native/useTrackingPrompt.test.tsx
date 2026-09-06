import React from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import { useTrackingPrompt } from '@/shared/native/useTrackingPrompt'

const mockRequest = jest.fn()
let mockAvailable = true

jest.mock('@/shared/native/tracking', () => ({
  get isTrackingPromptAvailable() {
    return mockAvailable
  },
  requestTrackingPermission: () => mockRequest(),
}))

function Harness({ enabled }: { enabled: boolean }) {
  useTrackingPrompt(enabled, { delayMs: 10 })
  return <Text>ok</Text>
}

describe('useTrackingPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockAvailable = true
    mockRequest.mockReset().mockResolvedValue('authorized')
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("demande l'autorisation une seule fois, même après un re-rendu", async () => {
    let tree: ReactTestRenderer.ReactTestRenderer | null = null
    await act(async () => {
      tree = ReactTestRenderer.create(<Harness enabled />)
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })
    expect(mockRequest).toHaveBeenCalledTimes(1)

    await act(async () => {
      tree?.update(<Harness enabled />)
      jest.advanceTimersByTime(50)
    })
    expect(mockRequest).toHaveBeenCalledTimes(1)
  })

  it('ne demande rien tant que le déclencheur est faux', async () => {
    await act(async () => {
      ReactTestRenderer.create(<Harness enabled={false} />)
    })
    await act(async () => {
      jest.advanceTimersByTime(50)
    })
    expect(mockRequest).not.toHaveBeenCalled()
  })

  it('ne demande rien si le module natif est absent', async () => {
    mockAvailable = false
    await act(async () => {
      ReactTestRenderer.create(<Harness enabled />)
    })
    await act(async () => {
      jest.advanceTimersByTime(50)
    })
    expect(mockRequest).not.toHaveBeenCalled()
  })
})
