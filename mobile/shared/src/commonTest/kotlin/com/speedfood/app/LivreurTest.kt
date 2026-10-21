package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.FicheLivreur
import com.speedfood.app.data.KtorLivreurApi
import com.speedfood.app.data.OffreLivreur
import com.speedfood.app.data.etapeSuivante
import com.speedfood.app.data.peutDeclarerEchec
import com.speedfood.app.ui.doitSuivreLaPosition
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LivreurTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun laChaineDEtapesDuGroupeSpeedfood() {
        assertEquals("vers_restaurant", etapeSuivante("assignee", "speedfood")?.vers)
        assertEquals("recuperee", etapeSuivante("vers_restaurant", "speedfood")?.vers)
        assertEquals("vers_client", etapeSuivante("recuperee", "speedfood")?.vers)
        val remise = etapeSuivante("vers_client", "speedfood")!!
        assertEquals("livree", remise.vers)
        assertTrue(remise.demandeCode, "la remise exige le code du client")
        assertNull(etapeSuivante("livree", "speedfood"))
        assertNull(etapeSuivante("echec", "speedfood"))
    }

    @Test
    fun leLivreurDuRestaurantPartDirectementChezLeClient() {
        assertEquals("vers_client", etapeSuivante("assignee", "propre")?.vers)
        assertTrue(etapeSuivante("vers_client", "propre")!!.demandeCode)
    }

    @Test
    fun echecSeulementUneFoisLaCommandeEnMain() {
        assertTrue(!peutDeclarerEchec("assignee"))
        assertTrue(!peutDeclarerEchec("vers_restaurant"))
        assertTrue(peutDeclarerEchec("recuperee"))
        assertTrue(peutDeclarerEchec("vers_client"))
        assertTrue(!peutDeclarerEchec("livree"))
    }

    @Test
    fun decompteDeLOffre() {
        val offre = OffreLivreur("o1", "2026-10-21T10:00:30Z", "Chez Awa", 2.4, 9_500, 0.8)
        val dixHeures = kotlin.time.Instant.parse("2026-10-21T10:00:00Z").toEpochMilliseconds()
        assertEquals(30, offre.secondesRestantes(dixHeures))
        assertEquals(10, offre.secondesRestantes(dixHeures + 20_000))
        assertEquals(0, offre.secondesRestantes(dixHeures + 60_000), "expirée")
        assertEquals(0, OffreLivreur("o", "pas une date").secondesRestantes(dixHeures), "date illisible : jamais acceptable")
    }

    @Test
    fun laPositionSeSuitSeulementEnLigneOuEnCourse() {
        fun etat(cycle: String, statut: String) = EtatLivreur(FicheLivreur(id = "l", nom = "Mamadou", statut = statut, cycle = cycle))
        assertTrue(doitSuivreLaPosition(etat("actif", "disponible")))
        assertTrue(doitSuivreLaPosition(etat("actif", "en_course")))
        assertTrue(!doitSuivreLaPosition(etat("actif", "hors_ligne")))
        assertTrue(!doitSuivreLaPosition(etat("candidat", "disponible")), "une fiche non active ne travaille pas")
    }

    @Test
    fun lEtatDuLivreurSeLitDepuisLeServeur() = runTest {
        var autorisation: String? = null
        val api = KtorLivreurApi(
            client(MockEngine { r ->
                autorisation = r.headers[HttpHeaders.Authorization]
                respond(
                    """{"ok":true,"etat":{
                        "livreur":{"id":"l1","nom":"Mamadou Barry","statut":"en_course","vehicule":"Moto","cycle":"actif","motifCycle":null,"restaurantNom":null},
                        "offre":null,
                        "course":{"livraisonId":"c1","statut":"recuperee","mode":"speedfood","libelle":"Commande récupérée","commandeReference":"SF-9","commandeStatut":"prete",
                                  "restaurantNom":"Chez Awa","restaurantPoint":{"latitude":9.54,"longitude":-13.67},"arriveePoint":null,"fraisGnf":9500,
                                  "client":{"nom":"Aminata","telephone":"+224622123456","adresse":"Rue KA-012"}},
                        "aNoter":null,"positionConnue":true}}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val etat = api.etat("acces")!!
        assertEquals("Bearer acces", autorisation)
        assertEquals("en_course", etat.livreur.statut)
        assertEquals("SF-9", etat.course?.commandeReference)
        assertEquals("Rue KA-012", etat.course?.client?.adresse)
        assertEquals("vers_client", etapeSuivante(etat.course!!.statut, etat.course.mode)?.vers)
    }

    @Test
    fun uneAdresseDeClientAbsenteAvantLaRecuperation() = runTest {
        val api = KtorLivreurApi(
            client(MockEngine {
                respond(
                    """{"ok":true,"etat":{"livreur":{"id":"l1","nom":"M","statut":"en_course","cycle":"actif"},
                        "course":{"livraisonId":"c1","statut":"assignee","commandeReference":"SF-9","restaurantNom":"R","fraisGnf":8000,"client":null}}}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        assertNull(api.etat("t")!!.course?.client, "le serveur ne donne pas les coordonnées du client avant la récupération")
    }

    @Test
    fun uneAdresseQuiNEstPasUnCompteLivreurRendNull() = runTest {
        val api = KtorLivreurApi(client(MockEngine { respond("""{"ok":true,"etat":null}""", HttpStatusCode.OK, json) }), config)
        assertNull(api.etat("t"))
    }

    @Test
    fun lesActionsEnvoientLeBonCorpsEtRendentLeRefusDuServeur() = runTest {
        val vus = mutableListOf<Pair<String, String>>()
        val api = KtorLivreurApi(
            client(MockEngine { r ->
                assertEquals(HttpMethod.Post, r.method)
                vus += r.url.encodedPath to r.body.toByteArray().decodeToString()
                if (r.url.encodedPath.endsWith("/course")) {
                    respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"La commande n'est pas encore prête : attendez que le restaurant la déclare prête."}}""", HttpStatusCode.BadRequest, json)
                } else {
                    respond("""{"ok":true}""", HttpStatusCode.OK, json)
                }
            }),
            config,
        )
        assertNull(api.enLigne("t", true))
        assertNull(api.position("t", 9.5412, -13.6773))
        assertNull(api.repondreOffre("t", "offre-1", true))
        assertNull(api.repondreOffre("t", "offre-1", false))
        val refus = api.avancer("t", "recuperee")
        assertNotNull(refus)
        assertTrue(refus.contains("pas encore prête"))

        fun corps(fin: String, n: Int = 0) = Json.parseToJsonElement(vus.filter { it.first.endsWith(fin) }[n].second).jsonObject
        assertEquals("true", corps("/en-ligne")["enLigne"]!!.jsonPrimitive.content)
        assertEquals("9.5412", corps("/position")["latitude"]!!.jsonPrimitive.content)
        assertEquals("acceptee", corps("/offre", 0)["reponse"]!!.jsonPrimitive.content)
        assertEquals("refusee", corps("/offre", 1)["reponse"]!!.jsonPrimitive.content)
        assertEquals("recuperee", corps("/course")["vers"]!!.jsonPrimitive.content)
        assertTrue(!corps("/course").containsKey("code"), "pas de code hors remise")
        assertTrue(vus.all { it.first.startsWith("/api/v1/livreur/") })
    }
}
