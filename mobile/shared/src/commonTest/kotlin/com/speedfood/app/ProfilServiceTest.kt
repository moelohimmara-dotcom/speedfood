package com.speedfood.app

import com.speedfood.app.data.CLE_PROFIL_CHOISI
import com.speedfood.app.data.ProfilEntree
import com.speedfood.app.data.ProfilService
import com.speedfood.app.data.StockageMemoire
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ProfilServiceTest {
    @Test
    fun leProfilChoisiEstMemoriseEtRelu() {
        val stockage = StockageMemoire()
        val s = ProfilService(stockage)
        assertNull(s.profil.value)
        s.choisir(ProfilEntree.Restaurateur)
        assertEquals(ProfilEntree.Restaurateur, s.profil.value)
        assertEquals("restaurateur", stockage.lire(CLE_PROFIL_CHOISI))
        assertEquals(ProfilEntree.Restaurateur, ProfilService(stockage).profil.value, "un nouveau lancement retrouve le profil")
    }

    @Test
    fun changerDeProfilOublieLeChoixEtDemandeLEcranDeChoix() {
        val stockage = StockageMemoire()
        val s = ProfilService(stockage)
        s.choisir(ProfilEntree.Consommateur)
        s.demanderChangement()
        assertNull(s.profil.value)
        assertNull(stockage.lire(CLE_PROFIL_CHOISI))
        assertTrue(s.choixDemande.value)
        s.choixTraite()
        assertFalse(s.choixDemande.value)
    }

    @Test
    fun uneSessionFermeeQuiEffaceLeProfilSeVoitApresRelecture() {
        val stockage = StockageMemoire()
        val s = ProfilService(stockage)
        s.choisir(ProfilEntree.Professionnel)
        stockage.effacer(CLE_PROFIL_CHOISI)
        s.relire()
        assertNull(s.profil.value)
    }
}
