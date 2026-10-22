package com.speedfood.app.data

/** Résultat de la demande d'un jeton d'identité Google au téléphone. */
sealed interface ResultatGoogle {
    /** [nonce] : valeur brute à renvoyer au service d'authentification, qui la compare à l'empreinte contenue dans le jeton (protège contre la réutilisation d'un jeton volé). */
    data class Jeton(val jetonIdentite: String, val nonce: String) : ResultatGoogle

    /** La personne a fermé la fenêtre de choix du compte : rien à afficher. */
    data object Annule : ResultatGoogle

    data class Erreur(val message: String) : ResultatGoogle
}

/**
 * Connexion avec Google : chaque plateforme fournit la sienne (Android : gestionnaire d'identifiants du système, fenêtre native de choix du compte). Le jeton obtenu est
 * vérifié par le service d'authentification : le mot de passe Google n'est jamais vu par Speedfood.
 */
interface FournisseurGoogle {
    /** La plateforme est configurée pour la connexion Google (identifiant d'application Google présent, services disponibles). */
    val disponible: Boolean

    suspend fun jetonIdentite(): ResultatGoogle
}

class GoogleIndisponible : FournisseurGoogle {
    override val disponible = false
    override suspend fun jetonIdentite(): ResultatGoogle = ResultatGoogle.Erreur("La connexion avec Google n'est pas disponible sur cet appareil.")
}
