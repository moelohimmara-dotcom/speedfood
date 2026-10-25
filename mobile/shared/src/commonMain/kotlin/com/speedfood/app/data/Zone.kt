package com.speedfood.app.data

import kotlinx.serialization.Serializable

/** Zone de livraison choisie sans permission de position au premier lancement. */
@Serializable
data class ZoneLivraison(val id: String, val nom: String, val parDefaut: Boolean = false)

fun zoneParDefaut(zones: List<ZoneLivraison>): ZoneLivraison? = zones.firstOrNull { it.parDefaut } ?: zones.firstOrNull()

fun restaurantsDansZone(restaurants: List<Restaurant>, zone: ZoneLivraison?): List<Restaurant> =
    zone?.let { cible -> restaurants.filter { it.nomQuartier.equals(cible.nom, ignoreCase = true) } } ?: restaurants

fun cleZoneAccueil(zoneId: String) = "zone-$zoneId"

/** Clé de stockage du choix de zone de l'accueil ; la valeur [TOUTES_ZONES] signifie « pas de filtre ». */
const val CLE_ZONE_ACCUEIL = "zone_accueil"
const val TOUTES_ZONES = "*"

/**
 * Les zones où il y a réellement des restaurants (les quartiers des restaurants publiés), de A à Z ; la zone par défaut est celle qui en compte le plus (à égalité, la
 * première par ordre alphabétique). Une zone sans restaurant n'est jamais proposée : on ne montre pas un filtre qui donne une page vide.
 */
fun zonesDisponibles(restaurants: List<Restaurant>): List<ZoneLivraison> {
    val comptes = restaurants.mapNotNull { it.nomQuartier }.groupingBy { it }.eachCount()
    if (comptes.isEmpty()) return emptyList()
    val plusFournie = comptes.entries.sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key }).first().key
    return comptes.keys.sorted().map { ZoneLivraison(id = it, nom = it, parDefaut = it == plusFournie) }
}

/**
 * La zone à appliquer à l'accueil : « toutes les zones » si la personne l'a choisi, sa zone mémorisée si elle existe encore, sinon la zone par défaut — mais seulement
 * s'il y a au moins deux zones (avec une seule, un filtre ne sert à rien). Aucune position n'est demandée pour cela.
 */
fun zoneEffective(zones: List<ZoneLivraison>, choixMemorise: String?): ZoneLivraison? = when {
    choixMemorise == TOUTES_ZONES -> null
    choixMemorise != null && zones.any { it.id == choixMemorise } -> zones.first { it.id == choixMemorise }
    zones.size >= 2 -> zoneParDefaut(zones)
    else -> null
}

/** Nombre de restaurants de chaque zone, pour le sélecteur. */
fun nombreParZone(restaurants: List<Restaurant>, zones: List<ZoneLivraison>): Map<String, Int> =
    zones.associate { z -> z.id to restaurantsDansZone(restaurants, z).size }
