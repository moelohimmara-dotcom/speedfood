package com.speedfood.app.data

import com.speedfood.app.disponibilite.estCommandable

/** Montant GNF entier, groupé par milliers avec une espace fine insécable : « 35 000 GNF ». Jamais de décimale (le franc guinéen n'en a pas). */
fun formaterGnf(montant: Int): String = formaterGnf(montant.toLong())

fun formaterGnf(montant: Long): String {
    val signe = if (montant < 0) "-" else ""
    val chiffres = kotlin.math.abs(montant).toString()
    val groupes = chiffres.reversed().chunked(3).joinToString(" ").reversed()
    return "$signe$groupes GNF"
}

private val ACCENTS = mapOf(
    'à' to 'a', 'â' to 'a', 'ä' to 'a', 'é' to 'e', 'è' to 'e', 'ê' to 'e', 'ë' to 'e', 'î' to 'i', 'ï' to 'i',
    'ô' to 'o', 'ö' to 'o', 'ù' to 'u', 'û' to 'u', 'ü' to 'u', 'ç' to 'c', 'ÿ' to 'y', 'œ' to 'o',
)

/** Minuscules, sans accents ni espaces superflus : la recherche ne dépend ni de la casse ni des accents. */
fun normaliser(texte: String): String =
    texte.lowercase().map { ACCENTS[it] ?: it }.joinToString("").trim().replace(Regex("\\s+"), " ")

enum class FiltreRestaurants(val libelle: String) {
    Tous("Tous"),
    Ouverts("Ouverts"),
    Commandables("On peut commander"),
}

/**
 * Recherche locale sur la liste déjà chargée (au plus 100 restaurants) : nom ou quartier, sans casse ni accents, tous les mots de la requête doivent
 * se retrouver ; le filtre garde les restaurants ouverts ou ceux qui prennent des commandes maintenant.
 */
fun filtrerRestaurants(restaurants: List<Restaurant>, requete: String, filtre: FiltreRestaurants): List<Restaurant> {
    val mots = normaliser(requete).split(" ").filter { it.isNotEmpty() }
    return restaurants.filter { r ->
        val etatOk = when (filtre) {
            FiltreRestaurants.Tous -> true
            FiltreRestaurants.Ouverts -> r.ouvert
            FiltreRestaurants.Commandables -> estCommandable(r.ouvert, r.accepteCommandes)
        }
        val cible = normaliser(listOfNotNull(r.nom, r.nomQuartier, r.nomCategorie).joinToString(" "))
        etatOk && mots.all { cible.contains(it) }
    }
}
