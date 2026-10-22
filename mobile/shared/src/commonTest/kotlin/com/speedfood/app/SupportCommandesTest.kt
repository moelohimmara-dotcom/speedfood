package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorEquipeApi
import com.speedfood.app.data.STATUTS_RECHERCHE
import com.speedfood.app.data.libelleStatutCommande
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SupportCommandesTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private val commande = """{"id":"c1","reference":"SF-1","restaurantNom":"Chez Aïssatou","restaurantId":"r1","statut":"acceptee","mode":"livraison","clientNom":"Mamadou","telephoneAffiche":"+224 6** ** ** 78","adresseAffichee":"Kaloum, ***","sousTotal":40000,"fraisLivraisonEstime":5000,"creeLe":"2026-10-22T10:00:00Z","historique":[{"statutPrecedent":"en_attente","statutSuivant":"acceptee","acteur":"equipe:u1","horodatage":"2026-10-22T10:05:00Z"}],"propositions":[]}"""

    @Test
    fun laRechercheEnvoieLesFiltresEtLitLesCommandesMasquees() = runTest {
        var url = ""
        val moteur = MockEngine { requete ->
            url = requete.url.toString()
            respond("""{"ok":true,"commandes":[$commande]}""", HttpStatusCode.OK, json)
        }
        val liste = KtorEquipeApi(client(moteur), config).commandes("j", " SF-1 ", "acceptee", true)
        assertTrue(url.contains("/api/v1/equipe/commandes"))
        assertTrue(url.contains("statut=acceptee"))
        assertTrue(url.contains("reference=SF-1"))
        assertTrue(url.contains("jour=1"))
        assertEquals("+224 6** ** ** 78", liste.single().telephoneAffiche)
        assertEquals(45000, liste.single().total)
    }

    @Test
    fun leDetailPorteLesTransitionsEtLeDroitDeReveler() = runTest {
        val moteur = MockEngine { respond("""{"ok":true,"commande":$commande,"transitions":["prete","annulee"],"peutReveler":true}""", HttpStatusCode.OK, json) }
        val detail = KtorEquipeApi(client(moteur), config).commande("j", "c1")
        assertEquals(listOf("prete", "annulee"), detail.transitions)
        assertTrue(detail.peutReveler)
        assertEquals("equipe:u1", detail.commande.historique.single().acteur)
    }

    @Test
    fun leChangementDeStatutEnvoieLeMotif() = runTest {
        var chemin = ""
        var corps = ""
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            corps = requete.body.toByteArray().decodeToString()
            respond("""{"ok":true}""", HttpStatusCode.OK, json)
        }
        assertNull(KtorEquipeApi(client(moteur), config).changerStatut("j", "c1", "annulee", "Client injoignable"))
        assertEquals("/api/v1/equipe/commandes/c1/statut", chemin)
        val objet = Json.parseToJsonElement(corps).jsonObject
        assertEquals("annulee", objet["vers"]!!.jsonPrimitive.content)
        assertEquals("Client injoignable", objet["motif"]!!.jsonPrimitive.content)
    }

    @Test
    fun laRevelationRendLesCoordonneesEtUnRefusSeLitEnClair() = runTest {
        val ok = MockEngine { respond("""{"ok":true,"coordonnees":{"telephone":"+224620000078","adresse":"Kaloum, rue 12","devoilees":true}}""", HttpStatusCode.OK, json) }
        val c = KtorEquipeApi(client(ok), config).reveler("j", "c1", "Livreur introuvable")
        assertEquals("+224620000078", c.telephone)
        assertTrue(c.devoilees)
        val refus = MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) }
        assertFailsWith<ErreurAcces> { KtorEquipeApi(client(refus), config).reveler("j", "c1", "x") }
    }

    @Test
    fun lesStatutsSeLisentCommeSurLeSite() {
        assertEquals("En attente", libelleStatutCommande("en_attente"))
        assertEquals("Prête", libelleStatutCommande("prete"))
        assertEquals("inconnu", libelleStatutCommande("inconnu"))
        assertEquals("tous", STATUTS_RECHERCHE.first())
    }
}
