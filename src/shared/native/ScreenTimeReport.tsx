import React from 'react'
import {
  Platform,
  requireNativeComponent,
  UIManager,
  type ViewProps,
} from 'react-native'

type ReportProps = ViewProps & {
  period?: number
  /**
   * Décalage en UNITÉS de la période courante : jours (period 0), semaines
   * (period 1) ou mois (period 2). 0 = période en cours.
   */
  offset?: number
  /**
   * « usage » : l'Activité entière (résumé + graphe + classement), qui défile
   * elle-même. Accueil : « hero » (total du jour + delta) et « pills »
   * (rangée du jour).
   */
  mode?: 'usage' | 'pills' | 'hero'
  /** Affiché si la vue native est absente OU si son rendu échoue. */
  fallback?: React.ReactNode
}

const NAME = 'ScreenTimeReportView'

// Vue native qui héberge le rapport de temps d'écran système (extension
// DeviceActivityReport). period : 0 = jour, 1 = semaine, 2 = mois.
//
// ⚠️ `requireNativeComponent` ne lève JAMAIS d'exception quand la vue
// n'existe pas — l'erreur exploserait au rendu. La vraie détection passe
// par le registre UIManager : sans view config, on n'instancie rien et on
// rend le `fallback`. Un ErrorBoundary interne attrape le reste (défense
// en profondeur : plus aucun crash possible au niveau de l'écran).
function hasNativeView(name: string): boolean {
  if (Platform.OS !== 'ios') return false
  try {
    if (typeof UIManager.hasViewManagerConfig === 'function') {
      return UIManager.hasViewManagerConfig(name)
    }
    return UIManager.getViewManagerConfig?.(name) != null
  } catch {
    return false
  }
}

export const isScreenTimeReportAvailable = hasNativeView(NAME)

type NativeProps = ViewProps & {
  period?: number
  offset?: number
  mode?: 'usage' | 'pills' | 'hero'
}

const NativeReport: React.ComponentType<NativeProps> | null =
  isScreenTimeReportAvailable ? requireNativeComponent<NativeProps>(NAME) : null

class ReportBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}

export function ScreenTimeReport({ fallback, ...props }: ReportProps) {
  if (!NativeReport) return <>{fallback ?? null}</>
  return (
    <ReportBoundary fallback={fallback}>
      <NativeReport {...props} />
    </ReportBoundary>
  )
}
