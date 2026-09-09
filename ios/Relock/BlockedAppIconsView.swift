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
      // ⚠️ Boîte de mise en page FIXE, posée AVANT l'agrandissement.
      // `Label(token)` ne rend pas la même chose selon que l'agent système a
      // déjà résolu le jeton ou non, et sa taille intrinsèque bouge avec lui.
      // Sans cette boîte, le centre autour duquel `scaleEffect` tourne suivait
      // cette taille — et le moindre point d'écart ressortait multiplié par
      // l'agrandissement (×7 sur une grande tuile), ce qui projetait l'icône
      // hors de son cadre, presque toujours vers le haut. La boîte fige ce
      // centre sur celui de la tuile : une résolution tardive ne peut plus
      // déplacer l'icône. Elle propose exactement la même taille qu'avant, la
      // vue système continue donc de se dessiner à l'identique.
      .frame(width: side, height: side)
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

#if targetEnvironment(simulator)
  /// Vignette FACTICE — simulateur uniquement, jamais compilée pour un iPhone.
  ///
  /// Family Controls n'existe pas sur simulateur : aucun jeton ne s'y résout,
  /// et la rangée « Apps bloquées » restait une file de carrés vides. On rend
  /// donc la même géométrie avec des marques inventées, dans la palette du
  /// rapport factice (`ScreenTimeReportView`), pour pouvoir juger l'écran.
  private struct SimulatorIcon: View {
    let key: String
    let side: CGFloat

    private static let palette: [(symbol: String, tint: Color)] = [
      ("camera.fill", Color(red: 0.79, green: 0.33, blue: 0.63)),
      ("music.note", Color(red: 0.13, green: 0.13, blue: 0.16)),
      ("safari.fill", Color(red: 0.20, green: 0.55, blue: 0.95)),
      ("message.fill", Color(red: 0.30, green: 0.78, blue: 0.36)),
      ("play.rectangle.fill", Color(red: 0.90, green: 0.22, blue: 0.21)),
      ("music.note.list", Color(red: 0.11, green: 0.73, blue: 0.33)),
    ]

    /// Empreinte STABLE d'un lancement à l'autre. `hashValue` est ensemencé
    /// aléatoirement par processus : la même app aurait changé d'icône à
    /// chaque démarrage, et deux captures ne se seraient plus ressemblé.
    private static func face(for key: String) -> (symbol: String, tint: Color) {
      let sum = key.unicodeScalars.reduce(0) { ($0 * 31 + Int($1.value)) % 100_003 }
      return palette[sum % palette.count]
    }

    var body: some View {
      let face = Self.face(for: key)
      RoundedRectangle(cornerRadius: side * 0.26, style: .continuous)
        .fill(face.tint)
        .overlay(
          Image(systemName: face.symbol)
            .font(.system(size: side * 0.52, weight: .medium))
            .foregroundColor(.white)
        )
        .frame(width: side, height: side)
    }
  }
