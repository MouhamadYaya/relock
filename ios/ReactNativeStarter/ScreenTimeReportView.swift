import DeviceActivity
import React
import SwiftUI
import UIKit
import os

/// Héberge un rapport de temps d'écran (extension RelockActivityReport) dans une
/// UIView pour RN.
/// - `mode` : « usage » (Activité : résumé + graphe + classement statiques),
///   « home » (total + delta + pilules, ancienne maquette Accueil) ou
///   « hero » (total + delta seuls, maquette Accueil v2).
/// - `offset` : recule de 0 à 6 jours dans le temps.
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
  let offset: Int
  let mode: String
  /// Change à chaque reconstruction : force SwiftUI à créer un NOUVEAU
  /// DeviceActivityReport (nouvelle connexion à l'extension), au lieu de
  /// « mettre à jour » une surface distante peut-être morte.
  let epoch: Int

  /// Intervalle du jour demandé.
  private func interval(_ cal: Calendar, _ now: Date) -> DateInterval {
    let safeOffset = min(max(offset, 0), 6)
    let anchor = cal.date(byAdding: .day, value: -safeOffset, to: now) ?? now
    return cal.dateInterval(of: .day, for: anchor)
      ?? DateInterval(start: anchor, duration: 86_400)
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

    case "hero":
      // Même filtre que « home » (hier → fin d'aujourd'hui, segments
      // quotidiens) : seul le rendu change côté extension (pas de pilules).
      let today =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      let start = cal.date(byAdding: .day, value: -1, to: today.start) ?? today.start
      DeviceActivityReport(
        DeviceActivityReport.Context("TodayHero"),
        filter: DeviceActivityFilter(
          segment: .daily(during: DateInterval(start: start, end: today.end)),
          users: .all, devices: devices))

    default:
      // Activité : UN SEUL rapport plein écran. Son extension possède le seul
      // ScrollView vertical de la page.
      let iv = interval(cal, now)
      let safeOffset = min(max(offset, 0), 6)
      DeviceActivityReport(
        DeviceActivityReport.Context("ActivityP0O\(safeOffset)"),
        filter: DeviceActivityFilter(
          segment: .hourly(during: iv), users: .all, devices: devices))
    }
  }

  var body: some View {
    report
      .id(epoch)
  }
}

private final class ActivityControlsOverlay: UIView {
  var onSelect: ((Int) -> Void)?
  var onRefresh: (() -> Void)?
  var onSettings: (() -> Void)?

  private let titleLabel = UILabel()
  private let refreshButton = UIButton(type: .custom)
  private let settingsButton = UIButton(type: .custom)
  private let dateContainer = UIView()
  private var dateButtons: [UIButton] = []
  private var selectedOffset = 0
  private var refreshRevision = 0

  private let background = UIColor(red: 0.043, green: 0.047, blue: 0.063, alpha: 1)
  private let accent = UIColor(red: 0.643, green: 0.604, blue: 0.996, alpha: 1)
  private let ink = UIColor(red: 0.94, green: 0.94, blue: 0.96, alpha: 1)
  private let ink2 = UIColor(red: 0.66, green: 0.67, blue: 0.75, alpha: 1)
  private let ink3 = UIColor(red: 0.46, green: 0.48, blue: 0.56, alpha: 1)
  private let surface = UIColor(red: 0.110, green: 0.122, blue: 0.169, alpha: 1)

  override init(frame: CGRect) {
    super.init(frame: frame)
    configure()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configure()
  }

  private func configure() {
    backgroundColor = background

    titleLabel.text = "Activité"
    titleLabel.textColor = ink
    titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
    titleLabel.accessibilityTraits = .header
    titleLabel.accessibilityIdentifier = "activity-native-title"
    addSubview(titleLabel)

    configureHeaderButton(
      refreshButton,
      symbol: "arrow.clockwise",
      label: "Rafraîchir",
      identifier: "activity-native-refresh")
    refreshButton.addAction(UIAction { [weak self] _ in self?.onRefresh?() }, for: .touchUpInside)

    configureHeaderButton(
      settingsButton,
      symbol: "gearshape",
      label: "Réglages",
      identifier: "activity-native-settings")
    settingsButton.addAction(UIAction { [weak self] _ in self?.onSettings?() }, for: .touchUpInside)

    addSubview(dateContainer)
    update(offset: 0)
  }

