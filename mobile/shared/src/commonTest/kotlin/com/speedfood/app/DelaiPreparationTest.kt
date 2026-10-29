package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorReglagesRestaurateurApi
import com.speedfood.app.data.SuiviCommande
import com.speedfood.app.data.heureLisible
import com.speedfood.app.data.verifierDelaiPreparation
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Heure estimée de préparation : la saisie du restaurateur, son enregistrement, et ce que le client lit. */
class DelaiPreparationTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun saisieDuDelaiMemesReglesQueLeServeur() {
        assertNull(verifierDelaiPreparation(""), "vide = aucune estimation")
        assertNull(verifierDelaiPreparation("   "))
        for (bon in listOf("5", "25", " 30 ", "240")) assertNull(verifierDelaiPreparation(bon), bon)
        for (mauvais in listOf("4", "241", "0", "-10", "12.5", "abc", "25 min", "99999")) assertNotNull(verifierDelaiPreparation(mauvais), mauvais)
        assertTrue(verifierDelaiPreparation("3")!!.contains("entre 5 et 240"))
    }

    @Test
    fun heureEstimeeAfficheeALHeureDeConakry() {
        assertEquals("14:35", heureLisible("2026-10-29T14:35:00Z"))
        assertEquals("00:05", heureLisible("2026-10-29T00:05:00Z"))
        assertEquals("", heureLisible(null))
        assertEquals("", heureLisible("n'importe quoi"))
    }

    @Test
    fun leSuiviLitLHeureEstimeeEtLeDelaiDuRestaurant() {
        val lu = Json { ignoreUnknownKeys = true }.decodeFromString<SuiviCommande>(
            """{"reference":"SF-1","statut":"acceptee","pretEstimeeLe":"2026-10-29T14:35:00.000Z","restaurant":{"nom":"Chez Awa","delaiPreparationMinutes":25}}""",
        )
        assertEquals("2026-10-29T14:35:00.000Z", lu.pretEstimeeLe)
        assertEquals(25, lu.restaurant.delaiPreparationMinutes)
        val ancien = Json { ignoreUnknownKeys = true }.decodeFromString<SuiviCommande>("""{"reference":"SF-1","statut":"en_attente"}""")
        assertNull(ancien.pretEstimeeLe, "un serveur plus ancien n'envoie rien : pas d'estimation")
        assertNull(ancien.restaurant.delaiPreparationMinutes)
    }

    @Test
    fun lesReglagesLisentLeDelaiDeclare() = runTest {
        val api = KtorReglagesRestaurateurApi(client(MockEngine {
            respond("""{"ok":true,"horaires":"","ouvert":true,"accepteCommandes":true,"platsAReconfirmer":[],"delaiPreparationMinutes":30}""", HttpStatusCode.OK, json)
        }), config)
        assertEquals(30, api.charger("jeton").delaiPreparationMinutes)
        val sansDelai = KtorReglagesRestaurateurApi(client(MockEngine {
            respond("""{"ok":true,"horaires":"","ouvert":true,"accepteCommandes":true,"platsAReconfirmer":[]}""", HttpStatusCode.OK, json)
        }), config)
        assertNull(sansDelai.charger("jeton").delaiPreparationMinutes)
    }

    @Test
    fun enregistrerLeDelaiLEnvoieEnTexteMemeVide() = runTest {
        val corps = mutableListOf<String>()
        val api = KtorReglagesRestaurateurApi(client(MockEngine { r ->
            corps += r.body.toByteArray().decodeToString()
            respond("""{"ok":true}""", HttpStatusCode.OK, json)
        }), config)
        assertNull(api.enregistrerDelai("jeton", "25"))
        assertNull(api.enregistrerDelai("jeton", ""))
        assertTrue(corps[0].contains("\"delaiPreparationMinutes\":\"25\""), corps[0])
        assertTrue(corps[1].contains("\"delaiPreparationMinutes\":\"\""), "vide = effacer l'estimation, jamais un champ omis : ${corps[1]}")
    }

    @Test
    fun enregistrerLeDelaiRelaieLeRefusDuServeur() = runTest {
        val api = KtorReglagesRestaurateurApi(client(MockEngine {
            respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Le délai de préparation doit être compris entre 5 et 240 minutes."}}""", HttpStatusCode.BadRequest, json)
        }), config)
        assertTrue(api.enregistrerDelai("jeton", "999")!!.contains("entre 5 et 240"))
    }
}
