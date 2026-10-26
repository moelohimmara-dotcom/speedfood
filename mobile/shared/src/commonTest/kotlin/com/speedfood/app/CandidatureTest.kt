package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.BrouillonCandidature
import com.speedfood.app.data.BrouillonCandidatureStockage
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorCandidatureApi
import com.speedfood.app.data.PhotoChoisie
import com.speedfood.app.data.PlatCandidature
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.ajouterPlatCandidature
import com.speedfood.app.data.corpsCandidature
import com.speedfood.app.data.erreurEtapeCandidature
import com.speedfood.app.data.lirePrixPlat
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
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class CandidatureTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private val complet = BrouillonCandidature(
        nom = "Chez Awa", quartierId = "q1", quartierNom = "Kipé", telephone = "622 12 34 56", prenom = "Awa", nomResponsable = "Camara",
        horaires = "Tous les jours, 9h à 22h", moyensPaiement = listOf("especes"), services = listOf("livraison"), plats = listOf(PlatCandidature("Riz", 25000)),
    )

    @Test
    fun chaqueEtapeDitCeQuiManque() {
        assertTrue(erreurEtapeCandidature(0, BrouillonCandidature())!!.contains("nom de votre restaurant"))
        assertTrue(erreurEtapeCandidature(0, complet.copy(quartierId = ""))!!.contains("quartier"))
        assertTrue(erreurEtapeCandidature(0, complet.copy(prenom = ""))!!.contains("prénom"))
        assertTrue(erreurEtapeCandidature(0, complet.copy(telephone = "123"))!!.contains("invalide"))
        assertNull(erreurEtapeCandidature(0, complet))
        assertTrue(erreurEtapeCandidature(1, complet.copy(horaires = ""))!!.contains("horaires"))
        assertTrue(erreurEtapeCandidature(1, complet.copy(services = emptyList()))!!.contains("service"))
        assertNull(erreurEtapeCandidature(1, complet))
        assertNull(erreurEtapeCandidature(2, BrouillonCandidature()), "images facultatives")
        assertNull(erreurEtapeCandidature(3, BrouillonCandidature()), "menu facultatif : l'équipe le saisit avec le restaurateur")
    }

    @Test
    fun lesPrixSontDesEntiersEnGnf() {
        assertEquals(25000, lirePrixPlat("25 000"))
        assertEquals(25000, lirePrixPlat("25000"))
        assertNull(lirePrixPlat("25.5"))
        assertNull(lirePrixPlat("25,5"))
        assertNull(lirePrixPlat("abc"))
        assertNull(lirePrixPlat(""))
        assertNull(lirePrixPlat("50"), "trop bas")
        assertNull(lirePrixPlat("25000000"), "trop haut : zéros en trop")
        val (b, e) = ajouterPlatCandidature(BrouillonCandidature(), "Poulet braisé", "40 000")
        assertEquals(listOf(PlatCandidature("Poulet braisé", 40000)), b!!.plats)
        assertNull(e)
        assertNotNull(ajouterPlatCandidature(BrouillonCandidature(), "P", "40000").second)
        assertNotNull(ajouterPlatCandidature(BrouillonCandidature(), "Poulet", "x").second)
    }

    @Test
    fun leCorpsNEnvoiePasLEmailNiLaCommune() {
        val c = corpsCandidature(complet)
        assertEquals("Chez Awa", c["nom"]!!.jsonPrimitive.content)
        assertEquals("q1", c["quartierId"]!!.jsonPrimitive.content)
        assertEquals("+224622123456", c["telephone"]!!.jsonPrimitive.content, "téléphone normalisé")
        assertEquals("Awa", c["responsable"]!!.jsonObject["prenom"]!!.jsonPrimitive.content)
        assertTrue("email" !in c && "commune" !in c && "quartier" !in c)
        assertEquals(25000, c["plats"]!!.jsonArray[0].jsonObject["prix"]!!.jsonPrimitive.content.toInt())
    }

    @Test
    fun leBrouillonSeGardeSurLeTelephone() {
        val stockage = StockageMemoire()
        val s = BrouillonCandidatureStockage(stockage)
        assertEquals(BrouillonCandidature(), s.lire())
        s.ecrire(complet.copy(etape = 2))
        assertEquals(complet.copy(etape = 2), BrouillonCandidatureStockage(stockage).lire(), "après une réouverture")
        s.effacer()
        assertEquals(BrouillonCandidature(), s.lire())
        stockage.ecrire("candidature_brouillon", "pas du json")
        assertEquals(BrouillonCandidature(), s.lire(), "un brouillon illisible ne bloque pas le formulaire")
    }

    @Test
    fun lApiLitDeposeEtEnvoieLesImages() = runTest {
        var methode = ""
        var chemin = ""
        var autorisation: String? = null
        var corps = ""
        val api = KtorCandidatureApi(client(MockEngine { r ->
            methode = r.method.value; chemin = r.url.encodedPath; autorisation = r.headers[HttpHeaders.Authorization]; corps = r.body.toByteArray().decodeToString()
            when {
                r.url.encodedPath.endsWith("/candidature") && r.method.value == "GET" -> respond("""{"ok":true,"candidature":null}""", HttpStatusCode.OK, json)
                else -> respond("""{"ok":true,"candidature":{"id":"c1","etat":"recue","libelleEtat":"Demande reçue","nom":"Chez Awa","nombrePlats":1,"aLogo":true}}""", HttpStatusCode.OK, json)
            }
        }), config)
        assertNull(api.lire("tok"))
        assertEquals("Bearer tok", autorisation)
        val v = api.deposer("tok", complet)
        assertEquals("POST", methode)
        assertTrue(chemin.endsWith("/api/v1/candidature"))
        assertTrue(corps.contains("\"quartierId\":\"q1\""))
        assertEquals("recue", v.etat)
        val avecImage = api.envoyerImage("tok", "logo", PhotoChoisie(byteArrayOf(1, 2, 3)))
        assertTrue(chemin.endsWith("/api/v1/candidature/image"))
        assertTrue(avecImage.aLogo)
    }

    @Test
    fun lesRefusDuServeurSontLisibles() = runTest {
        val refus = KtorCandidatureApi(client(MockEngine { respond("""{"ok":false,"erreur":{"code":"CONFLIT_ETAT","message":"Vous avez déjà une demande en cours."}}""", HttpStatusCode.Conflict, json) }), config)
        val e = runCatching { refus.deposer("tok", complet) }.exceptionOrNull()
        assertEquals("Vous avez déjà une demande en cours.", e?.message)
        assertFalse(e is ErreurAcces)
        val nonConnecte = KtorCandidatureApi(client(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTHENTIFIE","message":"Connectez-vous."}}""", HttpStatusCode.Unauthorized, json) }), config)
        assertTrue(runCatching { nonConnecte.lire("tok") }.exceptionOrNull() is ErreurAcces)
    }
}
