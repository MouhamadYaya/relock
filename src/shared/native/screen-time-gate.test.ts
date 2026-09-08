import { requireScreenTime } from '@/shared/native/screen-time-gate'

const mockAuthorizationStatus = jest.fn()
const mockRequestAuthorization = jest.fn()
const native = { isAvailable: true }

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    get isAvailable() {
      return native.isAvailable
    },
    authorizationStatus: () => mockAuthorizationStatus(),
    requestAuthorization: () => mockRequestAuthorization(),
  },
}))

describe('requireScreenTime', () => {
  beforeEach(() => {
    native.isAvailable = true
    mockAuthorizationStatus.mockReset()
    mockRequestAuthorization.mockReset()
  })

  /**
   * LE test de H-6. Une fois l'autorisation refusée, iOS ne présente plus
   * jamais sa fenêtre : rappeler `requestAuthorization()` ne produit qu'un
   * rejet, donc un bouton qui ne fait rien. Tout l'écran de récupération
   * repose sur le fait qu'on ne rappelle PAS.
   */
  it('ne redemande jamais après un refus, et annonce le blocage', async () => {
    mockAuthorizationStatus.mockResolvedValue('denied')

    await expect(requireScreenTime()).resolves.toBe('blocked')
    expect(mockRequestAuthorization).not.toHaveBeenCalled()
  })

  it("demande quand la fenêtre système n'a jamais été présentée", async () => {
    mockAuthorizationStatus.mockResolvedValue('notDetermined')
    mockRequestAuthorization.mockResolvedValue('approved')

    await expect(requireScreenTime()).resolves.toBe('approved')
    expect(mockRequestAuthorization).toHaveBeenCalledTimes(1)
  })

  it('rend « blocked » quand la fenêtre est présentée et refusée', async () => {
    mockAuthorizationStatus.mockResolvedValue('notDetermined')
    mockRequestAuthorization.mockResolvedValue('denied')

    await expect(requireScreenTime()).resolves.toBe('blocked')
  })

  it("ne demande rien quand l'autorisation est déjà acquise", async () => {
    mockAuthorizationStatus.mockResolvedValue('approved')

    await expect(requireScreenTime()).resolves.toBe('approved')
    expect(mockRequestAuthorization).not.toHaveBeenCalled()
  })

  /**
   * `unavailable` reste distinct de `blocked` : il n'y a rien à récupérer, et
   * l'appelant ne doit pas ouvrir un écran qui parlerait d'une autorisation
   * qui n'existe pas sur cette machine.
   */
  it('distingue « pas de Family Controls ici » d’un refus', async () => {
    mockAuthorizationStatus.mockResolvedValue('unsupported')
    await expect(requireScreenTime()).resolves.toBe('unavailable')

    native.isAvailable = false
    mockAuthorizationStatus.mockClear()
    await expect(requireScreenTime()).resolves.toBe('unavailable')
    expect(mockAuthorizationStatus).not.toHaveBeenCalled()
  })

  it('traite un statut illisible comme un blocage, jamais comme un feu vert', async () => {
    mockAuthorizationStatus.mockRejectedValue(new Error('native failure'))

    await expect(requireScreenTime()).resolves.toBe('blocked')
    expect(mockRequestAuthorization).not.toHaveBeenCalled()
  })

  it('survit à un rejet de la demande elle-même', async () => {
    mockAuthorizationStatus.mockResolvedValue('notDetermined')
    mockRequestAuthorization.mockRejectedValue(new Error('auth_failed'))

    await expect(requireScreenTime()).resolves.toBe('blocked')
  })
})
