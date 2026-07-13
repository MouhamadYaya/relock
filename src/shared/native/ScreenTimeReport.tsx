import React from 'react'
import { Platform, requireNativeComponent, type ViewProps } from 'react-native'

type ReportProps = ViewProps & { period?: number }
const NAME = 'ScreenTimeReportView'

// On récupère le composant (l'échec « View config not found » survient au RENDU,
// pas ici) — on le tente et on le protège par un ErrorBoundary.
let NativeReport: React.ComponentType<ReportProps> | null = null
try {
  if (Platform.OS === 'ios') {
    NativeReport = requireNativeComponent<ReportProps>(NAME)
  }
} catch {
  NativeReport = null
}

export const isScreenTimeReportAvailable = Platform.OS === 'ios'

class ReportBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export function ScreenTimeReport({
  fallback,
  ...props
}: ReportProps & { fallback?: React.ReactNode }) {
  if (!NativeReport) return <>{fallback ?? null}</>
  const Native = NativeReport
  return (
    <ReportBoundary fallback={fallback ?? null}>
      <Native {...props} />
    </ReportBoundary>
  )
}
