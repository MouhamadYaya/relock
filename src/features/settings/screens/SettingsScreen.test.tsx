import { router } from 'expo-router'
import React from 'react'
import { Alert, AppState, Linking, Share, Switch } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { constants } from '@/config/constants'
import {
  emergencyAvailability,
  markEmergencyUnlockUsed,
} from '@/features/blocking/services/emergency-quota'
import { emergencyUnlock } from '@/features/blocking/services/emergency-unlock'
import { NotificationService } from '@/features/notifications/notification.service'
import {
  getNotifPrefs,
  setNotifPrefs,
} from '@/features/notifications/prefs/prefs'
import SettingsScreen from '@/features/settings/screens/SettingsScreen'
import { Notif } from '@/shared/native/notifications'
import { ScreenTime } from '@/shared/native/screen-time'
import { applyCrashReportsPreference } from '@/shared/services/monitoring/sentry'
import {
  DEFAULT_REMINDER_MINUTES,
  getPreference,
  getReminderMinutes,
  setPreference,
  setReminderMinutes,
} from '@/shared/services/storage/app-preferences'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { usePreferences } from '@/shared/stores/preferences.store'
import { showToast } from '@/shared/utils/toast'

jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return {
    router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
    // Le vrai hook se déclenche à chaque prise de focus, montage compris :
    // le reproduire par un `useEffect` conserve la lecture au montage.
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  }
})

jest.mock('@/shared/services/monitoring/sentry', () => ({
  ...jest.requireActual('@/shared/services/monitoring/sentry'),
  applyCrashReportsPreference: jest.fn(),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/i18n/useT', () => ({ useT: () => (key: string) => key }))
jest.mock('@/i18n', () => ({ i18n: { language: 'fr' } }))

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View /> }
})

jest.mock('@/shared/components/ui/ScreenWrapper', () => {
  const { View } = require('react-native')
  return {
    ScreenWrapper: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  }
})

// `showToast` passe par `Alert.alert` sur iOS : sans ce mock, un simple
// toast serait indiscernable d'une demande de confirmation.
jest.mock('@/shared/utils/toast', () => ({
  showToast: jest.fn(),
  showErrorToast: jest.fn(),
}))

jest.mock('@/shared/components/ui/RelockWordmark', () => {
  const { View } = require('react-native')
  return { RelockWordmark: () => <View /> }
})

jest.mock('@/features/user/hooks/useProfile', () => ({
  useProfile: () => ({
    name: 'Yaya',
    displayName: 'Yaya',
    email: 'yaya@example.com',
    avatar: null,
    birthDate: null,
    createdAt: null,
    isLoading: false,
  }),
}))

jest.mock('@/features/onboarding/services/revenuecat', () => ({
  isRevenueCatEnabled: () => false,
  openRevenueCatCustomerCenter: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}))

jest.mock('@/features/auth/services/auth/auth.service', () => ({
  AuthService: { logout: jest.fn() },
}))

jest.mock('@/session/bootstrap', () => ({
  resetOnboarding: jest.fn(),
  syncEntitlement: jest.fn(),
  signOutToAuth: jest.fn(),
}))

jest.mock('@/features/notifications/notification.service', () => ({
  NotificationService: {
    ensurePermission: jest.fn().mockResolvedValue(true),
    runFromLastKnown: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/shared/native/notifications', () => ({
  Notif: {
    isAvailable: true,
    permissionStatus: jest.fn().mockResolvedValue('granted'),
  },
}))

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    authorizationStatus: jest.fn().mockResolvedValue('notDetermined'),
    requestAuthorization: jest.fn().mockResolvedValue('approved'),
    uninstallProtection: jest
      .fn()
      .mockResolvedValue({ enabled: false, active: false }),
    setUninstallProtection: jest.fn().mockResolvedValue(true),
    getDiagnostics: jest.fn(),
  },
}))

jest.mock('@/features/blocking/services/emergency-unlock', () => ({
  emergencyUnlock: jest.fn().mockResolvedValue({ removed: 2, failed: 0 }),
}))

jest.mock('@/features/settings/services/data-export', () => ({
  buildDataExport: jest.fn().mockResolvedValue({ rules: [] }),
  serializeDataExport: () => '{}',
}))

const refetchRules = jest.fn().mockResolvedValue(undefined)
jest.mock('@/features/blocking/hooks/useBlockRulesQuery', () => ({
  useBlockRulesQuery: jest.fn(),
}))

