import React from 'react'
import {
  Platform,
  requireNativeComponent,
  UIManager,
  type ViewProps,
} from 'react-native'

type ReportProps = ViewProps & { period?: number }
const NAME = 'ScreenTimeReportView'

// Le composant existe seulement si le view manager natif est enregistré.
// (Sinon `requireNativeComponent` plante au rendu : « View config not found ».)
function componentRegistered(): boolean {
  if (Platform.OS !== 'ios') return false
  try {
    return UIManager.getViewManagerConfig?.(NAME) != null
  } catch {
    return false
  }
}

let NativeReport: React.ComponentType<ReportProps> | null = null
if (componentRegistered()) {
  try {
    NativeReport = requireNativeComponent<ReportProps>(NAME)
  } catch {
    NativeReport = null
  }
}

export const isScreenTimeReportAvailable = NativeReport != null

export function ScreenTimeReport(props: ReportProps) {
  if (!NativeReport) return null
  return <NativeReport {...props} />
}