  private func configureHeaderButton(
    _ button: UIButton,
    symbol: String,
    label: String,
    identifier: String
  ) {
    let configuration = UIImage.SymbolConfiguration(pointSize: 18, weight: .medium)
    button.setImage(UIImage(systemName: symbol, withConfiguration: configuration), for: .normal)
    button.tintColor = ink2
    button.backgroundColor = UIColor(white: 1, alpha: 0.06)
    button.layer.cornerRadius = 19
    button.layer.borderWidth = 1
    button.layer.borderColor = UIColor(white: 1, alpha: 0.10).cgColor
    button.accessibilityLabel = label
    button.accessibilityIdentifier = identifier
    addSubview(button)
  }

  func update(offset: Int) {
    selectedOffset = min(max(offset, 0), 6)
    rebuildDateButtons()
    setNeedsLayout()
  }

  func acknowledgeRefresh() {
    refreshRevision += 1
    refreshButton.accessibilityValue = "Actualisé \(refreshRevision)"
    UIView.animate(
      withDuration: 0.28,
      animations: {
        self.refreshButton.imageView?.transform = CGAffineTransform(rotationAngle: .pi)
      },
      completion: { _ in
        UIView.animate(withDuration: 0.28) {
          self.refreshButton.imageView?.transform = .identity
        }
      })
  }

  private func rebuildDateButtons() {
    dateButtons.forEach { $0.removeFromSuperview() }
    dateButtons.removeAll()

    for option in dayOptions() {
      let button = UIButton(type: .custom)
      button.tag = option.offset
      button.setTitle(option.label, for: .normal)
      button.setTitleColor(option.offset == selectedOffset ? background : ink, for: .normal)
      button.titleLabel?.font = .systemFont(
        ofSize: 13,
        weight: option.offset == selectedOffset ? .bold : .medium)
      button.titleLabel?.numberOfLines = 2
      button.titleLabel?.textAlignment = .center
      button.backgroundColor = option.offset == selectedOffset ? accent : surface
      button.layer.cornerRadius = 22
      button.accessibilityIdentifier = "activity-native-day-\(option.offset)"
      button.accessibilityTraits =
        option.offset == selectedOffset ? [.button, .selected] : .button
      button.addAction(UIAction { [weak self, weak button] _ in
        guard let button else { return }
        self?.onSelect?(button.tag)
      }, for: .touchUpInside)
      dateContainer.addSubview(button)
      dateButtons.append(button)
    }
  }

  private func dayOptions() -> [(offset: Int, label: String)] {
    let calendar = Calendar.current
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "fr_FR")
    formatter.dateFormat = "EEEEE"
    return stride(from: 6, through: 0, by: -1).map { offset in
      let date = calendar.date(byAdding: .day, value: -offset, to: Date()) ?? Date()
      let letter = formatter.string(from: date).uppercased()
      return (offset, "\(letter)\n\(calendar.component(.day, from: date))")
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    let horizontal: CGFloat = 20
    titleLabel.frame = CGRect(x: horizontal, y: 4, width: bounds.width - 150, height: 38)
    settingsButton.frame = CGRect(x: bounds.width - horizontal - 38, y: 4, width: 38, height: 38)
    refreshButton.frame = CGRect(x: settingsButton.frame.minX - 48, y: 4, width: 38, height: 38)

    dateContainer.frame = CGRect(
      x: horizontal, y: 56, width: bounds.width - horizontal * 2, height: 78)
    let count = CGFloat(max(dateButtons.count, 1))
    let spacing: CGFloat = 8
    let width = (dateContainer.bounds.width - spacing * (count - 1)) / count
    for (index, button) in dateButtons.enumerated() {
      button.frame = CGRect(
        x: CGFloat(index) * (width + spacing),
        y: 8,
        width: width,
        height: 56)
    }
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard let hit = super.hitTest(point, with: event) else { return nil }
    var candidate: UIView? = hit
    while let view = candidate, view !== self {
      if view is UIControl { return hit }
      candidate = view.superview
    }
    return nil
  }
}