const { useBlockRulesQuery } = jest.requireMock(
  '@/features/blocking/hooks/useBlockRulesQuery',
) as { useBlockRulesQuery: jest.Mock }

const RULES = [
  { id: 'r1', type: 'schedule', appIds: [], isActive: true },
  { id: 'r2', type: 'daily_limit', appIds: [], isActive: true },
]

/**
 * La ligne portant ce libellé (les clés i18n brutes, `useT` étant neutralisé).
 *
 * On cherche par PROPS et non par type : `Pressable` est un composant
 * mémoïsé, que `findAllByType` ne retrouve pas de façon fiable. Le couple
 * « libellé + gestionnaire d'appui » est de toute façon ce qui définit une
 * ligne actionnable du point de vue de l'utilisateur.
 */
function rowFor(tree: ReactTestRenderer, label: string) {
  return tree.root.find(
    node =>
      node.props?.accessibilityLabel === label &&
      typeof node.props?.onPress === 'function',
  )
}

/**
 * L'interrupteur de la rangée portant ce libellé.
 *
 * Un interrupteur n'a pas de libellé propre : c'est la rangée qui le porte.
 * On descend donc depuis la rangée, ce qui rend le test indépendant de
 * l'ordre des lignes à l'écran.
 */
function switchFor(tree: ReactTestRenderer, label: string) {
  for (const node of tree.root.findAll(
    n => n.props?.accessibilityLabel === label,
  )) {
    const switches = node.findAllByType(Switch)
    if (switches.length > 0) return switches[0]
  }
  throw new Error(`Aucun interrupteur sous « ${label} »`)
}

/** Le sélecteur natif posé en accessoire d'une rangée. */
function pickerFor(tree: ReactTestRenderer, label: string) {
  return tree.root.find(
    node =>
      node.props?.accessibilityLabel === label &&
      typeof node.props?.onChange === 'function',
  )
}

/** Déclenche le bouton d'une `Alert.alert`, par son libellé. */
function pressAlertButton(label: string) {
  const spy = Alert.alert as unknown as jest.Mock
  const buttons = spy.mock.calls.at(-1)?.[2] as
    | { text: string; onPress?: () => void }[]
    | undefined
  const button = buttons?.find(b => b.text === label)
  if (!button) throw new Error(`Bouton « ${label} » absent de l'alerte`)
  act(() => button.onPress?.())
}

let mounted: ReactTestRenderer | null = null

async function render(): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(<SettingsScreen />)
  })
  return mounted as unknown as ReactTestRenderer
}