#endif

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
    didSet {
      guard oldValue != tokenKey else { return }
      cachedToken = nil
      setNeedsRebuild()
    }
  }
  /// Force une nouvelle résolution sans démonter la vue (après un bind).
  @objc var reloadToken: NSNumber = 0 {
    didSet {
      guard oldValue != reloadToken else { return }
      cachedToken = nil
      setNeedsRebuild()
    }
  }

  private var hosting: UIHostingController<AnyView>?
  private var rebuildWorkItem: DispatchWorkItem?
  /// Bornes pour lesquelles le rendu courant a été calculé. On garde la taille
  /// ENTIÈRE et plus le seul côté : une tuile qui change de largeur gardait
  /// sinon une icône centrée sur l'ancienne boîte.
  private var renderedSize: CGSize = .zero
  /// Jeton déjà résolu pour `tokenKey`. La résolution décode TOUTES les
  /// sélections de l'App Group : on ne la rejoue pas pour un simple
  /// changement de taille.
  private var cachedToken: Token?
  private var cachedTokenKey: String = ""

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
    // Dernier rempart : même mal placé, le calque système ne peut pas sortir
    // de la tuile. Le `overflow: 'hidden'` posé côté JS ne suffit pas — c'est
    // la vue hôte, ici, qui doit borner le contenu qu'elle héberge.
    clipsToBounds = true
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
    // L'autorisation a pu être accordée, ou la sélection re-liée : le jeton en
    // cache n'est plus une réponse fiable.
    cachedToken = nil
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

  /// Le jeton de `tokenKey`, résolu UNE seule fois par identité.
  @available(iOS 16.0, *)
  private func resolvedToken() -> Token? {
    let wanted = tokenKey as String
    if let cachedToken, cachedTokenKey == wanted { return cachedToken }
    guard let token = loadToken() else { return nil }
    cachedToken = token
    cachedTokenKey = wanted
    return token
  }

  /// ⚠️ Miroir de `BlocusScreenTime.tokenKey` — garder les deux en phase.
  static func encodedKey<T: Codable>(_ token: T) -> String? {
    guard let data = try? JSONEncoder().encode(token) else { return nil }
    return data.base64EncodedString()
  }

  private func detachHosting() {
    renderedSize = .zero
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

  /// La vue SwiftUI pour la taille courante. Ne parle à l'agent Family
  /// Controls que la première fois : ensuite le jeton est en cache.
  @available(iOS 16.0, *)
  private func makeRoot(side: CGFloat) -> AnyView? {
    #if targetEnvironment(simulator)
      let icon = AnyView(SimulatorIcon(key: tokenKey as String, side: side))
    #else
      guard let token = resolvedToken() else { return nil }
      let displayScale = window?.screen.scale ?? UIScreen.main.scale
      let icon = AnyView(
        TokenIcon(token: token, side: side, displayScale: displayScale))
    #endif
    // ⚠️ `ignoresSafeArea` n'est pas cosmétique ici. Un `UIHostingController`
    // centre sa racine dans ses bornes MOINS la zone sûre, et cette zone est
    // transitoirement non nulle pendant un changement d'onglet — la tuile
    // traverse alors le bas de l'écran. L'icône se calait trop haut, et le
    // calque système, une fois posé, ne se recentrait plus.
    return AnyView(
      icon
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea())
  }

  private func rebuild() {
    guard window != nil, #available(iOS 16.0, *) else { return }

    // Ne jamais figer la taille de secours de 24 pt avant le layout RN. C'était
    // invisible dans les cartes de 24 pt, mais la grande tuile restait ensuite
    // rendue à 24 pt au centre d'un conteneur de 72 pt.
    let side = min(bounds.width, bounds.height)
    guard side > 0, tokenKey.length > 0, let root = makeRoot(side: side) else {
      detachHosting()
      return
    }

    // Le contrôleur déjà en place est réutilisé : le recréer à chaque passe
    // faisait clignoter la tuile et relançait une résolution par XPC.
    // `parent != nil` n'est pas redondant : une vue construite sans
    // containment (branche d'erreur ci-dessous) ne dessine pas le contenu
    // système, il faut la refaire et non la réutiliser.
    if let hosting, let parent = hosting.parent, parent === nearestViewController()
    {
      hosting.rootView = root
      hosting.view.frame = bounds
      renderedSize = bounds.size
      return
    }

    detachHosting()
    let vc = UIHostingController(rootView: root)
    vc.view.backgroundColor = .clear
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    vc.view.clipsToBounds = true
    vc.view.insetsLayoutMarginsFromSafeArea = false
    if #available(iOS 16.4, *) { vc.safeAreaRegions = [] }

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
    renderedSize = bounds.size
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // Le recadrage est immédiat : l'icône se recentre dans la tuile au même
    // cycle que le layout, sans attendre le débounce.
    hosting?.view.frame = bounds
    guard window != nil, bounds.size != renderedSize else { return }
    guard min(bounds.width, bounds.height) > 0, tokenKey.length > 0 else {
      return
    }
    // La taille pilote l'agrandissement du calque système : elle doit être
    // celle des bornes FINALES, pas celle d'une passe intermédiaire.
    setNeedsRebuild()
  }
}
