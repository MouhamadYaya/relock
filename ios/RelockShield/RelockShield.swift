import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Écran de blocage personnalisé Relock (remplace le shield Apple par défaut).
/// Rendu par iOS → statique (pas d'animation). Le bouton « Fermer » est géré
/// par RelockShieldAction.
///
/// C'est AUSSI le compteur des « ouvertures évitées » : iOS demande cette
/// configuration chaque fois que le bouclier s'AFFICHE — donc chaque fois que
/// l'utilisateur a tenté d'ouvrir une app bloquée. Compter ici (et pas
/// seulement le tap « Fermer » dans l'extension d'action) capture le cas de
/// loin le plus fréquent : voir le mur, et balayer vers l'accueil sans
/// toucher aucun bouton — qui ne laissait AUCUNE trace, d'où des stats
/// figées à 0.
class RelockShield: ShieldConfigurationDataSource {

  private static let suite = "group.com.yaya.relock"
  private let defaults = UserDefaults(suiteName: RelockShield.suite)

  /// Verrou inter-processus — miroir de RelockMonitor/RelockShieldAction.
  private static func withGroupLock<T>(_ body: () -> T) -> T {
    guard
      let dir = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: suite)
    else { return body() }
    let fd = open(dir.appendingPathComponent(".relock.lock").path,
                  O_CREAT | O_WRONLY, 0o644)
    guard fd >= 0 else { return body() }
    flock(fd, LOCK_EX)
    defer {
      flock(fd, LOCK_UN)
      close(fd)
    }
    return body()
  }

  /// Une tentative d'ouverture = un événement « shield_shown ». iOS peut
  /// demander la configuration plusieurs fois pour un même affichage :
  /// on déduplique sous 8 s — personne ne tente deux vraies ouvertures
  /// distinctes en moins de 8 s, mais iOS re-demande bien plus vite.
  private func logShown() {
    guard let d = defaults else { return }
    Self.withGroupLock {
      let now = Date().timeIntervalSince1970
      let last = d.double(forKey: "shield.lastShownAt")
      guard now - last > 8 else { return }
      d.set(now, forKey: "shield.lastShownAt")
      d.set(d.integer(forKey: "shieldShownTotal") + 1, forKey: "shieldShownTotal")

      var log = d.array(forKey: "eventLog") as? [[String: Any]] ?? []
      log.append([
        "kind": "shield_shown",
        "activity": "shield",
        "at": ISO8601DateFormatter().string(from: Date()),
      ])
      if log.count > 200 { log.removeFirst(log.count - 200) }
      d.set(log, forKey: "eventLog")
      // Extension éphémère : flush avant que iOS suspende le process.
      d.synchronize()
    }
  }

  private static let bg = UIColor(
    red: 0.043, green: 0.047, blue: 0.063, alpha: 1.0) // #0B0C10
  private static let accent = UIColor(
    red: 0.643, green: 0.604, blue: 0.996, alpha: 1.0) // #A49AFE
  private static let ink2 = UIColor(white: 0.68, alpha: 1.0)

  private func make() -> ShieldConfiguration {
    logShown()
    // Logo Relock (croissant de lune) + halo violet, déposé dans
    // Shield.xcassets → "BlockMoon". Repli sur un symbole si l'asset manque.
    let art =
      UIImage(named: "BlockMoon")
      ?? UIImage(systemName: "moon.fill")?
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
      // Texte BLANC sur le bouton violet : signal « bouton d'action » sans
      // ambiguïté. Le texte sombre précédent (#0B0C10) se lisait comme du
      // texte inerte, pas comme un contrôle cliquable.
      primaryButtonLabel: ShieldConfiguration.Label(
        text: "Fermer", color: .white),
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
