import Foundation
import React
import UIKit

/// Pont des icônes alternatives — « choisis ton logo » dans les Réglages.
///
/// Trois choses qu'iOS ne dit pas et que ce module absorbe :
///
///  1. **Main thread obligatoire.** `setAlternateIconName` appelé depuis la
///     file d'un module React ne fait rien — pas d'erreur, pas de changement.
///     Tout passe donc par `DispatchQueue.main`.
///  2. **`nil` signifie « l'icône principale »**, et non « échec ». La
///     traduction se fait ici : côté JS on manipule trois noms de variantes,
///     jamais un optionnel.
///  3. **iOS affiche SA propre alerte** (« Vous avez changé l'icône… ») à
///     chaque changement effectif. Elle n'est pas désactivable par une voie
///     publique, et on ne cherche pas à la contourner : c'est une garantie
///     donnée par le système à l'utilisateur, pas une gêne à masquer. On
///     évite simplement les appels INUTILES — réécrire l'icône déjà en place
///     déclencherait l'alerte pour rien (voir le court-circuit ci-dessous).
///
/// Les jeux d'icônes vivent dans `Images.xcassets` (`AppIcon-Orb`,
/// `AppIcon-Phases`) et sont déclarés au compilateur d'assets par
/// `ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES`. Un nom absent du binaire
/// fait échouer l'appel : le module renvoie alors l'erreur telle quelle
/// plutôt que de prétendre avoir réussi.
@objc(RelockAppIcon)
final class RelockAppIcon: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  /// L'appareil accepte-t-il les icônes alternatives ? (Faux sur iPad en
  /// Slide Over, sur certaines configurations gérées par un MDM.)
  @objc(isSupported:rejecter:)
  func isSupported(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(UIApplication.shared.supportsAlternateIcons)
    }
  }

  /// Le nom du jeu actuellement posé, ou `nil` pour l'icône principale.
  @objc(current:rejecter:)
  func current(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      resolve(UIApplication.shared.alternateIconName)
    }
  }

  /// Pose une icône. `name` vide ou absent remet l'icône principale.
  @objc(setIcon:resolver:rejecter:)
  func setIcon(
    _ name: NSString?,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let requested = (name as String?).flatMap { $0.isEmpty ? nil : $0 }

    DispatchQueue.main.async {
      guard UIApplication.shared.supportsAlternateIcons else {
        reject("unsupported", "Alternate icons are not supported here", nil)
        return
      }

      // Déjà en place : ne rien faire. Sans ce court-circuit, revenir sur son
      // propre choix rejouerait l'alerte système pour un changement nul.
      guard UIApplication.shared.alternateIconName != requested else {
        resolve(requested)
        return
      }

      UIApplication.shared.setAlternateIconName(requested) { error in
        if let error {
          reject("set_failed", error.localizedDescription, error)
        } else {
          resolve(requested)
        }
      }
    }
  }
}
