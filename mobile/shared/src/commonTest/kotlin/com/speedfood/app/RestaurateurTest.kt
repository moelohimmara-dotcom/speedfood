package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.CommandeRestaurateur
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.KtorRestaurateurApi
import com.speedfood.app.data.actionsPossibles
import com.speedfood.app.data.classerCommandes
import com.speedfood.app.data.peutProposer
import com.speedfood.app.ui.verifierProposition
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RestaurateurTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private fun commande(id: String, etat: String, cree: String, statut: String = if (etat == "attente_confirmation_client") "en_attente" else etat) =
        CommandeRestaurateur(id, "SF-$id", statut, etat, creeLe = cree, sousTotal = 10_000, fraisLivraisonEstime = 2_000)

    @Test
    fun lesCommandesSontRangeesParUrgence() {
        val c = classerCommandes(
            listOf(
                commande("recente", "en_attente", "2026-10-21T11:59:00Z"),
                commande("ancienne", "en_attente", "2026-10-21T11:30:00Z"),
                commande("proposee", "attente_confirmation_client", "2026-10-21T11:00:00Z"),
                commande("prep", "acceptee", "2026-10-21T10:00:00Z"),
                commande("prete", "prete", "2026-10-21T10:30:00Z"),
                commande("finie", "terminee", "2026-10-20T10:30:00Z"),
                commande("refusee", "refusee", "2026-10-21T09:00:00Z"),
            ),
        )
        assertEquals(listOf("ancienne", "recente"), c.aTraiter.map { it.id }, "la plus ancienne d'abord : c'est celle qui attend depuis le plus longtemps")
        assertEquals(listOf("prete", "prep", "proposee").sorted(), c.enCours.map { it.id }.sorted())
        assertEquals(listOf("proposee", "prete", "prep"), c.enCours.map { it.id }, "en cours : les plus récentes d'abord")
        assertEquals(listOf("refusee", "finie"), c.historique.map { it.id })
    }

    @Test
    fun lesActionsSuiventLaMachineAEtats() {
        fun codes(etat: String) = actionsPossibles(commande("x", etat, "2026-10-21T11:00:00Z")).map { it.code }
        assertEquals(listOf("accepter", "refuser"), codes("en_attente"))
        assertEquals(listOf("prete", "annuler"), codes("acceptee"))
        assertEquals(listOf("terminee", "annuler"), codes("prete"))
        assertEquals(listOf("annuler"), codes("attente_confirmation_client"), "pendant une proposition au client, seule l'annulation reste possible")
        assertTrue(codes("terminee").isEmpty())
        assertTrue(codes("refusee").isEmpty())
        assertTrue(actionsPossibles(commande("x", "en_attente", "")).first { it.code == "refuser" }.destructive, "refuser demande confirmation")
        assertTrue(!actionsPossibles(commande("x", "en_attente", "")).first { it.code == "accepter" }.destructive)
        assertTrue(peutProposer(commande("x", "en_attente", "")))
        assertTrue(!peutProposer(commande("x", "acceptee", "")))
        assertTrue(!peutProposer(commande("x", "attente_confirmation_client", "")), "une proposition est déjà en cours")
    }

    @Test
    fun laPropositionExigeDesMontantsEntiersEtUnChangement() {
        assertNotNull(verifierProposition("", "0", "", 10_000, 2_000))
        assertNotNull(verifierProposition("abc", "0", "", 10_000, 2_000))
        assertNotNull(verifierProposition("9000", "-5", "", 10_000, 2_000))
        assertNotNull(verifierProposition("10000", "2000", "", 10_000, 2_000), "rien n'a changé")
        assertNotNull(verifierProposition("9000", "2000", "x".repeat(501), 10_000, 2_000))
        assertNull(verifierProposition("9000", "2000", "", 10_000, 2_000), "un montant différent suffit")
        assertNull(verifierProposition("10000", "2000", "Plat remplacé", 10_000, 2_000), "une condition suffit")
        assertNull(verifierProposition(" 9000 ", " 0 ", "", 10_000, 2_000))
    }

    @Test
    fun lEtatDuRestaurantSeLitDepuisLeServeur() = runTest {
        var autorisation: String? = null
        val api = KtorRestaurateurApi(
            client(MockEngine { r ->
                autorisation = r.headers[HttpHeaders.Authorization]
                respond(
                    """{"ok":true,"restaurant":{"id":"r1","nom":"Chez Awa","ouvert":true,"accepteCommandes":false},
                        "commandes":[{"id":"c1","reference":"SF-1","statut":"en_attente","etatDerive":"en_attente","mode":"livraison","clientNom":"Aminata","clientTelephone":"+224622123456",
                        "clientAdresse":"Rue KA-012","sousTotal":60000,"fraisLivraisonEstime":9500,"creeLe":"2026-10-21T11:56:00Z","estTest":false,
                        "lignes":[{"nom":"Poulet","prix":30000,"quantite":2,"options":[{"nom":"Piment","prix":500}]}],"propositionActive":null,"propositions":[],"paiementStatut":"non_declare"}]}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val etat = api.etat("acces")
        assertEquals("Bearer acces", autorisation)
        assertEquals("Chez Awa", etat.restaurant?.nom)
        assertEquals(false, etat.restaurant?.accepteCommandes)
        val c = etat.commandes.single()
        assertEquals(69_500, c.total)
        assertEquals("Rue KA-012", c.clientAdresse)
        assertEquals("Piment", c.lignes.single().options.single().nom)
    }

    @Test
    fun unAccesRefuseRemonteLeMessageDuServeur() = runTest {
        val api = KtorRestaurateurApi(
            client(MockEngine {
                respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Ce compte utilise la double authentification : utilisez la console restaurateur sur le site pour l'instant."}}""", HttpStatusCode.Forbidden, json)
            }),
            config,
        )
        val e = assertFailsWith<ErreurReseau> { api.etat("t") }
        assertTrue(e.message!!.contains("double authentification"))
    }

    @Test
    fun lesActionsEnvoientLeBonCorpsEtRendentLeRefus() = runTest {
        val vus = mutableListOf<Pair<String, String>>()
        val api = KtorRestaurateurApi(
            client(MockEngine { r ->
                vus += r.url.encodedPath to r.body.toByteArray().decodeToString()
                if (r.url.encodedPath.endsWith("/action")) {
                    respond("""{"ok":false,"erreur":{"code":"CONFLIT_ETAT","message":"Une proposition de modification attend la réponse du client."}}""", HttpStatusCode.Conflict, json)
                } else {
                    respond("""{"ok":true}""", HttpStatusCode.OK, json)
                }
            }),
            config,
        )
        val refus = api.agir("t", "c1", "accepter")
        assertNotNull(refus)
        assertTrue(refus.contains("proposition"))
        assertNull(api.proposer("t", "c1", 40_000, 0, "Plat remplacé"))
        assertNull(api.proposer("t", "c1", 40_000, 0, "  "))
        assertNull(api.definirStatut("t", "ouvert", false))

        fun corps(fin: String, n: Int = 0) = Json.parseToJsonElement(vus.filter { it.first.endsWith(fin) }[n].second).jsonObject
        assertEquals("accepter", corps("/action")["action"]!!.jsonPrimitive.content)
        assertEquals("c1", corps("/action")["commandeId"]!!.jsonPrimitive.content)
        assertEquals("40000", corps("/proposition", 0)["nouveauSousTotal"]!!.jsonPrimitive.content)
        assertEquals("Plat remplacé", corps("/proposition", 0)["conditionsModifiees"]!!.jsonPrimitive.content)
        assertTrue(!corps("/proposition", 1).containsKey("conditionsModifiees"), "une explication vide n'est pas envoyée")
        assertEquals("ouvert", corps("/statut")["champ"]!!.jsonPrimitive.content)
        assertEquals("false", corps("/statut")["valeur"]!!.jsonPrimitive.content)
        assertTrue(vus.all { it.first.startsWith("/api/v1/restaurant/") })
    }
}
