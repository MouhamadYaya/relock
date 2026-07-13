import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Écran de blocage personnalisé Relock (remplace le shield Apple par défaut).
/// Rendu par iOS → statique (pas d'animation). On peut brander : fond, logo,
/// titre, sous-titre, bouton. Le bouton « Fermer » ferme l'app bloquée
/// (comportement de fermeture par défaut, sans extension d'action).
class RelockShield: ShieldConfigurationDataSource {

  private static let bg = UIColor(
    red: 0.043, green: 0.047, blue: 0.063, alpha: 1.0) // #0B0C10
  private static let accent = UIColor(
    red: 0.643, green: 0.604, blue: 0.996, alpha: 1.0) // #A49AFE
  private static let ink2 = UIColor(white: 0.68, alpha: 1.0)

  private func make() -> ShieldConfiguration {
    // Illustration « personne qui lit » (déposée dans Shield.xcassets → "BlockArt").
    // Repli sur un symbole tant que le fichier n'est pas fourni.
    let art =
      UIImage(named: "BlockArt")
      ?? UIImage(systemName: "book.fill")?
        .withTintColor(Self.accent, renderingMode: .alwaysOriginal)
    return ShieldConfiguration(
      backgroundBlurStyle: .dark,
      backgroundColor: Self.bg,
      icon: art,
      title: ShieldConfiguration.Label(text: "Bloqué", color: .white),
      subtitle: ShieldConfiguration.Label(
        text:
          "Concentre-toi sur ce qui compte. Ou fais une vraie pause — ouvrir cette app ne t'aidera pas.",
        color: Self.ink2),
      primaryButtonLabel: ShieldConfiguration.Label(
        text: "Fermer", color: Self.bg),
      primaryButtonBackgroundColor: Self.accent)
  }

  override func configuration(shielding application: Application)
    -> ShieldConfiguration
  {
    make()
  }

  override func configuration(
    shielding application: Application, in category: ActivityCategory
  ) -> ShieldConfiguration {
    make()
  }

  override func configuration(shielding webDomain: WebDomain)
    -> ShieldConfiguration
  {
    make()
  }

  override func configuration(
    shielding webDomain: WebDomain, in category: ActivityCategory
  ) -> ShieldConfiguration {
    make()
  }
}
