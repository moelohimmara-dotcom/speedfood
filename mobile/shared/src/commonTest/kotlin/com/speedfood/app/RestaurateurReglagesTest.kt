package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AlerteCommande
import com.speedfood.app.data.HorairesSemaine
import com.speedfood.app.data.JourHoraire
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorReglagesRestaurateurApi
import com.speedfood.app.data.KtorRestaurateurApi
import com.speedfood.app.data.PreferencesRestaurateur
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.formaterHoraires
import com.speedfood.app.data.parseHoraires
import com.speedfood.app.data.verifierHoraires
import com.speedfood.app.ui.EtatConsole
import com.speedfood.app.ui.EtatReglages
import com.speedfood.app.ui.RestaurateurReglagesViewModel
import com.speedfood.app.ui.RestaurateurViewModel
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
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Réglages du poste de travail du restaurateur : les horaires qu'il déclare, la pause du service, le son des nouvelles commandes et le mode
 * « poste fixe ».
 *
 * Faux serveur en mémoire (`MockEngine`), ViewModels réels, aucun réseau. Ces tests verrouillent quatre choses : ce que l'application écrit
 * part bien au serveur, ce qui est mémorisé sur le téléphone, ce qui reste affiché quand le réseau tombe, et le message d'erreur exact.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RestaurateurReglagesTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private fun session(stockage: StockageLocal, connecte: Boolean): SessionService {
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    /** Attend l'état qui satisfy la condition (le ViewModel travaille en arrière-plan). */
    private suspend fun <T> attendre(etats: StateFlow<T>, condition: (T) -> Boolean): T = withTimeout(15_000) { etats.first { condition(it) } }

    private val horairesServeur = "Lundi : 11:00 - 22:00\nMardi : 11:00 - 22:00\nMercredi : 11:00 - 22:00\nJeudi : 11:00 - 22:00\nVendredi : 11:00 - 23:00\nSamedi : 11:00 - 23:00\nDimanche : fermé"

    private val reponseReglages = """{"ok":true,"horaires":"$horairesServeur","ouvert":true,"accepteCommandes":true,
        "platsAReconfirmer":[{"id":"p2","nom":"Riz gras","confirmeLe":"2026-10-23T06:00:00Z"},{"id":"p3","nom":"Sauce arachide","confirmeLe":null}]}"""

    private val reponseCommandes = """{"ok":true,"restaurant":{"id":"r1","nom":"Chez Awa","ouvert":true,"accepteCommandes":true},"commandes":[]}"""

    // --- Les horaires : format, relecture, contrôles -------------------------------

    @Test
    fun lesHorairesSontEcritsDansLeFormatDuServeur() {
        val semaine = HorairesSemaine((0..6).map { JourHoraire(it, ouvert = it != 6, ouverture = "9:30", fermeture = "22:00") })
        val texte = formaterHoraires(semaine)
        assertTrue(texte.startsWith("Lundi : 09:30 - 22:00"), "le jour et les heures sont en clair : $texte")
        assertTrue(texte.contains("Dimanche : fermé"), "un jour fermé est écrit en clair")
        val relu = parseHoraires(texte)
        assertNotNull(relu, "le format écrit se relit")
        assertEquals("09:30", relu!!.jours[0].ouverture)
        assertEquals("22:00", relu.jours[0].fermeture)
        assertFalse(relu.jours[6].ouvert, "le dimanche est fermé")
        assertNull(parseHoraires("Ouvert tous les jours de 11h à 22h"), "un texte écrit sur le site n'est pas dans le format de l'application")
        assertNull(parseHoraires("Lundi : 11:00 - 22:00"), "une semaine incomplète n'est pas une semaine")
    }

    @Test
    fun desHorairesImpossiblesSontRefuses() {
        assertNotNull(verifierHoraires(HorairesSemaine(listOf(JourHoraire(0, ouverture = "23:00", fermeture = "22:00")))), "l'ouverture doit précéder la fermeture")
        assertNotNull(verifierHoraires(HorairesSemaine(listOf(JourHoraire(0, ouverture = "midi", fermeture = "22:00")))), "une heure illisible est signalée")
        assertNull(verifierHoraires(HorairesSemaine(listOf(JourHoraire(0, ouverture = "11:00", fermeture = "22:00")))), "des horaires corrects passent")
        assertNull(verifierHoraires(HorairesSemaine(listOf(JourHoraire(0, ouvert = false)))), "un jour fermé n'a pas d'heure à vérifier")
    }

    // --- La lecture des réglages ---------------------------------------------------

    @Test
    fun lesReglagesEtLesPlatsAReconfirmerViennentDuServeur(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { r ->
            if (r.url.encodedPath.endsWith("/reglages")) respond(reponseReglages, HttpStatusCode.OK, json) else respond(reponseCommandes, HttpStatusCode.OK, json)
        })
        val vm = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        val pret = attendre(vm.etat) { it is EtatReglages.Pret } as EtatReglages.Pret
        assertEquals(2, pret.reglages.platsAReconfirmer.size, "la liste des plats à reconfirmer vient du serveur")
        assertEquals("Riz gras", pret.reglages.platsAReconfirmer.first().nom)
        assertTrue(pret.horairesLibres.not(), "les horaires du serveur sont dans le format de l'application")
        assertEquals("11:00", pret.horaires.jours[0].ouverture)
        assertTrue(pret.sonActif, "le son est actif tant que le restaurateur ne l'a pas coupé")
        assertTrue(pret.posteFixe, "le poste fixe est actif tant que le restaurateur ne l'a pas coupé")
    }

    @Test
    fun desHorairesEcritsSurLeSiteSontAffichesSansEtreEcrases(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { respond("""{"ok":true,"horaires":"Ouvert tous les jours","ouvert":true,"accepteCommandes":true,"platsAReconfirmer":[]}""", HttpStatusCode.OK, json) })
        val vm = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        val pret = attendre(vm.etat) { it is EtatReglages.Pret } as EtatReglages.Pret
        assertTrue(pret.horairesLibres, "un texte qui n'est pas dans le format de l'application est signalé")
        assertEquals("Ouvert tous les jours", pret.reglages.horaires, "le texte du serveur est affiché tel quel")
    }

    // --- Ce qui est mémorisé sur le téléphone ---------------------------------------

    @Test
    fun leSonEstMemoriseSurLeTelephone(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { respond(reponseReglages, HttpStatusCode.OK, json) })
        val vm = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        attendre(vm.etat) { it is EtatReglages.Pret }
        vm.basculerSon(false)
        assertEquals("non", stockage.lire(PreferencesRestaurateur.CLE_SON), "le choix est écrit sur le téléphone")
        assertFalse((vm.etat.value as EtatReglages.Pret).sonActif, "l'écran montre le choix fait")

        // Un nouvel écran (application relancée) relit le choix : il n'est pas perdu.
        val autre = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        val relu = attendre(autre.etat) { it is EtatReglages.Pret } as EtatReglages.Pret
        assertFalse(relu.sonActif, "le son coupé reste coupé après relance")
    }

    @Test
    fun lePosteFixeEstMemoriseSurLeTelephone(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { respond(reponseReglages, HttpStatusCode.OK, json) })
        val vm = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        attendre(vm.etat) { it is EtatReglages.Pret }
        vm.basculerPosteFixe(false)
        assertEquals("non", stockage.lire(PreferencesRestaurateur.CLE_POSTE_FIXE))
        assertFalse((vm.etat.value as EtatReglages.Pret).posteFixe, "l'écran montre le choix fait")
    }

    // --- La pause du service ---------------------------------------------------------

    @Test
    fun laPauseChangeLEtatAffiche(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val demandes = mutableListOf<String>()
        val client = client(MockEngine { r ->
            if (r.url.encodedPath.endsWith("/statut")) {
                demandes += r.body.toByteArray().decodeToString()
                respond("""{"ok":true}""", HttpStatusCode.OK, json)
            } else {
                respond(reponseCommandes, HttpStatusCode.OK, json)
            }
        })
        val vm = RestaurateurViewModel(session(stockage, true), KtorRestaurateurApi(client, config), AlerteFaux(), stockage)
        attendre(vm.etat) { it is EtatConsole.Pret }
        vm.mettreEnPause(true)
        val apres = attendre(vm.etat) { (it as? EtatConsole.Pret)?.enPause == true } as EtatConsole.Pret
        assertTrue(apres.enPause == true, "l'écran montre la pause")
        assertNotNull(apres.message)
        assertTrue(apres.message!!.contains("en pause"), "le message dit ce que la pause change : ${apres.message}")
        assertEquals(1, demandes.size, "la pause part au serveur")
        assertTrue(demandes.first().contains("accepte_commandes"), "le serveur reçoit le champ de la pause : ${demandes.first()}")
        assertTrue(demandes.first().contains("false"), "la pause coupe les commandes : ${demandes.first()}")
    }

    @Test
    fun lePosteFixeDecideDeLecranAllume(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val alerte = AlerteFaux()
        val client = client(MockEngine { respond(reponseCommandes, HttpStatusCode.OK, json) })
        val vm = RestaurateurViewModel(session(stockage, true), KtorRestaurateurApi(client, config), alerte, stockage)
        attendre(vm.etat) { it is EtatConsole.Pret }
        assertTrue(alerte.ecranAllume, "poste fixe actif (par défaut) : l'écran reste allumé")

        // Poste fixe coupé : la console ne garde plus l'écran allumé.
        val stockage2 = StockageMemoire()
        PreferencesRestaurateur.ecrirePosteFixe(stockage2, false)
        val alerte2 = AlerteFaux()
        val vm2 = RestaurateurViewModel(session(stockage2, true), KtorRestaurateurApi(client, config), alerte2, stockage2)
        attendre(vm2.etat) { it is EtatConsole.Pret }
        assertFalse(alerte2.ecranAllume, "poste fixe coupé : l'écran peut s'éteindre")
    }

    // --- Les pannes et l'absence de session -------------------------------------------

    @Test
    fun laPanneConserveLesDonneesAffichees(): Unit = runBlocking {
        val stockage = StockageMemoire()
        var appels = 0
        val client = client(MockEngine {
            appels++
            if (appels == 1) respond(reponseReglages, HttpStatusCode.OK, json) else throw IllegalStateException("réseau coupé")
        })
        val vm = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        val avant = attendre(vm.etat) { it is EtatReglages.Pret } as EtatReglages.Pret
        vm.charger()
        val apres = attendre(vm.etat) { (it as? EtatReglages.Pret)?.message != null } as EtatReglages.Pret
        assertEquals(avant.horaires, apres.horaires, "les horaires déjà affichés restent affichés")
        assertEquals(avant.reglages.platsAReconfirmer, apres.reglages.platsAReconfirmer, "les plats à reconfirmer restent affichés")
        assertNotNull(apres.message, "la panne est expliquée")
    }

    @Test
    fun unServeurArreteDonneLeMessageImpossibleDeJoindre(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { throw IllegalStateException("réseau coupé") })
        val vm = RestaurateurReglagesViewModel(session(stockage, true), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        val etat = attendre(vm.etat) { it is EtatReglages.Erreur } as EtatReglages.Erreur
        assertTrue(etat.message.contains("Impossible de joindre Speedfood"), "le message dit ce qu'il faut faire : ${etat.message}")
    }

    @Test
    fun sansSessionLEcranDemandeDeSeConnecter(): Unit = runBlocking {
        val stockage = StockageMemoire()
        val client = client(MockEngine { respond(reponseReglages, HttpStatusCode.OK, json) })
        val vm = RestaurateurReglagesViewModel(session(stockage, false), KtorReglagesRestaurateurApi(client, config), KtorRestaurateurApi(client, config), stockage)
        val etat = attendre(vm.etat) { it is EtatReglages.NonConnecte }
        assertTrue(etat is EtatReglages.NonConnecte, "sans session, l'écran demande de se connecter")
    }

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    /** Alerte de test : elle note ce que l'application demande (écran allumé, sonnerie). */
    private class AlerteFaux : AlerteCommande {
        var ecranAllume = false
        var sonneries = 0
        override fun sonner() { sonneries++ }
        override fun garderEcranAllume(actif: Boolean) { ecranAllume = actif }
    }
}
