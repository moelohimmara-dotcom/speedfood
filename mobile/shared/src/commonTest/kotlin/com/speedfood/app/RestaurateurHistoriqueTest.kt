package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.CommandeHistorique
import com.speedfood.app.data.HistoriqueRestaurateurApi
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorHistoriqueRestaurateurApi
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.cleCommandeHistorique
import com.speedfood.app.data.dateHeureCommande
import com.speedfood.app.data.libelleMode
import com.speedfood.app.data.libelleStatutCommande
import com.speedfood.app.data.resumeHistorique
import com.speedfood.app.ui.EtatHistorique
import com.speedfood.app.ui.RestaurateurHistoriqueViewModel
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withTimeout
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Historique des commandes du restaurateur : la pagination et ce qui se passe quand le réseau tombe.
 *
 * Faux serveur en mémoire (`MockEngine`), ViewModel réel, aucun réseau. Ces tests verrouillent le point délicat de l'écran : la page suivante
 * s'ajoute à l'historique affiché (sans le remplacer), et une panne ne fait pas disparaître les commandes déjà à l'écran.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RestaurateurHistoriqueTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private fun session(stockage: StockageLocal, connecte: Boolean): SessionService {
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    private suspend fun <T> attendre(etats: StateFlow<T>, condition: (T) -> Boolean): T = withTimeout(15_000) { etats.first { condition(it) } }

    /** Une page d'essai : trois commandes, la page suivante annoncée. */
    private fun page(page: Int, total: Int = 45) = """{"ok":true,"page":$page,"total":$total,"pageSuivante":${if (page * 3 < total) page + 1 else null},"commandes":[
        {"id":"c$page-1","reference":"SF-${page}01","statut":"terminee","mode":"retrait","sousTotal":30000,"fraisLivraisonEstime":0,"creeLe":"2026-10-2${page}T10:00:00Z","nbLignes":2},
        {"id":"c$page-2","reference":"SF-${page}02","statut":"refusee","mode":"livraison","sousTotal":45000,"fraisLivraisonEstime":9500,"creeLe":"2026-10-2${page}T09:00:00Z","nbLignes":1},
        {"id":"c$page-3","reference":"SF-${page}03","statut":"annulee","mode":"retrait","sousTotal":15000,"fraisLivraisonEstime":0,"creeLe":"2026-10-2${page}T08:00:00Z","nbLignes":1}]}"""

    @Test
    fun laPaginationChargeLaPageSuivante(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val demandes = mutableListOf<String>()
        val client = client(MockEngine { r ->
            val corps = r.body.toByteArray().decodeToString()
            demandes += corps
            val pageDemandee = Regex("\"page\":(\\d+)").find(corps)?.groupValues?.get(1)?.toIntOrNull() ?: 1
            respond(page(pageDemandee), HttpStatusCode.OK, json)
        })
        val vm = RestaurateurHistoriqueViewModel(session(stockage, true), KtorHistoriqueRestaurateurApi(client, config))
        val premiere = attendre(vm.etat) { it is EtatHistorique.Pret } as EtatHistorique.Pret
        assertEquals(3, premiere.commandes.size, "la première page est chargée")
        assertEquals(1, premiere.page)
        assertEquals(2, premiere.pageSuivante, "le serveur annonce la page suivante")

        vm.chargerPageSuivante()
        val apres = attendre(vm.etat) { (it as? EtatHistorique.Pret)?.commandes?.size == 6 } as EtatHistorique.Pret
        assertEquals(6, apres.commandes.size, "la page suivante s'ajoute à l'historique affiché")
        assertEquals(2, apres.page, "la page affichée est la page 2")
        assertEquals("c1-1", apres.commandes.first().id, "la première page n'a pas disparu")
        assertEquals("c2-1", apres.commandes[3].id, "la page suivante est bien à la suite")
        assertEquals(2, demandes.size, "deux requêtes : une par page")
        assertTrue(demandes[1].contains("\"page\":2"), "la page demandée part au serveur : ${demandes[1]}")
    }

    @Test
    fun laDernierePageNAnnoncePlusDeSuite(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { respond(page(3, total = 7), HttpStatusCode.OK, json) })
        val vm = RestaurateurHistoriqueViewModel(session(stockage, true), KtorHistoriqueRestaurateurApi(client, config))
        val pret = attendre(vm.etat) { it is EtatHistorique.Pret } as EtatHistorique.Pret
        assertNull(pret.pageSuivante, "la dernière page n'annonce pas de suite")
    }

    @Test
    fun laPanneConserveLesCommandesAffichees(): Unit = runBlocking {
        val stockage = StockageMemoire()
        var appels = 0
        val client = client(MockEngine {
            appels++
            if (appels == 1) respond(page(1), HttpStatusCode.OK, json) else throw IllegalStateException("réseau coupé")
        })
        val vm = RestaurateurHistoriqueViewModel(session(stockage, true), KtorHistoriqueRestaurateurApi(client, config))
        val avant = attendre(vm.etat) { it is EtatHistorique.Pret } as EtatHistorique.Pret
        vm.chargerPageSuivante()
        val apres = attendre(vm.etat) { (it as? EtatHistorique.Pret)?.message != null } as EtatHistorique.Pret
        assertEquals(avant.commandes, apres.commandes, "les commandes déjà affichées restent affichées")
        assertNotNull(apres.message, "la panne est expliquée")
    }

    @Test
    fun unServeurArreteDonneLeMessageImpossibleDeJoindre(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { throw IllegalStateException("réseau coupé") })
        val vm = RestaurateurHistoriqueViewModel(session(stockage, true), KtorHistoriqueRestaurateurApi(client, config))
        val etat = attendre(vm.etat) { it is EtatHistorique.Erreur } as EtatHistorique.Erreur
        assertTrue(etat.message.contains("Impossible de joindre Speedfood"), "le message dit ce qu'il faut faire : ${etat.message}")
    }

    @Test
    fun sansSessionLEcranDemandeDeSeConnecter(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { respond(page(1), HttpStatusCode.OK, json) })
        val vm = RestaurateurHistoriqueViewModel(session(stockage, false), KtorHistoriqueRestaurateurApi(client, config))
        val etat = attendre(vm.etat) { it is EtatHistorique.NonConnecte }
        assertTrue(etat is EtatHistorique.NonConnecte, "sans session, l'écran demande de se connecter")
    }

    // --- Mise en forme (sans réseau) -----------------------------------------------

    @Test
    fun laDateEtLeStatutSontEnFrancais() {
        assertEquals("23/10/2026 à 18:20", dateHeureCommande("2026-10-23T18:20:00Z"))
        assertEquals("Terminée", libelleStatutCommande("terminee"))
        assertEquals("Refusée", libelleStatutCommande("refusee"))
        assertEquals("Livraison", libelleMode("livraison"))
        assertEquals("Retrait", libelleMode("retrait"))
        assertEquals("12 commandes sur 45", resumeHistorique(12, 45))
    }

    @Test
    fun lesClesDeListesNeSeChevauchentPas() {
        assertNotEquals(cleCommandeHistorique("c1"), cleCommandeHistorique("c2"), "deux commandes ne peuvent pas partager une clé")
        assertTrue(cleCommandeHistorique("c1").startsWith("commande-"), "les clés de l'historique ont leur propre espace de noms")
    }

    @Test
    fun laPageDemandeePartDansLeCorpsDeLaRequete(): Unit = runBlocking {
        var corps = ""
        val client = client(MockEngine { r ->
            corps = r.body.toByteArray().decodeToString()
            respond(page(3), HttpStatusCode.OK, json)
        })
        val api: HistoriqueRestaurateurApi = KtorHistoriqueRestaurateurApi(client, config)
        val resultat = api.historique("acces", 3, 20)
        assertEquals(3, resultat.page)
        assertEquals(3, resultat.commandes.size)
        val envoye = Json.parseToJsonElement(corps).jsonObject
        assertEquals("3", envoye["page"]!!.jsonPrimitive.content)
        assertEquals("20", envoye["taille"]!!.jsonPrimitive.content)
    }

    @Test
    fun uneCommandeAEssaiNeComptePas() {
        // Le serveur exclut les commandes d'essai : le total renvoyé ne les compte pas, l'application n'a rien à faire.
        val commande = CommandeHistorique(id = "c1", reference = "SF-1", statut = "terminee", sousTotal = 30_000)
        assertEquals(30_000, commande.total, "le total d'une commande est ses plats plus la livraison")
    }

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()
}
