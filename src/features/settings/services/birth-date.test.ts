import {
  birthDateBounds,
  formatBirthDate,
  formatMemberSince,
  parseBirthDate,
  toIsoDate,
} from '@/features/settings/services/birth-date'

describe('birth-date', () => {
  it('lit une date ISO sur les composantes locales', () => {
    const date = parseBirthDate('1998-03-14')
    expect(date?.getFullYear()).toBe(1998)
    expect(date?.getMonth()).toBe(2)
    expect(date?.getDate()).toBe(14)
  })

  it('rejette ce qui n’est pas une date civile', () => {
    expect(parseBirthDate(null)).toBeNull()
    expect(parseBirthDate('')).toBeNull()
    expect(parseBirthDate('14/03/1998')).toBeNull()
    expect(parseBirthDate('1998-03-14T12:00:00Z')).toBeNull()
  })

  it('fait l’aller-retour sans glisser d’un jour', () => {
    // Le piège que ce module existe pour éviter : `new Date('YYYY-MM-DD')`
    // est interprété en UTC et recule d'un jour à l'ouest de Greenwich.
    for (const iso of ['2000-01-01', '1998-03-14', '2024-12-31']) {
      expect(toIsoDate(parseBirthDate(iso) as Date)).toBe(iso)
    }
  })

  it('borne la saisie entre 1900 et aujourd’hui', () => {
    const now = new Date(2026, 8, 7, 12)
    const { min, max } = birthDateBounds(now)
    expect(min.getFullYear()).toBe(1900)
    expect(max).toBe(now)
  })

  it('formate une date lisible, et rend null sans date', () => {
    expect(formatBirthDate('1998-03-14', 'fr')).toContain('1998')
    expect(formatBirthDate(null, 'fr')).toBeNull()
  })

  it('formate le mois d’inscription, et ignore un horodatage cassé', () => {
    expect(formatMemberSince('2026-03-14T10:00:00Z', 'fr')).toContain('2026')
    expect(formatMemberSince('pas une date', 'fr')).toBeNull()
    expect(formatMemberSince(null, 'fr')).toBeNull()
  })
})