@objc(ScreenTimeReportView)
final class ScreenTimeReportView: UIView {
  fileprivate static let log = Logger(
    subsystem: "com.yaya.relock", category: "reportview")

  override init(frame: CGRect) {
    super.init(frame: frame)
    configureActivityControls()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configureActivityControls()
  }

  @objc var offset: NSNumber = 0 {
    didSet {
      if oldValue != offset { setNeedsRebuild() }
      updateActivityControls()
    }
  }
  @objc var mode: NSString = "usage" {
    didSet {
      if oldValue != mode {
        updateActivityControls()
        setNeedsRebuild()
      }
    }
  }
  @objc var reloadToken: NSNumber = 0 {
    didSet { if oldValue != reloadToken { setNeedsRebuild() } }
  }
  @objc var onCommand: RCTDirectEventBlock?
  var onNavigateToSettings: (() -> Void)?

  private var hosting: UIViewController?
  private var rebuildWorkItem: DispatchWorkItem?
  private var epoch = 0
  private let activityControls = ActivityControlsOverlay()

  private func configureActivityControls() {
    activityControls.onSelect = { [weak self] offset in
      guard let self else { return }
      self.offset = NSNumber(value: offset)
      self.onCommand?(["command": "select.day\(offset)"])
    }
    activityControls.onRefresh = { [weak self] in
      guard let self else { return }
      // Ne jamais détruire ici le rapport visible : iOS peut refuser de
      // repeindre une DeviceActivityReport recréée immédiatement et laisser
      // l'écran vide. La surface courante reste alimentée par Temps d'écran;
      // on invalide uniquement sa présentation locale.
      self.activityControls.acknowledgeRefresh()
      self.hosting?.view.setNeedsLayout()
      self.hosting?.view.setNeedsDisplay()
    }
    activityControls.onSettings = { [weak self] in
      self?.onNavigateToSettings?()
    }
    addSubview(activityControls)
    updateActivityControls()
  }

