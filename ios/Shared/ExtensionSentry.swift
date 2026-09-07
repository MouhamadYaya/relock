import Foundation

#if canImport(Sentry)
  import Sentry
#endif

/// Démarrage de sentry-cocoa dans une extension.
///
/// QUI L'UTILISE, ET QUI NE PEUT PAS
///   `RelockMonitor`, `RelockShieldAction` et `RelockWidgets` : ces trois-là
///   vivent assez longtemps pour porter un SDK, et ont accès au réseau.
///   `RelockActivityReport` (aucun réseau, interdiction Apple) et
///   `RelockShield` (appelée de façon synchrone à chaque bouclier, où toute
///   latence se voit) en sont exclues : elles passent par `ExtensionLog`.
///
/// Les deux mécanismes sont COMPLÉMENTAIRES, pas redondants : `ExtensionLog`
/// remonte les erreurs ATTRAPÉES, ce SDK remonte les crashs DURS — ceux qui
/// tuent le processus avant qu'il puisse écrire quoi que ce soit.
///
/// `#if canImport(Sentry)` : le fichier reste compilable dans une cible qui ne
/// lie pas le pod, où il devient un no-op. Un oubli de configuration ne casse
/// donc jamais un build.
enum ExtensionSentry {
  private static var started = false

  /// - Parameter source: étiquette de la cible (`monitor`, `action`, `widgets`).
  static func startIfNeeded(source: String) {
    guard !started else { return }
    started = true

    #if canImport(Sentry)
      // Le DSN vient du groupe d'app : une extension ne peut pas lire `.env`
      // (`react-native-config` n'y existe pas). L'app l'y dépose à chaque
      // démarrage — une extension qui s'exécute avant le tout premier
      // lancement reste donc muette, ce qui est acceptable.
      guard let dsn = ExtensionLog.sentryDSN() else { return }

      SentrySDK.start { options in
        options.dsn = dsn
        options.enableAutoSessionTracking = false
        options.enableWatchdogTerminationTracking = false
        options.enableAppHangTracking = false
        options.enableAutoPerformanceTracing = false
        options.tracesSampleRate = 0
        options.sendDefaultPii = false

        // Une extension peut être tuée à tout instant, souvent sans réseau
        // disponible. Le cache d'enveloppes vit donc dans le conteneur
        // PARTAGÉ (il survit à la mort du processus) et dans un
        // sous-dossier par cible, pour que deux extensions concurrentes ne
        // se marchent pas dessus.
        if let container = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: ExtensionLog.suiteName)
        {
          options.cacheDirectoryPath =
            container
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("Caches", isDirectory: true)
            .appendingPathComponent("sentry-\(source)", isDirectory: true)
            .path
        }

        // Sans cela, chaque extension créerait SA propre release
        // (`com.yaya.relock.RelockMonitor@…`), et Release Health compterait
        // quatre produits au lieu d'un. Les versions des extensions sont
        // celles de l'app — c'est Xcode qui les aligne.
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "0"
        let build = info?["CFBundleVersion"] as? String ?? "0"
        options.releaseName = "com.yaya.relock@\(short)+\(build)"
        options.dist = build
      }

      SentrySDK.configureScope { scope in
        scope.setTag(value: source, key: "extension")
        // Trace le fait qu'on est dans un processus d'extension : la moitié
        // du diagnostic d'un crash « impossible » est là.
        scope.setTag(value: "true", key: "is_extension")
      }
    #endif
  }
}
