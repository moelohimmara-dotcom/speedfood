package com.speedfood.app.data

/** Étapes lisibles de la commande, dérivées du statut réellement renvoyé par le serveur. */
val ETAPES_SUIVI_CLIENT = listOf(
    "en_attente" to "Commande envoyée",
    "acceptee" to "Restaurant confirmé",
    "prete" to "Commande prête",
    "terminee" to "Commande terminée",
)

fun progressionSuivi(statut: String): Int = ETAPES_SUIVI_CLIENT.indexOfFirst { it.first == statut }.coerceAtLeast(0)
fun cleEtapeSuivi(statut: String) = "suivi-etape-$statut"
fun cleLigneSuivi(reference: String, index: Int) = "suivi-ligne-$reference-$index"

/** Les actions de contact ne sont affichées que si le serveur fournit une destination. */
data class ContactsSuivi(val telephoneLivreur: String? = null, val telephoneRestaurant: String? = null, val carteUrl: String? = null)
