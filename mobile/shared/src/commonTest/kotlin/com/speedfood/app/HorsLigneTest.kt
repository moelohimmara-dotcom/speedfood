package com.speedfood.app

import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.Menu
import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.Plat
import com.speedfood.app.data.QuartierChoix
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.RestaurantApiAvecCache
import com.speedfood.app.data.RestaurantFiche
import com.speedfood.app.data.StockageMemoire
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class HorsLigneTest {
    private class ApiFausse(var coupee: Boolean = false) : RestaurantApi {
        var appels = 0
        override suspend fun lister(): List<Restaurant> {
            appels++
            if (coupee) throw ErreurReseau("Impossible de joindre Speedfood.")
            return listOf(Restaurant(id = "r1", nom = "Chez Awa"))
        }
        override suspend fun fiche(id: String): RestaurantFiche? {
            if (coupee) throw ErreurReseau("Impossible de joindre Speedfood.")
            return null
        }
        override suspend fun quartiers(): List<QuartierChoix> {
            if (coupee) throw ErreurReseau("Impossible de joindre Speedfood.")
            return listOf(QuartierChoix("q1", "Kaloum"))
        }
        override suspend fun menu(id: String): Menu {
            if (coupee) throw ErreurReseau("Impossible de joindre Speedfood.")
            return Menu(emptyList(), listOf(Plat(id = "p1", nom = "Poulet braisé", prix = 40000)))
        }
    }

    @Test
    fun uneLectureReussieEstGardeeEtResservieQuandLeReseauSeCoupe() = runTest {
        var horloge = 1_000L
        val api = ApiFausse()
        val cache = RestaurantApiAvecCache(api, StockageMemoire()) { horloge }
        assertEquals("Chez Awa", cache.lister().single().nom)
        assertNull(cache.ageCache, "données fraîches : pas d'ancienneté")
        cache.quartiers()
        api.coupee = true
        horloge += 3_600_000L
        assertEquals("Chez Awa", cache.lister().single().nom)
        assertEquals(3_600_000L, cache.ageCache, "servi depuis le cache : l'ancienneté est connue")
        assertEquals("Kaloum", cache.quartiers().single().nom)
    }

    @Test
    fun sansCacheLErreurReseauRemonteTelle() = runTest {
        val api = ApiFausse(coupee = true)
        val cache = RestaurantApiAvecCache(api, StockageMemoire()) { 0L }
        assertFailsWith<ErreurReseau> { cache.lister() }
        assertFailsWith<ErreurReseau> { cache.menu("r1") }
    }

    @Test
    fun unCacheTropVieuxNEstPlusServi() = runTest {
        var horloge = 0L
        val api = ApiFausse()
        val cache = RestaurantApiAvecCache(api, StockageMemoire()) { horloge }
        cache.lister()
        api.coupee = true
        horloge += RestaurantApiAvecCache.VALIDITE_MS + 1
        assertFailsWith<ErreurReseau> { cache.lister() }
    }

    @Test
    fun leMenuEtLaFicheSontAussiEnCache() = runTest {
        val api = ApiFausse()
        val cache = RestaurantApiAvecCache(api, StockageMemoire()) { 0L }
        assertEquals("Poulet braisé", cache.menu("r1").plats.single().nom)
        api.coupee = true
        assertEquals("Poulet braisé", cache.menu("r1").plats.single().nom)
        assertTrue(cache.ageCache != null)
        // Un autre restaurant jamais consulté n'a rien en cache : l'erreur honnête.
        assertFailsWith<ErreurReseau> { cache.menu("r2") }
    }

    @Test
    fun lePanierSurvitAuRedemarrageEtSeVideComplet() {
        val stockage = StockageMemoire()
        val plat = Plat(id = "p1", nom = "Poulet braisé", prix = 40000, options = listOf(OptionPlat("o1", "Piment", 500)))
        val avant = PanierService(stockage)
        avant.ajouter("r1", "Chez Awa", plat, listOf(OptionPlat("o1", "Piment", 500)), 2)
        // « Redémarrage » : un nouveau service sur le même stockage retrouve le panier.
        val apres = PanierService(stockage)
        assertEquals(2, apres.panier.value.nombreArticles)
        assertEquals("Chez Awa", apres.panier.value.restaurantNom)
        assertEquals(81_000, apres.panier.value.sousTotal)
        apres.vider()
        assertTrue(PanierService(stockage).panier.value.estVide)
    }

    @Test
    fun unPanierIllisibleOuAbsentDonneUnPanierVide() {
        val stockage = StockageMemoire()
        assertTrue(PanierService(stockage).panier.value.estVide)
        stockage.ecrire("panier_v1", "pas du json")
        assertTrue(PanierService(stockage).panier.value.estVide)
        assertFalse(PanierService().panier.value.nombreArticles > 0)
    }
}
