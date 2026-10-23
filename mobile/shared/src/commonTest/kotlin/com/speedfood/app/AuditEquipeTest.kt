package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ActionAuditEquipe
import com.speedfood.app.data.AuditEquipe
import com.speedfood.app.data.AuditEquipeApi
import com.speedfood.app.data.EntreeJournalEquipe
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.IndicateurAuditEquipe
import com.speedfood.app.data.KtorAuditEquipeApi
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.PeriodeAuditEquipe
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.actionsAuditEquipeFiltrees
import com.speedfood.app.data.cleActionAuditEquipe
import com.speedfood.app.data.cleEntreeAuditEquipe
import com.speedfood.app.data.cleIndicateurAuditEquipe
import com.speedfood.app.data.dateHeureJournalAudit
import com.speedfood.app.data.libelleActionAuditEquipe
import com.speedfood.app.data.libellePeriodeAuditEquipe
import com.speedfood.app.data.miseEnFormeEntreeAudit
import com.speedfood.app.data.nombreEntreesAudit
import com.speedfood.app.data.resumeJournalAudit
import com.speedfood.app.ui.AuditEquipeViewModel
import com.speedfood.app.ui.EtatAuditEquipe
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Journal d'audit (équipe) : les indicateurs, les filtres et la mise en forme des entrées, lus en lecture seule. Ces tests
 * verrouillent trois choses : ce que l'application lit vient bien du serveur (filtres, catalogue), les textes affichés sont
 * lisibles en français, et les messages d'erreur disent ce qui est cassé.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuditEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    private fun apiAudit(moteur: MockEngine) = KtorAuditEquipeApi(client(moteur), config)

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    // --- Lecture --------------------------------------------------------------

    @Test
    fun leJournalDauditSeLit() = runTest {
        val a = apiAudit(MockEngine {
            respond(
                """{"ok":true,"tronque":false,
                    "indicateurs":[{"cle":"restaurants_en_attente","libelle":"Restaurants en attente de validation","definition":"Jamais examinés.","valeur":3},
                                   {"cle":"restaurants_suspendus","libelle":"Restaurants suspendus","definition":"Suspension active.","valeur":1},
                                   {"cle":"commandes_actives","libelle":"Commandes actives","definition":"En préparation.","valeur":12},
                                   {"cle":"revelations_coordonnees_7j","libelle":"Révélations de coordonnées (7 derniers jours)","definition":"Accès exceptionnels.","valeur":2}],
                    "actions":[{"code":"restaurant.approbation","libelle":"Restaurant approuvé"},{"code":"restaurant.suspension","libelle":"Restaurant suspendu"}],
                    "periodes":[{"valeur":null,"libelle":"Tout l'historique"},{"valeur":1,"libelle":"24 heures"},{"valeur":7,"libelle":"7 jours"},{"valeur":30,"libelle":"30 jours"}],
                    "journal":[{"id":"e1","horodatage":"2026-10-23T08:15:00.000Z","action":"restaurant.approbation","libelle":"Restaurant approuvé",
                                "acteurEmail":"moi@speedfood.gn","auteur":"moi@speedfood.gn","cibleType":"restaurant","cibleId":"0f8c1d2e",
                                "cible":"Restaurant 0f8c1d2e","cibleUrl":"/system/catalogue/restaurants/0f8c1d2e","motif":"Dossier complet"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val resultat = a.audit("acces", null, null)
        assertEquals(4, resultat.indicateurs.size, "les quatre indicateurs du site sont toujours là")
        assertEquals(3, resultat.indicateurs[0].valeur)
        assertEquals("Restaurants en attente de validation", resultat.indicateurs[0].libelle)
        assertEquals("Jamais examinés.", resultat.indicateurs[0].definition)
        assertEquals(2, resultat.actions.size)
        assertEquals("Restaurant approuvé", resultat.actions[0].libelle)
        assertEquals(4, resultat.periodes.size)
        assertNull(resultat.periodes[0].valeur, "une période nulle = tout l'historique")
        assertEquals(1, resultat.journal.size)
        assertEquals("2026-10-23T08:15:00.000Z", resultat.journal[0].horodatage)
        assertEquals("moi@speedfood.gn", resultat.journal[0].auteur)
        assertEquals("/system/catalogue/restaurants/0f8c1d2e", resultat.journal[0].cibleUrl)
        assertEquals("Dossier complet", resultat.journal[0].motif)
        assertTrue(!resultat.tronque)
    }

    @Test
    fun lesFiltresPartentAuServeur() = runTest {
        var requete = ""
        val a = apiAudit(MockEngine { r ->
            requete = r.url.encodedQuery
            respond("""{"ok":true,"journal":[]}""", HttpStatusCode.OK, json)
        })
        a.audit("acces", "restaurant.approbation", 7)
        assertTrue(requete.contains("action=restaurant.approbation"), "le type d'action part au serveur : $requete")
        assertTrue(requete.contains("depuis=7"), "la période part au serveur : $requete")
    }

    @Test
    fun sansFiltreAucunParametreNestEnvoye() = runTest {
        var requete = ""
        val a = apiAudit(MockEngine { r ->
            requete = r.url.encodedQuery
            respond("""{"ok":true,"journal":[]}""", HttpStatusCode.OK, json)
        })
        a.audit("acces", null, null)
        assertTrue(!requete.contains("action="), "toutes les actions : rien à demander : $requete")
        assertTrue(!requete.contains("depuis="), "tout l'historique : rien à demander : $requete")
    }

    // --- Mise en forme --------------------------------------------------------

    @Test
    fun laDateEtLHeureSontEnFrancais() {
        assertEquals("23/10/2026 à 08:15", dateHeureJournalAudit("2026-10-23T08:15:00.000Z"))
        assertEquals("01/01/2026 à 00:00", dateHeureJournalAudit("2026-01-01T00:00:00Z"))
        assertEquals("23/10/2026", dateHeureJournalAudit("2026-10-23"), "une date sans heure reste lisible")
        assertEquals("hier", dateHeureJournalAudit("hier"), "une date illisible est renvoyée telle quelle")
        assertEquals("", dateHeureJournalAudit(""))
    }

    @Test
    fun leLibelleDeLaPeriodeVientDuServeur() {
        val periodes = listOf(
            PeriodeAuditEquipe(null, "Tout l'historique"),
            PeriodeAuditEquipe(1, "24 heures"),
            PeriodeAuditEquipe(7, "7 jours"),
            PeriodeAuditEquipe(30, "30 jours"),
        )
        assertEquals("Tout l'historique", libellePeriodeAuditEquipe(null, periodes))
        assertEquals("24 heures", libellePeriodeAuditEquipe(1, periodes))
        assertEquals("7 jours", libellePeriodeAuditEquipe(7, periodes))
        assertEquals("30 jours", libellePeriodeAuditEquipe(30, periodes))
        assertEquals("Tout l'historique", libellePeriodeAuditEquipe(null), "sans liste du serveur, on ne devine pas")
    }

    @Test
    fun leBoutonDActionMontreLaSelection() {
        val actions = listOf(ActionAuditEquipe("restaurant.approbation", "Restaurant approuvé"))
        assertEquals("Toutes les actions", libelleActionAuditEquipe(null, actions))
        assertEquals("Restaurant approuvé", libelleActionAuditEquipe("restaurant.approbation", actions))
        assertEquals("restaurant.suspension", libelleActionAuditEquipe("restaurant.suspension", actions), "une action hors catalogue garde son code")
    }

    @Test
    fun leNombreDEntreesEstCompte() {
        val journal = listOf(
            EntreeJournalEquipe(id = "e1", libelle = "Restaurant approuvé"),
            EntreeJournalEquipe(id = "e2", libelle = "Restaurant suspendu"),
        )
        assertEquals(2, nombreEntreesAudit(journal))
        assertEquals("2 entrées", resumeJournalAudit(nombreEntreesAudit(journal)))
        assertEquals("1 entrée", resumeJournalAudit(1))
        assertEquals("0 entrées", resumeJournalAudit(0))
    }

    @Test
    fun uneEntreeIncompleteEstMiseEnForme() {
        // Auteur inconnu, motif absent, cible sans adresse : chaque cas reste lisible, rien n'est inventé.
        val entree = EntreeJournalEquipe(
            id = "e1",
            horodatage = "2026-10-23T08:15:00.000Z",
            action = "commande.annulation",
            libelle = "Commande annulée",
            acteurEmail = null,
            auteur = "acteur inconnu",
            cibleType = "commande",
            cibleId = "abc",
            cible = "Commande abc",
            cibleUrl = null,
            motif = null,
        )
        val affichee = miseEnFormeEntreeAudit(entree)
        assertEquals("acteur inconnu", affichee.auteur)
        assertNull(affichee.motif, "pas de motif : pas de ligne de motif")
        assertNull(affichee.cibleUrl, "pas d'adresse : la cible n'est pas un lien")
        assertEquals("Commande abc", affichee.cible)

        // Sans libellé d'auteur, l'e-mail connu prend le relais.
        val avecEmail = entree.copy(auteur = "", acteurEmail = "moi@speedfood.gn")
        assertEquals("moi@speedfood.gn", miseEnFormeEntreeAudit(avecEmail).auteur)
    }

    @Test
    fun lesActionsSeFiltrentSansCasseNiAccents() {
        val actions = listOf(
            ActionAuditEquipe("restaurant.approbation", "Restaurant approuvé"),
            ActionAuditEquipe("restaurant.suspension", "Restaurant suspendu"),
            ActionAuditEquipe("coordonnees.revelation", "Révélation de coordonnées"),
        )
        assertEquals(3, actionsAuditEquipeFiltrees(actions, "").size, "sans recherche, tout le catalogue est proposé")
        assertEquals(1, actionsAuditEquipeFiltrees(actions, "revelation").size, "la recherche ignore la casse et les accents")
        assertEquals(1, actionsAuditEquipeFiltrees(actions, "suspension").size)
        assertEquals(1, actionsAuditEquipeFiltrees(actions, "restaurant.approbation").size, "le code se cherche aussi")
        assertEquals(0, actionsAuditEquipeFiltrees(actions, "inexistant").size)
    }

    @Test
    fun lesClesDeLaListeNeSeChevauchentPas() {
        // Les indicateurs, les actions et les entrées sont lus dans la même liste défilante : une clé partagée fait planter l'application.
        assertTrue(cleIndicateurAuditEquipe("x") != cleEntreeAuditEquipe("x"))
        assertTrue(cleIndicateurAuditEquipe("x") != cleActionAuditEquipe("x"))
        assertTrue(cleEntreeAuditEquipe("x") != cleActionAuditEquipe("x"))
        val cles = buildList {
            addAll(listOf("restaurants_en_attente", "commandes_actives").map { cleIndicateurAuditEquipe(it) })
            addAll(listOf("restaurant.approbation", "coordonnees.revelation").map { cleActionAuditEquipe(it) })
            addAll(listOf("e1", "e2").map { cleEntreeAuditEquipe(it) })
        }
        assertEquals(cles.size, cles.toSet().size, "toutes les clés d'une même liste sont distinctes : $cles")
    }

    // --- Erreurs --------------------------------------------------------------

    @Test
    fun unAccesRefuseEstUneErreurDAccess() = runTest {
        val reponse = """{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}"""
        assertFailsWith<ErreurAcces> { apiAudit(MockEngine { respond(reponse, HttpStatusCode.Forbidden, json) }).audit("acces", null, null) }
    }

    @Test
    fun uneConnexionImpossibleEstDitCommeTelle() = runTest {
        val erreur = assertFailsWith<ErreurReseau> {
            apiAudit(MockEngine { throw IllegalStateException("connexion refusée") }).audit("acces", null, null)
        }
        assertTrue(erreur.message!!.contains("Impossible de joindre Speedfood"), "message : ${erreur.message}")
    }

    @Test
    fun uneReponseIllisibleEstDitCommeTelle() = runTest {
        val erreur = assertFailsWith<ErreurReseau> {
            apiAudit(MockEngine { respond("pas du json", HttpStatusCode.OK, json) }).audit("acces", null, null)
        }
        assertTrue(erreur.message!!.contains("illisible"), "message : ${erreur.message}")
    }

    // --- Écran ----------------------------------------------------------------

    /** Faux serveur du journal : ce qu'il a reçu, et une panne au deuxième appel. */
    private class FausseApiAudit : AuditEquipeApi {
        var actionsRecues = mutableListOf<String?>()
        var periodesRecues = mutableListOf<Int?>()
        var appels = 0
        var panneAuDeuxiemeAppel = false

        override suspend fun audit(jetonAcces: String, action: String?, depuis: Int?): AuditEquipe {
            appels++
            actionsRecues += action
            periodesRecues += depuis
            if (panneAuDeuxiemeAppel && appels == 2) throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
            return AuditEquipe(
                indicateurs = listOf(IndicateurAuditEquipe("restaurants_en_attente", "Restaurants en attente de validation", "Jamais examinés.", 3)),
                actions = listOf(ActionAuditEquipe("restaurant.approbation", "Restaurant approuvé")),
                periodes = listOf(PeriodeAuditEquipe(null, "Tout l'historique"), PeriodeAuditEquipe(7, "7 jours")),
                journal = listOf(EntreeJournalEquipe(id = "e1", libelle = "Restaurant approuvé")),
                tronque = false,
            )
        }
    }

    private fun session(connecte: Boolean): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    @Test
    fun lesFiltresDeLEcranSontPassesAuServeur() = runTest {
        val api = FausseApiAudit()
        val vm = AuditEquipeViewModel(session(true), api)
        assertNull((vm.etat.value as EtatAuditEquipe.Pret).action, "toutes les actions par défaut")
        assertNull((vm.etat.value as EtatAuditEquipe.Pret).periode, "tout l'historique par défaut")
        vm.filtrerAction("restaurant.approbation")
        assertEquals("restaurant.approbation", (vm.etat.value as EtatAuditEquipe.Pret).action)
        assertEquals(2, api.appels, "le filtre d'action déclenche un nouvel appel au serveur")
        assertEquals("restaurant.approbation", api.actionsRecues.last())
        vm.filtrerPeriode(7)
        assertEquals(7, (vm.etat.value as EtatAuditEquipe.Pret).periode)
        assertEquals(7, api.periodesRecues.last())
    }

    @Test
    fun laSelectionResteVisibleApresUnRafraichissement() = runTest {
        val api = FausseApiAudit()
        val vm = AuditEquipeViewModel(session(true), api)
        vm.filtrerAction("restaurant.approbation")
        vm.filtrerPeriode(7)
        vm.charger()
        val apres = vm.etat.value as EtatAuditEquipe.Pret
        assertEquals("restaurant.approbation", apres.action, "le type d'action choisi reste affiché")
        assertEquals(7, apres.periode, "la période choisie reste affichée")
    }

    @Test
    fun unRafraichissementNeEffacePasLeMessage() = runTest {
        val api = FausseApiAudit()
        api.panneAuDeuxiemeAppel = true
        val vm = AuditEquipeViewModel(session(true), api)
        vm.charger()
        val apresPanne = vm.etat.value as EtatAuditEquipe.Pret
        assertTrue(apresPanne.message != null, "la panne est expliquée à la personne")
        vm.charger()
        val apres = vm.etat.value as EtatAuditEquipe.Pret
        assertEquals(apresPanne.message, apres.message, "un rafraîchissement n'efface pas le message de panne")
    }

    @Test
    fun sansSessionLEcranDemandeDeSeConnecter() = runTest {
        val vm = AuditEquipeViewModel(session(false), FausseApiAudit())
        assertTrue(vm.etat.value is EtatAuditEquipe.NonConnecte, "sans session, l'écran demande de se connecter")
    }
}
