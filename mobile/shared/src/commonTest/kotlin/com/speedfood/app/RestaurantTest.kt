package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.KtorRestaurantApi
import com.speedfood.app.data.Restaurant
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
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.time.Instant

class RestaurantTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun lectureDeLaListePublique() = runTest {
        val corps = """[{"id":"a","nom":"Chez Awa","horaires":"8h-22h","ouvert":true,"accepte_commandes":true,
            "statut_mis_a_jour_le":"2026-10-21T10:00:00+00:00","photo_url":null,"logo_url":null,"couleur_accent":null,"code_court":"AWA",
            "avis_somme":9,"avis_total":2,"quartier":{"nom":"Kaloum"},"champ_inconnu":1}]"""
        var urlDemandee = ""
        var cleEnvoyee: String? = null
        val api = KtorRestaurantApi(client(MockEngine { requete ->
            urlDemandee = requete.url.toString()
            cleEnvoyee = requete.headers["apikey"]
            respond(corps, HttpStatusCode.OK, json)
        }), config)

        val liste = api.lister()

        assertEquals(1, liste.size)
        assertEquals("Chez Awa", liste[0].nom)
        assertEquals("Kaloum", liste[0].nomQuartier)
        assertEquals("cle-publique-de-test", cleEnvoyee)
        assertTrue(urlDemandee.contains("/rest/v1/restaurants"))
        assertTrue(urlDemandee.contains("donnees_demo=eq.false"), "les données de démonstration ne sont jamais montrées")
        assertTrue(urlDemandee.contains("limit=100"), "lecture bornée")
    }

    @Test
    fun noteMoyenneAbsenteSansAvis() {
        assertNull(Restaurant(id = "a", nom = "A").noteMoyenne)
        assertEquals(4.5, Restaurant(id = "a", nom = "A", avisSomme = 9, avisTotal = 2).noteMoyenne)
    }

    @Test
    fun ageDuStatut() {
        val maintenant = Instant.parse("2026-10-21T12:00:00Z")
        assertEquals(2 * 3_600_000L, Restaurant(id = "a", nom = "A", statutMisAJourLe = "2026-10-21T10:00:00+00:00").ageStatutMillis(maintenant))
        assertNull(Restaurant(id = "a", nom = "A", statutMisAJourLe = "pas une date").ageStatutMillis(maintenant))
        assertNull(Restaurant(id = "a", nom = "A").ageStatutMillis(maintenant))
    }

    @Test
    fun uneReponseEnErreurDonneUnMessageLisible() = runTest {
        val api = KtorRestaurantApi(client(MockEngine { respond("{}", HttpStatusCode.InternalServerError, json) }), config)
        val erreur = assertFailsWith<ErreurReseau> { api.lister() }
        assertTrue(erreur.message!!.contains("500"))
        assertTrue(!erreur.message!!.contains(config.supabaseAnonKey), "aucune clé dans un message affiché")
    }

    @Test
    fun uneReponseIllisibleDonneUnMessageLisible() = runTest {
        val api = KtorRestaurantApi(client(MockEngine { respond("pas du json", HttpStatusCode.OK, json) }), config)
        assertFailsWith<ErreurReseau> { api.lister() }
    }

    @Test
    fun sansConfigurationOnNeFaitAucuneRequete() = runTest {
        var appels = 0
        val api = KtorRestaurantApi(client(MockEngine { appels++; respond("[]", HttpStatusCode.OK, json) }), SpeedfoodConfig("", "", ""))
        assertFailsWith<ErreurReseau> { api.lister() }
        assertEquals(0, appels)
    }
}
