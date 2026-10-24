package com.speedfood.app

import com.speedfood.app.data.CategorieRef
import com.speedfood.app.data.QuartierRef
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.ZoneLivraison
import com.speedfood.app.data.construireAccueil
import com.speedfood.app.data.libelleDisponibilite
import com.speedfood.app.data.restaurantsDansZone
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AccueilTest {
    private val restaurants = listOf(
        Restaurant("a", "Chez A", ouvert = true, accepteCommandes = true, avisSomme = 45, avisTotal = 10, quartier = QuartierRef("Kaloum"), categorie = CategorieRef("Riz")),
        Restaurant("b", "Chez B", ouvert = false, quartier = QuartierRef("Matam"), categorie = CategorieRef("Grill")),
    )

    @Test
    fun filtreParZoneEtConstruitLesSections() {
        val accueil = construireAccueil(restaurants, ZoneLivraison("kaloum", "Kaloum", parDefaut = true))
        assertEquals(listOf("a"), accueil.proches.map { it.id })
        assertEquals(listOf("a"), accueil.ouverts.map { it.id })
        assertEquals(listOf("Riz"), accueil.cuisines)
        assertEquals(listOf("a"), restaurantsDansZone(restaurants, ZoneLivraison("kaloum", "Kaloum")).map { it.id })
    }

    @Test
    fun disponibiliteResteLisible() {
        assertTrue(libelleDisponibilite(restaurants.first()).contains("Disponibilité"))
        assertEquals("Fermé pour le moment", libelleDisponibilite(restaurants.last()))
    }
}
