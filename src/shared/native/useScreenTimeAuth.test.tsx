import React, { useEffect } from 'react'
import { Text } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'
import {
  type ScreenTimeAuthorizationState,
  useScreenTimeAuthorization,
} from '@/shared/native/useScreenTimeAuth'

const mockAuthorizationStatus = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => {
    const React = require('react')
    React.useEffect(callback, [callback])
  },
}))

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    authorizationStatus: (...args: unknown[]) =>
      mockAuthorizationStatus(...args),
  },
}))

type AuthorizationValue = ReturnType<typeof useScreenTimeAuthorization>

function AuthorizationHarness({
  onChange,
}: {
  onChange: (value: AuthorizationValue) => void
}) {
  const value = useScreenTimeAuthorization()
  useEffect(() => {
    onChange(value)
  }, [onChange, value])
  return <Text>{value.status}</Text>
}

describe('useScreenTimeAuthorization', () => {
  beforeEach(() => {
    mockAuthorizationStatus.mockReset()
  })

  it('ignore une ancienne vérification qui termine après la plus récente', async () => {
    let resolveFirst: (status: ScreenTimeAuthorizationState) => void = () =>
      undefined
    let resolveSecond: (status: ScreenTimeAuthorizationState) => void = () =>
      undefined
    mockAuthorizationStatus
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveFirst = resolve
        }),
      )
      .mockReturnValueOnce(
        new Promise(resolve => {
          resolveSecond = resolve
        }),
      )

    let latest: AuthorizationValue | undefined
    let renderer: ReactTestRenderer.ReactTestRenderer
    const onChange = (value: AuthorizationValue) => {
      latest = value
    }

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthorizationHarness onChange={onChange} />,
      )
    })
    expect(latest?.status).toBe('checking')

    let newestCheck: Promise<ScreenTimeAuthorizationState> | undefined
    await act(async () => {
      newestCheck = latest?.refresh()
    })

    await act(async () => {
      resolveSecond('approved')
      await newestCheck
    })
    expect(latest?.status).toBe('approved')

    await act(async () => {
      resolveFirst('denied')
      await Promise.resolve()
    })
    expect(latest?.status).toBe('approved')
    await act(async () => renderer!.unmount())
  })

  it('expose explicitement une erreur de vérification native', async () => {
    mockAuthorizationStatus.mockRejectedValueOnce(new Error('native failure'))
    let latest: AuthorizationValue | undefined

    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthorizationHarness onChange={value => (latest = value)} />,
      )
    })

    expect(latest?.status).toBe('error')
    expect(latest?.authorized).toBe(false)
    await act(async () => renderer!.unmount())
  })
})
