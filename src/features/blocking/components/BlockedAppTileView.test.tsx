import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  BLOCKED_APP_SLOT_HEIGHT,
  BlockedAppTileView,
  reprieveCountdownParts,
} from '@/features/blocking/components/BlockedAppTileView'
import { relockMaterial } from '@/shared/theme'
import { spacing } from '@/shared/theme/tokens/spacing'

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

// Mini-i18next : les gabarits doivent rester identiques à ceux des locales,
// sinon le test validerait un format qui n'existe nulle part dans l'app.
jest.mock('@/i18n/useT', () => {
  const dictionary: Record<string, string> = {
    'blocking.reblock_app.countdown_hours_minutes': '{{hours}}h {{minutes}}m',
    'blocking.reblock_app.countdown_minutes_seconds':
      '{{minutes}}m {{seconds}}s',
    'blocking.reblock_app.countdown_seconds': '{{seconds}}s',
  }
  return {
    useT: () => (key: string, vars?: Record<string, string | number>) =>
      (dictionary[key] ?? key).replace(
        /{{(\w+)}}/g,
        (_match: string, name: string) => String(vars?.[name] ?? ''),
      ),
  }
})

describe('BlockedAppTileView lock state', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('reserves the full tile, gap and caption height for parent rails', () => {
    expect(BLOCKED_APP_SLOT_HEIGHT).toBe(
      relockMaterial.layout.blockingLockedTileSize +
        spacing.xs +
        relockMaterial.typography.blockingCompactTitleLineHeight +
        spacing.micro,
    )
  })

  it('shows the closed lock treatment for a blocked app', () => {
    const onPress = jest.fn()
    act(() => {
      renderer = create(
        <BlockedAppTileView
          tokenKey="blocked-app"
          unlocked={false}
          label="Débloquer"
          onPress={onPress}
        />,
      )
    })

    expect(
      renderer?.root.findByProps({ testID: 'blocked-app-lock-closed' }),
    ).toBeTruthy()
    expect(
      renderer?.root.findAllByProps({ testID: 'blocked-app-lock-open' }),
    ).toHaveLength(0)
    expect(
      renderer?.root.findByProps({ testID: 'blocked-app-lock-overlay' }).props
        .style.backgroundColor,
    ).toBeUndefined()

    // Le cadenas n'a pas de pastille : son liseré sombre puis sa forme claire
    // restent lisibles quelle que soit la luminosité de l'icône placée dessous.
    expect(
      renderer?.root.findByProps({
        testID: 'blocked-app-lock-contrast-stroke',
      }).props.stroke,
    ).toBe(relockMaterial.colors.blockingAppMarkContrast)
    expect(
      renderer?.root.findByProps({
        testID: 'blocked-app-lock-contrast-body',
      }).props.fill,
    ).toBe(relockMaterial.colors.blockingAppMarkContrast)
    expect(
      renderer?.root.findAllByProps({
        stroke: relockMaterial.colors.blockingLockedAppMark,
      }),
    ).not.toHaveLength(0)

    const action = renderer?.root.findByProps({
      accessibilityLabel: 'Débloquer',
    })
    act(() => action?.props.onPress())
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows only an open lock over the unlocked app, without a badge', () => {
    act(() => {
      renderer = create(
        <BlockedAppTileView
          tokenKey="unlocked-app"
          unlocked
          label="Rebloquer"
          onPress={jest.fn()}
        />,
      )
    })

    expect(
      renderer?.root.findByProps({ testID: 'blocked-app-lock-open' }),
    ).toBeTruthy()
    expect(
      renderer?.root.findAllByProps({ testID: 'blocked-app-lock-closed' }),
    ).toHaveLength(0)
    expect(
      renderer?.root.findByProps({ testID: 'blocked-app-lock-overlay' }).props
        .style.backgroundColor,
    ).toBeUndefined()
    expect(
      renderer?.root.findByProps({
        testID: 'blocked-app-lock-contrast-stroke',
      }).props.stroke,
    ).toBe(relockMaterial.colors.blockingAppMarkContrast)
    expect(
      renderer?.root.findByProps({
        testID: 'blocked-app-lock-contrast-stroke',
      }).props.d,
    ).toBe('M22 16v-5a6 6 0 0 0-11.75-1.72')

    expect(
      renderer?.root.findAllByProps({
        stroke: relockMaterial.colors.blockingUnlockedAppMark,
      }),
    ).not.toHaveLength(0)
    expect(
      renderer?.root.findAllByProps({
        stroke: relockMaterial.colors.blockingLockedAppMark,
      }),
    ).toHaveLength(0)
  })

  it('counts down to the automatic reblock instead of labelling the action', () => {
    jest.useFakeTimers()
    const now = Date.now()
    try {
      act(() => {
        renderer = create(
          <BlockedAppTileView
            tokenKey="unlocked-app"
            unlocked
            label="Rebloquer"
            reprievedUntil={now / 1000 + 89}
            onPress={jest.fn()}
          />,
        )
      })

      const caption = () =>
        renderer?.root.findByProps({ numberOfLines: 1 }).props.children
      expect(caption()).toBe('1m 29s')

      act(() => {
        jest.advanceTimersByTime(60_000)
      })
      expect(caption()).toBe('29s')

      // L'action reste atteignable : seul le texte visible a changé.
      expect(
        renderer?.root.findByProps({ accessibilityLabel: 'Rebloquer' }),
      ).toBeTruthy()
    } finally {
      jest.useRealTimers()
    }
  })

  it('keeps the action label when no reprieve deadline is known', () => {
    act(() => {
      renderer = create(
        <BlockedAppTileView
          tokenKey="unlocked-app"
          unlocked
          label="Rebloquer"
          onPress={jest.fn()}
        />,
      )
    })

    expect(
      renderer?.root.findByProps({ numberOfLines: 1 }).props.children,
    ).toBe('Rebloquer')
  })
})

describe('reprieveCountdownParts', () => {
  it('splits the remaining reprieve into hours, minutes and seconds', () => {
    const now = Date.now()
    expect(reprieveCountdownParts(now / 1000 + 89, now)).toEqual({
      hours: 0,
      minutes: 1,
      seconds: 29,
    })
    expect(reprieveCountdownParts(now / 1000 + 3_930, now)).toEqual({
      hours: 1,
      minutes: 5,
      seconds: 30,
    })
  })

  it('never goes negative once the reprieve has expired', () => {
    const now = Date.now()
    expect(reprieveCountdownParts(now / 1000 - 42, now)).toEqual({
      hours: 0,
      minutes: 0,
      seconds: 0,
    })
  })
})
