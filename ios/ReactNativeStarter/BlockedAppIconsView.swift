import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit
import os

/// Héberge l'icône RÉELLE d'une app sélectionnée pour une règle.
///
/// Apple ne donne JAMAIS l'identité d'une app sélectionnée au code JS/Swift de
/// l'app hôte (jeton opaque `ApplicationToken`) — seule une vue système
/// `Label(token)` peut la restituer. Source : `selection.<ruleId>`, écrit par
/// `BlocusScreenTime.bindSelection` dans l'App Group.
///
/// ⚠️ POINTS DURS (chacun a été une cause de « rien ne s'affiche ») :
///  • Le `UIHostingController` DOIT être un child view controller. Sans
///    containment, SwiftUI n'a pas de cycle de vie complet et les vues
///    adossées à un service système (ici l'XPC vers FamilyControlsAgent) ne
///    se dessinent pas — alors qu'un `Text` ordinaire, lui, s'afficherait.
///  • Une sélection peut ne contenir AUCUN `applicationToken` : choisir une
///    CATÉGORIE entière ne remplit que `categoryTokens`. On rend donc le
///    premier jeton disponible, apps → catégories → domaines web.
///  • Les props RN arrivent une par une : sans debounce on reconstruit trois
///    fois et on lance autant de résolutions XPC concurrentes.
///  • Family Controls n'existe pas sur simulateur : rien ne s'y affichera
///    jamais, c'est attendu (cf. ScreenTimeReportView).
@available(iOS 16.0, *)
private struct SystemTokenIcon: View {
  let token: BlockedAppIconsView.Token
  let pointSize: CGFloat

  var body: some View {
    Group {
      switch token {
      case .app(let t): Label(t)
      case .category(let t): Label(t)
      case .web(let t): Label(t)
      }
    }
    .labelStyle(.iconOnly)
    .font(.system(size: pointSize))
  }
}

@available(iOS 16.0, *)
private struct TokenIcon: View {
  let token: BlockedAppIconsView.Token
  let side: CGFloat
  let displayScale: CGFloat

  var body: some View {
    SystemTokenIcon(
      token: token,
      pointSize: min(side * Self.iconToTileRatio, Self.systemPointSizeCap))
      // La vue du jeton est un contenu XPC protégé : elle ne peut pas être
      // copiée dans un UIImage. On demande sa composition à une densité
      // supérieure, puis on compense la réduction points/pixels induite par
      // cette densité au moment d'agrandir le calque système vivant.
      .environment(\.displayScale, displayScale * magnification)
      .scaleEffect(magnification * magnification)
      .frame(width: side, height: side)
      .clipped()
  }

  /// Rapport icône/tuile repris de `UsageReportView` (26 pt dans 30 pt).
  private static let iconToTileRatio: CGFloat = 26.0 / 30.0
  private static let systemPointSizeCap: CGFloat = 26
  private static let naturalSystemIconSide: CGFloat = 24
  private static let filledTileRatio: CGFloat = 0.9

  private var magnification: CGFloat {
    guard side >= 48 else { return 1 }
    return side * Self.filledTileRatio / Self.naturalSystemIconSide
  }
}

@objc(BlockedAppIconsView)
final class BlockedAppIconsView: UIView {
  fileprivate static let log = Logger(
    subsystem: "com.yaya.relock", category: "appicons")

  private static let suite = "group.com.yaya.relock"
  private static let defaults = UserDefaults(suiteName: suite)

  /// Un jeton affichable, quelle que soit sa nature.
  enum Token {
    case app(ApplicationToken)
    case category(ActivityCategoryToken)
    case web(WebDomainToken)
  }

  /// Identité STABLE du jeton à dessiner (encodage base64 — cf.
  /// `BlocusScreenTime.tokenKey`). On n'indexe plus dans un `Set`, dont
  /// l'ordre d'itération n'est pas garanti : deux vignettes pouvaient tomber
  /// sur le même jeton et afficher deux fois la même app.
  @objc var tokenKey: NSString = "" {
    didSet { if oldValue != tokenKey { setNeedsRebuild() } }
  }
  /// Force une nouvelle résolution sans démonter la vue (après un bind).
  @objc var reloadToken: NSNumber = 0 {
    didSet { if oldValue != reloadToken { setNeedsRebuild() } }
  }

  private var hosting: UIHostingController<AnyView>?
  private var rebuildWorkItem: DispatchWorkItem?
  private var renderedSide: CGFloat = 0

  override init(frame: CGRect) {
    super.init(frame: frame)
    commonInit()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    commonInit()
  }

