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
import kotlin.test.assertFalse
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

    @Test
    fun leTableauDeBordNeContientQueLesBlocsDuRole() = runTest {
        var chemin = ""
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            respond("""{"ok":true,"role":"support","commandes":{"activesDuJour":4,"enAttente":2,"propositionsEnAttente":1},"exploitation":{"aConfirmer":3,"etablissementsSansTelephone":1,"coursesSansLivreur":2,"livreursEnLigne":0,"candidatsLivreurs":1}}""", HttpStatusCode.OK, json)
        }
        val t = KtorEquipeApi(client(moteur), config).tableau("j")
        assertEquals("/api/v1/equipe/tableau", chemin)
        assertEquals(3, t.exploitation?.aConfirmer)
        assertNull(t.catalogue, "un rôle sans la permission ne reçoit pas le bloc catalogue")
        // 3 à confirmer + 2 courses sans livreur + 1 sans numéro + 1 candidat + 1 proposition = 8 points.
        assertEquals(8, com.speedfood.app.data.alertesEquipe(t))
        assertEquals(0, com.speedfood.app.data.alertesEquipe(com.speedfood.app.data.TableauEquipe()))
    }

    @Test
    fun lesMenusSeLisentEtSeReconfirmentAvecLeBonCorps() = runTest {
        val vus = mutableListOf<Pair<String, String>>()
        val moteur = MockEngine { requete ->
            vus += requete.url.encodedPath to requete.body.toByteArray().decodeToString()
            when {
                requete.url.encodedPath.endsWith("/menus") -> respond("""{"ok":true,"fraicheurHeures":6,"menus":[{"restaurantId":"r1","nom":"Chez Awa","plats":3,"aReconfirmer":3,"epuises":0,"derniereConfirmation":null}]}""", HttpStatusCode.OK, json)
                requete.url.encodedPath.contains("/menus/r1") -> respond("""{"ok":true,"nom":"Chez Awa","plats":[{"id":"p1","nom":"Poulet braisé","prix":40000,"disponible":true,"confirmeLe":null,"etat":"a_confirmer"}]}""", HttpStatusCode.OK, json)
                else -> respond("""{"ok":true,"message":"3 plats reconfirmés."}""", HttpStatusCode.OK, json)
            }
        }
        val api = KtorEquipeApi(client(moteur), config)
        val (menus, heures) = api.menus("j")
        assertEquals(6, heures)
        assertEquals(3, menus.single().aReconfirmer)
        assertNull(menus.single().derniereConfirmation)
        assertEquals("a_confirmer", api.menu("j", "r1").plats.single().etat)
        assertTrue(api.reconfirmer("j", "r1", null).ok)
        assertTrue(api.reconfirmer("j", "r1", "p1").ok)
        assertTrue(api.definirDisponibilite("j", "r1", "p1", false).ok)
        val toutMenu = Json.parseToJsonElement(vus.first { it.first.endsWith("/menus/confirmer") }.second).jsonObject
        assertEquals("r1", toutMenu["restaurantId"]!!.jsonPrimitive.content)
        assertFalse(toutMenu.containsKey("platId"), "sans platId : tout le menu")
        val unPlat = Json.parseToJsonElement(vus.filter { it.first.endsWith("/menus/confirmer") }[1].second).jsonObject
        assertEquals("p1", unPlat["platId"]!!.jsonPrimitive.content)
        val dispo = Json.parseToJsonElement(vus.first { it.first.endsWith("/menus/disponibilite") }.second).jsonObject
        assertEquals("false", dispo["disponible"]!!.jsonPrimitive.content)
    }

    @Test
    fun unPlatARepconfirmerCompteDansLesAlertesDuTableau() {
        val t = com.speedfood.app.data.TableauEquipe(catalogue = com.speedfood.app.data.BlocCatalogue(platsAReconfirmer = 5))
        assertEquals(1, com.speedfood.app.data.alertesEquipe(t))
        assertEquals(0, com.speedfood.app.data.alertesEquipe(com.speedfood.app.data.TableauEquipe(catalogue = com.speedfood.app.data.BlocCatalogue(publies = 3))))
    }
}
