import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI

/// Extension DeviceActivityReport de Relock.
/// Seul endroit où iOS autorise la lecture du temps d'écran système réel
/// (par app, par heure) et le rendu des vraies icônes d'apps. Le contenu est
/// une vue SwiftUI, hébergée dans l'app via `DeviceActivityReport(.usage, …)`.
@main
struct RelockActivityReport: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    UsageReport { model in
      UsageReportView(model: model)
    }
  }
}

extension DeviceActivityReport.Context {
  static let usage = Self("Usage")
}

struct AppUsage: Identifiable {
  let id: String
  let name: String
  let seconds: Double
  let token: ApplicationToken?
}

struct UsageModel {
  var totalSeconds: Double = 0
  var hourly: [Double] = Array(repeating: 0, count: 24)
  var apps: [AppUsage] = []
}

struct UsageReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .usage
  let content: (UsageModel) -> UsageReportView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> UsageModel {
    var model = UsageModel()
    var byApp: [String: AppUsage] = [:]

    for await entry in data {
      for await segment in entry.activitySegments {
        let hour = Calendar.current.component(
          .hour, from: segment.dateInterval.start)
        let dur = segment.totalActivityDuration
        model.totalSeconds += dur
        if hour >= 0, hour < 24 { model.hourly[hour] += dur }

        for await category in segment.categories {
          for await app in category.applications {
            let sec = app.totalActivityDuration
            guard sec > 0 else { continue }
            let name = app.application.localizedDisplayName ?? "App"
            let key = app.application.bundleIdentifier ?? name
            let prev = byApp[key]?.seconds ?? 0
            byApp[key] = AppUsage(
              id: key, name: name, seconds: prev + sec,
              token: app.application.token)
          }
        }
      }
    }

    model.apps = byApp.values.sorted { $0.seconds > $1.seconds }
    return model
  }
}
