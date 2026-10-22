package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AVATARS_CLIENT
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorClientApi
import com.speedfood.app.data.emojiAvatarClient
import com.speedfood.app.data.verifierAdresse
import com.speedfood.app.data.verifierPseudo
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
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EspaceClientTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun lePseudoSuitLaContrainteDeLaBase() {
        assertNull(verifierPseudo("Piment Malin 42"))
        assertNull(verifierPseudo("Aïssatou_B"))
        assertEquals("Le pseudo doit faire 3 à 24 caractères.", verifierPseudo("ab"))
        assertEquals("Le pseudo doit faire 3 à 24 caractères.", verifierPseudo("a".repeat(25)))
        assertTrue(verifierPseudo("Pseudo <script>")!!.contains("ne peut contenir"))
    }

    @Test
    fun lAdresseSuitLesBornesDuSite() {
        assertNull(verifierAdresse("Maison", "Kaloum, rue KA-012, près de la mosquée"))
        assertTrue(verifierAdresse("M", "Kaloum, rue KA-012")!!.contains("nom court"))
        assertTrue(verifierAdresse("Maison", "Rue")!!.contains("Décrivez l'adresse"))
        assertTrue(verifierAdresse("Maison", "x".repeat(301))!!.contains("Décrivez l'adresse"))
    }

    @Test
    fun lesAvatarsCorrespondentALaListeFermeeDeLaBase() {
        assertEquals(listOf("burger", "pizza", "riz", "poulet", "poisson", "cafe", "pain", "salade", "brochette", "glace"), AVATARS_CLIENT.map { it.first })
        assertEquals("🍔", emojiAvatarClient("burger"))
        assertEquals("🍽️", emojiAvatarClient("inconnu"))
    }

    @Test
    fun lEspaceSeLitEnUnSeulAppel() = runTest {
        var chemin = ""
        var entete: String? = null
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            entete = requete.headers[HttpHeaders.Authorization]
            respond(
                """{"ok":true,"profil":{"pseudo":"Piment Malin 42","avatar":"pizza","modePrefere":"livraison","notificationsCommande":true},"adresses":[{"id":"a1","libelle":"Maison","adresse":"Kaloum, rue KA-012","parDefaut":true}],"favoris":[{"restaurantId":"r1","nom":"Chez Awa","ouvert":true}],"avis":[{"id":"v1","restaurantNom":"Chez Awa","note":4,"commentaire":"Très bon","statut":"publie","creeLe":"2026-10-20T12:00:00Z"}]}""",
                HttpStatusCode.OK,
                json,
            )
        }
        val e = KtorClientApi(client(moteur), config).espace("jeton-x")
        assertEquals("/api/v1/client/espace", chemin)
        assertEquals("Bearer jeton-x", entete)
        assertEquals("pizza", e.profil?.avatar)
        assertTrue(e.adresses.single().parDefaut)
        assertEquals("Chez Awa", e.favoris.single().nom)
        assertEquals(4, e.avis.single().note)
    }

    @Test
    fun uneSessionRefuseeEstUnRefusDAcces() = runTest {
        val moteur = MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTHENTIFIE","message":"Connectez-vous avec votre compte."}}""", HttpStatusCode.Unauthorized, json) }
        assertFailsWith<ErreurAcces> { KtorClientApi(client(moteur), config).espace("faux") }
    }

    @Test
    fun lesEcrituresPartentAuBonCheminAvecLeursChamps() = runTest {
        val vus = mutableListOf<Pair<String, String>>()
        val moteur = MockEngine { requete ->
            vus += requete.url.encodedPath to requete.body.toByteArray().decodeToString()
            respond("""{"ok":true,"message":"Fait.","favori":true}""", HttpStatusCode.OK, json)
        }
        val api = KtorClientApi(client(moteur), config)
        assertTrue(api.profil("j", mapOf("pseudo" to "Piment Malin 42", "avatar" to "pizza", "modePrefere" to null, "notificationsCommande" to false)).ok)
        assertTrue(api.adresse("j", "ajouter", mapOf("libelle" to "Maison", "adresse" to "Kaloum, rue KA-012")).ok)
        assertTrue(api.basculerFavori("j", "r1").favori)
        val profil = Json.parseToJsonElement(vus[0].second).jsonObject
        assertEquals("/api/v1/client/profil", vus[0].first)
        assertEquals("pizza", profil["avatar"]!!.jsonPrimitive.content)
        assertEquals("false", profil["notificationsCommande"]!!.jsonPrimitive.content)
        assertTrue(profil.containsKey("modePrefere"), "une préférence vide est envoyée explicitement (null) pour effacer le choix")
        val adresse = Json.parseToJsonElement(vus[1].second).jsonObject
        assertEquals("/api/v1/client/adresses", vus[1].first)
        assertEquals("ajouter", adresse["action"]!!.jsonPrimitive.content)
        assertEquals("/api/v1/client/favoris", vus[2].first)
    }

    @Test
    fun unRefusDuServeurSeLitEnClair() = runTest {
        val moteur = MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Vous avez déjà 5 adresses : supprimez-en une avant d'en ajouter."}}""", HttpStatusCode.BadRequest, json) }
        val r = KtorClientApi(client(moteur), config).adresse("j", "ajouter", mapOf("libelle" to "Autre", "adresse" to "Quelque part loin"))
        assertFalse(r.ok)
        assertTrue(r.message.contains("5 adresses"))
    }
}
