import DeviceActivity
import SwiftUI
import UIKit
import os

/// Héberge un rapport de temps d'écran (extension RelockActivityReport) dans une
/// UIView pour RN.
/// - `mode` : « usage » (Activité : résumé + graphe + classement, défilant),
///   « pills » (rangée du jour, Accueil) ou « hero » (total + delta, Accueil).
/// - `period` : 0 = jour, 1 = semaine, 2 = mois.
/// - `offset` : recule dans le temps, en unités de la période.
///
/// ⚠️ RÈGLE DE VIE (durement apprise) : `DeviceActivityReport` est une vue
/// DISTANTE — son contenu est rendu hors process par l'extension, et la
/// connexion de rendu MEURT dès que la vue quitte la fenêtre (onglet détaché,
/// app relancée). Un hosting controller « conservé » ne conserve donc RIEN :
/// il ré-affiche une surface morte, d'où les cartes vides aléatoires. La seule
/// stratégie fiable est l'inverse de la conservation :
///   • détaché de la fenêtre  → on DÉTRUIT tout (le contenu est déjà mort) ;
///   • rattaché à la fenêtre  → on reconstruit À NEUF, identité SwiftUI
///     comprise (`.id(epoch)`), pour forcer une nouvelle connexion ;
///   • config changée         → pareil, hosting controller NEUF (remplacer le
///     `rootView` d'un contrôleur existant ne relance pas l'extension une
///     fois sur deux).
/// Le coalescing (une reconstruction max par tour de runloop) reste : RN
/// affecte les props une à une et déclencherait quatre reconstructions.
@available(iOS 16.0, *)
private struct ReportContainer: View {
  let period: Int
  let offset: Int
  let mode: String
  /// Change à chaque reconstruction : force SwiftUI à créer un NOUVEAU
  /// DeviceActivityReport (nouvelle connexion à l'extension), au lieu de
  /// « mettre à jour » une surface distante peut-être morte.
  let epoch: Int

  /// Intervalle de la période demandée (jour / semaine / mois, décalé).
  private func interval(_ cal: Calendar, _ now: Date) -> DateInterval {
    switch period {
    case 1:
      let anchor = cal.date(byAdding: .weekOfYear, value: -offset, to: now) ?? now
      return cal.dateInterval(of: .weekOfYear, for: anchor)
        ?? DateInterval(start: anchor, duration: 604_800)
    case 2:
      let anchor = cal.date(byAdding: .month, value: -offset, to: now) ?? now
      return cal.dateInterval(of: .month, for: anchor)
        ?? DateInterval(start: anchor, duration: 2_592_000)
    default:
      let anchor = cal.date(byAdding: .day, value: -offset, to: now) ?? now
      return cal.dateInterval(of: .day, for: anchor)
        ?? DateInterval(start: anchor, duration: 86_400)
    }
  }

  @ViewBuilder
  private var report: some View {
    let cal = Calendar.current
    let now = Date()
    // iPhone uniquement : `.all` additionnerait Mac/iPad → total > 24 h/jour.
    let devices = DeviceActivityFilter.Devices(.init([.iPhone]))

    switch mode {
    case "home":
      // [hier 00:00 → fin d'aujourd'hui] en segments QUOTIDIENS : la scène
      // combinée en tire le total du jour, le delta vs hier ET les pilules du
      // jour — UN seul rapport pour tout le bloc « Temps d'écran » de l'Accueil.
      let today =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      let start = cal.date(byAdding: .day, value: -1, to: today.start) ?? today.start
      DeviceActivityReport(
        DeviceActivityReport.Context("TodayHome"),
        filter: DeviceActivityFilter(
          segment: .daily(during: DateInterval(start: start, end: today.end)),
          users: .all, devices: devices))

    default:
      // Activité : UN SEUL rapport, qui défile lui-même. Le contexte porte la
      // granularité (heures pour le jour, jours pour semaine/mois).
      let iv = interval(cal, now)
      if period == 0 {
        DeviceActivityReport(
          DeviceActivityReport.Context("UsageHour"),
          filter: DeviceActivityFilter(
            segment: .hourly(during: iv), users: .all, devices: devices))
      } else {
        DeviceActivityReport(
          DeviceActivityReport.Context("UsageDay"),
          filter: DeviceActivityFilter(
            segment: .daily(during: iv), users: .all, devices: devices))
      }
    }
  }

  var body: some View {
    report.id(epoch)
  }
}

@objc(ScreenTimeReportView)
final class ScreenTimeReportView: UIView {
  fileprivate static let log = Logger(
    subsystem: "com.yaya.relock", category: "reportview")

  @objc var period: NSNumber = 0 { didSet { setNeedsRebuild() } }
  @objc var offset: NSNumber = 0 { didSet { setNeedsRebuild() } }
  @objc var mode: NSString = "usage" { didSet { setNeedsRebuild() } }

