plugins {
    id("com.android.application")
}

// Folder aset web yang disalin dari folder induk (root projek web).
val webAssetsDir = layout.buildDirectory.dir("webassets").get().asFile

android {
    namespace = "my.rashidzainol.waktusolat"
    compileSdk = 34

    defaultConfig {
        applicationId = "my.rashidzainol.waktusolat"
        minSdk = 24
        targetSdk = 34
        versionCode = 3
        versionName = "1.2"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
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
}