  private func updateActivityControls() {
    activityControls.isHidden = mode != "usage"
    activityControls.update(offset: offset.intValue)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      // Hors fenêtre, le contenu distant est déjà mort : on ne « conserve »
      // rien, on libère. Le rattachement reconstruira à neuf.
      rebuildWorkItem?.cancel()
      rebuildWorkItem = nil
      hosting?.view.removeFromSuperview()
      hosting = nil
    } else {
      setNeedsRebuild()
    }
  }

  /// RN affecte les props sur plusieurs cycles. Un léger debounce attend la
  /// configuration complète avant de créer le rapport : aucune connexion
  /// Apple intermédiaire n'est lancée puis détruite en plein calcul.
  private func setNeedsRebuild() {
    rebuildWorkItem?.cancel()
    let work = DispatchWorkItem { [weak self] in
      self?.rebuildWorkItem = nil
      self?.rebuild()
    }
    rebuildWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08, execute: work)
  }

  private func rebuild() {
    guard window != nil, #available(iOS 16.0, *) else { return }
    epoch += 1
    ScreenTimeReportView.log.info(
      "rebuild #\(self.epoch, privacy: .public) mode=\(self.mode, privacy: .public) offset=\(self.offset.intValue, privacy: .public)"
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
        rootView: MockReport(mode: mode as String))
    #else
      let root = ReportContainer(
        offset: offset.intValue, mode: mode as String, epoch: epoch)
      let vc = UIHostingController(rootView: root)
    #endif
    vc.view.backgroundColor = .clear
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(vc.view)
    hosting = vc
    bringSubviewToFront(activityControls)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hosting?.view.frame = bounds
    activityControls.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 134)
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
    MockApp(name: "Plans", minutes: 4, symbol: "map.fill",
            tint: Color(red: 0.35, green: 0.69, blue: 0.43)),
    MockApp(name: "Photos", minutes: 3, symbol: "photo.fill",
            tint: Color(red: 0.38, green: 0.58, blue: 0.94)),
  ]

  private func mockDuration(_ m: Int) -> String {
    if m < 60 { return "\(m)m" }
    let h = m / 60
    let r = m % 60
    return r == 0 ? "\(h)h" : "\(h)h \(r)"
  }

  private struct MockReport: View {
    let mode: String

    var body: some View {
      if mode == "home" {
        MockHomeView()
      } else if mode == "hero" {
        MockHeroView()
      } else {
        MockUsageView()
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

  /// Bloc Accueil factice, sans pilules (miroir de HeroTotalView) — maquette v2.
  private struct MockHeroView: View {
    private let ink = Color(red: 0.961, green: 0.961, blue: 0.969)
    private let unit = Color(red: 0.922, green: 0.922, blue: 0.961).opacity(0.45)
    private let green = Color(red: 0.373, green: 0.788, blue: 0.545)

    var body: some View {
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
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .environment(\.colorScheme, .dark)
    }
  }

  /// Écran Activité factice : total, graphe, classement (miroir d'UsageReportView).
  private struct MockUsageView: View {
    private let ink = Color(red: 0.941, green: 0.941, blue: 0.957)
    private let ink2 = Color(red: 0.66, green: 0.67, blue: 0.75)
    private let accent = Color(red: 0.643, green: 0.604, blue: 0.996)
    private let card = Color.white.opacity(0.045)

    private let bars: [CGFloat] =
      [0.2, 0.35, 0.5, 0.3, 0.8, 0.6, 0.9, 0.7, 0.4, 0.55, 0.65, 0.45]
    private let axis = ["6h", "9h", "12h", "15h", "18h", "21h"]

    var body: some View {
      ScrollView(.vertical, showsIndicators: false) {
        VStack(alignment: .leading, spacing: 18) {
          Color.clear.frame(height: 134).accessibilityHidden(true)
          // Résumé
          VStack(alignment: .leading, spacing: 4) {
            Text("Temps d'écran").font(.system(size: 13)).foregroundColor(ink2)
            Text("3 h 12").font(.system(size: 34, weight: .bold)).foregroundColor(ink)
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
            ForEach(mockApps.prefix(8).indices, id: \.self) { i in
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
              if i < 7 {
                Divider().overlay(Color.white.opacity(0.06))
              }
            }
          }
          .padding(.horizontal, 14)
          .background(RoundedRectangle(cornerRadius: 18).fill(card))
          .accessibilityIdentifier("activity-native-apps")

          VStack(alignment: .leading, spacing: 12) {
            Text("Autres statistiques")
              .font(.system(size: 23, weight: .bold))
              .foregroundColor(ink)
            mockStatCard(
              value: 186,
              title: "Notifications",
              subtitle: "reçues sur la période",
              imageName: "notification-card")
            mockStatCard(
              value: 42,
              title: "Prises en main",
              subtitle: "sur la période",
              imageName: "pickups-card")
          }
        }
        .padding(.horizontal, 20)
        .padding(.top, 4)
        .padding(.bottom, 32)
      }
      .accessibilityIdentifier("activity-native-scroll")
      .background(Color(red: 0.043, green: 0.047, blue: 0.063))
      .environment(\.colorScheme, .dark)
    }

    private func mockStatCard(
      value: Int,
      title: String,
      subtitle: String,
      imageName: String
    ) -> some View {
      let surface = Color(red: 0.082, green: 0.086, blue: 0.102)
      return ZStack(alignment: .leading) {
        surface
        Image(imageName)
          .resizable()
          .scaledToFill()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .clipped()
          .accessibilityHidden(true)
        LinearGradient(
          colors: [surface, surface.opacity(0.96), surface.opacity(0.20)],
          startPoint: .leading,
          endPoint: .trailing)
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text("\(value)")
            .font(.system(size: 52, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundColor(ink)
            .lineLimit(1)
            .minimumScaleFactor(0.65)
            .layoutPriority(1)
          VStack(alignment: .leading, spacing: 1) {
            Text(title)
              .font(.system(size: 18, weight: .semibold))
              .foregroundColor(ink)
              .lineLimit(1)
              .minimumScaleFactor(0.82)
            Text(subtitle)
              .font(.system(size: 13))
              .foregroundColor(ink2)
              .lineLimit(1)
              .minimumScaleFactor(0.82)
          }
        }
        .padding(.leading, 18)
        .padding(.trailing, 18)
      }
      .frame(height: 168)
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 22, style: .continuous)
          .stroke(Color.white.opacity(0.08), lineWidth: 1)
      )
      .accessibilityElement(children: .combine)
    }
  }
#endif
