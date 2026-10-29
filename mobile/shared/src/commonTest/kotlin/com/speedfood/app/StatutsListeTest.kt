package com.speedfood.app

import com.speedfood.app.ui.CommandeAffichee
import com.speedfood.app.ui.avecStatuts
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** « Mes commandes » : le statut lu en direct complète les commandes passées sans compte, sans jamais écraser celui que le serveur a déjà donné. */
class StatutsListeTest {
    private fun commande(reference: String, statut: String?) =
        CommandeAffichee(reference, "jeton-$reference", "r1", "Chez Awa", 1_000L, 25_000, statut, livraison = false, lignes = emptyList())

    @Test
    fun leStatutLuCompleteUneCommandeSansStatut() {
        val liste = listOf(commande("SF-1", null), commande("SF-2", null))
        val apres = avecStatuts(liste, mapOf("SF-1" to "acceptee"))
        assertEquals("acceptee", apres[0].statut)
        assertNull(apres[1].statut, "une commande dont le statut n'a pas pu être lu reste sans statut")
    }

    @Test
    fun leServeurFaitFoiQuandIlADejaDonneUnStatut() {
        val liste = listOf(commande("SF-1", "prete"))
        val apres = avecStatuts(liste, mapOf("SF-1" to "en_attente"))
        assertEquals("prete", apres[0].statut)
    }

    @Test
    fun uneListeVideOuSansLecturesNeChangeRien() {
        assertEquals(emptyList(), avecStatuts(emptyList(), mapOf("SF-1" to "acceptee")))
        val liste = listOf(commande("SF-1", null))
        assertEquals(liste, avecStatuts(liste, emptyMap()))
    }
}
