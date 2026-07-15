import ActivityKit
import Foundation

/// Attributs de la Live Activity « Bloquer maintenant ».
/// ⚠️ Compilé dans l'APP **et** dans l'extension RelockWidgets : le système
/// apparie les deux par le nom du type — garder ce fichier unique.
@available(iOS 16.2, *)
struct RelockBlockAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// Début du blocage (ancre du compte à rebours système).
    var startDate: Date
    /// Fin du blocage — le timer et l'anneau se mettent à jour tout seuls.
    var endDate: Date
  }

  /// Nb d'apps/catégories bloquées (jeton Apple opaque → juste le compte).
  var count: Int
}
