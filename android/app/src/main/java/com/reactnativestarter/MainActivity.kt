package com.reactnativestarter
import expo.modules.ReactActivityDelegateWrapper

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  // "main" — pas "ReactNativeStarter" — car `expo-router/entry` (point d'entrée
  // JS via package.json `main`) enregistre toujours le composant racine sous
  // "main" via `expo.registerRootComponent`, quel que soit le nom de l'app.
  override fun getMainComponentName(): String = "main"

  override fun onCreate(savedInstanceState: Bundle?) {
    RNBootSplash.init(this, R.style.BootTheme) // <- bootsplash theme name
    super.onCreate(savedInstanceState)
    // если вдруг используешь react-native-screens и шаблон требует:
    // super.onCreate(null)
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    ReactActivityDelegateWrapper(this, BuildConfig.IS_NEW_ARCHITECTURE_ENABLED, DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled))
}
