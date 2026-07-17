import ManagedSettings
import SwiftUI

// Palette partagée par les vues du rapport (mode sombre forcé : sinon iOS rend
// les libellés système des apps en noir).
enum ReportPalette {
  static let accent = Color(red: 0.643, green: 0.604, blue: 0.996)
  static let ink = Color(red: 0.94, green: 0.94, blue: 0.96)
  static let ink2 = Color(red: 0.66, green: 0.67, blue: 0.75)
  static let ink3 = Color(red: 0.46, green: 0.48, blue: 0.56)
  static let card = Color.white.opacity(0.04)
  static let grid = Color.white.opacity(0.07)
  static let track = Color.white.opacity(0.08)
}

/// « 36 min » / « 2 h 14 » — format partagé.
func formatDuration(_ s: Double) -> String {
  let m = Int(s / 60)
  if m < 60 { return "\(m) min" }
  let h = m / 60
  let r = m % 60
  return r == 0 ? "\(h) h" : "\(h) h \(String(format: "%02d", r))"
}

/// L'Activité entière : résumé, graphe, classement — dans UN ScrollView.
///
/// ⚠️ Ce ScrollView est le SEUL défilement possible de l'écran. La vue d'un
/// rapport est rendue hors process et iOS lui route les touches directement,
/// sans passer par la hiérarchie de l'app : un ScrollView côté React Native
/// ne reçoit jamais le geste au-dessus d'un rapport (vérifié — le `hitTest`
/// de la vue hôte n'est jamais appelé). D'où l'obligation de tout réunir ici.
struct UsageReportView: View {
  let model: UsageModel

  private var maxAppSeconds: Double { model.apps.first?.seconds ?? 1 }

  var body: some View {
    ScrollView(showsIndicators: false) {
      VStack(alignment: .leading, spacing: 14) {
        summaryCard
        chartSection
        appsSection
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.vertical, 4)
    }
    .environment(\.colorScheme, .dark)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  // MARK: Résumé

  private var summaryCard: some View {
    VStack(alignment: .leading, spacing: 12) {
      VStack(alignment: .leading, spacing: 2) {
        if !model.dateLabel.isEmpty {
          Text(model.dateLabel)
            .font(.system(size: 13)).foregroundColor(ReportPalette.ink3)
        }
        Text(model.isEmpty ? "—" : formatDuration(model.totalSeconds))
          .font(.system(size: 30, weight: .bold))
          .foregroundColor(ReportPalette.ink)
        Text("Temps d'écran")
          .font(.system(size: 13, weight: .medium))
          .foregroundColor(ReportPalette.ink2)
      }
      if !model.isEmpty {
        HStack(spacing: 28) {
          stat("\(model.totalPickups)", "Activations")
          stat("\(model.totalNotifications)", "Notifications")
        }
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 18).fill(ReportPalette.card))
  }

  private func stat(_ value: String, _ label: String) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(value)
        .font(.system(size: 22, weight: .bold))
        .foregroundColor(ReportPalette.ink)
      Text(label)
        .font(.system(size: 12)).foregroundColor(ReportPalette.ink3)
    }
  }

  // MARK: Graphe

  private var chartSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(model.isHourly ? "Temps d'écran par heure" : "Temps d'écran par jour")
        .font(.system(size: 14, weight: .semibold))
        .foregroundColor(ReportPalette.ink2)
      UsageChartView(model: model)
    }
  }

  // MARK: Classement

  private var appsSection: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Temps d'écran le plus élevé")
        .font(.system(size: 14, weight: .semibold))
        .foregroundColor(ReportPalette.ink2)
      if model.apps.isEmpty {
        // « Aucune donnée » ≠ « 0 minute » : iOS ne conserve qu'un historique
        // court, le dire évite de faire passer une absence pour une mesure.
        Text(
          model.beyondRetention
            ? "iOS ne conserve pas le détail du temps d'écran aussi loin dans le passé."
            : "Aucune donnée d'usage sur la période."
        )
        .font(.system(size: 13)).foregroundColor(ReportPalette.ink3)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.vertical, 8)
      } else {
        VStack(spacing: 14) {
          ForEach(model.apps.prefix(8)) { app in
            appRow(app)
          }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18).fill(ReportPalette.card))
      }
    }
  }

  private func appRow(_ app: AppUsage) -> some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 10) {
        icon(app)
        title(app)
          .font(.system(size: 15, weight: .medium))
          .foregroundColor(ReportPalette.ink)
          .lineLimit(1)
        Spacer(minLength: 8)
        Text(formatDuration(app.seconds))
          .font(.system(size: 14, weight: .semibold))
          .foregroundColor(ReportPalette.ink2)
      }
      // Barre proportionnelle (consommation vs app la plus utilisée).
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(ReportPalette.track).frame(height: 4)
          let frac = maxAppSeconds > 0 ? app.seconds / maxAppSeconds : 0
          Capsule().fill(ReportPalette.accent)
            .frame(width: max(4, geo.size.width * frac), height: 4)
        }
      }
      .frame(height: 4)
      Text(metaLine(app))
        .font(.system(size: 12)).foregroundColor(ReportPalette.ink3)
    }
  }

  /// Nom réel : seul iOS connaît celui d'une app non sélectionnée — il n'est
  /// lisible qu'en rendant son `Label`, jamais sous forme de chaîne.
  @ViewBuilder
  private func title(_ app: AppUsage) -> some View {
    switch app.icon {
    case .app(let token): Label(token).labelStyle(.titleOnly)
    case .web(let token): Label(token).labelStyle(.titleOnly)
    case .none: Text(app.name)
    }
  }

  @ViewBuilder
  private func icon(_ app: AppUsage) -> some View {
    switch app.icon {
    case .app(let token):
      Label(token).labelStyle(.iconOnly).font(.system(size: 26))
        .frame(width: 30, height: 30)
    case .web(let token):
      Label(token).labelStyle(.iconOnly).font(.system(size: 26))
        .frame(width: 30, height: 30)
    case .none:
      RoundedRectangle(cornerRadius: 7).fill(ReportPalette.track)
        .frame(width: 30, height: 30)
    }
  }

  /// Un site web n'a ni activations ni notifications : ne pas afficher
  /// « 0 activation » pour lui, ce serait une mesure qui n'existe pas.
  private func metaLine(_ app: AppUsage) -> String {
    if case .web = app.icon { return "Site web" }
    let a = "\(app.pickups) activation\(app.pickups > 1 ? "s" : "")"
    let n = "\(app.notifications) notification\(app.notifications > 1 ? "s" : "")"
    return "\(a) · \(n)"
  }
}

