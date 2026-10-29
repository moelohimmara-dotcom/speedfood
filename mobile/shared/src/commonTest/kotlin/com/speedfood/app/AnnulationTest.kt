package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandeServeur
import com.speedfood.app.data.CreationCommande
import com.speedfood.app.data.KtorCommandeApi
import com.speedfood.app.data.ResultatCommande
import com.speedfood.app.data.SuiviCommande
import com.speedfood.app.ui.EtatSuivi
import com.speedfood.app.ui.SuiviViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Annulation de la commande par le client : l'appel au serveur (le jeton voyage dans le corps, jamais dans l'adresse), le message du serveur relayé tel quel, et l'écran de
 * suivi qui n'annule que tant que le restaurant n'a pas répondu.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AnnulationTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    @Test
    fun annulerEnvoieLeJetonDansLeCorpsEtRenvoieNullSiTout_VaBien() = runTest {
        var chemin = ""
        var corps = ""
        var url = ""
        val api = KtorCommandeApi(client(MockEngine { r ->
            chemin = r.url.encodedPath
            url = r.url.toString()
            corps = r.body.toByteArray().decodeToString()
            respond("""{"ok":true,"reference":"SF-7"}""", HttpStatusCode.OK, json)
        }), config)
        assertNull(api.annuler("jeton-de-suivi-123"))
        assertTrue(chemin.endsWith("/api/v1/suivi/annuler"), chemin)
        assertTrue(corps.contains("\"jeton\":\"jeton-de-suivi-123\""), corps)
        assertTrue("jeton-de-suivi-123" !in url, "le jeton ne doit jamais être dans l'adresse")
    }

    @Test
    fun annulerRelaieLeMessageDuServeurQuandLeRestaurantAdejaRepondu() = runTest {
        val api = KtorCommandeApi(client(MockEngine {
            respond(
                """{"ok":false,"erreur":{"code":"CONFLIT_ETAT","message":"Le restaurant a déjà répondu à votre commande : elle ne peut plus être annulée ici. Appelez l'assistance Speedfood."}}""",
                HttpStatusCode.Conflict, json,
            )
        }), config)
        val message = api.annuler("jeton-de-suivi-123")
        assertTrue(message != null && message.contains("Appelez l'assistance"), message)
    }

    // Les tests du modèle d'écran n'utilisent pas runTest : le suivi relit le statut en boucle (minuteur de 15 s) et runTest attendrait ce minuteur virtuel sans fin.

    /** Faux serveur de suivi : une commande qui change de statut selon ce que fait l'écran. */
    private class FauxServeur(var statut: String, private val refus: String? = null) : CommandeApi {
        var annulations = 0
        override suspend fun creer(commande: CreationCommande, jetonAcces: String): ResultatCommande = error("inutile ici")
        override suspend fun suivi(jeton: String): SuiviCommande = SuiviCommande(reference = "SF-7", statut = statut)
        override suspend fun lister(jetonAcces: String): List<CommandeServeur> = emptyList()
        override suspend fun repondreProposition(jeton: String, propositionId: String, accepter: Boolean): String? = null
        override suspend fun annuler(jeton: String): String? {
            annulations++
            if (refus != null) return refus
            statut = "annulee"
            return null
        }
    }

    @Test
    fun ecranDeSuiviAnnuleUneCommandeEnAttente() {
        val api = FauxServeur("en_attente")
        val vm = SuiviViewModel(api, "jeton", null)
        vm.annuler()
        assertEquals(1, api.annulations)
        val e = vm.etat.value as EtatSuivi.Pret
        assertEquals("annulee", e.suivi.statut)
        assertTrue(e.reponse!!.contains("annulée"), e.reponse)
        assertEquals(false, e.envoiReponse)
    }

    @Test
    fun ecranDeSuiviNAnnulePasUneCommandeDejaAcceptee() {
        val api = FauxServeur("acceptee")
        val vm = SuiviViewModel(api, "jeton", null)
        vm.annuler()
        assertEquals(0, api.annulations, "aucune requête : le restaurant a déjà répondu")
        assertEquals("acceptee", (vm.etat.value as EtatSuivi.Pret).suivi.statut)
    }

    @Test
    fun ecranDeSuiviAfficheLeRefusDuServeur() {
        val api = FauxServeur("en_attente", refus = "Le restaurant vient de répondre à votre commande : elle ne peut plus être annulée ici. Appelez l'assistance Speedfood.")
        val vm = SuiviViewModel(api, "jeton", null)
        vm.annuler()
        val e = vm.etat.value as EtatSuivi.Pret
        assertEquals("en_attente", e.suivi.statut, "le statut affiché reste celui du serveur")
        assertTrue(e.reponse!!.contains("Appelez l'assistance"), e.reponse)
    }
}
