import React from 'react'
import {
  Platform,
  requireNativeComponent,
  UIManager,
  type ViewProps,
} from 'react-native'

type ReportProps = ViewProps & {
  /** Décalage journalier : 0 = aujourd'hui, 6 = il y a six jours. */
  offset?: number
  /**
   * « usage » : l'Activité entière. « home » : le héro et le classement du
   * tableau de bord dans une seule surface native.
   */
  mode?: 'usage' | 'home'
  /** Force une nouvelle connexion au rapport sans démonter la vue native. */
  reloadToken?: number
  /** Décale le classement Home uniquement lorsqu'une carte Blocages existe. */
  showsBlockedCard?: boolean
  /** Commandes émises par la page SwiftUI du rapport Activité. */
  onCommand?: (event: { nativeEvent: { command: string } }) => void
  /** Affiché si la vue native est absente OU si son rendu échoue. */
  fallback?: React.ReactNode
}

const NAME = 'ScreenTimeReportView'

// Vue native qui héberge le rapport de temps d'écran système (extension
// DeviceActivityReport). L'écran Activité expose les sept derniers jours.
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
  offset?: number
  mode?: 'usage' | 'home'
  reloadToken?: number
  showsBlockedCard?: boolean
  onCommand?: (event: { nativeEvent: { command: string } }) => void
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