// MARK: - Graphe

/// Graphe seul (fond quadrillé + axes), intégré au rapport. Sa granularité
/// vient du contexte qui l'alimente : elle reste donc juste même quand la
/// période ne contient aucune donnée.
struct UsageChartView: View {
  let model: UsageModel

  private var axisMax: Double {
    let peak = model.values.max() ?? 0
    if peak <= 0 { return model.isHourly ? 3_600 : 7_200 }
    let step = model.isHourly ? 1_800.0 : 3_600.0
    return max(step, (peak / step).rounded(.up) * step)
  }

  private func yLabel(_ s: Double) -> String {
    if axisMax >= 3_600 {
      let h = s / 3_600
      return h == h.rounded() ? "\(Int(h))h" : String(format: "%.1fh", h)
    }
    return "\(Int(s / 60))m"
  }

  var body: some View { chartCard }

  private var chartCard: some View {
    HStack(alignment: .top, spacing: 6) {
      VStack(spacing: 6) {
        ZStack {
          gridBackground
          bars
        }
        .frame(height: 128)
        xAxis
      }
      yAxis
    }
    .padding(14)
    .background(RoundedRectangle(cornerRadius: 18).fill(ReportPalette.card))
  }

  private var gridBackground: some View {
    ZStack {
      VStack(spacing: 0) {  // lignes horizontales
        ForEach(0..<4) { i in
          Rectangle().fill(ReportPalette.grid).frame(height: 1)
          if i < 3 { Spacer() }
        }
      }
      HStack(spacing: 0) {  // repères verticaux (¼ · ½ · ¾)
        ForEach(0..<4) { i in
          if i > 0 {
            Rectangle().fill(ReportPalette.grid).frame(width: 1)
            Spacer()
          } else {
            Spacer()
          }
        }
      }
    }
  }

  private var bars: some View {
    GeometryReader { geo in
      HStack(alignment: .bottom, spacing: 2) {
        ForEach(model.values.indices, id: \.self) { i in
          let frac = axisMax > 0 ? model.values[i] / axisMax : 0
          RoundedRectangle(cornerRadius: 1.5)
            .fill(ReportPalette.accent.opacity(model.values[i] > 0 ? 0.95 : 0.10))
            .frame(height: max(2, geo.size.height * frac))
            .frame(maxWidth: .infinity)
        }
      }
      .frame(maxHeight: .infinity, alignment: .bottom)
    }
  }

  private var xAxis: some View {
    HStack(spacing: 0) {
      ForEach(model.xLabels.indices, id: \.self) { i in
        Text(model.xLabels[i])
          .font(.system(size: 10)).foregroundColor(ReportPalette.ink3)
          .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
  }

  private var yAxis: some View {
    VStack(alignment: .trailing) {
      Text(yLabel(axisMax))
        .font(.system(size: 10)).foregroundColor(ReportPalette.ink3)
      Spacer()
      Text(yLabel(axisMax / 2))
        .font(.system(size: 10)).foregroundColor(ReportPalette.ink3)
      Spacer()
      Text("0").font(.system(size: 10)).foregroundColor(ReportPalette.ink3)
    }
    .frame(width: 26, height: 128)
  }
}
