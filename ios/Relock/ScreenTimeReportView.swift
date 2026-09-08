import DeviceActivity
import React
import SwiftUI
import UIKit
import os

/// Héberge un rapport de temps d'écran (extension RelockActivityReport) dans une
/// UIView pour RN.
/// - `mode` : « usage » (Activité complète) ou « home » (héro et classement
///   du tableau de bord dans un rapport unique).
/// - `offset` : recule de 0 à 6 jours dans le temps.
///
/// Le rapport est rendu dans un autre processus. Son contrôleur reste enfant
/// du contrôleur RN et sa vue reste attachée à la même UIWindow, même quand un
/// onglet natif détache temporairement l'Accueil. Recréer cette surface à
/// chaque retour rendrait le délai de reconnexion Apple visible.
/// Les props RN sont regroupées pour ne pas interrompre une agrégation encore
/// en cours.
@available(iOS 16.0, *)
private struct ReportContainer: View {
  let offset: Int
  let mode: String
  let showsBlockedCard: Bool
  /// Change à chaque reconstruction : force SwiftUI à créer un NOUVEAU
  /// DeviceActivityReport (nouvelle connexion à l'extension), au lieu de
  /// « mettre à jour » une surface distante peut-être morte.
  let identity: UUID
  let queryDate: Date

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
    let now = queryDate
    // iPhone uniquement : `.all` additionnerait Mac/iPad → total > 24 h/jour.
    let devices = DeviceActivityFilter.Devices(.init([.iPhone]))

