import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'
import {
  REDACTED,
  redactDeep,
  redactString,
  redactUrl,
  scrubBreadcrumb,
  scrubEvent,
} from './scrub'

describe('redactString', () => {
  it('masque un JWT Supabase noyé dans une phrase', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    expect(
      redactString(`échec avec le token ${jwt} sur /rest/v1`),
    ).not.toContain('eyJ')
  })

  it('masque un en-tête Bearer et une adresse e-mail', () => {
    expect(redactString('Bearer sk_live_abcdef123456')).toBe(REDACTED)
    expect(redactString('connexion de alice@example.com refusée')).toBe(
      `connexion de ${REDACTED} refusée`,
    )
  })

  it('masque une clé RevenueCat', () => {
    expect(redactString('appl_AbCdEfGhIjKlMnOpQr')).toBe(REDACTED)
  })

  it('laisse passer un message ordinaire', () => {
    const msg = 'Impossible de charger les règles de blocage (statut 500)'
    expect(redactString(msg)).toBe(msg)
  })
})

describe('redactUrl', () => {
  it('coupe la query string mais garde le chemin', () => {
    expect(redactUrl('https://api.relock.app/v1/blocks?token=abc&id=7')).toBe(
      `https://api.relock.app/v1/blocks?${REDACTED}`,
    )
  })

  it('laisse une URL sans query intacte', () => {
    expect(redactUrl('https://api.relock.app/v1/blocks')).toBe(
      'https://api.relock.app/v1/blocks',
    )
  })
})

describe('redactDeep', () => {
  it('masque par nom de clé, quelle que soit la valeur', () => {
    expect(
      redactDeep({ userId: '42', accessToken: 'x', nested: { password: 'y' } }),
    ).toEqual({
      userId: '42',
      accessToken: REDACTED,
      nested: { password: REDACTED },
    })
  })

  it('borne la récursion sans lever', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(() => redactDeep(cyclic)).not.toThrow()
  })
})

describe('scrubEvent', () => {
  it("ne garde que l'id de l'utilisateur", () => {
    const event = {
      user: { id: 'uuid-1', email: 'alice@example.com', ip_address: '1.2.3.4' },
    } as unknown as ErrorEvent
    expect(scrubEvent(event).user).toEqual({ id: 'uuid-1' })
  })

  it('supprime en-têtes et cookies de la requête', () => {
    const event = {
      request: {
        url: 'https://api.relock.app/v1/me?token=abc',
        headers: { Authorization: 'Bearer abc' },
        cookies: 'session=abc',
      },
    } as unknown as ErrorEvent
    const out = scrubEvent(event)
    expect(out.request?.headers).toBeUndefined()
    expect(out.request?.cookies).toBeUndefined()
    expect(out.request?.url).toBe(`https://api.relock.app/v1/me?${REDACTED}`)
  })

  it("masque la valeur d'une exception", () => {
    const event = {
      exception: {
        values: [{ type: 'Error', value: 'refus pour bob@example.com' }],
      },
    } as unknown as ErrorEvent
    expect(scrubEvent(event).exception?.values?.[0]?.value).toBe(
      `refus pour ${REDACTED}`,
    )
  })
})

describe('scrubBreadcrumb', () => {
  it('jette les logs console de debug', () => {
    expect(
      scrubBreadcrumb({
        category: 'console',
        level: 'debug',
      } as unknown as Breadcrumb),
    ).toBeNull()
  })

  it("coupe la query string de l'URL d'une miette réseau", () => {
    const out = scrubBreadcrumb({
      category: 'http',
      data: { url: 'https://api.relock.app/v1/me?token=abc' },
    } as unknown as Breadcrumb)
    expect(out?.data?.url).toBe(`https://api.relock.app/v1/me?${REDACTED}`)
  })
})
