import React from 'react'
import { Platform, requireNativeComponent, type ViewProps } from 'react-native'

type ReportProps = ViewProps & { period?: number }

// Vue native qui héberge le rapport de temps d'écran système (extension
// DeviceActivityReport). period : 0 = jour, 1 = semaine, 2 = mois.
let NativeReport: React.ComponentType<ReportProps> | null = null
try {
  if (Platform.OS === 'ios') {
    NativeReport = requireNativeComponent<ReportProps>('ScreenTimeReportView')
  }
} catch {
  NativeReport = null
}

export const isScreenTimeReportAvailable = NativeReport != null

export function ScreenTimeReport(props: ReportProps) {
  if (!NativeReport) return null
  return <NativeReport {...props} />
}
