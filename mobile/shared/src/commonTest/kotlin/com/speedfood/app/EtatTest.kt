package com.speedfood.app

import com.speedfood.app.disponibilite.EtatRestaurant
import com.speedfood.app.disponibilite.Ton
import com.speedfood.app.disponibilite.ancienneteLisible
import com.speedfood.app.disponibilite.estCommandable
import com.speedfood.app.disponibilite.estFraiche
import com.speedfood.app.disponibilite.etatRestaurant
import com.speedfood.app.disponibilite.libelleEtat
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Mêmes règles que les tests du dossier scripts/tests côté site : une disponibilité est une déclaration récente, jamais une garantie. */
class EtatTest {
    @Test
    fun troisSituationsDistinctes() {
        assertEquals(EtatRestaurant.Ferme, etatRestaurant(ouvert = false, accepteCommandes = true))
        assertEquals(EtatRestaurant.Ferme, etatRestaurant(ouvert = false, accepteCommandes = false))
        assertEquals(EtatRestaurant.Pause, etatRestaurant(ouvert = true, accepteCommandes = false))
        assertEquals(EtatRestaurant.Ouvert, etatRestaurant(ouvert = true, accepteCommandes = true))
    }

    @Test
    fun seuleLaSituationOuvertEstCommandable() {
        assertTrue(estCommandable(true, true))
        assertFalse(estCommandable(true, false))
        assertFalse(estCommandable(false, true))
    }

    @Test
    fun libellesEtTons() {
        assertEquals("Ouvert" to Ton.Succes, libelleEtat(EtatRestaurant.Ouvert).let { it.texte to it.ton })
        assertEquals("Commandes en pause" to Ton.Neutre, libelleEtat(EtatRestaurant.Pause).let { it.texte to it.ton })
        assertEquals("Fermé" to Ton.Danger, libelleEtat(EtatRestaurant.Ferme).let { it.texte to it.ton })
    }

    @Test
    fun ancienneteLisible() {
        val minute = 60_000L
        assertEquals("à l'instant", ancienneteLisible(30_000))
        assertEquals("il y a 25 min", ancienneteLisible(25 * minute))
        assertEquals("il y a 3 h", ancienneteLisible(3 * 60 * minute))
        assertEquals("hier", ancienneteLisible(30 * 60 * minute))
        assertEquals("il y a 4 jours", ancienneteLisible(4 * 24 * 60 * minute))
    }

    @Test
    fun unAgeNegatifVautMaintenant() {
        assertEquals("à l'instant", ancienneteLisible(-5 * 60_000L))
        assertTrue(estFraiche(-1_000))
    }

    @Test
    fun fraicheurAuSeuilDeSixHeures() {
        val heure = 3_600_000L
        assertTrue(estFraiche(6 * heure))
        assertFalse(estFraiche(6 * heure + 1))
        assertFalse(estFraiche(null), "jamais confirmé : à confirmer, jamais disponible")
    }
}