  private var hosting: UIViewController?
  private var rebuildScheduled = false
  private var epoch = 0

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      // Hors fenêtre, le contenu distant est déjà mort : on ne « conserve »
      // rien, on libère. Le rattachement reconstruira à neuf.
      hosting?.view.removeFromSuperview()
      hosting = nil
    } else {
      setNeedsRebuild()
    }
  }

  /// Reconstruit AU PLUS UNE FOIS par cycle d'exécution (RN affecte les props
  /// une par une ; sans coalescing, jusqu'à quatre reconstructions en cascade
  /// détruisaient le rendu asynchrone en plein calcul).
  private func setNeedsRebuild() {
    guard !rebuildScheduled else { return }
    rebuildScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.rebuildScheduled = false
      self.rebuild()
    }
  }

  private func rebuild() {
    guard window != nil, #available(iOS 16.0, *) else { return }
    epoch += 1
    ScreenTimeReportView.log.info(
      "rebuild #\(self.epoch, privacy: .public) mode=\(self.mode, privacy: .public) period=\(self.period.intValue, privacy: .public) offset=\(self.offset.intValue, privacy: .public)"
    )
    // Toujours un contrôleur NEUF : c'est ce qui force une nouvelle connexion
    // à l'extension de rapport. L'ancien contenu (peut-être mort) part avec.
    hosting?.view.removeFromSuperview()

    #if targetEnvironment(simulator)
      // Le simulateur ne fait PAS tourner Family Controls : un vrai rapport y
      // reste blanc. On rend donc un aperçu à chiffres FICTIFS, uniquement pour
      // valider la mise en page (ce bloc n'est même pas compilé pour l'iPhone,
      // où seuls les vrais rapports s'affichent).
      let vc = UIHostingController(
        rootView: MockReport(mode: mode as String, period: period.intValue))
    #else
      let root = ReportContainer(
        period: period.intValue, offset: offset.intValue,
        mode: mode as String, epoch: epoch)
      let vc = UIHostingController(rootView: root)
    #endif
    vc.view.backgroundColor = .clear
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(vc.view)
    hosting = vc
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hosting?.view.frame = bounds
  }
}

