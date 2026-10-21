package com.speedfood.app

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.di.initKoin
import java.io.File
import java.util.Properties

/** Réglages : variables d'environnement SPEEDFOOD_SUPABASE_URL / SPEEDFOOD_SUPABASE_ANON_KEY, sinon `speedfood.properties` (dossier mobile/). */
private fun lireConfig(): SpeedfoodConfig {
    val fichier = generateSequence(File(".").absoluteFile) { it.parentFile }.map { File(it, "speedfood.properties") }.firstOrNull { it.exists() }
    val proprietes = Properties().apply { fichier?.inputStream()?.use { load(it) } }
    fun valeur(env: String, cle: String, parDefaut: String = ""): String =
        (System.getenv(env) ?: proprietes.getProperty(cle) ?: parDefaut).trim()
    return SpeedfoodConfig(
        supabaseUrl = valeur("SPEEDFOOD_SUPABASE_URL", "supabase.url"),
        supabaseAnonKey = valeur("SPEEDFOOD_SUPABASE_ANON_KEY", "supabase.anonKey"),
        siteUrl = valeur("SPEEDFOOD_SITE_URL", "site.url", "https://speedfood-app.moelohimmara.workers.dev"),
    )
}

fun main() {
    val config = lireConfig()
    initKoin(config)
    application {
        // Fenêtre au format téléphone : l'aperçu montre ce qu'un téléphone affichera.
        Window(onCloseRequest = ::exitApplication, title = "Speedfood (aperçu)", state = rememberWindowState(size = DpSize(412.dp, 860.dp))) {
            App(config)
        }
    }
}
