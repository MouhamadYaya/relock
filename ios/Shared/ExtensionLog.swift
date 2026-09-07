import Foundation

/// Journal de télémétrie partagé entre l'app et ses extensions.
///
/// POURQUOI CE DÉTOUR PLUTÔT QU'UN SDK
/// Les extensions Family Controls sont des processus séparés, et deux d'entre
/// elles ne peuvent PAS héberger de SDK de télémétrie :
///
///   • `RelockActivityReport` (DeviceActivityReportExtension) n'a aucun accès
///     réseau — Apple l'interdit, ce n'est pas une question de configuration ;
///   • `RelockShield` (ShieldConfigurationDataSource) est appelée de façon
///     synchrone pour dessiner CHAQUE bouclier : démarrer un SDK y ajouterait
///     de la latence sur le geste central du produit.
///
/// Elles écrivent donc ici, dans le groupe d'app — le même conteneur que
/// `ShieldAttemptStore` —, et l'app draine ce journal à son démarrage suivant
/// pour le transmettre à Sentry.
///
/// CE QUE ÇA COUVRE, ET CE QUE ÇA NE COUVRE PAS
/// Les erreurs ATTRAPÉES et les événements notables : « le groupe d'app est
/// inaccessible », « le magasin de règles est illisible », « le bouclier a été
/// dessiné sans nom d'app ». C'est-à-dire les pannes silencieuses, qui sont la
/// majorité des pannes d'extension.
/// Un crash DUR (déréférencement nul, assertion) tue le processus avant toute
/// écriture : il faut pour cela un vrai SDK dans l'extension, ce que font
/// `RelockMonitor`, `RelockShieldAction` et `RelockWidgets`.
///
/// COÛT
/// Une lecture + une écriture `UserDefaults` d'un petit tableau borné. La
/// course entre processus (deux extensions qui écrivent en même temps) peut
/// perdre une entrée : c'est acceptable pour de la télémétrie, et c'est la
/// raison pour laquelle l'état MÉTIER, lui, passe par le fichier verrouillé de
/// `ShieldAttemptStore` et non par ici.
enum ExtensionLog {
  static let suiteName = "group.com.yaya.relock"
  static let storageKey = "relock.extLog.v1"
  static let dsnKey = "relock.sentry.dsn.v1"

  /// Borne dure. Sans elle, une extension en boucle d'erreur remplirait le
  /// conteneur partagé d'une app qui n'est peut-être pas lancée depuis des
  /// semaines. Au-delà, les PLUS ANCIENNES entrées sont perdues : ce sont les
  /// moins utiles, et l'app apprend combien ont été jetées.
  static let maxEntries = 60

  private static var defaults: UserDefaults? {
    UserDefaults(suiteName: suiteName)
  }

  /// Consigne un événement. Ne lève jamais, ne bloque jamais : un journal qui
  /// ferait échouer l'extension qu'il observe serait pire que pas de journal.
  ///
  /// - Parameters:
  ///   - source: la cible, `"shield"`, `"monitor"`, `"report"`…
  ///   - kind: `"error"` ou `"info"` — pilote le niveau côté Sentry.
  ///   - message: message stable, SANS identifiant ni donnée utilisateur
  ///              (il sert d'empreinte de regroupement).
  ///   - data: contexte court, valeurs textuelles uniquement.
  static func record(
    source: String,
    kind: String,
    message: String,
    data: [String: String] = [:]
  ) {
    guard let defaults else { return }

    var entries = defaults.array(forKey: storageKey) as? [[String: Any]] ?? []
    entries.append([
      "ts": Date().timeIntervalSince1970,
      "source": source,
      "kind": kind,
      "message": message,
      "data": data,
    ])

    // On garde la QUEUE (les plus récentes) et on dit combien on a jeté.
    if entries.count > maxEntries {
      let dropped = entries.count - maxEntries
      entries = Array(entries.suffix(maxEntries))
      entries[0]["droppedBefore"] = dropped
    }

    defaults.set(entries, forKey: storageKey)
  }

  /// Raccourci pour une erreur attrapée.
  static func error(
    _ source: String,
    _ message: String,
    _ error: Error? = nil,
    data: [String: String] = [:]
  ) {
    var payload = data
    if let error {
      // `localizedDescription` peut contenir un chemin de fichier : on garde
      // le type de l'erreur, stable et non identifiant.
      payload["errorType"] = String(describing: type(of: error))
    }
    record(source: source, kind: "error", message: message, data: payload)
  }

  /// Vide le journal et le renvoie. Réservé à l'APP : c'est elle qui a le
  /// réseau et le SDK. Les extensions n'appellent jamais ceci.
  static func drain() -> [[String: Any]] {
    guard let defaults else { return [] }
    // Les extensions écrivent depuis d'autres processus ; le cache mémoire
    // d'`UserDefaults` côté app peut être périmé et rater ces écritures.
    defaults.synchronize()
    let entries = defaults.array(forKey: storageKey) as? [[String: Any]] ?? []
    if !entries.isEmpty {
      defaults.removeObject(forKey: storageKey)
    }
    return entries
  }

  // MARK: - DSN

  /// L'app publie le DSN pour ses extensions.
  ///
  /// `react-native-config` n'existe pas dans une extension : elle ne peut pas
  /// lire `.env`. L'app, elle, l'a déjà en mémoire — elle le dépose donc ici à
  /// chaque démarrage. Conséquence assumée : une extension qui s'exécute avant
  /// le tout premier lancement de l'app n'a pas encore de DSN et reste muette.
  ///
  /// Le DSN n'est pas un secret (il est déjà dans le binaire).
  static func publishSentryDSN(_ dsn: String) {
    guard let defaults else { return }
    if dsn.isEmpty {
      defaults.removeObject(forKey: dsnKey)
    } else {
      defaults.set(dsn, forKey: dsnKey)
    }
  }

  /// DSN lu par une extension au démarrage de son SDK.
  static func sentryDSN() -> String? {
    guard let defaults else { return nil }
    defaults.synchronize()
    let dsn = defaults.string(forKey: dsnKey) ?? ""
    return dsn.isEmpty ? nil : dsn
  }
}
