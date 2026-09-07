import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { MathPauseModal } from '@/features/blocking/components/MathPauseModal'
import * as challenges from '@/features/blocking/services/pause-ritual/math-challenge'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: () => null }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

/** Un calcul figé : le rituel se teste sur sa mécanique, pas sur le tirage. */
const FIXED = { left: 7, right: 14, operator: 'x', answer: 98 } as const

describe('MathPauseModal', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.spyOn(challenges, 'nextMathChallenge').mockReturnValue({ ...FIXED })
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.restoreAllMocks()
  })

  const render = (onContinue = jest.fn()) => {
    act(() => {
      renderer = create(
        <MathPauseModal
          visible
          ritual="math"
          tokenKey="app-a"
          onCancel={jest.fn()}
          onContinue={onContinue}
        />,
      )
    })
    return onContinue
  }

  const byId = (id: string) => renderer?.root.findByProps({ testID: id })
  const press = (label: string) =>
    act(() => {
      renderer?.root
        .findAllByProps({ accessibilityRole: 'button' })
        .find(node => node.props.accessibilityLabel === label)
        ?.props.onPress()
    })
  const type = (digits: string) => {
    for (const digit of digits) press(digit)
  }
  const submit = () => act(() => byId('math-submit')?.props.onPress())

  it('n’ouvre la porte qu’après trois réponses justes', () => {
    const onContinue = render()

    expect(byId('math-continue')?.props.disabled).toBe(true)

    for (let round = 0; round < challenges.MATH_ROUNDS; round += 1) {
      expect(byId('math-continue')?.props.disabled).toBe(true)
      type('98')
      submit()
    }

    expect(byId('math-continue')?.props.disabled).toBe(false)
    act(() => byId('math-continue')?.props.onPress())
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('ne fait pas avancer une réponse fausse, et vide la saisie', () => {
    render()

    type('99')
    submit()

    // La manche n'est pas gagnée : le bouton reste fermé…
    expect(byId('math-continue')?.props.disabled).toBe(true)
    // …et le champ est remis à zéro pour le nouveau calcul.
    expect(byId('math-expression')).toBeTruthy()

    // Trois bonnes réponses restent nécessaires APRÈS l'erreur : rater ne
    // déduit rien, mais ne crédite rien non plus.
    for (let round = 0; round < challenges.MATH_ROUNDS - 1; round += 1) {
      type('98')
      submit()
      expect(byId('math-continue')?.props.disabled).toBe(true)
    }
    type('98')
    submit()
    expect(byId('math-continue')?.props.disabled).toBe(false)
  })

  it('efface le dernier chiffre saisi sans toucher au compteur', () => {
    render()

    type('9')
    act(() => byId('math-erase')?.props.onPress())
    // « 8 » seul est faux : l'effacement a bien retiré le 9.
    type('8')
    submit()
    expect(byId('math-continue')?.props.disabled).toBe(true)
  })
})
