import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firma de release, en este orden:
// 1. `android/key.properties` (builds locales; nunca se commitea).
// 2. Variables de Codemagic (`android_signing` con una referencia al
//    keystore): CM_KEYSTORE_PATH, CM_KEYSTORE_PASSWORD, CM_KEY_ALIAS,
//    CM_KEY_PASSWORD.
// 3. Si no hay ninguna, la clave de debug (Play la rechaza).
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(keystorePropertiesFile.inputStream())
} else if (System.getenv("CM_KEYSTORE_PATH") != null) {
    keystoreProperties["storeFile"] = System.getenv("CM_KEYSTORE_PATH")
    keystoreProperties["storePassword"] = System.getenv("CM_KEYSTORE_PASSWORD")
    keystoreProperties["keyAlias"] = System.getenv("CM_KEY_ALIAS")
    keystoreProperties["keyPassword"] = System.getenv("CM_KEY_PASSWORD")
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile") != null
if (!hasReleaseKeystore) {
    logger.warn(
        "Sin android/key.properties ni CM_KEYSTORE_PATH: el build release se " +
            "firma con la clave de debug. Ver docs/runbooks/stores.md.",
    )
}

android {
    namespace = "com.guria.openfluent"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Tiene que coincidir con el package de google-services.json y con la
        // ficha de Play: no cambiarlo después de publicar.
        applicationId = "com.guria.openfluent"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