    switch mode {
    case "home":
      // [J-7 00:00 → fin d'aujourd'hui] en segments QUOTIDIENS : la scène
      // combinée en tire le total du jour, le delta vs hier, les pilules du
      // jour ET la référence personnelle du score (le score compare
      // l'utilisateur à sa propre médiane, pas à un absolu — sans ces jours de
      // recul il n'y a rien à comparer). UN seul rapport pour tout le bloc.
      let today =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      let start = cal.date(byAdding: .day, value: -7, to: today.start) ?? today.start
      DeviceActivityReport(
        DeviceActivityReport.Context(
          showsBlockedCard ? "TodayHomeWithBlocks" : "TodayHomeWithoutBlocks"),
        filter: DeviceActivityFilter(
          segment: .daily(during: DateInterval(start: start, end: now)),
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
      .id(identity)
  }
}

/// A window attachment happens before a native tab transition has completed.
/// Mount the remote SwiftUI report only after UIKit has finished presenting
/// this child, including when its React Native ScrollView is already scrolled.
private final class ReportHostingController: UIHostingController<AnyView> {
  var onVisible: (() -> Void)?
  private(set) var isVisible = false

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    isVisible = true
    onVisible?()
  }

  override func viewWillDisappear(_ animated: Bool) {
    isVisible = false
    super.viewWillDisappear(animated)
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

    titleLabel.text = RelockLanguage.pick(
      fr: "Activité", en: "Activity", es: "Actividad")
    titleLabel.textColor = ink
    titleLabel.font = .systemFont(ofSize: 24, weight: .bold)
    titleLabel.accessibilityTraits = .header
    titleLabel.accessibilityIdentifier = "activity-native-title"
    addSubview(titleLabel)

    configureHeaderButton(
      refreshButton,
      symbol: "arrow.clockwise",
      label: RelockLanguage.pick(
        fr: "Rafraîchir", en: "Refresh", es: "Actualizar"),
      identifier: "activity-native-refresh")
    refreshButton.addAction(UIAction { [weak self] _ in self?.onRefresh?() }, for: .touchUpInside)

    configureHeaderButton(
      settingsButton,
      symbol: "gearshape",
      label: RelockLanguage.pick(
        fr: "Réglages", en: "Settings", es: "Ajustes"),
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
    refreshButton.accessibilityValue = RelockLanguage.pick(
      fr: "Actualisé \(refreshRevision)",
      en: "Refreshed \(refreshRevision)",
      es: "Actualizado \(refreshRevision)")
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

/// Local controls register touch regions above the out-of-process report.
/// A transparent UIView alone does not reliably intercept it on real iOS.
private final class HomeReportControls: UIControl {
  var onCommand: ((String) -> Void)?
  var showsBlockedCard = false { didSet { setNeedsLayout() } }
  private let hero = UIButton(type: .custom)
  private let apps = UIButton(type: .custom)

  override init(frame: CGRect) {
    super.init(frame: frame)
    configure(
      hero, command: "home.hero",
      label: RelockLanguage.pick(
        fr: "Ouvrir le détail du temps d’écran",
        en: "Open the screen time details",
        es: "Abrir el detalle del tiempo de pantalla"))
    configure(
      apps, command: "home.apps",
      label: RelockLanguage.pick(
        fr: "Voir les applications dans Activité",
        en: "See the apps in Activity",
        es: "Ver las aplicaciones en Actividad"))
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) unavailable") }

  private func configure(_ button: UIButton, command: String, label: String) {
    button.accessibilityIdentifier = command
    button.accessibilityLabel = label
    button.addAction(UIAction { [weak self] _ in self?.onCommand?(command) }, for: .touchUpInside)
    addSubview(button)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Miroir des tokens `homeHeroHeight` / `homeScoreHeight` / `homeBlockedHeight`
    // (relock-material.ts) : hero 360, score 270, carte « Mes apps » 280, gouttières 24.
    hero.frame = CGRect(x: 0, y: 140, width: bounds.width, height: 220)
    // Pas de zone « score » ici : la carte du score est une vraie vue React
    // Native posée par-dessus ce rapport, elle capte son tap elle-meme. Un
    // bouton natif au meme endroit ne ferait que doubler l'element pour
    // VoiceOver.
    apps.frame = CGRect(
      x: 16, y: showsBlockedCard ? 978 : 674, width: bounds.width - 32, height: 232)
  }

  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    // Leave the React Native greeting, streak and Settings controls above it.
    guard point.y >= 140 else { return nil }
    return super.hitTest(point, with: event)
  }
}

@objc(ScreenTimeReportView)
final class ScreenTimeReportView: UIView {
  fileprivate static let log = Logger(
    subsystem: "com.yaya.relock", category: "reportview")

  override init(frame: CGRect) {
    super.init(frame: frame)
    clipsToBounds = true
    isOpaque = false
    backgroundColor = .clear
    configureActivityControls()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    clipsToBounds = true
    isOpaque = false
    backgroundColor = .clear
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
  @objc var showsBlockedCard = false {
    didSet {
      homeTouchSurface.showsBlockedCard = showsBlockedCard
      if oldValue != showsBlockedCard { setNeedsRebuild() }
    }
  }
  @objc var onCommand: RCTDirectEventBlock?
  var onNavigateToSettings: (() -> Void)?

  private var hosting: ReportHostingController?
  private var reportMounted = false
  private var rebuildWorkItem: DispatchWorkItem?
  private var readyWorkItem: DispatchWorkItem?
  private var queryRefreshWorkItems: [DispatchWorkItem] = []
  private var rebuildRevision = 0
  // Monotonic across wrapper lifetimes, so diagnostics can distinguish a
  // new React Native view from a reconnect of an existing one.
  private static var nextEpoch = 0
  private var epoch = 0
  private var reportNeedsRebuild = true
  private var wasBackgrounded = false
  // Native tabs remove an inactive screen from the window. Moving only the
  // remote report into a covered sibling keeps its XPC surface alive without
  // exposing or copying Screen Time data into the host application.
  private let homeParkingContainer = UIView()
  #if DEBUG
    // Instrumentation du cycle de vie de la surface distante.
    //
    // Les logs `os_log` d'un iPhone appairé en Wi-Fi ne sont plus lisibles
    // depuis le Mac (`log stream --device` a disparu de macOS 26), et le
    // contenu d'une extension DeviceActivityReport n'entre pas dans l'arbre
    // d'accessibilité de l'app hôte. Sans ce relais, un rapport vide et un
    // rapport jamais reconstruit sont indiscernables depuis un test.
    private var detachCount = 0
    private var attachCount = 0
    private var requestCount = 0
    private var skipCount = 0
    private var foregroundCount = 0
    private var lastRebuildAt: CFTimeInterval = 0
    private let diagnostics = UIView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
  #endif
  private let activityControls = ActivityControlsOverlay()
  // A local UIKit surface receives touches instead of the out-of-process
  // DeviceActivity surface. Its ancestor RN ScrollView owns the vertical pan.
  private let homeTouchSurface = HomeReportControls()

  deinit {
    NotificationCenter.default.removeObserver(self)
    rebuildWorkItem?.cancel()
    readyWorkItem?.cancel()
    queryRefreshWorkItems.forEach { $0.cancel() }
    let controller = hosting
    let parkingContainer = homeParkingContainer
    DispatchQueue.main.async {
      controller?.willMove(toParent: nil)
      controller?.view.removeFromSuperview()
      controller?.removeFromParent()
      parkingContainer.removeFromSuperview()
    }
  }

  /// Retour d'arrière-plan : mesuré sur iPhone, ce chemin ne produit AUCUN
  /// détachement de fenêtre (`didMoveToWindow` reste muet). L'observateur
  /// distingue donc une vraie reprise pour reconstruire Activity, tandis que
  /// Home conserve volontairement sa surface et ses derniers pixels.
  ///
  /// `willEnterForeground` et NON `didBecomeActive` : ce dernier se déclenche
  /// aussi à la fermeture du centre de contrôle ou d'une alerte système —
  /// mesuré ici, il reconstruisait le rapport alors que l'app n'avait jamais
  /// quitté l'écran, ce qui rend le squelette clignotant sans aucun gain.
  private func observeForeground() {
    NotificationCenter.default.addObserver(
      self, selector: #selector(applicationDidEnterBackground),
      name: UIApplication.didEnterBackgroundNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(applicationWillEnterForeground),
      name: UIApplication.willEnterForegroundNotification, object: nil)
    NotificationCenter.default.addObserver(
      self, selector: #selector(applicationDidBecomeActive),
      name: UIApplication.didBecomeActiveNotification, object: nil)
  }

  @objc private func applicationDidEnterBackground() {
    wasBackgrounded = true
    // Preserve Home's last rendered surface. Rebuilding it on every foreground
    // guarantees a user-visible empty interval while Apple's service reconnects.
    // Activity remains explicitly refreshable and keeps its previous policy.
    if mode != "home" {
      invalidateReport()
    }
    #if DEBUG
      publishDiagnostics()
    #endif
  }

  @objc private func applicationWillEnterForeground() {
    // Une reprise sans passage effectif en arrière-plan ne peut pas avoir tué
    // l'extension : reconstruire là ne ferait que clignoter pour rien.
    guard wasBackgrounded else { return }
    wasBackgrounded = false
    #if DEBUG
      foregroundCount += 1
    #endif
    scheduleRebuildIfNeeded()
  }

  @objc private func applicationDidBecomeActive() {
    // Drain a pending rebuild only. Closing Control Center or a permission
    // alert does not invalidate an already mounted report.
    scheduleRebuildIfNeeded()
    mountVisibleReport()
  }

  private func configureActivityControls() {
    observeForeground()
    activityControls.onSelect = { [weak self] offset in
      guard let self else { return }
      self.offset = NSNumber(value: offset)
      self.onCommand?(["command": "select.day\(offset)"])
    }
    activityControls.onRefresh = { [weak self] in
      guard let self else { return }
      self.activityControls.acknowledgeRefresh()
      // JS checks authorization, then changes reloadToken. All reconnects
      // share the same deferred native mount, including a manual recovery.
      self.onCommand?(["command": "refresh"])
    }
    activityControls.onSettings = { [weak self] in
      self?.onNavigateToSettings?()
    }
    addSubview(activityControls)
    homeTouchSurface.backgroundColor = .clear
    homeTouchSurface.isOpaque = false
    homeTouchSurface.onCommand = { [weak self] command in
      self?.onCommand?(["command": command])
    }
    homeTouchSurface.accessibilityIdentifier = "home-native-touch-surface"
    addSubview(homeTouchSurface)
    #if DEBUG
      diagnostics.isAccessibilityElement = true
      diagnostics.accessibilityIdentifier = "screen-time-report-diagnostics"
      diagnostics.accessibilityLabel = "diagnostic du rapport"
      diagnostics.isUserInteractionEnabled = false
      addSubview(diagnostics)
      publishDiagnostics()
    #endif
    updateActivityControls()
  }

  #if DEBUG
    /// Etat du cycle de vie, lisible par XCUITest via `element.value`.
    private func publishDiagnostics() {
      let age = lastRebuildAt == 0 ? -1 : Int((CACurrentMediaTime() - lastRebuildAt) * 1000)
      diagnostics.accessibilityValue =
        "mode=\(mode) win=\(window == nil ? 0 : 1) host=\(hosting == nil ? 0 : 1)"
        + " visible=\(hosting?.isVisible == true ? 1 : 0) mounted=\(reportMounted ? 1 : 0)"
        + " parked=\(hosting?.view.superview === homeParkingContainer ? 1 : 0)"
        + " epoch=\(epoch) req=\(requestCount) skip=\(skipCount)"
        + " det=\(detachCount) att=\(attachCount) fg=\(foregroundCount)"
        + " tok=\(reloadToken.intValue) age=\(age)"
    }
  #endif

  private func updateActivityControls() {
    activityControls.isHidden = mode != "usage"
    // Le plan tactile local laisse le ScrollView RN reconnaître les pans;
    // les boutons Home sont des frères RN placés au-dessus de ce plan.
    isUserInteractionEnabled = true
    homeTouchSurface.isHidden = mode != "home"
    activityControls.update(offset: offset.intValue)
  }

  private func parkHomeReport(in sourceWindow: UIWindow) {
    guard mode == "home", let reportView = hosting?.view,
      reportView.superview === self
    else { return }

    homeParkingContainer.isUserInteractionEnabled = false
    homeParkingContainer.clipsToBounds = true
    homeParkingContainer.backgroundColor = .clear
    homeParkingContainer.frame = CGRect(origin: .zero, size: reportView.bounds.size)
    homeParkingContainer.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    if homeParkingContainer.superview !== sourceWindow {
      homeParkingContainer.removeFromSuperview()
      if let rootView = sourceWindow.rootViewController?.view,
        rootView.superview === sourceWindow
      {
        sourceWindow.insertSubview(homeParkingContainer, belowSubview: rootView)
      } else {
        sourceWindow.insertSubview(homeParkingContainer, at: 0)
      }
    }
    homeParkingContainer.addSubview(reportView)
    reportView.frame = homeParkingContainer.bounds
    #if DEBUG
      publishDiagnostics()
    #endif
  }

  private func restoreHomeReport() {
    guard mode == "home", let reportView = hosting?.view,
      reportView.superview === homeParkingContainer
    else { return }
    insertSubview(reportView, at: 0)
    reportView.frame = bounds
    homeParkingContainer.removeFromSuperview()
    bringSubviewToFront(homeTouchSurface)
    bringSubviewToFront(activityControls)
    #if DEBUG
      publishDiagnostics()
    #endif
  }

  override func willMove(toWindow newWindow: UIWindow?) {
    // Move between two views of the SAME UIWindow before UIKit detaches the
    // inactive native tab. The report therefore never observes window=nil.
    if newWindow == nil, let sourceWindow = window {
      parkHomeReport(in: sourceWindow)
    }
    super.willMove(toWindow: newWindow)
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    #if DEBUG
      if window == nil { detachCount += 1 } else { attachCount += 1 }
      publishDiagnostics()
    #endif
    if window == nil {
      if mode != "home" {
        invalidateReport()
      }
    } else {
      restoreHomeReport()
      if hosting == nil || reportNeedsRebuild {
        setNeedsRebuild()
      }
    }
  }

  private func removeHostingController() {
    reportMounted = false
    hosting?.onVisible = nil
    hosting?.willMove(toParent: nil)
    hosting?.view.removeFromSuperview()
    hosting?.removeFromParent()
    hosting = nil
    homeParkingContainer.removeFromSuperview()
  }

  private func invalidateReport() {
    reportNeedsRebuild = true
    rebuildRevision += 1
    rebuildWorkItem?.cancel()
    rebuildWorkItem = nil
    readyWorkItem?.cancel()
    readyWorkItem = nil
    queryRefreshWorkItems.forEach { $0.cancel() }
    queryRefreshWorkItems.removeAll()
    removeHostingController()
    #if DEBUG
      publishDiagnostics()
    #endif
  }

  private var parentController: UIViewController? {
    var responder: UIResponder? = next
    while let current = responder {
      if let controller = current as? UIViewController { return controller }
      responder = current.next
    }
    return nil
  }

  /// RN affecte les props sur plusieurs cycles. Un léger debounce attend la
  /// configuration complète avant de créer le rapport : aucune connexion
  /// Apple intermédiaire n'est lancée puis détruite en plein calcul.
  private func setNeedsRebuild() {
    // Tear down BEFORE the debounce, never in the same turn as the new mount.
    // Prop batches and rapid tab changes invalidate all older scheduled work.
    invalidateReport()
    #if DEBUG
      requestCount += 1
      publishDiagnostics()
    #endif
    scheduleRebuildIfNeeded()
  }

  private func scheduleRebuildIfNeeded() {
    guard reportNeedsRebuild, rebuildWorkItem == nil, window != nil,
      !wasBackgrounded, UIApplication.shared.applicationState == .active,
      bounds.width > 0, bounds.height > 0, parentController != nil
    else { return }
    let revision = rebuildRevision
    let work = DispatchWorkItem { [weak self] in
      guard let self, self.rebuildRevision == revision else { return }
      self.rebuildWorkItem = nil
      self.rebuild()
    }
    rebuildWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08, execute: work)
  }

  private func rebuild() {
    guard reportNeedsRebuild, window != nil, !wasBackgrounded,
      UIApplication.shared.applicationState == .active,
      bounds.width > 0, bounds.height > 0,
      let parent = parentController, #available(iOS 16.0, *)
    else {
      #if DEBUG
        skipCount += 1
        publishDiagnostics()
      #endif
      return
    }
    reportNeedsRebuild = false
    ScreenTimeReportView.nextEpoch += 1
    epoch = ScreenTimeReportView.nextEpoch
    #if DEBUG
      lastRebuildAt = CACurrentMediaTime()
      publishDiagnostics()
    #endif
    ScreenTimeReportView.log.info(
      "rebuild #\(self.epoch, privacy: .public) mode=\(self.mode, privacy: .public) offset=\(self.offset.intValue, privacy: .public)"
    )
    // The previous controller was released before scheduling this mount.
    onCommand?(["command": "reloading"])

    let vc = ReportHostingController(rootView: AnyView(Color.clear))
    vc.onVisible = { [weak self] in self?.mountVisibleReport() }
    // Home already lays out its status bar/header and bottom tab clearance.
    // SwiftUI otherwise inserts the phone's 59pt top inset inside the fixed
    // report, silently clipping the last application row.
    if mode == "home", #available(iOS 16.4, *) {
      vc.safeAreaRegions = []
    }
    vc.view.backgroundColor = .clear
    vc.view.isOpaque = false
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    hosting = vc
    parent.addChild(vc)
    addSubview(vc.view)
    vc.didMove(toParent: parent)
    bringSubviewToFront(homeTouchSurface)
    bringSubviewToFront(activityControls)
    #if DEBUG
      publishDiagnostics()
    #endif
  }

  private func mountVisibleReport() {
    guard let vc = hosting, vc.isVisible, !reportMounted,
      !reportNeedsRebuild, window != nil, !wasBackgrounded,
      UIApplication.shared.applicationState == .active, #available(iOS 16.0, *)
    else { return }
    reportMounted = true
    #if targetEnvironment(simulator)
      vc.rootView = AnyView(MockReport(
        mode: mode as String, showsBlockedCard: showsBlockedCard
      ).ignoresSafeArea())
    #else
      let reportIdentity = UUID()
      vc.rootView = AnyView(ReportContainer(
        offset: offset.intValue, mode: mode as String,
        showsBlockedCard: showsBlockedCard, identity: reportIdentity, queryDate: Date()
      ).ignoresSafeArea())
      if mode == "home" {
        // The device service can miss its first refresh while the extension
        // proxy is connecting, then wait for a 60-second timer. Update the
        // real end date on the SAME connection; never recreate its ID.
        // UIKit schedules this because SwiftUI's .task is not reliably entered
        // when a remote report replaces Activity in an already scrolled Home.
        // A navigation-stack return can take over two seconds to attach the
        // service. Two bounded attempts cover warm and slower connections;
        // both are cancelled only on a real configuration replacement.
        for delay in [1.0, 3.0] {
          let refresh = DispatchWorkItem { [weak self, weak vc] in
            guard let self, let vc, self.hosting === vc, self.reportMounted,
              !self.reportNeedsRebuild, vc.view.window != nil
            else { return }
            ScreenTimeReportView.log.info(
              "refresh query #\(self.epoch, privacy: .public) after=\(delay, privacy: .public)s")
            vc.rootView = AnyView(ReportContainer(
              offset: self.offset.intValue, mode: self.mode as String,
              showsBlockedCard: self.showsBlockedCard,
              identity: reportIdentity, queryDate: Date()
            ).ignoresSafeArea())
          }
          queryRefreshWorkItems.append(refresh)
          DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: refresh)
        }
      }
    #endif
    // This acknowledges the LOCAL mount, not completion of Apple's remote
    // aggregation (DeviceActivityReport exposes no completion callback).
    // Never let an old controller dismiss a newer report's placeholder.
    let readyEpoch = epoch
    let ready = DispatchWorkItem { [weak self, weak vc] in
      guard let self, let vc, self.hosting === vc, self.epoch == readyEpoch,
        !self.reportNeedsRebuild, vc.view.window != nil
      else { return }
      self.readyWorkItem = nil
      self.onCommand?(["command": "ready"])
    }
    readyWorkItem = ready
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.45, execute: ready)
    #if DEBUG
      publishDiagnostics()
    #endif
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if hosting?.view.superview === self {
      hosting?.view.frame = bounds
    }
    homeTouchSurface.frame = bounds
    #if DEBUG
      diagnostics.frame = CGRect(x: 0, y: 0, width: 1, height: 1)
      bringSubviewToFront(diagnostics)
      publishDiagnostics()
    #endif
    activityControls.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 134)
    scheduleRebuildIfNeeded()
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
    let showsBlockedCard: Bool

