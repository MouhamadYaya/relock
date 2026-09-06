import React from 'react'
import { Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { HomeHeader } from '@/features/home/components/HomeHeader'
import { HomeMyAppsCard } from '@/features/home/components/HomeMyAppsCard'
import { HomeProgressCard } from '@/features/home/components/HomeProgressCard'
import { HomeScoreCard } from '@/features/home/components/HomeScoreCard'
import type { HomeMyAppsState } from '@/features/home/types/my-apps'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string, options?: Record<string, unknown>) =>
    `${key}${options ? JSON.stringify(options) : ''}`,
}))
jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View /> }
})
jest.mock('@/shared/native/BlockedAppIcons', () => {
  const { View } = require('react-native')
  return {
    BlockedAppIcons: ({ tokenKey }: { tokenKey: string }) => (
      <View testID={`blocked-app-${tokenKey}`} />
    ),
  }
})
const now = new Date(2026, 8, 4, 12)
const active: HomeMyAppsState = {
  state: 'blocked',
  ruleTitles: ['Décompression'],
  nextStart: null,
  nextRuleTitle: null,
  resuming: false,
  apps: ['a', 'b', 'c', 'd', 'e'].map(key => ({
    key,
    unlocked: false,
    ruleIds: ['rule-1'],
  })),
  blockedCount: 5,
}
describe('Home dashboard cards', () => {
  let renderer: ReactTestRenderer | undefined
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })
  const texts = () =>
    renderer!.root.findAllByType(Text).map(node => node.props.children)

  it('shows the wordmark instead of a greeting', () => {
    act(() => {
      renderer = create(
        <HomeHeader
          streak={3}
          streakLabel="Série"
          settingsLabel="Réglages"
          onPressStreak={jest.fn()}
          onPressSettings={jest.fn()}
        />,
      )
    })
    expect(
      renderer!.root.findByProps({ accessibilityLabel: 'Relock' }),
    ).toBeTruthy()
    // Plus aucune copie de salutation : la marque a pris sa place.
    expect(texts()).toEqual(['🔥', 3])
  })

  it('keeps streak and settings separate, including a zero-day flame', () => {
    const onPressStreak = jest.fn()
    const onPressSettings = jest.fn()
    act(() => {
      renderer = create(
        <HomeHeader
          streak={0}
          streakLabel="Série"
          settingsLabel="Réglages"
          onPressStreak={onPressStreak}
          onPressSettings={onPressSettings}
        />,
      )
    })
    act(() => {
      renderer!.root
        .findByProps({ accessibilityLabel: 'Série' })
        .props.onPress()
      renderer!.root
        .findByProps({ accessibilityLabel: 'Réglages' })
        .props.onPress()
    })
    expect(onPressStreak).toHaveBeenCalledTimes(1)
    expect(onPressSettings).toHaveBeenCalledTimes(1)
    expect(texts()).toEqual(expect.arrayContaining(['🔥', 0]))
  })
  it('keeps score fallback honest and opens its details', () => {
    const onPress = jest.fn()
    act(() => {
      renderer = create(
        <HomeScoreCard
          scores={{ global: null, focus: null, rest: null, available: false }}
          title="Score"
          subtitle="Aujourd’hui"
          bandLabel="Bon équilibre"
          footerLabel="Ton rythme est sain."
          focusLabel="Focus"
          restLabel="Repos"
          accessibilityLabel="Score"
          accessibilityHint="Ouvrir le détail"
          onPress={onPress}
        />,
      )
    })
    expect(texts()).toEqual(expect.arrayContaining(['—', 'Focus', 'Repos']))
    act(() =>
      renderer!.root
        .findAllByProps({ accessibilityLabel: 'Score' })
        .find(node => node.props.onPress)
        ?.props.onPress(),
    )
    expect(onPress).toHaveBeenCalledTimes(1)
  })
  it('renders explicit known score values', () => {
    act(() => {
      renderer = create(
        <HomeScoreCard
          scores={{ global: 72, focus: 78, rest: 66, available: true }}
          title="Score"
          subtitle="Aujourd’hui"
          bandLabel="Bon équilibre"
          footerLabel="Ton rythme est sain."
          focusLabel="Focus"
          restLabel="Repos"
          accessibilityLabel="Score"
          accessibilityHint="Ouvrir le détail"
          onPress={jest.fn()}
        />,
      )
    })
    expect(texts()).toEqual(expect.arrayContaining([72, 78, 66]))
  })
  it('renders actual rule membership, three native icons, overflow and a direct unlock action', () => {
    const onPress = jest.fn()
    const onUnlock = jest.fn()
    act(() => {
      renderer = create(
        <HomeMyAppsCard
          model={active}
          now={now}
          onPress={onPress}
          onUnlock={onUnlock}
        />,
      )
    })
    expect(texts()).toContain('Décompression')
    for (const key of ['a', 'b', 'c'])
      expect(
        renderer!.root.findByProps({ testID: `blocked-app-${key}` }),
      ).toBeTruthy()
    expect(
      renderer!.root.findAllByProps({ testID: 'blocked-app-d' }),
    ).toHaveLength(0)
    expect(
      texts().some(value => Array.isArray(value) && value.join('') === '+2'),
    ).toBe(true)
    act(() =>
      renderer!.root
        .findAllByProps({ testID: 'home-unlock-apps' })
        .find(node => node.props.onPress)!
        .props.onPress(),
    )
    expect(onUnlock).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
    act(() =>
      renderer!.root
        .findAllByProps({ accessibilityLabel: 'home.my_apps.open' })
        .find(node => node.props.onPress)!
        .props.onPress(),
    )
    expect(onPress).toHaveBeenCalledTimes(1)
  })
  it('clearly says no apps are blocked while announcing the next schedule', () => {
    const model: HomeMyAppsState = {
      ...active,
      state: 'clear',
      ruleTitles: [],
      apps: [],
      blockedCount: 0,
      nextStart: new Date(now.getTime() + 6 * 60 * 60_000),
      nextRuleTitle: 'Limite du week-end',
    }
    act(() => {
      renderer = create(
        <HomeMyAppsCard
          model={model}
          now={now}
          onPress={jest.fn()}
          onUnlock={jest.fn()}
        />,
      )
    })
    expect(texts()).toContain('home.my_apps.none_blocked')
    expect(
      texts().some(
        value =>
          typeof value === 'string' &&
          value.includes('Limite du week-end') &&
          value.includes('home.my_apps.hours'),
      ),
    ).toBe(true)
    expect(
      renderer!.root.findAllByProps({ testID: 'home-unlock-apps' }),
    ).toHaveLength(0)
  })
  it('does not claim no apps are blocked while the native read is loading', () => {
    act(() => {
      renderer = create(
        <HomeMyAppsCard
          model={{ ...active, state: 'loading', apps: [], blockedCount: 0 }}
          now={now}
          onPress={jest.fn()}
          onUnlock={jest.fn()}
        />,
      )
    })
    expect(texts()).toContain('home.my_apps.checking')
    expect(texts()).not.toContain('home.my_apps.none_blocked')
    expect(
      renderer!.root.findAllByProps({ testID: 'home-unlock-apps' }),
    ).toHaveLength(0)
  })
  it('only celebrates a real streak and adapts after day one', () => {
    act(() => {
      renderer = create(<HomeProgressCard streak={0} />)
    })
    expect(renderer!.toJSON()).toBeNull()
    act(() => renderer!.update(<HomeProgressCard streak={1} />))
    expect(texts()).toContain('home.progress.first_title{"count":1}')
    expect(texts()).toContain(1)
    act(() => renderer!.update(<HomeProgressCard streak={13} />))
    expect(texts()).toContain('home.progress.title{"count":13}')
    expect(texts()).toContain(13)
  })
})
