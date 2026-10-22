package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorEquipeApi
import com.speedfood.app.data.actionsEquipe
import com.speedfood.app.data.numeroAppel
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

class EquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun lesActionsSuiventLeStatutCommeSurLeSite() {
        assertEquals(listOf("accepter", "refuser", "annuler"), actionsEquipe("en_attente").map { it.code })
        assertEquals(listOf("prete", "annuler"), actionsEquipe("acceptee").map { it.code })
        assertEquals(listOf("terminee"), actionsEquipe("prete").map { it.code })
        assertTrue(actionsEquipe("terminee").isEmpty())
        assertTrue(actionsEquipe("inconnu").isEmpty())
        // Refuser et annuler préviennent le client : elles demandent une confirmation de plus.
        assertTrue(actionsEquipe("en_attente").filter { it.destructive }.map { it.code }.containsAll(listOf("refuser", "annuler")))
    }

    @Test
    fun leNumeroAppelableNeGardeQueLesChiffresEtLePlus() {
        assertEquals("+224620000000", numeroAppel("+224 620 00 00 00"))
        assertNull(numeroAppel(null))
        assertNull(numeroAppel("12"))
    }

    @Test
    fun leMenuEtLeRoleSeLisentDepuisLeServeur() = runTest {
        var chemin = ""
        var entete: String? = null
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            entete = requete.headers[HttpHeaders.Authorization]
            respond(
                """{"ok":true,"role":"support","permissions":["commande.support"],"groupes":[{"libelle":"Commandes","entrees":[{"chemin":"/system/repartition","libelle":"Répartition","natif":true},{"chemin":"/system/paiements","libelle":"Paiements","natif":false}]}]}""",
                HttpStatusCode.OK,
                json,
            )
        }
        val acces = KtorEquipeApi(client(moteur), config).moi("jeton-x")
        assertEquals("/api/v1/equipe/moi", chemin)
        assertEquals("Bearer jeton-x", entete)
        assertEquals("support", acces.role)
        assertEquals(listOf(true, false), acces.groupes.single().entrees.map { it.natif })
    }

    @Test
    fun unCompteHorsEquipeEstUnRefusDAcces() = runTest {
        val moteur = MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) }
        val erreur = assertFailsWith<ErreurAcces> { KtorEquipeApi(client(moteur), config).moi("j") }
        assertEquals("Cet espace est réservé à l'équipe Speedfood.", erreur.message)
        assertFailsWith<ErreurAcces> { KtorEquipeApi(client(moteur), config).repartition("j") }
    }

    @Test
    fun laRepartitionEtLActionParlentAuBonChemin() = runTest {
        val vus = mutableListOf<Pair<String, String>>()
        val moteur = MockEngine { requete ->
            vus += requete.url.encodedPath to requete.body.toByteArray().decodeToString()
            if (requete.url.encodedPath.endsWith("/action")) respond("""{"ok":true,"statut":"acceptee"}""", HttpStatusCode.OK, json)
            else respond(
                """{"ok":true,"commandes":[{"id":"c1","reference":"SF-1","statut":"en_attente","mode":"livraison","sousTotal":40000,"fraisLivraison":5000,"creeLe":"2026-10-22T10:00:00Z","estTest":false,"restaurantId":"r1","restaurantNom":"Chez Aïssatou","telephoneRestaurant":"+224620000000","lignes":[{"nom":"Poulet braisé","quantite":2}]}]}""",
                HttpStatusCode.OK,
                json,
            )
        }
        val api = KtorEquipeApi(client(moteur), config)
        val commandes = api.repartition("j")
        assertEquals(45000, commandes.single().total)
        assertNull(api.agir("j", "c1", "accepter"))
        val action = vus.single { it.first.endsWith("/repartition/action") }
        val corps = Json.parseToJsonElement(action.second).jsonObject
        assertEquals("c1", corps["commandeId"]!!.jsonPrimitive.content)
        assertEquals("accepter", corps["action"]!!.jsonPrimitive.content)
    }

    @Test
    fun unRefusDuServeurSurUneActionSeLitEnClair() = runTest {
        val moteur = MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Cette commande a déjà changé d'état. Actualisez."}}""", HttpStatusCode.BadRequest, json) }
        assertEquals("Cette commande a déjà changé d'état. Actualisez.", KtorEquipeApi(client(moteur), config).agir("j", "c1", "prete"))
    }
}
