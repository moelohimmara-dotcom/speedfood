package com.speedfood.app.data

import kotlinx.serialization.Serializable

/** Zone de livraison choisie sans permission de position au premier lancement. */
@Serializable
data class ZoneLivraison(val id: String, val nom: String, val parDefaut: Boolean = false)

fun zoneParDefaut(zones: List<ZoneLivraison>): ZoneLivraison? = zones.firstOrNull { it.parDefaut } ?: zones.firstOrNull()

fun restaurantsDansZone(restaurants: List<Restaurant>, zone: ZoneLivraison?): List<Restaurant> =
    zone?.let { cible -> restaurants.filter { it.nomQuartier.equals(cible.nom, ignoreCase = true) } } ?: restaurants

fun cleZoneAccueil(zoneId: String) = "zone-$zoneId"
