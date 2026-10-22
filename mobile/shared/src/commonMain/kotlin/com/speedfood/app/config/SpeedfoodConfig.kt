package com.speedfood.app.config

/**
 * Réglages d'exécution, fournis par chaque plateforme au démarrage (jamais écrits dans le code ni dans Git).
 *
 * [supabaseAnonKey] est la clé PUBLIQUE du site (celle qui part déjà dans chaque page web) : la sécurité des données repose sur la RLS
 * de la base, pas sur le secret de cette clé. La clé « service role » ne doit jamais atteindre une application.
 */
data class SpeedfoodConfig(
    val supabaseUrl: String,
    val supabaseAnonKey: String,
    val siteUrl: String,
) {
    /** HTTPS exigé ; seule exception : le faux serveur d'essai de l'émulateur (`http://10.0.2.2`, voir scripts/faux-serveur-application.mjs). Android bloque de toute façon le HTTP en clair dans l'APK publiée. */
    val estComplete: Boolean get() = (supabaseUrl.startsWith("https://") || supabaseUrl.startsWith("http://10.0.2.2")) && supabaseAnonKey.isNotBlank()
}
