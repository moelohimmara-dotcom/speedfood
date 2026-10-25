package com.speedfood.app

import com.speedfood.app.data.QuartierRef
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.TOUTES_ZONES
import com.speedfood.app.data.nombreParZone
import com.speedfood.app.data.restaurantsDansZone
import com.speedfood.app.data.zoneEffective
import com.speedfood.app.data.zonesDisponibles
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ZoneAccueilTest {
    private fun r(id: String, quartier: String?) = Restaurant(id = id, nom = "R$id", quartier = quartier?.let { QuartierRef(it) })

    private val liste = listOf(r("1", "Kipé"), r("2", "Kipé"), r("3", "Kaloum"), r("4", null))

    @Test
    fun lesZonesSontCellesOuIlYADesRestaurants() {
        val zones = zonesDisponibles(liste)
        assertEquals(listOf("Kaloum", "Kipé"), zones.map { it.nom }, "de A à Z, sans zone vide ni restaurant sans quartier")
        assertEquals("Kipé", zones.single { it.parDefaut }.nom, "la zone par défaut est la plus fournie")
        assertEquals(mapOf("Kaloum" to 1, "Kipé" to 2), nombreParZone(liste, zones))
        assertTrue(zonesDisponibles(emptyList()).isEmpty())
        assertEquals("Kaloum", zonesDisponibles(listOf(r("1", "Matam"), r("2", "Kaloum"))).single { it.parDefaut }.nom, "à égalité : ordre alphabétique")
    }

    @Test
    fun laZoneEffectiveSuitLeChoixSansJamaisCacherPourRien() {
        val zones = zonesDisponibles(liste)
        assertEquals("Kipé", zoneEffective(zones, null)?.nom, "pas de choix, au moins deux zones : la zone par défaut")
        assertEquals("Kaloum", zoneEffective(zones, "Kaloum")?.nom, "le choix mémorisé")
        assertNull(zoneEffective(zones, TOUTES_ZONES), "toutes les zones : pas de filtre")
        assertEquals("Kipé", zoneEffective(zones, "Zone disparue")?.nom, "une zone mémorisée qui n'existe plus : retour à la zone par défaut")
        assertNull(zoneEffective(zonesDisponibles(listOf(r("1", "Kipé"))), null), "une seule zone : aucun filtre")
        assertNull(zoneEffective(emptyList(), null))
    }

    @Test
    fun leFiltreDeZoneGardeLesBonsRestaurants() {
        val zones = zonesDisponibles(liste)
        assertEquals(listOf("1", "2"), restaurantsDansZone(liste, zones.single { it.nom == "Kipé" }).map { it.id })
        assertEquals(4, restaurantsDansZone(liste, null).size)
    }
}
