import Foundation

/// Toutes les chaînes du mur système vivent ici.
///
/// Elles suivent la langue CHOISIE DANS RELOCK (`RelockLanguage`), pas celle
/// du système : le mur est la surface la plus visible du produit, et il
/// s'affichait en français devant une app réglée en anglais ou en espagnol.
enum RelockShieldCopy {
  static var title: String {
    RelockLanguage.pick(
      fr: "Reprends le contrôle\nde ton temps.",
      en: "Take back control\nof your time.",
      es: "Recupera el control\nde tu tiempo.")
  }
  static var mission: String {
    RelockLanguage.pick(
      fr: "C’est la mission de Relock.",
      en: "That’s Relock’s mission.",
      es: "Esa es la misión de Relock.")
  }
  static var management: String {
    RelockLanguage.pick(
      fr: "Gère ce blocage en ouvrant l’application Relock.",
      en: "Manage this block by opening the Relock app.",
      es: "Gestiona este bloqueo abriendo la aplicación Relock.")
  }
  static var openRelock: String {
    RelockLanguage.pick(fr: "Ouvrir Relock", en: "Open Relock", es: "Abrir Relock")
  }
  static var ignore: String {
    RelockLanguage.pick(fr: "Ignorer", en: "Dismiss", es: "Ignorar")
  }
  static var fallbackApplicationName: String {
    RelockLanguage.pick(fr: "Cette app", en: "This app", es: "Esta app")
  }

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
    let blockedTemplate = RelockLanguage.pick(
      fr: "C’est pourquoi %@ a été bloqué pendant ta session.",
      en: "That’s why %@ was blocked during your session.",
      es: "Por eso %@ se ha bloqueado durante tu sesión.")
    let counterTemplate = RelockLanguage.pick(
      fr: "%@ bloqué par Relock %d× aujourd’hui",
      en: "%@ blocked by Relock %d× today",
      es: "%@ bloqueada por Relock %d× hoy")
    let blocked = String(
      format: blockedTemplate, locale: Locale.autoupdatingCurrent, applicationName)
    let counter = String(
      format: counterTemplate, locale: Locale.autoupdatingCurrent, applicationName, count)
    // La ligne vide DE TÊTE n'est pas décorative : le titre et le sous-titre
    // sont deux libellés distincts dont iOS fixe lui-même l'écart, très serré.
    // « Reprends le contrôle de ton temps. » se retrouvait collé à la phrase
    // suivante. Une ligne vide est le seul moyen d'aérer ce joint.
    return "\n\(mission)\n\n\(blocked)\n\n\(management)\n\n\(counterMark)  \(counter)"
  }
}
