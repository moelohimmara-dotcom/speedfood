package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorPaiementsEquipeApi
import com.speedfood.app.data.LitigeVu
import com.speedfood.app.data.PaiementVu
import com.speedfood.app.data.VersementVu
import com.speedfood.app.data.libelleEtatPaiement
import com.speedfood.app.data.libelleVersement
import com.speedfood.app.data.paiementEnAlerte
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PaiementsEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorPaiementsEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @Test
    fun lesPaiementsSeLisentEnLectureSeule() = runTest {
        var methode: String? = null
        val a = api(MockEngine { r ->
            methode = r.method.value
            respond(
                """{"ok":true,"reglages":{"actif":false,"fournisseur":"simulation","valeursValidees":false},
                    "compteurs":{"enAttente":1,"versementsATraiter":2,"litigesAHumain":1},
                    "paiements":[{"id":"p1","commandeReference":"SF-5","restaurantNom":"Chez Awa","etat":"libere","operateur":"orange_money","fournisseur":"simulation",
                    "totalGnf":50000,"restaurantGnf":40000,"livreurGnf":5000,"speedfoodBrutGnf":5000,"fraisMobileGnf":1000,"rembourseGnf":0,"creeLe":"2026-10-22T09:00:00Z",
                    "versements":[{"beneficiaire":"restaurant","etat":"echoue","montantGnf":40000,"erreurCode":"reseau"}],"litiges":[{"situation":"non_livree","etat":"a_humain","regle":null}]}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val r = a.paiements("acces")
        assertEquals("GET", methode, "aucune écriture : lecture seule")
        assertFalse(r.reglages.actif)
        assertEquals(2, r.compteurs.versementsATraiter)
        val p = r.paiements.single()
        assertEquals("SF-5", p.commandeReference)
        assertTrue(paiementEnAlerte(p), "versement échoué et litige à décider : en alerte")
    }

    @Test
    fun lesLibellesEtLesAlertes() {
        assertEquals("Payé, à libérer", libelleEtatPaiement("confirme"))
        assertEquals("Versé", libelleVersement("confirme"))
        assertEquals("inconnu", libelleEtatPaiement("inconnu"))
        val sain = PaiementVu(etat = "libere", versements = listOf(VersementVu("restaurant", "confirme", 1)), litiges = listOf(LitigeVu("x", "clos")))
        assertFalse(paiementEnAlerte(sain))
        assertTrue(paiementEnAlerte(PaiementVu(etat = "en_litige")))
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.paiements("acces") }
    }
}