    var body: some View {
      if mode == "home" {
        MockHomeView(showsBlockedCard: showsBlockedCard)
      } else {
        MockUsageView()
      }
    }
  }

  /// Verre des cartes de l'Accueil — miroir de `HomeGlassCard`
  /// (RelockActivityReport.swift) et de `HomeCardMaterial.tsx`. Les trois
  /// surfaces DOIVENT bouger ensemble : ce simulateur est l'endroit où l'on
  /// juge le rendu, un décalage ici se paie en aller-retours inutiles.
  private struct HomeGlassCard: ViewModifier {
    let fill: Double
    let edge: Double
    private let corner: CGFloat = 36

    func body(content: Content) -> some View {
      content
        .background(
          ZStack(alignment: .top) {
            Color.white.opacity(fill)
            Rectangle().fill(Color.white.opacity(edge)).frame(height: 1)
          }
          .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
        )
        .overlay(
          RoundedRectangle(cornerRadius: corner, style: .continuous)
            .stroke(Color.white.opacity(0.07), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.45), radius: 20, x: 0, y: 12)
    }
  }

  /// Accueil factice : les valeurs n'existent QUE sur simulateur. La géométrie
  /// reste identique à HomeSectionView afin de valider le rapport unique qui
  /// traverse le héro et la carte des trois apps.
  ///
  /// Le héros et le classement sont TOUJOURS remplis ici. Un tiret et « les
  /// données réelles ne sont pas simulées » décrivaient honnêtement la
  /// situation, mais laissaient le chiffre CENTRAL de l'Accueil vide : on ne
  /// pouvait juger ni la composition, ni une capture. Les valeurs sont
  /// alignées sur `MockUsageView` (onglet Activité) — les deux écrans doivent
  /// raconter la même journée, sans quoi deux captures se contredisent.
  private struct MockHomeView: View {
    let showsBlockedCard: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedApp: String?
    private let ink = Color(red: 0.961, green: 0.961, blue: 0.969)
    private let unit = Color(red: 0.922, green: 0.922, blue: 0.961)
    private let green = Color(red: 0.373, green: 0.788, blue: 0.545)
    private let ink2 = Color(red: 0.725, green: 0.690, blue: 0.792)

    var body: some View {
      GeometryReader { geometry in
        VStack(alignment: .leading, spacing: 0) {
        ZStack(alignment: .top) {
          VStack(alignment: .center, spacing: 5) {
            Text(
              RelockLanguage.pick(
                fr: "Temps d’écran aujourd’hui", en: "Screen time today",
                es: "Tiempo de pantalla hoy")
            )
            .font(.system(size: 15, weight: .medium))
              .foregroundColor(ink.opacity(0.94))
              .shadow(color: .black.opacity(0.9), radius: 7, x: 0, y: 2)
            // « 3h12 » : aucune espace autour des unités, minutes sur deux
            // chiffres, unité à 0.45x la taille du nombre et même graisse.
            // Miroir de `segments` dans HeroTotalView.
            HStack(alignment: .firstTextBaseline, spacing: 0) {
              Text("3").font(.system(size: 48, weight: .bold)).kerning(-1.2)
                .foregroundColor(ink)
              Text("h").font(.system(size: 22, weight: .bold)).kerning(-0.4)
                .foregroundColor(unit.opacity(0.45))
              Text("12").font(.system(size: 48, weight: .bold)).kerning(-1.2)
                .foregroundColor(ink)
            }
            // Comparaison à la référence PERSONNELLE proratisée, jamais au
            // total d'hier — miroir de `comparison` dans HeroTotalView.
            HStack(spacing: 6) {
              Image(systemName: "arrow.down")
                .font(.system(size: 17, weight: .bold)).foregroundColor(green)
              Text(
                RelockLanguage.pick(
                  fr: "1h12 sous ta moyenne", en: "1h12 below your average",
                  es: "1h12 por debajo de tu media")
              )
              .font(.system(size: 17, weight: .semibold)).foregroundColor(green)
            }
          }
          .frame(maxWidth: .infinity)
          .padding(.top, 180)
          .shadow(color: .black.opacity(0.9), radius: 8, x: 0, y: 2)
        }
        .frame(width: geometry.size.width, height: 360, alignment: .top)

        // Emplacement de la carte « Score global » : elle est rendue par React
        // Native par-dessus cette simulation, comme par-dessus le vrai
        // rapport. La dessiner ici afficherait deux cartes superposees.
        Color.clear.frame(height: 290)
        Color.clear.frame(height: showsBlockedCard ? 328 : 24)

        VStack(alignment: .leading, spacing: 16) {
          Text(
            RelockLanguage.pick(
              fr: "Top 3 applications aujourd’hui", en: "Top 3 apps today",
              es: "Top 3 apps hoy")
          )
          .font(.system(size: 15, weight: .semibold))
            .foregroundColor(ink)
          VStack(spacing: 12) {
            ForEach(Array(referenceApps.enumerated()), id: \.offset) { _, app in
                Button {
                  let action = { selectedApp = selectedApp == app.name ? nil : app.name }
                  if reduceMotion { action() } else { withAnimation(.easeOut(duration: 0.2), action) }
                } label: {
                  HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                      .fill(app.tint)
                      .frame(width: 38, height: 38)
                      .overlay(
                        Image(systemName: app.symbol)
                          .font(.system(size: 20, weight: .medium))
                          .foregroundColor(.white))
                    Text(app.name)
                      .font(.system(size: 14, weight: .medium))
                      .foregroundColor(ink)
                      .lineLimit(1)
                      .truncationMode(.tail)
                      .frame(width: 96, alignment: .leading)
                    if selectedApp == app.name {
                      Text("Usage aujourd’hui · \(Int(round(Double(app.minutes) / Double(referenceApps[0].minutes) * 100))) %")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundColor(ink2)
                        .lineLimit(1)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                      GeometryReader { bar in
                        ZStack(alignment: .leading) {
                          Capsule().fill(Color.white.opacity(0.08))
                          Capsule()
                            .fill(
                              LinearGradient(
                                colors: [
                                  Color(red: 0.451, green: 0.341, blue: 0.863),
                                  Color(red: 0.784, green: 0.722, blue: 1.0),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing)
                            )
                            .frame(
                              width: bar.size.width * CGFloat(app.minutes) / CGFloat(referenceApps[0].minutes))
                        }
                      }
                      .frame(height: 6)
                    }
                    Text(mockDuration(app.minutes))
                      .font(.system(size: 13, weight: .medium))
                      .monospacedDigit()
                      .foregroundColor(ink2)
                      .lineLimit(1)
                      .frame(width: 54, alignment: .trailing)
                  }
                  .frame(height: 46)
                }
                .buttonStyle(.plain)
              }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .frame(width: geometry.size.width - 32, height: 232, alignment: .topLeading)
        .modifier(HomeGlassCard(fill: 0.035, edge: 0.06))
        .padding(.horizontal, 16)
        }
        .frame(
          width: geometry.size.width, height: geometry.size.height,
          alignment: .topLeading)
        .background(Color.clear)
        .environment(\.colorScheme, .dark)
      }
    }

    /// Les trois premières de `mockApps` (onglet Activité), aux mêmes durées :
    /// l'Accueil et l'Activité doivent décrire la même journée.
    private var referenceApps: [MockApp] { Array(mockApps.prefix(3)) }
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
            Text(
              RelockLanguage.pick(
                fr: "Temps d'écran", en: "Screen time", es: "Tiempo de pantalla")
            )
            .font(.system(size: 13)).foregroundColor(ink2)
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
            Text(
              RelockLanguage.pick(
                fr: "Autres statistiques", en: "Other statistics",
                es: "Otras estadísticas"))
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
