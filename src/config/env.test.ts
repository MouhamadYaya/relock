import { parseEnvBool, parseSampleRate } from './env'

jest.mock('react-native-config', () => ({ default: {} }))

describe('parseSampleRate', () => {
  it('ramène toute saisie invalide à 0 plutôt que de laisser passer NaN', () => {
    expect(parseSampleRate('0.2')).toBe(0.2)
    expect(parseSampleRate('1')).toBe(1)
    expect(parseSampleRate(undefined)).toBe(0)
    expect(parseSampleRate('')).toBe(0)
    expect(parseSampleRate('abc')).toBe(0)
    // Hors bornes : un taux > 1 n'a pas de sens et coûterait cher.
    expect(parseSampleRate('2')).toBe(0)
    expect(parseSampleRate('-1')).toBe(0)
  })
})

describe('parseEnvBool', () => {
  it('accepte les orthographes courantes du vrai', () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on']) {
      expect(parseEnvBool(v)).toBe(true)
    }
    for (const v of ['0', 'false', 'no', '', undefined]) {
      expect(parseEnvBool(v)).toBe(false)
    }
  })
})
