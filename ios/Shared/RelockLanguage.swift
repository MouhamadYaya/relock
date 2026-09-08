import Foundation

/// La langue de l'interface Relock, vue depuis une extension.
///
/// ## Pourquoi ne pas se fier à la langue système
///
/// Une extension Family Controls reçoit la langue du SYSTÈME, pas celle
/// choisie dans Relock. Quelqu'un qui met l'app en espagnol sur un iPhone
/// anglais voyait donc un mur de blocage et un rapport d'activité en anglais,
/// à côté d'une app en espagnol — la même incohérence que le
/// `let language = "fr"` codé en dur qui l'a précédée.
///
/// L'app publie donc sa langue courante dans le groupe d'app à chaque
/// démarrage et à chaque changement (`src/i18n/i18n.ts` →
/// `BlocusScreenTime.setAppLanguage`). Les extensions la relisent ici.
///
/// ## Repli
///
/// Tant que l'app n'a pas tourné une seule fois depuis la mise à jour, la clé
/// est absente : on retombe alors sur les langues préférées du système,
/// ramenées aux trois langues livrées, puis sur l'anglais. Jamais sur le
/// français : un lecteur inconnu lit l'anglais bien plus souvent.
enum RelockLanguage: String {
  case french = "fr"
  case english = "en"
  case spanish = "es"

  static let suiteName = "group.com.yaya.relock"
  static let storageKey = "relock.language"

  /// Réduit `es-419`, `fr_CA`, `en-GB` à leur langue.
  private static func base(_ tag: String) -> String {
    String(tag.replacingOccurrences(of: "_", with: "-").split(separator: "-").first ?? "")
      .lowercased()
  }

  static var current: RelockLanguage {
    if let stored = UserDefaults(suiteName: suiteName)?.string(forKey: storageKey),
      let language = RelockLanguage(rawValue: base(stored))
    {
      return language
    }
    for tag in Locale.preferredLanguages {
      if let language = RelockLanguage(rawValue: base(tag)) { return language }
    }
    return .english
  }

  /**
   * La langue sous forme de `Locale`, pour les contrôles UIKit.
   *
   * Un `UIDatePicker` en mode compte à rebours écrit ses propres unités
   * (« heures », « min ») et les prend de SA locale, pas de nos tables : sans
   * ce réglage, la roue affichait « heure » en français au milieu d'un écran
   * anglais, parce qu'elle suivait la langue du téléphone.
   */
  var locale: Locale {
    Locale(identifier: rawValue)
  }

  static var currentLocale: Locale {
    current.locale
  }

  /// Choisit la variante correspondant à la langue courante.
  ///
  /// Les tables de textes des extensions sont écrites en Swift plutôt que dans
  /// un `Localizable.strings` : chaque extension est une cible séparée, avec
  /// son propre bundle, et il faudrait maintenir cinq catalogues au lieu d'un
  /// fichier partagé entre elles toutes.
  static func pick<T>(fr: T, en: T, es: T) -> T {
    switch current {
    case .french: return fr
    case .english: return en
    case .spanish: return es
    }
  }
}
