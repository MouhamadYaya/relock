import React from 'react'
import {
  Platform,
  requireNativeComponent,
  UIManager,
  type ViewProps,
} from 'react-native'

type Props = ViewProps & {
  /** Identité stable du jeton (cf. `ScreenTime.appKeys` / `blockedAppKeys`). */
  tokenKey: string
  /** Force une nouvelle résolution sans démonter la vue. */
  reloadToken?: number
}

const NAME = 'BlockedAppIconsView'

// ⚠️ `requireNativeComponent` ne lève JAMAIS d'exception quand la vue
// n'existe pas — l'erreur exploserait au rendu. La vraie détection passe
// par le registre UIManager (même stratégie que ScreenTimeReport.tsx).
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

export const isBlockedAppIconsAvailable = hasNativeView(NAME)

const NativeBlockedAppIcons: React.ComponentType<Props> | null =
  isBlockedAppIconsAvailable ? requireNativeComponent<Props>(NAME) : null

class IconsBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    if (this.state.failed) return null
    return this.props.children
  }
}

/**
 * Icône RÉELLE d'une app bloquée — Apple ne l'expose jamais au JS (jeton
 * opaque), seule une vue native (`Label(ApplicationToken)`) peut la restituer.
 * Ne rend RIEN si la vue native est absente (Android, iOS < 16, simulateur) ou
 * si le jeton ne se résout pas : jamais d'icône devinée.
 */
export function BlockedAppIcons({ tokenKey, ...rest }: Props) {
  if (!NativeBlockedAppIcons) return null
  return (
    <IconsBoundary>
      <NativeBlockedAppIcons tokenKey={tokenKey} {...rest} />
    </IconsBoundary>
  )
}
