import React from 'react'
import { Platform, requireNativeComponent, type ViewProps } from 'react-native'

// Vue native qui héberge le rapport de temps d'écran système (extension
// DeviceActivityReport). Absente hors iOS / sur build sans le composant.
let NativeReport: React.ComponentType<ViewProps> | null = null
try {
  if (Platform.OS === 'ios') {
    NativeReport = requireNativeComponent<ViewProps>('ScreenTimeReportView')
  }
} catch {
  NativeReport = null
}

export const isScreenTimeReportAvailable = NativeReport != null

export function ScreenTimeReport(props: ViewProps) {
  if (!NativeReport) return null
  return <NativeReport {...props} />
}
