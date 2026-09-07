import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Unique mur de blocage Relock.
///
/// ## Ce que l'API laisse réellement piloter
///
/// `ShieldConfiguration` n'expose que huit valeurs : un fond, un flou, une
/// image, quatre libellés (texte + couleur) et la couleur du bouton principal.
/// **Aucune police, taille, graisse, interligne, marge ni zone sécurisée n'est
/// paramétrable** — la mise en page verticale, les tailles de texte et les
/// pilules du bas sont imposées par iOS, identiques pour toutes les apps de
/// contrôle parental (c'est pourquoi le mur d'Opal a exactement cette
/// silhouette : c'est la même).
///
/// La qualité perçue se joue donc sur les trois seuls leviers disponibles :
///
///  1. **L'image** — le seul endroit où l'on possède les pixels. On y compose
///     le mot-symbole ET la lueur violette de Relock, ce qui fait entrer un
///     dégradé dans un écran qui n'accepte qu'un aplat.
///  2. **Les couleurs** — fond nocturne légèrement violacé plutôt que gris
///     neutre, accent lavande sur le bouton principal, encre chaude.
///  3. **Le texte et ses retours à la ligne** — c'est ce qui crée la
///     respiration verticale : des paragraphes courts séparés par une ligne
///     vide (cf. `RelockShieldCopy.subtitle`).
///
/// ## Pourquoi pas l'icône réelle de l'app bloquée
///
/// Apple ne livre jamais l'icône d'une app derrière un `ApplicationToken` :
/// seule une vue système `Label(token)`, rendue hors process, peut l'afficher —
/// et elle ne peut pas être copiée dans un `UIImage` (même constat que
/// `BlockedAppIconsView`). `ShieldConfiguration.icon` n'accepte qu'un
/// `UIImage`. L'icône réelle est donc impossible ICI ; elle apparaît en
/// revanche dès l'ouverture de Relock, sur la feuille de déblocage de cette
/// app précise. Ce qui reste possible sur le mur, et qu'on fait : nommer
/// l'app par son **vrai nom** (`localizedDisplayName`).
final class RelockShield: ShieldConfigurationDataSource {
  /// Panne silencieuse la plus grave de cette extension : sans le groupe
  /// d'app, le mur s'affiche toujours mais AUCUNE tentative n'est comptée —
  /// les statistiques de résistance restent à zéro sans que rien ne le
  /// signale. On la journalise (cf. `ExtensionLog`) : cette extension étant
  /// appelée de façon synchrone à chaque bouclier, elle n'héberge pas de SDK.
  private let attempts: ShieldAttemptStore? = {
    let store = ShieldAttemptStore.production()
    if store == nil {
      ExtensionLog.error(
        "shield",
        "groupe d'app inaccessible : aucune tentative ne sera enregistrée")
    }
    return store
  }()

  // Jetons repris de `src/shared/theme/tokens/relock-material.ts` — le mur
  // doit appartenir au même monde que l'app, pas ressembler à un écran système.

  /// Aplat du mur. iOS n'accepte ici qu'une couleur UNIE : ni dégradé, ni
  /// vignette, ni halo — et l'image, seul endroit où l'on possède des pixels,
  /// est confinée à son emplacement d'icône. La profondeur ne peut donc venir
  /// que du noir lui-même. On descend au ras du noir tout en gardant le voile
  /// violet qui l'empêche de virer au gris mort, et qui fait ressortir l'orbe.
  private static let canvas = UIColor(
    red: 0.027, green: 0.024, blue: 0.047, alpha: 1)  // #07060C
  private static let accent = UIColor(
    red: 0.776, green: 0.710, blue: 1.0, alpha: 1)  // #C6B5FF blockingAccentLight
  private static let ink = UIColor(
    red: 0.969, green: 0.965, blue: 0.988, alpha: 1)  // #F7F6FC textPrimary
  private static let inkMuted = UIColor(
    red: 0.714, green: 0.714, blue: 0.780, alpha: 1)  // #B6B6C7 textSecondary
  /// Remplissage du bouton principal.
  ///
  /// ⚠️ Constaté sur l'appareil : iOS rend les libellés du mur **en vibrance**
  /// sur le matériau de fond. Une encre presque noire posée sur la lavande
  /// claire ne ressortait donc pas noire mais GRISE, à peine lisible — le
  /// réglage de couleur ne suffit pas à lui seul. On travaille donc AVEC la
  /// vibrance plutôt que contre : un violet plus profond, et une encre
  /// blanche que la vibrance ne peut qu'éclaircir. Contraste ~5,4:1, et le
  /// bouton reste franchement violet.
  private static let accentFill = UIColor(
    red: 0.451, green: 0.341, blue: 0.863, alpha: 1)  // #7357DC accentVioletDeep
  private static let onAccent = UIColor.white
  /// Libellé du bouton secondaire. Le système dessine son fond et ne me laisse
  /// AUCUNE couleur pour lui : le seul levier de visibilité est l'encre. En
  /// blanc cassé, « Ignorer » se lit franchement sans venir concurrencer la
  /// pilule lavande — la hiérarchie des deux actions reste évidente.
  private static let onSecondary = UIColor(
    red: 0.969, green: 0.965, blue: 0.988, alpha: 1)  // #F7F6FC

  // MARK: - Artwork

