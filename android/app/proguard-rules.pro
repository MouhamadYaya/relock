# Règles ProGuard/R8 du projet.
#
# ⚠️ ÉTAT : la minification est ENCORE DÉSACTIVÉE
# (`enableProguardInReleaseBuilds = false` dans build.gradle). Ce fichier est
# prêt, mais l'activer demande de VÉRIFIER un APK de release sur un appareil —
# une règle manquante ne casse rien à la compilation, elle produit un plantage
# au lancement ou une fonctionnalité muette, visibles seulement dans le binaire
# minifié. Voir la marche à suivre en bas de fichier.
#
# Les règles ci-dessous sont ADDITIVES : elles ne font qu'empêcher R8 de
# supprimer ou renommer ce qui est atteint par réflexion / JNI, jamais
# l'inverse. Les rendre trop larges coûte quelques kilo-octets ; les rendre
# trop étroites coûte un plantage.
#
# La plupart des bibliothèques de ce projet (React Native, Expo, Reanimated,
# Screens, Gesture Handler, Sentry, RevenueCat) embarquent leurs propres
# `consumer-rules.pro` dans leur AAR : R8 les applique automatiquement et il
# est inutile de les recopier ici. Ne sont listés que les cas que cette
# mécanique ne couvre pas.

# ── React Native : ponts et modules natifs ───────────────────────────────
# Les méthodes annotées @ReactMethod / @DoNotStrip sont appelées depuis JS par
# leur NOM : les renommer les rend introuvables, sans la moindre erreur de
# compilation.
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
    @com.facebook.react.bridge.ReactMethod *;
}
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep,includedescriptorclasses class * { native <methods>; }
-keep class com.facebook.jni.** { *; }

# ── Hermes ───────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ── Le module natif de Relock ────────────────────────────────────────────
# `BlocusScreenTime` n'existe que côté iOS, mais le paquet Android porte les
# ponts propres au projet : on ne laisse pas R8 y toucher.
-keep class com.yaya.relock.** { *; }

# ── react-native-config ──────────────────────────────────────────────────
# `BuildConfig` est lu par réflexion pour exposer les variables d'environnement.
-keep class com.yaya.relock.BuildConfig { *; }

# ── Sérialisation JSON (OkHttp / Okio, tirés par plusieurs modules) ───────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# ── Kotlin : métadonnées lues par la réflexion des modules Expo ───────────
-keep class kotlin.Metadata { *; }
-keepclassmembers class **$WhenMappings { <fields>; }

# ── Traces lisibles dans Sentry ──────────────────────────────────────────
# Sans ça, les rapports de crash Android arrivent avec des noms obfusqués et
# ne servent plus à rien. (Le mapping doit aussi être téléversé vers Sentry.)
-keepattributes SourceFile,LineNumberTable,*Annotation*,Signature,Exceptions
-renamesourcefileattribute SourceFile

# ── AVANT D'ACTIVER (`enableProguardInReleaseBuilds = true`) ─────────────
#   1. ./gradlew assembleRelease            (compile, ne prouve rien)
#   2. installer l'APK sur un VRAI appareil, pas seulement un émulateur ;
#   3. parcourir : démarrage, onboarding, paywall (RevenueCat), connexion
#      Google, création d'une règle, notifications, Réglages ;
#   4. surveiller Sentry pendant quelques jours après la première release.
# Les points 2 et 3 sont ceux qui attrapent réellement une règle manquante.
