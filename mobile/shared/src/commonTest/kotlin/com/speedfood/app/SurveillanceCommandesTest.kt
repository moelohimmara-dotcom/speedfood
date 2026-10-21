package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorRestaurateurApi
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.SurveillanceCommandes
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SurveillanceCommandesTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private val maintenantIso = "2026-10-21T12:00:00Z"
    private val maintenant = kotlin.time.Instant.parse(maintenantIso).toEpochMilliseconds()

    private fun commande(id: String, etat: String = "en_attente", cree: String = maintenantIso) =
        """{"id":"$id","reference":"SF-$id","statut":"$etat","etatDerive":"$etat","clientNom":"Aminata","clientTelephone":"+224622123456","sousTotal":10000,"creeLe":"$cree","lignes":[]}"""

    private fun reponse(commandes: List<String>, ouvert: Boolean = true, accepte: Boolean = true) =
        """{"ok":true,"restaurant":{"id":"r1","nom":"Chez Awa","ouvert":$ouvert,"accepteCommandes":$accepte},"commandes":[${commandes.joinToString(",")}]}"""

    private fun session(connecte: Boolean = true): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "r@b.test")))
        return SessionService(KtorAuthApi(client(MockEngine { respond("{}", HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
    }

    /** Surveillance dont les réponses sont scriptées tour après tour et dont l'horloge est pilotée. */
    private class Banc(val reponses: MutableList<Pair<HttpStatusCode, String>>, var maintenant: Long)

    private fun banc(connecte: Boolean = true, depart: Long = maintenant, vararg reponses: Pair<HttpStatusCode, String>): Pair<SurveillanceCommandes, Banc> {
        val b = Banc(reponses.toMutableList(), depart)
        val moteur = MockEngine {
            val (statut, corps) = if (b.reponses.size > 1) b.reponses.removeAt(0) else b.reponses[0]
            respond(corps, statut, json)
        }
        return SurveillanceCommandes(session(connecte), KtorRestaurateurApi(client(moteur), config)) { b.maintenant } to b
    }

    private val ok = HttpStatusCode.OK

    @Test
    fun sansSessionLaSurveillanceSArrete() = runTest {
        val (s, _) = banc(connecte = false, reponses = arrayOf(ok to reponse(emptyList())))
        assertEquals(SurveillanceCommandes.Tour.Arret, s.tour())
    }

    @Test
    fun unAccesRefuseArreteMaisUneCoupureReseauNon() = runTest {
        val (refuse, _) = banc(reponses = arrayOf(HttpStatusCode.Forbidden to """{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Ce compte utilise la double authentification."}}"""))
        assertEquals(SurveillanceCommandes.Tour.Arret, refuse.tour(), "accès refusé : inutile de réessayer")
        val (panne, _) = banc(reponses = arrayOf(HttpStatusCode.BadGateway to "oops"))
        assertEquals(SurveillanceCommandes.Tour.Attente, panne.tour(), "réseau ou service indisponible : on réessaie")
        val (limite, _) = banc(reponses = arrayOf(HttpStatusCode.TooManyRequests to """{"ok":false,"erreur":{"code":"TROP_DE_REQUETES","message":"Trop de demandes."}}"""))
        assertEquals(SurveillanceCommandes.Tour.Attente, limite.tour(), "trop de demandes : on patiente, ce n'est pas un refus d'accès")
    }

    @Test
    fun auDemarrageLesCommandesDejaLaNeSonnentPas() = runTest {
        val (s, _) = banc(reponses = arrayOf(ok to reponse(listOf(commande("a")))))
        val tour = s.tour() as SurveillanceCommandes.Tour.Suite
        assertEquals(1, tour.aTraiter.size)
        assertFalse(tour.alerter, "le restaurateur vient d'ouvrir l'application : rien n'est nouveau")
    }

    @Test
    fun uneCommandeDejaAncienneAuDemarrageSonne() = runTest {
        val (s, _) = banc(reponses = arrayOf(ok to reponse(listOf(commande("vieille", cree = "2026-10-21T11:55:00Z")))))
        val tour = s.tour() as SurveillanceCommandes.Tour.Suite
        assertTrue(tour.alerter, "elle attend depuis 5 minutes : service relancé après une coupure, on prévient")
    }

    @Test
    fun uneNouvelleCommandeSonnePuisUnRappelChaqueMinute() = runTest {
        val (s, b) = banc(
            reponses = arrayOf(
                ok to reponse(listOf(commande("a"))),
                ok to reponse(listOf(commande("a"), commande("b"))),
                ok to reponse(listOf(commande("a"), commande("b"))),
                ok to reponse(listOf(commande("a"), commande("b"))),
            ),
        )
        s.tour() // démarrage : a déjà là
        b.maintenant += 10_000
        val nouvelle = s.tour() as SurveillanceCommandes.Tour.Suite
        assertEquals(1, nouvelle.nouvelles, "b est arrivée")
        assertTrue(nouvelle.alerter)
        assertFalse(nouvelle.rappel)

        b.maintenant += 10_000
        assertFalse((s.tour() as SurveillanceCommandes.Tour.Suite).alerter, "10 s après : pas de nouvelle sonnerie")

        b.maintenant += 60_000
        val rappel = s.tour() as SurveillanceCommandes.Tour.Suite
        assertTrue(rappel.rappel, "une minute après la dernière alerte : rappel")
        assertEquals(0, rappel.nouvelles)
    }

    @Test
    fun uneCommandeTraiteeNeSonneJamaisEtLeFermeSansCommandeArrete() = runTest {
        val (s, b) = banc(
            reponses = arrayOf(
                ok to reponse(listOf(commande("a"))),
                ok to reponse(listOf(commande("a", etat = "acceptee"))),
                ok to reponse(listOf(commande("a", etat = "acceptee")), ouvert = false, accepte = false),
            ),
        )
        s.tour()
        b.maintenant += 90_000
        val traitee = s.tour() as SurveillanceCommandes.Tour.Suite
        assertTrue(traitee.aTraiter.isEmpty())
        assertFalse(traitee.alerter, "plus rien à traiter : pas de rappel")
        b.maintenant += 10_000
        assertEquals(SurveillanceCommandes.Tour.Arret, s.tour(), "restaurant fermé et plus rien à traiter : le service s'arrête")
    }

    @Test
    fun leRestaurantFermeAvecUneCommandeAtraiterGardeLaSurveillance() = runTest {
        val (s, _) = banc(reponses = arrayOf(ok to reponse(listOf(commande("a")), ouvert = false, accepte = false)))
        assertTrue(s.tour() is SurveillanceCommandes.Tour.Suite, "une commande attend encore : on continue d'alerter")
    }
}