  /// Le logo Relock — l'orbe lunaire de l'app.
  ///
  /// ⚠️ iOS ne laisse choisir NI la taille NI la position de cette image : il
  /// l'ajuste dans un emplacement fixe (~250 × 95 pt), centré. On lui donne
  /// donc l'image telle quelle, CARRÉE : c'est la forme qui remplit le mieux
  /// cet emplacement, la contrainte venant alors de la hauteur (~95 pt de
  /// côté). Le mot-symbole d'avant, cinq fois plus large que haut, était
  /// ajusté sur la largeur et n'occupait qu'un tiers de la hauteur disponible.
  ///
  /// L'image porte volontairement **+30 % de marge transparente en bas**
  /// (720 × 936). C'est le SEUL moyen d'écarter l'orbe du titre : l'ajustement
  /// se faisant sur la hauteur, cette marge remonte l'orbe d'environ 22 pt
  /// dans son emplacement. Le prix est mécanique et assumé — la marge compte
  /// comme faisant partie du logo, donc l'orbe rétrécit d'autant (~73 pt de
  /// côté au lieu de 95). Toujours régénérer depuis l'orbe carré d'origine
  /// plutôt que de repadder l'image déjà padée, sinon la marge se cumule.
  ///
  /// Ne rien composer d'autre autour : une lueur dessinée derrière faisait une
  /// tache rectangulaire visible sur l'aplat nocturne.
  private static let artwork: UIImage? =
    UIImage(named: "RelockMoon")?.withRenderingMode(.alwaysOriginal)

  /// Repli lisible si le catalogue d'images n'est pas embarqué. Une lune
  /// lavande vaut mieux qu'un trou noir au milieu de l'écran — mais il faut
  /// une configuration de GRANDE taille : un symbole SF par défaut arrive en
  /// ~17 pt, invisible dans l'emplacement d'icône du mur.
  private static func fallbackIcon() -> UIImage? {
    UIImage(
      systemName: "moon.stars.fill",
      withConfiguration: UIImage.SymbolConfiguration(pointSize: 96, weight: .regular))?
      .withTintColor(accent, renderingMode: .alwaysOriginal)
  }

  // MARK: - Configuration

  private func configuration(
    applicationKey: String,
    applicationName: String,
    categoryKey: String? = nil
  ) -> ShieldConfiguration {
    attempts?.recordProbe(
      "fileStore=\(attempts != nil) category=\(categoryKey != nil)")

    let presentation = attempts?.recordAttempt(
      applicationKey: applicationKey,
      applicationName: applicationName,
      categoryKey: categoryKey)
    let count = presentation?.count ?? 1

    return ShieldConfiguration(
      // ⚠️ Le style de flou N'EST PAS décoratif : c'est lui qui fixe
      // l'APPARENCE de tout le mur. Sans lui (`nil`), iOS ignore
      // `backgroundColor` et retombe sur un matériau CLAIR — fond blanc,
      // mot-symbole blanc devenu invisible, textes gris illisibles et pilule
      // « Ignorer » blanche, car le bouton secondaire est dessiné par le
      // système et suit cette même apparence. Il faut donc une variante
      // `…Dark`, et un fond OPAQUE par-dessus pour que l'app bloquée ne
      // transparaisse pas (c'est cette transparence qui ternissait les noirs).
      backgroundBlurStyle: .systemThickMaterialDark,
      backgroundColor: Self.canvas,
      icon: Self.artwork ?? Self.fallbackIcon(),
      title: ShieldConfiguration.Label(
        text: RelockShieldCopy.title,
        color: Self.ink),
      subtitle: ShieldConfiguration.Label(
        text: RelockShieldCopy.subtitle(
          applicationName: applicationName,
          count: count),
        color: Self.inkMuted),
      primaryButtonLabel: ShieldConfiguration.Label(
        text: RelockShieldCopy.openRelock,
        color: Self.onAccent),
      primaryButtonBackgroundColor: Self.accentFill,
      secondaryButtonLabel: ShieldConfiguration.Label(
        text: RelockShieldCopy.ignore,
        color: Self.onSecondary))
  }

  private func appConfiguration(
    _ application: Application,
    categoryKey: String? = nil
  ) -> ShieldConfiguration {
    let name = application.localizedDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines)
    let applicationName = name.flatMap { value in
      value.isEmpty ? nil : value
    } ?? RelockShieldCopy.fallbackApplicationName
    let key = application.token.flatMap(ShieldAttemptStore.tokenKey)
      ?? application.bundleIdentifier.map { "bundle:\($0)" }
      ?? "application:unknown"
    return configuration(
      applicationKey: key,
      applicationName: applicationName,
      categoryKey: categoryKey)
  }

  private func webConfiguration(
    _ webDomain: WebDomain,
    categoryKey: String? = nil
  ) -> ShieldConfiguration {
    let domain = webDomain.domain?.trimmingCharacters(in: .whitespacesAndNewlines)
    let name = domain.flatMap { value in
      value.isEmpty ? nil : value
    } ?? RelockShieldCopy.fallbackApplicationName
    let key = webDomain.token.flatMap(ShieldAttemptStore.tokenKey)
      ?? webDomain.domain.map { "web:\($0)" }
      ?? "web:unknown"
    return configuration(
      applicationKey: key,
      applicationName: name,
      categoryKey: categoryKey)
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    appConfiguration(application)
  }

  override func configuration(
    shielding application: Application,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    appConfiguration(
      application,
      categoryKey: category.token.flatMap(ShieldAttemptStore.tokenKey))
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    webConfiguration(webDomain)
  }

  override func configuration(
    shielding webDomain: WebDomain,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    webConfiguration(
      webDomain,
      categoryKey: category.token.flatMap(ShieldAttemptStore.tokenKey))
  }
}
