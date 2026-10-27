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

private val MOIS_ABREGES = listOf("janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.")

/** Date civile (année, mois 1-12, jour 1-31) d'un nombre de jours depuis le 1er janvier 1970 (calendrier grégorien, algorithme de Howard Hinnant). */
private fun dateCivile(jours: Long): Triple<Int, Int, Int> {
    val z = jours + 719468
    val ere = Math.floorDiv(z, 146097L)
    val jourDeLEre = z - ere * 146097
    val anneeDeLEre = (jourDeLEre - jourDeLEre / 1460 + jourDeLEre / 36524 - jourDeLEre / 146096) / 365
    val jourDeLAnnee = jourDeLEre - (365 * anneeDeLEre + anneeDeLEre / 4 - anneeDeLEre / 100)
    val mp = (5 * jourDeLAnnee + 2) / 153
    val jour = (jourDeLAnnee - (153 * mp + 2) / 5 + 1).toInt()
    val mois = (if (mp < 10) mp + 3 else mp - 9).toInt()
    val annee = (anneeDeLEre + ere * 400 + if (mois <= 2) 1 else 0).toInt()
    return Triple(annee, mois, jour)
}

/**
 * Date et heure lisibles d'un horodatage ISO : « aujourd'hui 02:34 », « hier 18:20 », « 26 oct. 09:00 » (avec l'année si ce n'est pas l'année en cours). Heure de Conakry, qui est l'heure
 * universelle (UTC+0, sans changement d'heure). Remplace « 2026-10-27 02:34 » qui se lisait comme une donnée brute. Un horodatage illisible est rendu tel quel, tronqué.
 */
fun dateLisible(iso: String?, maintenant: kotlin.time.Instant = kotlin.time.Clock.System.now()): String {
    val brut = iso?.takeIf { it.isNotBlank() } ?: return ""
    val instant = try {
        kotlin.time.Instant.parse(brut)
    } catch (_: IllegalArgumentException) {
        return brut.take(16).replace('T', ' ')
    }
    val secondes = instant.epochSeconds
    val jours = Math.floorDiv(secondes, 86_400L)
    val reste = Math.floorMod(secondes, 86_400L)
    val heure = "${(reste / 3600).toString().padStart(2, '0')}:${((reste % 3600) / 60).toString().padStart(2, '0')}"
    val aujourdhui = Math.floorDiv(maintenant.epochSeconds, 86_400L)
    return when (jours) {
        aujourdhui -> "aujourd'hui $heure"
        aujourdhui - 1 -> "hier $heure"
        else -> {
            val (annee, mois, jour) = dateCivile(jours)
            val anneeCourante = dateCivile(aujourdhui).first
            "$jour ${MOIS_ABREGES[mois - 1]}${if (annee != anneeCourante) " $annee" else ""} $heure"
        }
    }
}