  private func commonInit() {
    isUserInteractionEnabled = false
    backgroundColor = .clear
    // L'autorisation peut être accordée APRÈS le premier rendu, et une
    // sélection peut être liée pendant que l'écran est déjà affiché.
    NotificationCenter.default.addObserver(
      self, selector: #selector(appDidBecomeActive),
      name: UIApplication.didBecomeActiveNotification, object: nil)
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func appDidBecomeActive() {
    setNeedsRebuild()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      rebuildWorkItem?.cancel()
      rebuildWorkItem = nil
      detachHosting()
    } else {
      setNeedsRebuild()
    }
  }

  /// RN affecte les props sur plusieurs cycles : on attend la configuration
  /// complète avant de résoudre le jeton (une seule requête à l'agent).
  private func setNeedsRebuild() {
    rebuildWorkItem?.cancel()
    let work = DispatchWorkItem { [weak self] in
      self?.rebuildWorkItem = nil
      self?.rebuild()
    }
    rebuildWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05, execute: work)
  }

  /// Retrouve le jeton dont l'encodage correspond à `tokenKey`, en balayant
  /// TOUTES les sélections de règles de l'App Group. La même app peut être
  /// visée par plusieurs règles : peu importe laquelle la fournit, le jeton
  /// est le même — c'est justement ce qui permet de la dessiner une seule fois.
  @available(iOS 16.0, *)
  private func loadToken() -> Token? {
    guard tokenKey.length > 0, let defaults = Self.defaults else { return nil }
    let wanted = tokenKey as String
    let decoder = JSONDecoder()
    for (key, value) in defaults.dictionaryRepresentation() {
      guard key == "selection" || key.hasPrefix("selection."),
        let data = value as? Data,
        let selection = try? decoder.decode(
          FamilyActivitySelection.self, from: data)
      else { continue }
      for token in selection.applicationTokens
      where BlockedAppIconsView.encodedKey(token) == wanted {
        return .app(token)
      }
      for token in selection.categoryTokens
      where BlockedAppIconsView.encodedKey(token) == wanted {
        return .category(token)
      }
      for token in selection.webDomainTokens
      where BlockedAppIconsView.encodedKey(token) == wanted {
        return .web(token)
      }
    }
    Self.log.error("token not found for key \(wanted, privacy: .public)")
    return nil
  }

  /// ⚠️ Miroir de `BlocusScreenTime.tokenKey` — garder les deux en phase.
  static func encodedKey<T: Codable>(_ token: T) -> String? {
    guard let data = try? JSONEncoder().encode(token) else { return nil }
    return data.base64EncodedString()
  }

  private func detachHosting() {
    renderedSide = 0
    guard let hosting else { return }
    hosting.willMove(toParent: nil)
    hosting.view.removeFromSuperview()
    hosting.removeFromParent()
    self.hosting = nil
  }

  /// Le view controller le plus proche dans la chaîne des responders — le
  /// parent auquel rattacher le hosting controller.
  private func nearestViewController() -> UIViewController? {
    var responder: UIResponder? = next
    while let r = responder {
      if let vc = r as? UIViewController { return vc }
      responder = r.next
    }
    return nil
  }

  private func rebuild() {
    guard window != nil, #available(iOS 16.0, *) else { return }
    detachHosting()
    guard let token = loadToken() else { return }

    // Ne jamais figer la taille de secours de 24 pt avant le layout RN. C'était
    // invisible dans les cartes de 24 pt, mais la grande tuile restait ensuite
    // rendue à 24 pt au centre d'un conteneur de 72 pt.
    let side = min(bounds.width, bounds.height)
    guard side > 0 else { return }
    renderedSide = side
    let displayScale = window?.screen.scale ?? UIScreen.main.scale
    let root = AnyView(
      TokenIcon(token: token, side: side, displayScale: displayScale))
    let vc = UIHostingController(rootView: root)
    vc.view.backgroundColor = .clear
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    // ⚠️ Containment obligatoire (voir l'en-tête) : sans parent, la vue
    // SwiftUI adossée à FamilyControlsAgent reste vide.
    if let parent = nearestViewController() {
      parent.addChild(vc)
      addSubview(vc.view)
      vc.didMove(toParent: parent)
    } else {
      addSubview(vc.view)
      Self.log.error("no parent view controller — icon may not render")
    }
    hosting = vc
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hosting?.view.frame = bounds
    let side = min(bounds.width, bounds.height)
    if window != nil, side > 0, abs(side - renderedSide) > 0.5 {
      setNeedsRebuild()
    }
  }
}
