package com.speedfood.app

import androidx.compose.ui.window.ComposeUIViewController
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.di.initKoin
import platform.Foundation.NSBundle
import platform.Foundation.NSUserDefaults

private fun cleInfo(nom: String): String = (NSBundle.mainBundle.objectForInfoDictionaryKey(nom) as? String).orEmpty()

/** Préférences de l'application. Le Trousseau iOS remplacera ce stockage avant la publication sur l'App Store (voir docs/NATIF-PLAN.md). */
private class StockagePreferencesIos : StockageLocal {
    private val defauts = NSUserDefaults.standardUserDefaults
    override fun lire(cle: String): String? = defauts.stringForKey("speedfood.$cle")
    override fun ecrire(cle: String, valeur: String) = defauts.setObject(valeur, forKey = "speedfood.$cle")
    override fun effacer(cle: String) = defauts.removeObjectForKey("speedfood.$cle")
}

private val config: SpeedfoodConfig by lazy {
    // Valeurs publiques, injectées dans Info.plist par iosApp/Configuration/Secrets.xcconfig (ignoré par Git).
    SpeedfoodConfig(
        supabaseUrl = cleInfo("SUPABASE_URL"),
        supabaseAnonKey = cleInfo("SUPABASE_ANON_KEY"),
        siteUrl = cleInfo("SITE_URL").ifBlank { "https://speedfood-app.moelohimmara.workers.dev" },
    ).also { initKoin(it, StockagePreferencesIos()) }
}

fun MainViewController() = ComposeUIViewController { App(config) }
