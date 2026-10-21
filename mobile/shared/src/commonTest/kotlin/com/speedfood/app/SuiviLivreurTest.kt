package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorLivreurApi
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.SuiviLivreur
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

class SuiviLivreurTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private fun etatJson(statut: String, cycle: String = "actif", offre: String = "null") =
        """{"ok":true,"etat":{"livreur":{"id":"l1","nom":"M","statut":"$statut","cycle":"$cycle"},"offre":$offre,"course":null,"positionConnue":true}}"""

    private fun session(connecte: Boolean = true): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "m@b.test")))
        return SessionService(KtorAuthApi(client(MockEngine { respond("{}", HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
    }

    private class Scenario(val moteur: MockEngine, val positions: MutableList<String>)

    private fun scenario(etat: String, reseauCoupe: Boolean = false): Scenario {
        val positions = mutableListOf<String>()
        val moteur = MockEngine { r ->
            if (reseauCoupe) throw RuntimeException("réseau coupé")
            if (r.url.encodedPath.endsWith("/position")) {
                positions += r.body.toByteArray().decodeToString()
                respond("""{"ok":true}""", HttpStatusCode.OK, json)
            } else {
                respond(etat, HttpStatusCode.OK, json)
            }
        }
        return Scenario(moteur, positions)
    }

    @Test
    fun sansSessionLeSuiviSArrete() = runTest {
        val s = scenario(etatJson("disponible"))
        val suivi = SuiviLivreur(session(connecte = false), KtorLivreurApi(client(s.moteur), config))
        assertEquals(SuiviLivreur.Tour.Arret, suivi.tour())
    }

    @Test
    fun horsLigneOuFicheInactiveOuPasLivreurArretentLeSuivi() = runTest {
        for (etat in listOf(etatJson("hors_ligne"), etatJson("disponible", cycle = "suspendu"), """{"ok":true,"etat":null}""")) {
            val s = scenario(etat)
            assertEquals(SuiviLivreur.Tour.Arret, SuiviLivreur(session(), KtorLivreurApi(client(s.moteur), config)).tour(), etat)
            assertTrue(s.positions.isEmpty(), "aucune position n'est envoyée quand il n'y a rien à suivre")
        }
    }

    @Test
    fun uneCoupureReseauNArretePasLeSuivi() = runTest {
        val s = scenario("", reseauCoupe = true)
        assertEquals(SuiviLivreur.Tour.Attente, SuiviLivreur(session(), KtorLivreurApi(client(s.moteur), config)).tour())
    }

    @Test
    fun laPositionPartToutesLes8SecondesAuPlus() = runTest {
        var maintenant = 1_000_000L
        val s = scenario(etatJson("disponible"))
        val suivi = SuiviLivreur(session(), KtorLivreurApi(client(s.moteur), config)) { maintenant }

        assertTrue(suivi.tour() is SuiviLivreur.Tour.Suite)
        assertTrue(s.positions.isEmpty(), "pas encore de mesure : rien à envoyer")

        suivi.positionMesuree(9.5412, -13.6773)
        suivi.tour()
        assertEquals(1, s.positions.size)
        assertEquals("9.5412", Json.parseToJsonElement(s.positions[0]).jsonObject["latitude"]!!.jsonPrimitive.content)

        maintenant += 5_000
        suivi.tour()
        assertEquals(1, s.positions.size, "5 s plus tard : trop tôt")

        maintenant += 3_000
        suivi.positionMesuree(9.55, -13.68)
        suivi.tour()
        assertEquals(2, s.positions.size, "8 s après le premier envoi : la nouvelle position part")
        assertEquals("9.55", Json.parseToJsonElement(s.positions[1]).jsonObject["latitude"]!!.jsonPrimitive.content)
    }

    @Test
    fun uneOffreEnAttenteRemonteDansLeTour() = runTest {
        val s = scenario(etatJson("disponible", offre = """{"offreId":"o1","expireLe":"2099-01-01T00:00:00Z","restaurantNom":"Chez Awa","fraisGnf":9500}"""))
        val tour = SuiviLivreur(session(), KtorLivreurApi(client(s.moteur), config)).tour()
        assertTrue(tour is SuiviLivreur.Tour.Suite)
        assertEquals("o1", tour.etat.offre?.offreId, "le service s'en sert pour notifier la nouvelle course")
    }
}
