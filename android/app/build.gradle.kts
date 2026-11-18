plugins {
    id("com.android.application")
}

// Folder aset web yang disalin dari folder induk (root projek web).
val webAssetsDir = layout.buildDirectory.dir("webassets").get().asFile

// Kunci tandatangan TETAP. Tanpa ini, GitHub Actions menjana debug keystore
// baharu pada setiap run, jadi APK setiap versi ditandatangani dengan kunci
// berbeza dan Android menolak kemas kini ("package conflict").
// Nilai datang dari repository secrets (lihat .github/workflows/android.yml).
// Untuk build tempatan tanpa secrets, debug keystore biasa digunakan.
val wsKeystorePath: String? = System.getenv("WS_KEYSTORE")
val wsStorePassword: String? = System.getenv("WS_KEYSTORE_PASSWORD")
val wsKeyAliasName: String? = System.getenv("WS_KEY_ALIAS")
val wsKeyPassword: String? = System.getenv("WS_KEY_PASSWORD")
val wsHasSigning = wsKeystorePath != null && java.io.File(wsKeystorePath).exists() &&
        !wsStorePassword.isNullOrBlank() &&
        !wsKeyAliasName.isNullOrBlank()

android {
    namespace = "my.rashidzainol.waktusolat"
    compileSdk = 34

    defaultConfig {
        applicationId = "my.rashidzainol.waktusolat"
        minSdk = 24
        targetSdk = 34
        versionCode = 9
        versionName = "1.8"
    }

    signingConfigs {
        if (wsHasSigning) {
            create("waktuSolat") {
                storeFile = java.io.File(wsKeystorePath!!)
                storePassword = wsStorePassword
                keyAlias = wsKeyAliasName
                keyPassword = wsKeyPassword
                storeType = "PKCS12"
            }
        }
    }

    buildTypes {
        getByName("debug") {
            if (wsHasSigning) signingConfig = signingConfigs.getByName("waktuSolat")
        }
        getByName("release") {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (wsHasSigning) signingConfig = signingConfigs.getByName("waktuSolat")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Aset web disalin dari folder induk semasa build.
    sourceSets["main"].assets.srcDir(webAssetsDir)
}

val syncWebAssets = tasks.register<Copy>("syncWebAssets") {
    from(rootProject.projectDir.parentFile) {
        include(
            "index.html",
            "app.css",
            "manifest.webmanifest",
            "sw.js",
            "icon-192.png",
            "icon-512.png",
            "icon-maskable-512.png",
            "js/**"
        )
    }
    into(webAssetsDir.resolve("www"))
}

tasks.named("preBuild").configure {
    dependsOn(syncWebAssets)
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.core:core:1.13.1")
}
