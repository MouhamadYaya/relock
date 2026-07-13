import ManagedSettings
import SwiftUI

/// Rendu du temps d'écran : total, graphe horaire (quadrillage + axe Y à
/// droite en min/h), et top apps avec leurs vraies icônes (rendues par iOS).
struct UsageReportView: View {
  let model: UsageModel

  private let accent = Color(red: 0.643, green: 0.604, blue: 0.996)
  private let ink = Color(red: 0.94, green: 0.94, blue: 0.96)
  private let ink2 = Color(red: 0.66, green: 0.67, blue: 0.75)
  private let ink3 = Color(red: 0.42, green: 0.44, blue: 0.51)
  private let grid = Color.white.opacity(0.06)

  private func fmt(_ s: Double) -> String {
    let m = Int(s / 60)
    if m < 60 { return "\(m) min" }
    let h = m / 60
    let r = m % 60
    return r == 0 ? "\(h) h" : "\(h) h \(String(format: "%02d", r))"
  }

  private var axisMax: Double {
    let peak = model.hourly.max() ?? 0
    if peak <= 0 { return 3600 }
    let step = 1800.0 // arrondi à la demi-heure supérieure
    return max(step, (peak / step).rounded(.up) * step)
  }

  private func axisLabel(_ s: Double) -> String {
    if axisMax >= 3600 {
      let h = s / 3600
      return h == h.rounded() ? "\(Int(h))h" : String(format: "%.1fh", h)
    }
    return "\(Int(s / 60))m"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      VStack(alignment: .leading, spacing: 4) {
        Text("Temps d'écran")
          .font(.system(size: 13, weight: .medium)).foregroundColor(ink2)
        Text(fmt(model.totalSeconds))
          .font(.system(size: 30, weight: .bold)).foregroundColor(ink)
        Text("aujourd'hui").font(.system(size: 12)).foregroundColor(ink3)
      }

      chart

      if model.apps.isEmpty {
        Text("Aucune donnée d'usage aujourd'hui.")
          .font(.system(size: 13)).foregroundColor(ink3)
      } else {
        VStack(spacing: 14) {
          ForEach(model.apps.prefix(6)) { app in
            HStack(spacing: 12) {
              if let token = app.token {
                Label(token).font(.system(size: 15)).foregroundColor(ink)
              } else {
                Text(app.name).font(.system(size: 15)).foregroundColor(ink)
              }
              Spacer(minLength: 8)
              Text(fmt(app.seconds))
                .font(.system(size: 14, weight: .medium)).foregroundColor(ink2)
            }
          }
        }
      }
    }
    .padding(20)
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private var chart: some View {
    HStack(alignment: .top, spacing: 8) {
      GeometryReader { geo in
        ZStack(alignment: .bottom) {
          VStack(spacing: 0) { // quadrillage léger (3 lignes)
            Rectangle().fill(grid).frame(height: 1)
            Spacer()
            Rectangle().fill(grid).frame(height: 1)
            Spacer()
            Rectangle().fill(grid).frame(height: 1)
          }
          HStack(alignment: .bottom, spacing: 2) {
            ForEach(0..<24, id: \.self) { i in
              let frac = axisMax > 0 ? model.hourly[i] / axisMax : 0
              RoundedRectangle(cornerRadius: 2)
                .fill(accent.opacity(model.hourly[i] > 0 ? 0.9 : 0.12))
                .frame(height: max(2, geo.size.height * frac))
                .frame(maxWidth: .infinity)
            }
          }
        }
      }
      .frame(height: 130)

      VStack { // axe Y à droite (min / h selon le niveau)
        Text(axisLabel(axisMax)).font(.system(size: 10)).foregroundColor(ink3)
        Spacer()
        Text(axisLabel(axisMax / 2)).font(.system(size: 10)).foregroundColor(ink3)
        Spacer()
        Text("0").font(.system(size: 10)).foregroundColor(ink3)
      }
      .frame(width: 30, height: 130)
    }
  }
}
