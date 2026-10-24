package com.speedfood.app.data

/** Destination interne issue d'un lien partagé depuis le site ou WhatsApp. */
sealed interface LienProfond {
    data class Restaurant(val id: String) : LienProfond
    data class Commande(val jeton: String) : LienProfond
}

/**
 * Interprète uniquement les liens publics Speedfood connus.
 * Les autres hôtes, schémas et chemins restent sur le site : aucune navigation arbitraire.
 */
fun lireLienProfond(url: String): LienProfond? {
    val valeur = url.trim()
    if (!valeur.startsWith("https://") && !valeur.startsWith("http://")) return null
    val sansSchema = valeur.substringAfter("://")
    val hote = sansSchema.substringBefore('/').lowercase()
    if (hote !in setOf("speedfood-app.moelohimmara.workers.dev", "www.speedfood.dev", "speedfood.dev")) return null
    val chemin = "/" + sansSchema.substringAfter('/', "").substringBefore('?').substringBefore('#')
    val morceaux = chemin.split('/').filter { it.isNotBlank() }
    if (morceaux.size != 2) return null
    val identifiant = morceaux[1].trim()
    if (identifiant.isEmpty() || identifiant.length > 160 || identifiant.any { it.isWhitespace() || it == '/' || it == '\\' }) return null
    return when (morceaux[0].lowercase()) {
        "r" -> LienProfond.Restaurant(identifiant)
        "commande" -> LienProfond.Commande(identifiant)
        else -> null
    }
}
