/**
 * L'interrupteur « rapports d'anomalie » doit couper le SDK LUI-MÊME.
 *
 * Régression visée : ne filtrer que les wrappers de ce module laissait partir
 * crashs natifs, sessions, traces, profils et replay — c'est-à-dire l'essentiel
 * du trafic — alors que l'écran affirmait l'envoi coupé.
 */

let mockCrashReports = true
let mockDsn = 'https://key@example.ingest.sentry.io/1'

jest.mock('@/shared/services/storage/app-preferences', () => ({
  getPreference: (key: string) =>
    key === 'crashReports' ? mockCrashReports : true,
}))

jest.mock('@/config/env', () => ({
  env: {
    // Accesseur, pas valeur figée : la fabrique n'est évaluée qu'une fois,
    // alors qu'un test doit pouvoir retirer le DSN.
    get SENTRY_DSN() {
      return mockDsn
    },
    // Jest tourne en __DEV__ : sans ce drapeau, le module resterait inerte.
    SENTRY_ENABLE_IN_DEV: '1',
    ENV: 'test',
    SENTRY_TRACES_SAMPLE_RATE: 0,
    SENTRY_PROFILES_SAMPLE_RATE: 0,
    SENTRY_REPLAYS_SESSION_SAMPLE_RATE: 0,
    SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: 0,
  },
}))

type SentryApi = typeof import('@/shared/services/monitoring/sentry')
type SentrySdk = jest.Mocked<typeof import('@sentry/react-native')>

/**
 * Recharge le module dans un registre neuf. `initSentry` ne s'exécute qu'une
 * fois par processus : sans isolation, le deuxième test hériterait de l'état
 * du premier.
 */
function load(): { api: SentryApi; sdk: SentrySdk } {
  let api!: SentryApi
  let sdk!: SentrySdk
  jest.isolateModules(() => {
    sdk = require('@sentry/react-native')
    api = require('@/shared/services/monitoring/sentry')
  })
  return { api, sdk }
}

/** Les options passées à `Sentry.init`, pour inspecter `beforeSend`. */
function initOptions(sdk: SentrySdk) {
  return sdk.init.mock.calls[0]?.[0] as {
    beforeSend: (event: unknown) => unknown
  }
}

beforeEach(() => {
  mockCrashReports = true
  mockDsn = 'https://key@example.ingest.sentry.io/1'
})

describe('initSentry', () => {
  it("n'initialise pas le SDK quand l'envoi est refusé", () => {
    mockCrashReports = false
    const { api, sdk } = load()

    api.initSentry()

    expect(sdk.init).not.toHaveBeenCalled()
    expect(api.isSentryEnabled()).toBe(false)
  })

  it('initialise le SDK quand l’envoi est accepté', () => {
    const { api, sdk } = load()

    api.initSentry()

    expect(sdk.init).toHaveBeenCalledTimes(1)
    expect(api.isSentryEnabled()).toBe(true)
  })
})

describe('applyCrashReportsPreference', () => {
  it('ferme le client à la coupure', () => {
    const { api, sdk } = load()
    api.initSentry()

    mockCrashReports = false
    api.applyCrashReportsPreference(false)

    expect(sdk.close).toHaveBeenCalledTimes(1)
    expect(api.isSentryEnabled()).toBe(false)
  })

  it('ne ferme pas deux fois un client déjà coupé', () => {
    const { api, sdk } = load()
    api.initSentry()

    mockCrashReports = false
    api.applyCrashReportsPreference(false)
    api.applyCrashReportsPreference(false)

    expect(sdk.close).toHaveBeenCalledTimes(1)
  })

  it('redémarre le SDK à la réactivation', () => {
    mockCrashReports = false
    const { api, sdk } = load()
    api.initSentry()
    expect(sdk.init).not.toHaveBeenCalled()

    mockCrashReports = true
    api.applyCrashReportsPreference(true)

    expect(sdk.init).toHaveBeenCalledTimes(1)
    expect(api.isSentryEnabled()).toBe(true)
  })

  /**
   * Un client redémarré est VIERGE : sans restauration, les événements repris
   * seraient orphelins de leur utilisateur, de leurs étiquettes et de
   * l'instrumentation Supabase jusqu'au prochain lancement de l'app.
   */
  it('restaure le contexte de session à la réactivation', () => {
    mockCrashReports = false
    const { api, sdk } = load()
    api.initSentry()

    // Posés pendant que l'envoi était coupé : ils ne partent nulle part, mais
    // doivent être retenus.
    api.setSentryUser('user-42')
    api.setSentryTags({ env: 'test' })
    api.setSentryContext('device', { model: 'iPhone' })
    const supabaseClient = { from: jest.fn() }
    api.attachSupabaseTelemetry(supabaseClient)
    expect(sdk.setUser).not.toHaveBeenCalled()

    mockCrashReports = true
    api.applyCrashReportsPreference(true)

    expect(sdk.setUser).toHaveBeenCalledWith({ id: 'user-42' })
    expect(sdk.setTags).toHaveBeenCalledWith({ env: 'test' })
    expect(sdk.setContext).toHaveBeenCalledWith('device', {
      model: 'iPhone',
    })
    expect(sdk.supabaseIntegration).toHaveBeenCalledWith({ supabaseClient })
    expect(sdk.addIntegration).toHaveBeenCalled()
  })

  it('ne pilote aucun client sans DSN utilisable', () => {
    mockDsn = ''
    const { api, sdk } = load()

    api.initSentry()
    api.applyCrashReportsPreference(true)

    expect(sdk.init).not.toHaveBeenCalled()
    expect(sdk.close).not.toHaveBeenCalled()
  })
})

describe('beforeSend', () => {
  /**
   * `Sentry.close()` VIDE la file avant de fermer : un événement mis en file
   * juste avant l'opt-out partirait donc au moment même où l'utilisateur coupe
   * l'envoi. La préférence est relue à l'instant de l'émission.
   */
  it("jette les événements encore en file après l'opt-out", () => {
    const { api, sdk } = load()
    api.initSentry()
    const { beforeSend } = initOptions(sdk)

    mockCrashReports = false

    expect(beforeSend({ message: 'en file' })).toBeNull()
  })

  it('laisse passer les événements tant que l’envoi est accepté', () => {
    const { api, sdk } = load()
    api.initSentry()
    const { beforeSend } = initOptions(sdk)

    expect(beforeSend({ message: 'ok' })).not.toBeNull()
  })
})
