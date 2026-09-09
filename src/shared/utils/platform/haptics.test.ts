import {
  isSupported,
  trigger,
  triggerPattern,
} from 'react-native-haptic-feedback'
import { getPreference } from '@/shared/services/storage/app-preferences'
import { haptics, resetHapticsMemory } from '@/shared/utils/platform/haptics'

jest.mock('@/shared/services/storage/app-preferences', () => ({
  getPreference: jest.fn(() => true),
}))

const pattern = jest.mocked(triggerPattern)
const legacy = jest.mocked(trigger)
const supported = jest.mocked(isSupported)
const preference = jest.mocked(getPreference)

/** Les événements du dernier motif joué. */
function lastEvents() {
  return pattern.mock.calls.at(-1)?.[0] ?? []
}

describe('partition haptique', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    supported.mockReturnValue(true)
    preference.mockReturnValue(true)
    resetHapticsMemory()
    // Chaque cas part d'une fenêtre de coalescence refroidie.
    jest.spyOn(Date, 'now').mockReturnValue(0)
  })

  afterEach(() => jest.restoreAllMocks())

  it('ne vibre pas du tout quand le réglage est coupé', () => {
    preference.mockReturnValue(false)
    haptics.tap()
    haptics.error()
    expect(pattern).not.toHaveBeenCalled()
    expect(legacy).not.toHaveBeenCalled()
  })

  it('joue le toucher plus fort que le tic de sélection historique', () => {
    haptics.tap()
    // 0.2 était l'intensité du `selection` de la librairie : le toucher
    // standard doit se sentir nettement au-dessus, sinon rien n'a changé.
    expect(lastEvents()[0]?.intensity).toBeGreaterThan(0.4)
  })

  it('garde le toucher rond et l’erreur sèche', () => {
    haptics.tap()
    const tap = lastEvents()[0]
    jest.spyOn(Date, 'now').mockReturnValue(1000)
    haptics.error()
    const error = lastEvents()[0]
    expect(tap?.sharpness).toBeLessThan(0.3)
    expect(error?.sharpness).toBeGreaterThan(0.6)
  })

  it('fait monter la réussite et descendre l’extinction', () => {
    haptics.success()
    const [first, second] = lastEvents()
    expect(second?.intensity).toBeGreaterThan(first?.intensity ?? 0)

    jest.spyOn(Date, 'now').mockReturnValue(1000)
    haptics.toggle(false)
    const [on, off] = lastEvents()
    expect(off?.intensity).toBeLessThan(on?.intensity ?? 0)
  })

  it('avale le second signal quand deux tombent dans la même fenêtre', () => {
    haptics.press()
    jest.spyOn(Date, 'now').mockReturnValue(10)
    haptics.tap()
    expect(pattern).toHaveBeenCalledTimes(1)
  })

  it('laisse passer le signal le plus lourd dans cette même fenêtre', () => {
    haptics.tap()
    jest.spyOn(Date, 'now').mockReturnValue(10)
    haptics.error()
    expect(pattern).toHaveBeenCalledTimes(2)
  })

  it('ne coalesce jamais le martèlement d’un maintien', () => {
    // Les dernières secousses sont espacées de 38 ms, sous la fenêtre : sans
    // exception rythmique, la fin du maintien deviendrait muette.
    haptics.rumble(0.9)
    jest.spyOn(Date, 'now').mockReturnValue(10)
    haptics.rumble(0.95)
    expect(pattern).toHaveBeenCalledTimes(2)
  })

  it('durcit le martèlement à mesure que le maintien avance', () => {
    haptics.rumble(0)
    const start = lastEvents()[0]
    haptics.rumble(1)
    const end = lastEvents()[0]
    expect(end?.intensity).toBeGreaterThan(start?.intensity ?? 0)
    expect(end?.sharpness).toBeGreaterThan(start?.sharpness ?? 0)
  })

  it('borne une progression aberrante au lieu de la transmettre au moteur', () => {
    haptics.rumble(42)
    const event = lastEvents()[0]
    expect(event?.intensity).toBeLessThanOrEqual(1)
    expect(event?.sharpness).toBeLessThanOrEqual(1)
  })

  it('retombe sur un type historique quand Core Haptics est absent', () => {
    supported.mockReturnValue(false)
    haptics.tap()
    expect(pattern).not.toHaveBeenCalled()
    expect(legacy).toHaveBeenCalledWith('soft', expect.anything())
  })

  it('autorise le vibreur pour les signaux de sécurité seulement', () => {
    haptics.error()
    expect(pattern).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ enableVibrateFallback: true }),
    )
    jest.spyOn(Date, 'now').mockReturnValue(1000)
    haptics.tap()
    expect(pattern).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ enableVibrateFallback: false }),
    )
  })
})
