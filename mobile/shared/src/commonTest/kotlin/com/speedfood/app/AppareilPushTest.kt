package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AppareilApi
import com.speedfood.app.data.EnregistrementPush
import com.speedfood.app.data.FournisseurJetonPush
import com.speedfood.app.data.JetonPushIndisponible
import com.speedfood.app.data.KtorAppareilApi
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.Session
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
import kotlin.test.assertTrue

class AppareilPushTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private class FauxJeton(var valeur: String?, override val disponible: Boolean = true) : FournisseurJetonPush {
        override suspend fun jeton(): String? = valeur
    }

    private class FausseApi(var accepte: Boolean = true) : AppareilApi {
        val enregistres = mutableListOf<Triple<String, String, String?>>()
        val retires = mutableListOf<String>()
        override suspend fun enregistrer(jetonAcces: String, jetonAppareil: String, plateforme: String, versionApp: String?): Boolean {
            enregistres += Triple(jetonAppareil, plateforme, versionApp)
            return accepte
        }
        override suspend fun retirer(jetonAcces: String, jetonAppareil: String): Boolean {
            retires += jetonAppareil
            return true
        }
    }

    private fun session(stockage: StockageMemoire, connecte: Boolean, userId: String = "u1"): SessionService {
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, userId, "a@b.test")))
        return SessionService(KtorAuthApi(client(MockEngine { respond("{}", HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
    }

    private val jetonA = "jeton-appareil-aaaaaaaaaaaaaaaaaaaa"

    @Test
    fun sansSessionOuSansJetonRienNePart() = runTest {
        val api = FausseApi()
        val stockage = StockageMemoire()
        EnregistrementPush(session(stockage, connecte = false), api, FauxJeton(jetonA), stockage, "android", "2.7.0").enregistrer()
        assertTrue(api.enregistres.isEmpty(), "personne n'est connecté")
        val s2 = StockageMemoire()
        EnregistrementPush(session(s2, connecte = true), api, FauxJeton(null), s2, "android", "2.7.0").enregistrer()
        assertTrue(api.enregistres.isEmpty(), "pas de jeton (services Google absents ou réseau coupé)")
        val s3 = StockageMemoire()
        EnregistrementPush(session(s3, connecte = true), api, JetonPushIndisponible(), s3, "android", "2.7.0").enregistrer()
        assertTrue(api.enregistres.isEmpty(), "plateforme sans notifications poussées")
    }

    @Test
    fun uneFoisParCoupleCompteEtJeton() = runTest {
        val api = FausseApi()
        val stockage = StockageMemoire()
        val faux = FauxJeton(jetonA)
        val e = EnregistrementPush(session(stockage, connecte = true), api, faux, stockage, "android", "2.7.0")
        e.enregistrer()
        e.enregistrer()
        assertEquals(1, api.enregistres.size, "déjà enregistré : pas de nouvel appel")
        assertEquals(Triple(jetonA, "android", "2.7.0"), api.enregistres[0])
        faux.valeur = "nouveau-jeton-bbbbbbbbbbbbbbbbbbbb"
        e.enregistrer()
        assertEquals(2, api.enregistres.size, "nouveau jeton : on ré-enregistre")
    }

    @Test
    fun unRefusDuServeurSeraRejoue() = runTest {
        val api = FausseApi(accepte = false)
        val stockage = StockageMemoire()
        val e = EnregistrementPush(session(stockage, connecte = true), api, FauxJeton(jetonA), stockage, "android", null)
        e.enregistrer()
        api.accepte = true
        e.enregistrer()
        assertEquals(2, api.enregistres.size, "l'échec n'est pas mémorisé : le prochain essai repart")
        e.enregistrer()
        assertEquals(2, api.enregistres.size, "une fois accepté, plus d'appel")
    }

    @Test
    fun laDeconnexionRetireLAppareilEtOubliePourPouvoirSEnregistrerAilleurs() = runTest {
        val api = FausseApi()
        val stockage = StockageMemoire()
        val e = EnregistrementPush(session(stockage, connecte = true), api, FauxJeton(jetonA), stockage, "android", null)
        e.enregistrer()
        e.retirer()
        assertEquals(listOf(jetonA), api.retires)
        e.enregistrer()
        assertEquals(2, api.enregistres.size, "après un retrait, le même appareil peut être ré-enregistré (autre compte, reconnexion)")
    }

    @Test
    fun lesRequetesVisentLesBonnesRoutesAvecLeJetonDuCompte() = runTest {
        val vus = mutableListOf<Triple<String, String?, String>>()
        val api = KtorAppareilApi(
            client(MockEngine { r ->
                vus += Triple(r.url.encodedPath, r.headers[HttpHeaders.Authorization], r.body.toByteArray().decodeToString())
                respond("""{"ok":true}""", HttpStatusCode.OK, json)
            }),
            config,
        )
        assertTrue(api.enregistrer("acces", jetonA, "android", "2.7.0"))
        assertTrue(api.retirer("acces", jetonA))
        assertEquals("/api/v1/appareils", vus[0].first)
        assertEquals("/api/v1/appareils/retirer", vus[1].first)
        assertEquals("Bearer acces", vus[0].second)
        val corps = Json.parseToJsonElement(vus[0].third).jsonObject
        assertEquals("android", corps["plateforme"]!!.jsonPrimitive.content)
        assertEquals("2.7.0", corps["versionApp"]!!.jsonPrimitive.content)
        // Réseau coupé : jamais d'exception.
        val coupe = KtorAppareilApi(client(MockEngine { throw RuntimeException("réseau coupé") }), config)
        assertEquals(false, coupe.enregistrer("acces", jetonA, "android", null))
    }
}
