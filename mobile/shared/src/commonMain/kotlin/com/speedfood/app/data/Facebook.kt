package com.speedfood.app.data

/** Résultat de la connexion avec Facebook, faite dans le navigateur du téléphone. */
sealed interface ResultatFacebook {
    /** [verificateur] : secret généré sur le téléphone (PKCE), à joindre à l'échange du code ; sans lui, un code intercepté ne sert à rien. */
    data class Code(val code: String, val verificateur: String) : ResultatFacebook

    /** La personne a fermé le navigateur ou refusé l'accès : rien à afficher. */
    data object Annule : ResultatFacebook

    data class Erreur(val message: String) : ResultatFacebook
}

/**
 * Connexion avec Facebook : la plateforme ouvre la page Facebook dans le navigateur (le mot de passe Facebook n'est jamais vu par Speedfood), puis rend le code à usage unique
 * que le service d'authentification a joint au lien de retour. [urlDepart] fabrique l'adresse de départ à partir de l'empreinte PKCE (calculée par la plateforme).
 */
interface FournisseurFacebook {
    val disponible: Boolean

    suspend fun obtenirCode(urlDepart: (codeChallenge: String) -> String): ResultatFacebook
}

class FacebookIndisponible : FournisseurFacebook {
    override val disponible = false
    override suspend fun obtenirCode(urlDepart: (codeChallenge: String) -> String): ResultatFacebook =
        ResultatFacebook.Erreur("La connexion avec Facebook n'est pas disponible sur cet appareil.")
}

/** Chemin du site sur lequel Facebook ramène la personne ; l'application l'intercepte (lien d'application) et en lit le code. */
const val CHEMIN_RETOUR_FACEBOOK = "/auth/application"