#if targetEnvironment(simulator)
  // MARK: - Aperçu SIMULATEUR (chiffres fictifs)
  //
  // Family Controls ne tourne pas sur simulateur → un vrai DeviceActivityReport
  // y reste blanc. Ces vues reproduisent la mise en page réelle avec des
  // données inventées, pour juger l'écran sans iPhone. Jamais compilées pour un
  // appareil physique (`#if targetEnvironment(simulator)`).

  private struct MockApp {
    let name: String
    let minutes: Int
    let symbol: String
    let tint: Color
  }

  private let mockApps: [MockApp] = [
    MockApp(name: "Instagram", minutes: 80, symbol: "camera.fill",
            tint: Color(red: 0.79, green: 0.33, blue: 0.63)),
    MockApp(name: "TikTok", minutes: 47, symbol: "music.note",
            tint: Color(red: 0.13, green: 0.13, blue: 0.16)),
    MockApp(name: "Safari", minutes: 22, symbol: "safari.fill",
            tint: Color(red: 0.20, green: 0.55, blue: 0.95)),
    MockApp(name: "Messages", minutes: 12, symbol: "message.fill",
            tint: Color(red: 0.30, green: 0.78, blue: 0.36)),
    MockApp(name: "YouTube", minutes: 8, symbol: "play.rectangle.fill",
            tint: Color(red: 0.90, green: 0.22, blue: 0.21)),
    MockApp(name: "Spotify", minutes: 5, symbol: "music.note.list",
            tint: Color(red: 0.11, green: 0.73, blue: 0.33)),
  ]

  private func mockDuration(_ m: Int) -> String {
    if m < 60 { return "\(m)m" }
    let h = m / 60
    let r = m % 60
    return r == 0 ? "\(h)h" : "\(h)h \(r)"
  }

  private struct MockReport: View {
    let mode: String
    let period: Int

    var body: some View {
      if mode == "home" {
        MockHomeView()
      } else {
        MockUsageView(period: period)
      }
    }
  }

  /// Bloc Accueil factice : total + delta + pilules (miroir de HomeSectionView).
  private struct MockHomeView: View {
    private let ink = Color(red: 0.961, green: 0.961, blue: 0.969)
    private let unit = Color(red: 0.922, green: 0.922, blue: 0.961).opacity(0.45)
    private let green = Color(red: 0.373, green: 0.788, blue: 0.545)
    private let time = Color.white.opacity(0.55)
    private let cardBg = Color.white.opacity(0.045)

    var body: some View {
      VStack(alignment: .leading, spacing: 0) {
        // Total + delta
        VStack(alignment: .leading, spacing: 5) {
          HStack(alignment: .firstTextBaseline, spacing: 7) {
            Text("3").font(.system(size: 44, weight: .bold)).kerning(-1.2)
              .foregroundColor(ink)
            Text("h").font(.system(size: 22, weight: .semibold)).foregroundColor(unit)
            Text("12").font(.system(size: 44, weight: .bold)).kerning(-1.2)
              .foregroundColor(ink)
            Text("min").font(.system(size: 22, weight: .semibold)).foregroundColor(unit)
          }
          HStack(spacing: 6) {
            Image(systemName: "chevron.down")
              .font(.system(size: 11, weight: .bold)).foregroundColor(green)
            Text("48 min de moins qu'hier")
              .font(.system(size: 13.5, weight: .medium)).foregroundColor(green)
          }
        }
        .frame(height: 82, alignment: .topLeading)

        Spacer().frame(height: 14)

        // Pilules
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(alignment: .top, spacing: 9) {
            ForEach(mockApps.indices, id: \.self) { i in
              let app = mockApps[i]
              VStack(spacing: 5) {
                RoundedRectangle(cornerRadius: 11, style: .continuous)
                  .fill(app.tint)
                  .frame(width: 42, height: 42)
                  .overlay(
                    Image(systemName: app.symbol)
                      .font(.system(size: 20, weight: .medium))
                      .foregroundColor(.white))
                Text(mockDuration(app.minutes))
                  .font(.system(size: 12, weight: .medium))
                  .foregroundColor(time).lineLimit(1)
              }
              .frame(width: 66, height: 74)
              .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous).fill(cardBg))
            }
          }
          .padding(.horizontal, 2)
        }
        .frame(height: 80)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .environment(\.colorScheme, .dark)
    }
  }

  /// Écran Activité factice : total, graphe, classement (miroir d'UsageReportView).
  private struct MockUsageView: View {
    let period: Int
    private let ink = Color(red: 0.941, green: 0.941, blue: 0.957)
    private let ink2 = Color(red: 0.66, green: 0.67, blue: 0.75)
    private let accent = Color(red: 0.643, green: 0.604, blue: 0.996)
    private let card = Color.white.opacity(0.045)

    private var bars: [CGFloat] {
      period == 0
        ? [0.2, 0.35, 0.5, 0.3, 0.8, 0.6, 0.9, 0.7, 0.4, 0.55, 0.65, 0.45]
        : [0.5, 0.7, 0.4, 0.85, 0.6, 0.95, 0.3]
    }
    private var axis: [String] {
      period == 0
        ? ["6h", "9h", "12h", "15h", "18h", "21h"]
        : period == 1
          ? ["L", "M", "M", "J", "V", "S", "D"]
          : ["S1", "S2", "S3", "S4"]
    }

    var body: some View {
      ScrollView(showsIndicators: false) {
        VStack(alignment: .leading, spacing: 18) {
          // Résumé
          VStack(alignment: .leading, spacing: 4) {
            Text("Temps d'écran").font(.system(size: 13)).foregroundColor(ink2)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
              Text("3 h 12").font(.system(size: 34, weight: .bold)).foregroundColor(ink)
              Text("· 42 activations").font(.system(size: 13)).foregroundColor(ink2)
            }
          }

          // Graphe
          VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .bottom, spacing: 6) {
              ForEach(bars.indices, id: \.self) { i in
                RoundedRectangle(cornerRadius: 4)
                  .fill(i == bars.count - 2 ? accent : accent.opacity(0.35))
                  .frame(maxWidth: .infinity)
                  .frame(height: max(6, bars[i] * 130))
              }
            }
            .frame(height: 130)
            HStack {
              ForEach(axis.indices, id: \.self) { i in
                Text(axis[i]).font(.system(size: 11)).foregroundColor(ink2)
                  .frame(maxWidth: .infinity)
              }
            }
          }
          .padding(14)
          .background(RoundedRectangle(cornerRadius: 18).fill(card))

          // Classement
          VStack(spacing: 0) {
            ForEach(mockApps.prefix(5).indices, id: \.self) { i in
              let app = mockApps[i]
              HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                  .fill(app.tint).frame(width: 34, height: 34)
                  .overlay(Image(systemName: app.symbol)
                    .font(.system(size: 15, weight: .medium)).foregroundColor(.white))
                Text(app.name).font(.system(size: 15, weight: .medium)).foregroundColor(ink)
                Spacer()
                Text(mockDuration(app.minutes))
                  .font(.system(size: 14, weight: .semibold)).foregroundColor(ink2)
              }
              .padding(.vertical, 11)
              if i < 4 {
                Divider().overlay(Color.white.opacity(0.06))
              }
            }
          }
          .padding(.horizontal, 14)
          .background(RoundedRectangle(cornerRadius: 18).fill(card))
        }
        .padding(.bottom, 24)
      }
      .environment(\.colorScheme, .dark)
    }
  }
#endif
