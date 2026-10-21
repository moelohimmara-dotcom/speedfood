package com.speedfood.app

import androidx.compose.ui.window.ComposeUIViewController
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.di.initKoin
import platform.Foundation.NSBundle

private fun cleInfo(nom: String): String = (NSBundle.mainBundle.objectForInfoDictionaryKey(nom) as? String).orEmpty()

private val config: SpeedfoodConfig by lazy {
    // Valeurs publiques, injectées dans Info.plist par iosApp/Configuration/Secrets.xcconfig (ignoré par Git).
    SpeedfoodConfig(
        supabaseUrl = cleInfo("SUPABASE_URL"),
        supabaseAnonKey = cleInfo("SUPABASE_ANON_KEY"),
        siteUrl = cleInfo("SITE_URL").ifBlank { "https://speedfood-app.moelohimmara.workers.dev" },
    ).also { initKoin(it) }
}

fun MainViewController() = ComposeUIViewController { App(config) }
