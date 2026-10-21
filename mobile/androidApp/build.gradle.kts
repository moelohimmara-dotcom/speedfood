import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.util.Properties

plugins {
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeCompiler)
}

// Valeurs publiques du site, lues dans `speedfood.properties` (ignoré par Git ; modèle : speedfood.properties.example).
val reglages = Properties().apply {
    val fichier = rootProject.file("speedfood.properties")
    if (fichier.exists()) fichier.inputStream().use { load(it) }
}
fun reglage(cle: String, parDefaut: String = ""): String = (reglages.getProperty(cle) ?: parDefaut).trim()

dependencies {
    implementation(projects.shared)
    implementation(libs.androidx.activity.compose)
    implementation(libs.compose.uiToolingPreview)
    implementation(libs.compose.foundation)
    implementation(libs.ktor.client.okhttp)
}

android {
    namespace = "com.speedfood.app"
    compileSdk = libs.versions.android.compileSdk.get().toInt()

    defaultConfig {
        // Même identifiant que l'ancienne enveloppe web (APK du 18 octobre) : avec la même clé de signature,
        // l'application native se met à jour par-dessus l'installation existante (voir docs/NATIF-PLAN.md).
        applicationId = "com.speedfood.app"
        minSdk = libs.versions.android.minSdk.get().toInt()
        targetSdk = libs.versions.android.targetSdk.get().toInt()
        versionCode = 8
        versionName = "2.6.0"
        buildConfigField("String", "SUPABASE_URL", "\"${reglage("supabase.url")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${reglage("supabase.anonKey")}\"")
        buildConfigField("String", "SITE_URL", "\"${reglage("site.url", "https://speedfood-app.moelohimmara.workers.dev")}\"")
    }
    buildFeatures {
        buildConfig = true
    }
    // Signature de publication : lue dans l'environnement (jamais dans le dépôt). Sans ces variables, la version « release » reste non signée.
    // SPEEDFOOD_KEYSTORE (chemin du fichier), SPEEDFOOD_KEYSTORE_PASSWORD, SPEEDFOOD_KEY_ALIAS (défaut : speedfood), SPEEDFOOD_KEY_PASSWORD (défaut : celui du fichier).
    val cheminCle = System.getenv("SPEEDFOOD_KEYSTORE")
    if (!cheminCle.isNullOrBlank()) {
        signingConfigs {
            create("release") {
                storeFile = file(cheminCle)
                storePassword = System.getenv("SPEEDFOOD_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("SPEEDFOOD_KEY_ALIAS") ?: "speedfood"
                keyPassword = System.getenv("SPEEDFOOD_KEY_PASSWORD") ?: System.getenv("SPEEDFOOD_KEYSTORE_PASSWORD")
            }
        }
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
}

kotlin {
    compilerOptions {
        jvmTarget = JvmTarget.JVM_11
    }
}