describe('SettingsScreen', () => {
  // Un arbre laissé monté continue de s'abonner au store : la remise à zéro
  // du test suivant le ferait alors se redessiner hors de tout `act`.
  /** Les abonnés à `AppState` du rendu courant, pour les déclencher à la main. */
  const appStateHandlers: ((state: string) => void)[] = []

  afterEach(() => {
    act(() => mounted?.unmount())
    mounted = null
  })

  beforeEach(() => {
    jest.clearAllMocks()
    // L'écran s'abonne à `AppState` et se désabonne au démontage. L'espion est
    // posé pour TOUS les tests, et pas seulement ceux qui l'observent : sans
    // abonnement valide, le nettoyage de l'effet ferait échouer chaque
    // démontage.
    appStateHandlers.length = 0
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, handler) => {
        appStateHandlers.push(handler as (state: string) => void)
        return { remove: jest.fn() } as never
      })
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    // MMKV est simulé mais PERSISTANT d'un test à l'autre : sans cette remise
    // à zéro, un test qui coupe les notifications fait disparaître des lignes
    // pour tous les suivants.
    for (const key of ['haptics', 'pauseSound', 'crashReports'] as const) {
      setPreference(key, true)
    }
    setReminderMinutes(DEFAULT_REMINDER_MINUTES)
    setNotifPrefs({
      version: 2,
      master: true,
      channels: {
        reminders: true,
        progression: true,
        account: true,
        offers: false,
        ritual: false,
      },
      quietHours: null,
      ritual: {
        myMomentMinutes: null,
        bedtimeMinutes: null,
        morningMinutes: null,
      },
    })
    kvStorage.delete(constants.EMERGENCY_UNLOCK_AT)
    usePreferences.setState({
      haptics: true,
      pauseSound: true,
      crashReports: true,
    })
    useBlockRulesQuery.mockReturnValue({
      rules: RULES,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: refetchRules,
    })
    ;(ScreenTime.authorizationStatus as jest.Mock).mockResolvedValue(
      'notDetermined',
    )
    ;(ScreenTime.uninstallProtection as jest.Mock).mockResolvedValue({
      enabled: false,
      active: false,
    })
    ;(Notif.permissionStatus as jest.Mock).mockResolvedValue('granted')
  })

  /**
   * Ces permissions se retirent DEPUIS iOS, hors de l'app. Une lecture au seul
   * montage laissait donc l'écran afficher « accordée » après un aller-retour
   * par Réglages, et proposer des actions vouées à échouer.
   */
  describe('fraîcheur des permissions', () => {
    it('lit les permissions au montage', async () => {
      await render()

      expect(ScreenTime.authorizationStatus).toHaveBeenCalled()
      expect(ScreenTime.uninstallProtection).toHaveBeenCalled()
      expect(Notif.permissionStatus).toHaveBeenCalled()
    })

    it('relit les permissions au retour au premier plan', async () => {
      await render()
      const screenTimeReads = (ScreenTime.authorizationStatus as jest.Mock).mock
        .calls.length
      const notifReads = (Notif.permissionStatus as jest.Mock).mock.calls.length

      // L'autorisation a été retirée pendant que l'app était en arrière-plan.
      ;(ScreenTime.authorizationStatus as jest.Mock).mockResolvedValue('denied')
      await act(async () => {
        for (const handler of appStateHandlers) handler('active')
      })

      expect(
        (ScreenTime.authorizationStatus as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(screenTimeReads)
      expect(
        (Notif.permissionStatus as jest.Mock).mock.calls.length,
      ).toBeGreaterThan(notifReads)
    })

    it('ne relit rien quand l’app passe en arrière-plan', async () => {
      await render()
      const screenTimeReads = (ScreenTime.authorizationStatus as jest.Mock).mock
        .calls.length

      await act(async () => {
        for (const handler of appStateHandlers) handler('background')
      })

      expect(
        (ScreenTime.authorizationStatus as jest.Mock).mock.calls.length,
      ).toBe(screenTimeReads)
    })
  })

  it('mène à la fiche d’identité depuis la carte de profil', async () => {
    const tree = await render()
    act(() => rowFor(tree, 'settings.profile.open').props.onPress())
    expect(router.push).toHaveBeenCalledWith('/profile')
  })

  it('demande l’autorisation Temps d’écran quand elle manque', async () => {
    const tree = await render()
    // `await` : la demande d'autorisation résout puis écrit l'état de la
    // ligne — sans quoi React signale une mise à jour hors `act`.
    await act(async () => {
      rowFor(tree, 'settings.screen_time').props.onPress()
    })
    expect(ScreenTime.requestAuthorization).toHaveBeenCalled()
  })

  it('renvoie aux réglages iOS quand l’autorisation est déjà accordée', async () => {
    ;(ScreenTime.authorizationStatus as jest.Mock).mockResolvedValue('approved')
    const openSettings = jest
      .spyOn(Linking, 'openSettings')
      .mockResolvedValue(undefined)

    const tree = await render()
    act(() => rowFor(tree, 'settings.screen_time').props.onPress())

    // Redemander une autorisation acquise ne fait rien du tout côté iOS : la
    // ligne doit mener là où elle peut être retirée.
    expect(ScreenTime.requestAuthorization).not.toHaveBeenCalled()
    expect(openSettings).toHaveBeenCalled()
    openSettings.mockRestore()
  })

  it('désactive les catégories sans les masquer ni perdre le réglage', async () => {
    const tree = await render()
    const before = tree.root.findAllByType(Switch).length

    act(() =>
      switchFor(tree, 'settings.notifications_master').props.onValueChange(
        false,
      ),
    )

    // Les catégories restent À L'ÉCRAN : les masquer effaçait la dépendance
    // au lieu de l'expliquer, et donnait l'impression d'un réglage perdu.
    expect(tree.root.findAllByType(Switch).length).toBe(before)
    expect(
      switchFor(tree, 'settings.notifications_reminders').props.disabled,
    ).toBe(true)
    expect(
      switchFor(tree, 'settings.notifications_progression').props.disabled,
    ).toBe(true)

    // Et la préférence enregistrée n'a pas bougé : la réactivation la
    // retrouve telle quelle.
    expect(getNotifPrefs()).toMatchObject({
      master: false,
      channels: { reminders: true, progression: true },
    })
  })

  it('place l’autorisation iOS AVANT les préférences quand elle manque', async () => {
    ;(Notif.permissionStatus as jest.Mock).mockResolvedValue('denied')
    const tree = await render()

    const labels = tree.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string)

    // Un « Autoriser les notifications » allumé au-dessus d'une autorisation
    // refusée laisse croire que tout fonctionne déjà.
    expect(labels.indexOf('settings.notifications_permission')).toBeLessThan(
      labels.indexOf('settings.notifications_master'),
    )
  })

  it('ne demande AUCUNE autorisation à l’ouverture de l’écran', async () => {
    await render()
    // Un consentement ne se déclenche pas en arrivant sur un écran.
    expect(NotificationService.ensurePermission).not.toHaveBeenCalled()
    expect(ScreenTime.requestAuthorization).not.toHaveBeenCalled()
    expect(ScreenTime.setUninstallProtection).not.toHaveBeenCalled()
  })

  describe('déblocage d’urgence', () => {
    it('libère tout après confirmation, sans passer par le flux de déblocage', async () => {
      const tree = await render()
      act(() => rowFor(tree, 'settings.emergency').props.onPress())

      // Rien ne doit se produire tant que l'alerte n'est pas confirmée.
      expect(emergencyUnlock).not.toHaveBeenCalled()

      await act(async () => {
        pressAlertButton('settings.emergency_cta')
      })

      // Toutes les règles sont passées, pas seulement les actives : une règle
      // inactive peut avoir laissé une activité armée côté iOS.
      expect(emergencyUnlock).toHaveBeenCalledWith(RULES)
      expect(refetchRules).toHaveBeenCalled()
    })

    it('ne fait rien quand il n’y a rien à lever', async () => {
      useBlockRulesQuery.mockReturnValue({
        rules: [],
        isPending: false,
        isError: false,
        isRefetching: false,
        refetch: refetchRules,
      })
      const tree = await render()
      act(() => rowFor(tree, 'settings.emergency').props.onPress())

      // Un simple message, jamais une demande de confirmation.
      expect(showToast).toHaveBeenCalledWith('settings.emergency_none')
      expect(Alert.alert).not.toHaveBeenCalled()
      expect(emergencyUnlock).not.toHaveBeenCalled()
    })
  })

  describe('quota hebdomadaire du déblocage d’urgence', () => {
    it('annonce le quota dans la demande de confirmation', async () => {
      const tree = await render()
      act(() => rowFor(tree, 'settings.emergency').props.onPress())

      const [, body] = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1)
      // La règle se lit AVANT de confirmer, pas après avoir consommé sa
      // semaine.
      expect(body).toContain('settings.emergency_quota')
    })

    it('consomme le quota une fois la libération faite', async () => {
      const tree = await render()
      act(() => rowFor(tree, 'settings.emergency').props.onPress())
      await act(async () => {
        pressAlertButton('settings.emergency_cta')
      })

      expect(emergencyUnlock).toHaveBeenCalled()
      // C'est MMKV qui tranche : le quota survit à la fermeture de l'app.
      expect(emergencyAvailability().allowed).toBe(false)
    })

    it('refuse un second déblocage la même semaine, sans rien demander', async () => {
      markEmergencyUnlockUsed()
      const tree = await render()
      act(() => rowFor(tree, 'settings.emergency').props.onPress())

      const [title, , buttons] = (
        Alert.alert as unknown as jest.Mock
      ).mock.calls.at(-1)
      expect(title).toBe('settings.emergency_locked_title')
      // Pas de bouton d'action : proposer « tu es sûr ? » pour répondre
      // ensuite « en fait non » serait une porte qui ouvre sur un mur.
      expect(buttons).toBeUndefined()
      expect(emergencyUnlock).not.toHaveBeenCalled()
    })

    it('ne consomme rien quand il n’y a aucun blocage à lever', async () => {
      useBlockRulesQuery.mockReturnValue({
        rules: [],
        isPending: false,
        isError: false,
        isRefetching: false,
        refetch: refetchRules,
      })
      const tree = await render()
      act(() => rowFor(tree, 'settings.emergency').props.onPress())

      expect(emergencyAvailability().allowed).toBe(true)
    })
  })

  describe('protection contre la désinstallation', () => {
    it('explique la restriction AVANT de l’activer', async () => {
      const tree = await render()
      act(() =>
        switchFor(tree, 'settings.uninstall_protection').props.onValueChange(
          true,
        ),
      )

      // L'explication précède l'activation : la restriction iOS est globale,
      // la découvrir après coup ferait croire à un téléphone cassé.
      expect(ScreenTime.setUninstallProtection).not.toHaveBeenCalled()
      expect(Alert.alert).toHaveBeenCalled()

      await act(async () => {
        pressAlertButton('settings.uninstall_explain_cta')
      })
      expect(ScreenTime.setUninstallProtection).toHaveBeenCalledWith(true)
    })

    it('se coupe sans rien demander', async () => {
      ;(ScreenTime.uninstallProtection as jest.Mock).mockResolvedValue({
        enabled: true,
        active: true,
      })
      const tree = await render()

      await act(async () => {
        switchFor(tree, 'settings.uninstall_protection').props.onValueChange(
          false,
        )
      })

      // On ne met jamais d'obstacle devant la sortie.
      expect(Alert.alert).not.toHaveBeenCalled()
      expect(ScreenTime.setUninstallProtection).toHaveBeenCalledWith(false)
    })
  })

  it('replanifie les notifications quand l’heure du rituel change', async () => {
    // L'heure ne s'affiche qu'une fois le canal « rendez-vous quotidien »
    // activé : sans rituel choisi, il n'y a pas d'heure à régler.
    setNotifPrefs({
      ...getNotifPrefs(),
      channels: { ...getNotifPrefs().channels, ritual: true },
    })
    const tree = await render()
    const picker = pickerFor(tree, 'settings.reminder_time')

    act(() => {
      picker.props.onChange({ type: 'set' }, new Date(2026, 0, 1, 21, 15))
    })

    expect(getReminderMinutes()).toBe(21 * 60 + 15)
    // Cette heure était enregistrée sans que rien ne la lise : elle pilote
    // désormais réellement le rendez-vous quotidien.
    expect(getNotifPrefs().ritual.myMomentMinutes).toBe(21 * 60 + 15)
    expect(NotificationService.runFromLastKnown).toHaveBeenCalled()
  })

  /**
   * La politique de confidentialité PUBLIÉE promet « disable or enable crash
   * reporting in Settings ». Cet interrupteur est donc un engagement, pas un
   * confort : il a déjà disparu une fois d'une refonte de l'écran, et rien ne
   * l'avait signalé.
   */

  /**
   * La politique de confidentialité PUBLIÉE promet « disable or enable crash
   * reporting in Settings ». Cet interrupteur est un engagement, pas un
   * confort : il a déjà disparu DEUX FOIS de refontes de cet écran sans que
   * rien ne le signale. La cohérence avec la politique est verrouillée à part,
   * dans `privacy-commitments.test.ts` ; ici on couvre le comportement.
   */
  describe('rapports d’anomalie', () => {
    it('offre l’interrupteur promis par la politique de confidentialité', async () => {
      const tree = await render()
      expect(switchFor(tree, 'settings.crash_reports')).toBeTruthy()
    })

    it('coupe le SDK, et pas seulement nos appels', async () => {
      const tree = await render()

      act(() =>
        switchFor(tree, 'settings.crash_reports').props.onValueChange(false),
      )

      // La préférence survit au démontage — c'est MMKV qui tranche.
      expect(getPreference('crashReports')).toBe(false)
      // Et le SDK est réellement fermé : sinon crashs natifs, sessions,
      // traces et replay continueraient d'émettre tout seuls.
      expect(applyCrashReportsPreference).toHaveBeenCalledWith(false)
    })

    it('relance le SDK à la réactivation', async () => {
      setPreference('crashReports', false)
      usePreferences.setState({ crashReports: false })
      const tree = await render()

      act(() =>
        switchFor(tree, 'settings.crash_reports').props.onValueChange(true),
      )

      expect(getPreference('crashReports')).toBe(true)
      expect(applyCrashReportsPreference).toHaveBeenCalledWith(true)
    })
  })

  it('place la zone sensible tout en bas, dans l’ordre de gravité', async () => {
    const tree = await render()
    const labels = tree.root
      .findAll(node => typeof node.props?.accessibilityLabel === 'string')
      .map(node => node.props.accessibilityLabel as string)

    const emergency = labels.indexOf('settings.emergency')
    const reset = labels.indexOf('settings.reset')
    const remove = labels.indexOf('settings.delete_account')

    expect(emergency).toBeGreaterThan(-1)
    // Du plus réversible au moins réversible : on ne tombe pas par mégarde
    // sur la suppression du compte en cherchant la sortie de secours.
    expect(reset).toBeGreaterThan(emergency)
    expect(remove).toBeGreaterThan(reset)
  })
})
