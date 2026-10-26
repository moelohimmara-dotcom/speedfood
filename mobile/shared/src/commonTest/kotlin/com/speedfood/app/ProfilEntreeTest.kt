package com.speedfood.app

import com.speedfood.app.data.DebutApplication
import com.speedfood.app.data.EcranEntree
import com.speedfood.app.data.ProfilEntree
import com.speedfood.app.data.debutApplication
import com.speedfood.app.data.ecranApresOuverture
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ProfilEntreeTest {
    @Test
    fun lEcranDeChoixNeSAfficheQuAuPremierLancementOuApresDeconnexion() {
        assertEquals(EcranEntree.Choix, ecranApresOuverture(lienProfond = false, connecte = false, profil = null), "personne de connu : on demande")
        assertEquals(EcranEntree.Application, ecranApresOuverture(lienProfond = true, connecte = false, profil = null), "un lien reçu ouvre sa fiche")
        assertEquals(EcranEntree.Application, ecranApresOuverture(lienProfond = false, connecte = true, profil = null), "connecté : directement son espace")
        assertEquals(EcranEntree.Application, ecranApresOuverture(lienProfond = false, connecte = false, profil = ProfilEntree.Consommateur), "profil déjà choisi")
    }

    @Test
    fun leDebutDependDuProfilEtDeLaConnexion() {
        assertEquals(DebutApplication.CreationCompte, debutApplication(ProfilEntree.Consommateur, connecte = false, apresChoix = true))
        assertEquals(DebutApplication.Normal, debutApplication(ProfilEntree.Consommateur, connecte = false), "le consommateur qui revient retrouve l'accueil")
        assertEquals(DebutApplication.CreationCompteRestaurateur, debutApplication(ProfilEntree.Restaurateur, connecte = false, apresChoix = true))
        assertEquals(DebutApplication.CreationCompteRestaurateur, debutApplication(ProfilEntree.Restaurateur, connecte = false), "compte pas fini : on le reprend")
        assertEquals(DebutApplication.AccesPro, debutApplication(ProfilEntree.Professionnel, connecte = false))
        assertEquals(DebutApplication.Normal, debutApplication(ProfilEntree.Restaurateur, connecte = true), "connecté : l'accueil, l'espace est géré ailleurs")
        assertEquals(DebutApplication.Normal, debutApplication(null, connecte = false))
    }

    @Test
    fun laVisiteDuProfilEstProposeeUneSeuleFois() {
        assertEquals(true, com.speedfood.app.data.visiteAProposer(restaurateur = false, vues = emptySet()))
        assertEquals(true, com.speedfood.app.data.visiteAProposer(restaurateur = true, vues = emptySet()))
        assertEquals(false, com.speedfood.app.data.visiteAProposer(restaurateur = false, vues = setOf("visite_vue_consommateur")))
        assertEquals(false, com.speedfood.app.data.visiteAProposer(restaurateur = false, vues = setOf("visite_vue")), "l'ancienne visite compte pour le consommateur")
        assertEquals(true, com.speedfood.app.data.visiteAProposer(restaurateur = true, vues = setOf("visite_vue")), "mais pas pour un restaurateur")
        assertEquals(false, com.speedfood.app.data.visiteAProposer(restaurateur = true, vues = setOf("visite_vue_restaurateur")))
    }

    @Test
    fun leProfilSeRelitParSaCle() {
        assertEquals(ProfilEntree.Restaurateur, ProfilEntree.depuis("restaurateur"))
        assertNull(ProfilEntree.depuis("inconnu"))
        assertNull(ProfilEntree.depuis(null))
    }
}
