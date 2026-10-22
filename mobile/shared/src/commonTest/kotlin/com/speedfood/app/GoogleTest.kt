package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAuth
import com.speedfood.app.data.GoogleIndisponible
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.ResultatGoogle
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
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
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

class GoogleTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }
    private val reponseJeton = """{"access_token":"acces-g","refresh_token":"renouv-g","expires_in":3600,"user":{"id":"ug","email":"g@gmail.test"}}"""

    @Test
    fun leJetonGoogleEstEchangeContreUneSessionAvecSonNonce() = runTest {
        var url: String? = null
        var corps = ""
        var cle: String? = null
        val auth = KtorAuthApi(client(MockEngine { r -> url = r.url.toString(); cle = r.headers["apikey"]; corps = r.body.toByteArray().decodeToString(); respond(reponseJeton, HttpStatusCode.OK, json) }), config) { 1_000L }
        val s = auth.connecterAvecGoogle("jeton-identite-google", "nonce-brut-123")
        assertEquals("acces-g", s.accessToken)
        assertEquals("g@gmail.test", s.email)
        assertTrue(url!!.contains("grant_type=id_token"), "échange de jeton d'identité, pas de mot de passe")
        assertEquals("cle-publique-de-test", cle, "clé publique uniquement")
        val racine = Json.parseToJsonElement(corps).jsonObject
        assertEquals("google", racine["provider"]!!.jsonPrimitive.content)
        assertEquals("jeton-identite-google", racine["id_token"]!!.jsonPrimitive.content)
        assertEquals("nonce-brut-123", racine["nonce"]!!.jsonPrimitive.content)
    }

    @Test
    fun uneSessionGoogleEstGardeeCommeUneAutre() = runTest {
        val stockage = StockageMemoire()
        val service = SessionService(KtorAuthApi(client(MockEngine { respond(reponseJeton, HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
        service.connecterAvecGoogle("jeton", "nonce")
        assertEquals("ug", service.session.value?.userId)
        assertNotNull(stockage.lire(SessionService.CLE))
    }

    @Test
    fun lesRefusDuServiceSontTraduitsEnFrancais() = runTest {
        fun auth(corps: String, statut: HttpStatusCode = HttpStatusCode.BadRequest) = KtorAuthApi(client(MockEngine { respond(corps, statut, json) }), config) { 0L }
        val inactif = assertFailsWith<ErreurAuth> { auth("""{"msg":"Unsupported provider: provider is not enabled"}""").connecterAvecGoogle("j", "n") }
        assertEquals("La connexion avec Google n'est pas encore activée.", inactif.message)
        val nonce = assertFailsWith<ErreurAuth> { auth("""{"msg":"Nonces mismatch"}""").connecterAvecGoogle("j", "n") }
        assertTrue(nonce.message!!.contains("recommencez"))
        val panne = assertFailsWith<ErreurAuth> { auth("oops", HttpStatusCode.BadGateway).connecterAvecGoogle("j", "n") }
        assertEquals(true, panne.temporaire)
    }

    @Test
    fun leBoutonGoogleDependDeCeQueLeServiceActive() = runTest {
        fun auth(corps: String, statut: HttpStatusCode = HttpStatusCode.OK) = KtorAuthApi(client(MockEngine { r ->
            assertEquals("/auth/v1/settings", r.url.encodedPath)
            respond(corps, statut, json)
        }), config) { 0L }
        assertEquals(setOf("google", "email"), auth("""{"external":{"google":true,"email":true,"facebook":false,"apple":false}}""").fournisseursActifs())
        assertEquals(setOf("email"), auth("""{"external":{"google":false,"email":true}}""").fournisseursActifs())
        assertEquals(emptySet(), auth("pas du json").fournisseursActifs(), "illisible : pas de bouton")
        assertEquals(emptySet(), auth("{}", HttpStatusCode.BadGateway).fournisseursActifs())
        assertEquals(emptySet(), KtorAuthApi(client(MockEngine { throw RuntimeException("réseau coupé") }), config) { 0L }.fournisseursActifs())
    }

    @Test
    fun sansFournisseurGoogleOnExpliqueSansPlanter() = runTest {
        val g = GoogleIndisponible()
        assertEquals(false, g.disponible)
        assertTrue(g.jetonIdentite() is ResultatGoogle.Erreur)
    }
}
