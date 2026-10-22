package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AppareilApi
import com.speedfood.app.data.AvisAcces
import com.speedfood.app.data.BilanEssai
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.DeconnexionService
import com.speedfood.app.data.EnregistrementPush
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.JetonPushIndisponible
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.MoiApi
import com.speedfood.app.data.ReactionAcces
import com.speedfood.app.data.RoleRestaurateur
import com.speedfood.app.data.RolesCompte
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Phase A de la feuille de route : un refus d'accès n'est jamais une coupure du réseau ; se déconnecter ne fait jamais perdre une commande en cours. */
@OptIn(ExperimentalCoroutinesApi::class)
class AccesSessionTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private class FausseApi(var roles: RolesCompte?) : MoiApi {
        override suspend fun roles(jetonAcces: String) = roles
    }

    /** Portée d'un test : annulée à la fin (la relecture périodique des droits ne s'arrête sinon jamais). */
    private val portees = mutableListOf<CoroutineScope>()

    private fun TestScope.portee(): CoroutineScope = CoroutineScope(UnconfinedTestDispatcher()).also { portees += it }

    @AfterTest
    fun arreter() {
        portees.forEach { it.cancel() }
        portees.clear()
    }

    private val refusDefinitif = MockEngine { respond("""{"msg":"Invalid Refresh Token"}""", HttpStatusCode.BadRequest, json) }
    private val renouvellementOk = MockEngine {
        respond("""{"access_token":"acces-2","refresh_token":"renouv-2","expires_in":3600,"user":{"id":"u1","email":"a@b.test"}}""", HttpStatusCode.OK, json)
    }

    private fun session(stockage: StockageMemoire, moteur: MockEngine, maintenant: Long = 0L): SessionService {
        stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces-1", "renouv-1", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(client(moteur), config) { maintenant }, stockage) { maintenant }
    }

    @Test
    fun unRefus401QuiSeConfirmeFermeLaSessionEtAnnonceLExpiration() = runTest {
        val stockage = StockageMemoire()
        val reaction = ReactionAcces()
        val s = session(stockage, refusDefinitif)
        val espaces = EspaceService(s, FausseApi(RolesCompte()), stockage, portee(), reaction)
        val avis = mutableListOf<AvisAcces>()
        val collecte = launch(UnconfinedTestDispatcher(testScheduler)) { espaces.avis.collect { avis += it } }

        reaction.signaler(401, "/api/v1/restaurant/commandes", "acces-1")
        // Le renouvellement passe par le moteur de test de Ktor (autre fil) : on attend l'annonce, en temps réel.
        withContext(Dispatchers.Default) { withTimeout(5_000) { while (avis.isEmpty()) delay(10) } }

        assertNull(s.session.value, "le serveur refuse le renouvellement : la session est fermée")
        assertEquals(Espace.Client, espaces.espace.value)
        val a = avis.single()
        assertTrue(a.reconnexion && a.message.contains("expiré"), "message clair avec « Me reconnecter »")
        collecte.cancel()
    }

    @Test
    fun unRefus401SurUnJetonDejaRenouveleNeFaitRien() = runTest {
        val stockage = StockageMemoire()
        val s = session(stockage, renouvellementOk)
        // Le jeton refusé n'est plus le jeton courant (un autre appel l'a déjà renouvelé) : rien à faire.
        assertTrue(!s.jetonRefuse("ancien-jeton"))
        assertNotNull(s.session.value)
        // Renouvellement réussi : la session continue avec le nouveau jeton.
        assertTrue(!s.jetonRefuse("acces-1"))
        assertEquals("acces-2", s.session.value?.accessToken)
        // Refus immédiat du NOUVEAU jeton : le serveur le rejette vraiment, la session est fermée (pas de renouvellement en boucle).
        assertTrue(s.jetonRefuse("acces-2"))
        assertNull(s.session.value)
    }

    @Test
    fun unRefus403DansUnEspaceRelitLesDroitsEtRamenneAuClientSiLeDroitEstRetire() = runTest {
        val stockage = StockageMemoire()
        stockage.ecrire("espace_actif", "restaurateur")
        val reaction = ReactionAcces()
        val api = FausseApi(RolesCompte(restaurateur = RoleRestaurateur("Chez Awa")))
        val espaces = EspaceService(session(stockage, renouvellementOk), api, stockage, portee(), reaction)
        assertEquals(Espace.Restaurateur, espaces.espace.value)
        val avis = mutableListOf<AvisAcces>()
        val collecte = launch(UnconfinedTestDispatcher(testScheduler)) { espaces.avis.collect { avis += it } }

        // 403 pour une raison qui ne change pas les droits (double authentification, par exemple) : on reste dans l'espace.
        reaction.signaler(403, "/api/v1/restaurant/commandes", "acces-1")
        assertEquals(Espace.Restaurateur, espaces.espace.value)
        assertTrue(avis.isEmpty())

        // Le droit a été retiré côté serveur : retour au client avec une explication.
        api.roles = RolesCompte()
        reaction.signaler(403, "/api/v1/restaurant/commandes", "acces-1")
        assertEquals(Espace.Client, espaces.espace.value)
        assertTrue(avis.single().message.contains("retiré"))
        // Un 403 hors des espaces pro (une route du client) ne déclenche rien.
        reaction.signaler(403, "/api/v1/client/espace", "acces-1")
        assertEquals(1, avis.size)
        collecte.cancel()
    }

    @Test
    fun laConnexionDepuisLAccesProOuvreLEspaceUniqueOuProposeLeChoix() = runTest {
        val unique = StockageMemoire()
        val e1 = EspaceService(session(unique, renouvellementOk), FausseApi(RolesCompte(livreur = true)), unique, portee())
        e1.intentionPro = true
        e1.actualiser()
        assertEquals(Espace.Livreur, e1.espace.value, "un seul espace pro : ouvert directement")

        val plusieurs = StockageMemoire()
        val e2 = EspaceService(session(plusieurs, renouvellementOk), FausseApi(RolesCompte(livreur = true, equipe = "support")), plusieurs, portee())
        e2.intentionPro = true
        e2.actualiser()
        assertEquals(Espace.Client, e2.espace.value)
        assertTrue(e2.choixAProposer.value, "plusieurs espaces : on propose le choix")
        e2.entrer(Espace.Equipe)
        assertEquals(Espace.Equipe, e2.espace.value)
        assertTrue(!e2.choixAProposer.value)
    }

    private class FauxAppareils : AppareilApi {
        val retires = mutableListOf<String>()
        override suspend fun enregistrer(jetonAcces: String, jetonAppareil: String, plateforme: String, versionApp: String?) = true
        override suspend fun retirer(jetonAcces: String, jetonAppareil: String): Boolean {
            retires += jetonAppareil
            return true
        }
        override suspend fun essai(jetonAcces: String): BilanEssai? = null
    }

    @Test
    fun seDeconnecterGardeLesCommandesEnCoursSaufDemandeContraire() = runTest {
        for (effacer in listOf(false, true)) {
            val stockage = StockageMemoire()
            stockage.ecrire("espace_actif", "livreur")
            val s = session(stockage, renouvellementOk)
            val locales = CommandesLocales(stockage)
            locales.ajouter(CommandeLocale(reference = "SF-1", jeton = "j1", restaurantNom = "Chez Awa", creeLe = 1L, total = 30_000))
            val espaces = EspaceService(s, FausseApi(RolesCompte(livreur = true)), stockage, portee())
            val avis = mutableListOf<AvisAcces>()
            val collecte = launch(UnconfinedTestDispatcher(testScheduler)) { espaces.avis.collect { avis += it } }
            val service = DeconnexionService(s, EnregistrementPush(s, FauxAppareils(), JetonPushIndisponible(), stockage, "android", "2.20.0"), locales, espaces, portee())

            service.executer(effacerCommandes = effacer)

            assertNull(s.session.value)
            assertEquals(Espace.Client, espaces.espace.value)
            assertEquals(if (effacer) 0 else 1, locales.lister().size, "commande en cours conservée sauf demande d'effacement")
            assertTrue(avis.single().message.contains("déconnecté"), "un message est montré après la déconnexion")
            collecte.cancel()
        }
    }
}
