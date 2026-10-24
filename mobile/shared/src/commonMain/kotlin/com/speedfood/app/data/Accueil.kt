package com.speedfood.app.data

/** Données factices et règles d'affichage de l'accueil client. */
data class AccueilSections(
    val ouverts: List<Restaurant>,
    val proches: List<Restaurant>,
    val mieuxNotes: List<Restaurant>,
    val cuisines: List<String>,
)

fun construireAccueil(restaurants: List<Restaurant>, zone: ZoneLivraison?): AccueilSections {
    val proches = restaurantsDansZone(restaurants, zone)
    return AccueilSections(
        ouverts = proches.filter { it.ouvert && it.accepteCommandes },
        proches = proches,
        mieuxNotes = proches.sortedByDescending { it.noteMoyenne ?: 0.0 },
        cuisines = proches.mapNotNull { it.nomCategorie }.distinct().sorted(),
    )
}

fun libelleDisponibilite(restaurant: Restaurant): String = when {
    !restaurant.ouvert || !restaurant.accepteCommandes -> "Fermé pour le moment"
    restaurant.statutMisAJourLe.isNullOrBlank() -> "Disponibilité à vérifier"
    else -> "Disponibilité à vérifier avant commande"
}

fun cleCarteAccueil(section: String, restaurantId: String) = "accueil-$section-$restaurantId"
