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
    // Notifications poussées (Firebase Cloud Messaging) et rapports de plantage (Crashlytics). Google Analytics n'est pas activé sur le projet Firebase.
    // Firebase apporte une ancienne version de Fragment que la vérification de qualité Android refuse pour les demandes d'autorisation (registerForActivityResult).
    implementation(libs.androidx.fragment)
    // Verrouillage optionnel des espaces professionnels (empreinte, visage ou code du téléphone).
    implementation(libs.androidx.biometric)
    // Connexion avec Google : fenêtre native de choix du compte (gestionnaire d'identifiants du système).
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play)
    implementation(libs.googleid)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.firebase.crashlytics)
}

// Le fichier de configuration Firebase (`google-services.json`, hors Git) est propre au projet Firebase de Speedfood. Sans lui (autre poste, intégration continue), l'application
// se construit quand même : Firebase reste simplement inactif (voir `FirebaseSpeedfood`).
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
    apply(plugin = "com.google.firebase.crashlytics")
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
        versionCode = 41
        versionName = "2.39.0"
        buildConfigField("String", "SUPABASE_URL", "\"${reglage("supabase.url")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${reglage("supabase.anonKey")}\"")
        // Identifiant du client OAuth « Web » du projet Google (valeur publique) : vide = pas de bouton « Continuer avec Google ».
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${reglage("google.webClientId")}\"")
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
