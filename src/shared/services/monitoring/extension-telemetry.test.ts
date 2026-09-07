import { ScreenTime } from '@/shared/native/screen-time'
import { drainExtensionTelemetry } from './extension-telemetry'
import { addAppBreadcrumb, captureError, isSentryEnabled } from './sentry'

jest.mock('./sentry', () => ({
  addAppBreadcrumb: jest.fn(),
  captureError: jest.fn(),
  isSentryEnabled: jest.fn(() => true),
}))

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    drainExtensionLog: jest.fn(),
    publishSentryDSN: jest.fn().mockResolvedValue(true),
  },
}))

const drainMock = ScreenTime.drainExtensionLog as jest.Mock
const enabledMock = isSentryEnabled as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  enabledMock.mockReturnValue(true)
})

it('remonte une entrée `error` comme exception, avec son instant réel', async () => {
  drainMock.mockResolvedValue([
    {
      ts: 1_700_000_000,
      source: 'monitor',
      kind: 'error',
      message: 'startMonitoring a échoué',
      data: { errorType: 'NSError' },
    },
  ])

  await drainExtensionTelemetry()

  expect(captureError).toHaveBeenCalledTimes(1)
  const [error, options] = (captureError as jest.Mock).mock.calls[0]
  expect((error as Error).message).toBe('[monitor] startMonitoring a échoué')
  expect(options.tags).toEqual({ extension: 'monitor', deferred: 'true' })
  // L'empreinte ne doit PAS dépendre de l'horodatage, sinon chaque incident
  // créerait sa propre issue.
  expect(options.fingerprint).toEqual([
    'extension',
    'monitor',
    'startMonitoring a échoué',
  ])
  expect(options.extra.occurred_at).toBe('2023-11-14T22:13:20.000Z')
})

it('transforme une entrée `info` en miette, sans lever d’exception', async () => {
  drainMock.mockResolvedValue([
    {
      ts: 1_700_000_000,
      source: 'shield',
      kind: 'info',
      message: 'mur affiché',
    },
  ])

  await drainExtensionTelemetry()

  expect(captureError).not.toHaveBeenCalled()
  expect(addAppBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({
      category: 'extension.shield',
      message: 'mur affiché',
    }),
  )
})

it('signale un débordement du tampon', async () => {
  drainMock.mockResolvedValue([
    {
      ts: 1_700_000_000,
      source: 'report',
      kind: 'info',
      message: 'reprise',
      droppedBefore: 12,
    },
  ])

  await drainExtensionTelemetry()

  expect(addAppBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({
      level: 'warning',
      message: expect.stringContaining('12'),
    }),
  )
})

it('vide quand même le journal quand Sentry est inactif', async () => {
  // Sinon le tampon borné de l'extension déborderait sur un build sans DSN,
  // et les entrées les plus anciennes — celles qui expliquent le début d'une
  // panne — seraient perdues.
  enabledMock.mockReturnValue(false)
  drainMock.mockResolvedValue([
    { ts: 1, source: 'monitor', kind: 'error', message: 'x' },
  ])

  await drainExtensionTelemetry()

  expect(drainMock).toHaveBeenCalledTimes(1)
  expect(captureError).not.toHaveBeenCalled()
})
