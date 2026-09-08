import {
  birthDateAnchor,
  birthDateBounds,
  formatBirthDate,
  formatMemberSince,
  MIN_AGE_YEARS,
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

  it('borne la saisie entre 1900 et le 13e anniversaire', () => {
    const now = new Date(2026, 8, 7, 12)
    const { min, max } = birthDateBounds(now)
    expect(min.getFullYear()).toBe(1900)
    // La borne haute n'est PAS aujourd'hui : accepter une date récente
    // reviendrait à collecter nom, e-mail et date de naissance d'un enfant,
    // ce qui fait tomber l'app sous la guideline 5.1.4 d'Apple (et sous le
    // RGPD/COPPA) sans consentement parental. Le sélecteur s'arrête donc au
    // 13e anniversaire — voir `MIN_AGE_YEARS`.
    expect(max.getFullYear()).toBe(2026 - MIN_AGE_YEARS)
    expect(max.getMonth()).toBe(now.getMonth())
    expect(max.getDate()).toBe(now.getDate())
    expect(max.getTime()).toBeLessThan(now.getTime())
  })

  it('pose les molettes sur une année plausible, jamais aujourd’hui', () => {
    const now = new Date(2026, 8, 7, 12)
    const anchor = birthDateAnchor(now)
    // Personne n'est né ce matin : partir d'aujourd'hui oblige à faire
    // défiler quarante ans de molette.
    expect(anchor.getFullYear()).toBe(2001)
    expect(anchor.getTime()).toBeLessThan(now.getTime())
    expect(anchor.getTime()).toBeGreaterThan(birthDateBounds(now).min.getTime())
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
