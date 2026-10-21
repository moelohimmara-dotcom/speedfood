package com.speedfood.app.disponibilite

/**
 * États d'un restaurant et lisibilité de l'ancienneté, portés de `src/lib/disponibilite/etat.ts` (même règle de produit : une disponibilité
 * est une déclaration récente du restaurant, jamais une garantie de stock ; un état inconnu ne devient jamais « disponible »).
 */
enum class EtatRestaurant { Ouvert, Pause, Ferme }

enum class Ton { Succes, Neutre, Danger }

data class LibelleEtat(val texte: String, val ton: Ton)

/** Trois situations distinctes : ouvert et prend des commandes, ouvert mais en pause, fermé. */
fun etatRestaurant(ouvert: Boolean, accepteCommandes: Boolean): EtatRestaurant = when {
    !ouvert -> EtatRestaurant.Ferme
    accepteCommandes -> EtatRestaurant.Ouvert
    else -> EtatRestaurant.Pause
}

fun estCommandable(ouvert: Boolean, accepteCommandes: Boolean): Boolean = etatRestaurant(ouvert, accepteCommandes) == EtatRestaurant.Ouvert

fun libelleEtat(etat: EtatRestaurant): LibelleEtat = when (etat) {
    EtatRestaurant.Ouvert -> LibelleEtat("Ouvert", Ton.Succes)
    EtatRestaurant.Pause -> LibelleEtat("Commandes en pause", Ton.Neutre)
    EtatRestaurant.Ferme -> LibelleEtat("Fermé", Ton.Danger)
}

/** « à l'instant », « il y a 25 min », « il y a 3 h », « hier », « il y a 4 jours ». Un âge négatif (décalage d'horloge) vaut « maintenant ». */
fun ancienneteLisible(ageMillis: Long): String {
    val minutes = (maxOf(0L, ageMillis) / 60_000L)
    if (minutes < 1) return "à l'instant"
    if (minutes < 60) return "il y a $minutes min"
    val heures = minutes / 60
    if (heures < 24) return "il y a $heures h"
    val jours = heures / 24
    return if (jours == 1L) "hier" else "il y a $jours jours"
}

/**
 * Fraîcheur d'une confirmation : au-delà du seuil (6 h par défaut côté site) sans reconfirmation, ou si elle n'a jamais eu lieu,
 * le restaurant affiche « à confirmer ». [ageMillis] = null quand l'horodatage est absent ou illisible.
 */
fun estFraiche(ageMillis: Long?, fraicheurHeures: Int = 6): Boolean =
    ageMillis != null && maxOf(0L, ageMillis) <= fraicheurHeures * 3_600_000L
