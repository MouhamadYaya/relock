import Foundation

/// Toutes les chaînes du mur système vivent ici. Les clés sont prêtes pour un
/// futur catalogue `Localizable.xcstrings`; les valeurs françaises restent la
/// source de vérité demandée tant qu'aucune traduction n'est fournie.
enum RelockShieldCopy {
  static let title = localized(
    "shield.title",
    defaultValue: "Reprends le contrôle\nde ton temps.")
  static let mission = localized(
    "shield.mission",
    defaultValue: "C’est la mission de Relock.")
  static let management = localized(
    "shield.management",
    defaultValue: "Gère ce blocage en ouvrant l’application Relock.")
  static let openRelock = localized(
    "shield.open_relock",
    defaultValue: "Ouvrir Relock")
  static let ignore = localized(
    "shield.ignore",
    defaultValue: "Ignorer")
  static let fallbackApplicationName = localized(
    "shield.fallback_application_name",
    defaultValue: "Cette app")

  /// Marqueur de la ligne de compteur.
  ///
  /// ⚠️ C'est ici que se jouerait « l'icône réelle de l'app ». Impossible :
  /// `ShieldConfiguration.subtitle` est du TEXTE BRUT — aucune image ne peut y
  /// être insérée — et Apple ne donne de toute façon jamais l'icône d'un
  /// `ApplicationToken` sous forme de `UIImage` (cf. l'en-tête de
  /// `RelockShield`). Un emoji est donc la seule couleur possible sur cette
  /// ligne. Le diamant a été choisi pour ce qu'il dit — ce temps repris a de
  /// la valeur. Noter qu'Apple le dessine CYAN : c'est la seule note froide
  /// d'un écran lavande, un écart à la palette accepté sciemment. Si un jour
  /// on veut la cohérence chromatique parfaite, le losange ◆ (glyphe texte,
  /// pas emoji) prendrait automatiquement la couleur du label. L'app est
  /// nommée juste à côté par son vrai nom système.
  static let counterMark = "💎"

  /// Le sous-titre porte À LUI SEUL toute la respiration verticale du mur :
  /// iOS n'expose ni interligne ni marges, mais il respecte les lignes vides.
  /// Quatre paragraphes courts séparés d'une ligne vide — mission, raison,
  /// conduite à tenir, compteur — donnent la même aération que les meilleurs
  /// murs du marché.
  static func subtitle(applicationName: String, count: Int) -> String {
    let blocked = format(
      "shield.blocked_reason",
      defaultValue: "C’est pourquoi %@ a été bloqué pendant ta session.",
      applicationName)
    let counter = format(
      "shield.daily_count",
      defaultValue: "%@ bloqué par Relock %d× aujourd’hui",
      applicationName,
      count)
    // La ligne vide DE TÊTE n'est pas décorative : le titre et le sous-titre
    // sont deux libellés distincts dont iOS fixe lui-même l'écart, très serré.
    // « Reprends le contrôle de ton temps. » se retrouvait collé à la phrase
    // suivante. Une ligne vide est le seul moyen d'aérer ce joint.
    return "\n\(mission)\n\n\(blocked)\n\n\(management)\n\n\(counterMark)  \(counter)"
  }

  private static func localized(_ key: String, defaultValue: String) -> String {
    NSLocalizedString(key, bundle: .main, value: defaultValue, comment: "")
  }

  private static func format(
    _ key: String,
    defaultValue: String,
    _ arguments: CVarArg...
  ) -> String {
    let template = localized(key, defaultValue: defaultValue)
    return String(format: template, locale: Locale.autoupdatingCurrent, arguments: arguments)
  }
}
