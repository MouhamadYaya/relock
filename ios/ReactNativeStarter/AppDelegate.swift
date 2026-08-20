import UIKit
import Expo
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    // Indispensable avec expo-dev-client : lie la factory à ExpoAppDelegate
    // pour que le dev-launcher puisse (re)créer la vue racine. Sans cet appel
    // (oublié par le codemod `install-expo-modules`), `recreateRootView`
    // plante en assertion au démarrage. Voir ExpoAppDelegate.bindReactNativeFactory.
    bindReactNativeFactory(factory)

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "ReactNativeStarter",
      in: window,
      launchOptions: launchOptions
    )

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Deep links (`relock://…`) → RN Linking. Sert notamment au pont de test
  /// dev piloté par `xcrun simctl openurl` (voir src/session/dev-test-bridge).
  ///
  /// `ExpoAppDelegate` définit déjà cette méthode (routage expo-dev-client,
  /// expo-linking) : on DOIT donc l'`override` et appeler `super` en premier.
  /// Le `||` court-circuite — si expo a traité l'URL, RCTLinkingManager n'est
  /// pas rappelé (pas de double livraison) ; sinon on route vers RN Linking.
  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    super.application(app, open: url, options: options)
      || RCTLinkingManager.application(app, open: url, options: options)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  // ✅ Bootsplash hook
  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }
}
