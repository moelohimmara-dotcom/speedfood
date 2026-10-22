package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorAideApi
import com.speedfood.app.data.QUESTIONS_AIDE
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AideTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test/")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun leNumeroDAssistanceNeGardeQueLesChiffres() = runTest {
        var chemin = ""
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            respond("""{"ok":true,"whatsapp":"+224 620 00 00 00"}""", HttpStatusCode.OK, json)
        }
        assertEquals("224620000000", KtorAideApi(client(moteur), config).whatsapp())
        assertEquals("/api/v1/aide", chemin)
    }

    @Test
    fun pasDeNumeroOuNumeroAbsurdeOuServeurHorsLigneDonneNull() = runTest {
        assertNull(KtorAideApi(client(MockEngine { respond("""{"ok":true,"whatsapp":null}""", HttpStatusCode.OK, json) }), config).whatsapp())
        assertNull(KtorAideApi(client(MockEngine { respond("""{"ok":true,"whatsapp":"12"}""", HttpStatusCode.OK, json) }), config).whatsapp())
        assertNull(KtorAideApi(client(MockEngine { respond("oups", HttpStatusCode.InternalServerError, json) }), config).whatsapp())
        assertNull(KtorAideApi(client(MockEngine { throw RuntimeException("réseau coupé") }), config).whatsapp())
    }

    @Test
    fun lesQuestionsFrequentesSontCompletes() {
        assertTrue(QUESTIONS_AIDE.size >= 5)
        assertTrue(QUESTIONS_AIDE.all { it.question.endsWith("?") || it.question.endsWith(".") })
        assertTrue(QUESTIONS_AIDE.all { it.reponse.length > 40 })
        // L'application n'encaisse rien : la réponse sur le paiement doit le dire (pas de promesse qu'elle ne tient pas).
        assertTrue(QUESTIONS_AIDE.first { it.question.startsWith("Comment payer") }.reponse.contains("n'encaisse rien"))
    }
}
