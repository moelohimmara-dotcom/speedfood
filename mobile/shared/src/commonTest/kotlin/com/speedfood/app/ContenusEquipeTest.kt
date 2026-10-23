package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AnnonceVersionEquipe
import com.speedfood.app.data.BanniereEquipe
import com.speedfood.app.data.BannieresEquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.FonctionnaliteEquipe
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorBannieresEquipeApi
import com.speedfood.app.data.KtorMisesAJourEquipeApi
import com.speedfood.app.data.KtorParametresEquipeApi
import com.speedfood.app.data.MiseAJourEquipe
import com.speedfood.app.data.MisesAJourEquipe
import com.speedfood.app.data.MisesAJourEquipeApi
import com.speedfood.app.data.ParametresEquipe
import com.speedfood.app.data.ParametresEquipeApi
import com.speedfood.app.data.ResultatBannieresEquipe
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.StatutBanniereEquipe
import com.speedfood.app.data.cleInterrupteurEquipe
import com.speedfood.app.data.cleJournalEquipe
import com.speedfood.app.data.dureeHeures
import com.speedfood.app.data.dureeJours
import com.speedfood.app.data.dureeMinutes
import com.speedfood.app.data.dureeMois
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleEtatFonctionnalite
import com.speedfood.app.data.libelleGroupeFonctionnalite
import com.speedfood.app.data.libelleStatutBanniereEquipe
import com.speedfood.app.data.ouNon
import com.speedfood.app.data.reglagesEquipe
import com.speedfood.app.data.statutBanniereEquipeValide
import com.speedfood.app.ui.BannieresEquipeViewModel
import com.speedfood.app.ui.EtatBannieresEquipe
import com.speedfood.app.ui.EtatMisesAJourEquipe
import com.speedfood.app.ui.EtatParametresEquipe
import com.speedfood.app.ui.MisesAJourEquipeViewModel
import com.speedfood.app.ui.ParametresEquipeViewModel
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
 * Contenu et paramètres (équipe) : bannières, médias, mises à jour et réglages lus en lecture seule. Ces tests verrouillent deux choses :
 * ce que l'application lit vient bien du serveur (filtre, chemin), et les messages d'erreur disent ce qui est cassé.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ContenusEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    private fun apiBannieres(moteur: MockEngine) = KtorBannieresEquipeApi(client(moteur), config)
    private fun apiMisesAJour(moteur: MockEngine) = KtorMisesAJourEquipeApi(client(moteur), config)
    private fun apiParametres(moteur: MockEngine) = KtorParametresEquipeApi(client(moteur), config)

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    // --- Bannières ------------------------------------------------------------

    @Test
    fun lesBannieresSeLisent() = runTest {
        val a = apiBannieres(MockEngine {
            respond(
                """{"ok":true,"tronque":false,"bannieres":[
                    {"id":"b1","titre":"Rentrée des prix","texte":"Livraison offerte","lien":"/restaurants","statut":"publie","ordre":1,"imageUrl":"https://exemple.gn/a.png","creeLe":"2026-10-20T08:00:00Z","misAJourLe":"2026-10-21T08:00:00Z"},
                    {"id":"b2","titre":"Hiver","texte":"","lien":null,"statut":"brouillon","ordre":2,"imageUrl":null,"creeLe":"2026-10-22T08:00:00Z","misAJourLe":"2026-10-22T08:00:00Z"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val resultat = a.bannieres("acces", StatutBanniereEquipe.Toutes)
        assertEquals(2, resultat.bannieres.size)
        assertEquals("Rentrée des prix", resultat.bannieres[0].titre)
        assertEquals("publie", resultat.bannieres[0].statut)
        assertEquals("https://exemple.gn/a.png", resultat.bannieres[0].imageUrl)
        assertEquals(1, resultat.bannieres[0].ordre)
        assertNull(resultat.bannieres[1].imageUrl)
        assertTrue(!resultat.tronque)
    }

    @Test
    fun leFiltreDeStatutEstEnvoyeAuServeur() = runTest {
        var requete = ""
        val a = apiBannieres(MockEngine { r ->
            requete = r.url.encodedQuery
            respond("""{"ok":true,"tronque":false,"bannieres":[]}""", HttpStatusCode.OK, json)
        })
        a.bannieres("acces", StatutBanniereEquipe.Brouillons)
        assertTrue(requete.contains("statut=brouillon"), "le filtre part au serveur : $requete")
    }

    @Test
    fun lesMediasViennentDeLEcranMedias() = runTest {
        var chemin = ""
        val a = apiBannieres(MockEngine { r ->
            chemin = r.url.encodedPath
            respond("""{"ok":true,"tronque":false,"bannieres":[{"id":"b1","titre":"Avec image","statut":"publie","imageUrl":"https://exemple.gn/a.png"}]}""", HttpStatusCode.OK, json)
        })
        val resultat = a.medias("acces")
        assertTrue(chemin.contains("/api/v1/equipe/medias"), "les médias ont leur propre écran : $chemin")
        assertEquals(1, resultat.bannieres.size)
    }

    @Test
    fun unFiltreInconnuRetombeSurToutes() {
        assertEquals(StatutBanniereEquipe.Toutes, statutBanniereEquipeValide("nimporte"))
        assertEquals(StatutBanniereEquipe.Toutes, statutBanniereEquipeValide(null))
        assertEquals(StatutBanniereEquipe.Publiees, statutBanniereEquipeValide("publie"))
        assertEquals(StatutBanniereEquipe.Brouillons, statutBanniereEquipeValide("brouillon"))
    }

    @Test
    fun lesLibellesDeBanniereSontLisibles() {
        assertEquals("Publiée", libelleStatutBanniereEquipe("publie"))
        assertEquals("Brouillon", libelleStatutBanniereEquipe("brouillon"))
        assertEquals("inconnu", libelleStatutBanniereEquipe("inconnu"), "un statut inconnu est affiché tel quel")
    }

    // --- Mises à jour ---------------------------------------------------------

    @Test
    fun lEtatDesMisesAJourSeLit() = runTest {
        val a = apiMisesAJour(MockEngine {
            respond(
                """{"ok":true,"version":{"code":32,"nom":"2.30.0","notes":"Contenu et paramètres"},"appareils":7,
                    "annonce":{"versionCode":31,"versionNom":"2.29.0","annonceeLe":"2026-10-23T10:00:00Z","appareils":5,"envoyes":4},
                    "fonctionnalites":[{"cle":"zones_livraison","libelle":"Zones","description":"Zones par restaurant","groupe":"public","active":true,"miseAJourLe":"2026-10-14T10:00:00Z"},
                                       {"cle":"animations","libelle":"Animations","description":"Animations","groupe":"public","active":false,"miseAJourLe":"2026-10-05T10:00:00Z"}],
                    "misesAJour":[{"id":"zones","date":"2026-10-14","titre":"Zones desservies","resume":"Résumé","verification":"Accueil.","cle":"zones_livraison","active":true,"raisonSansInterrupteur":null,"groupe":"public"},
                                  {"id":"argent","date":"2026-10-04","titre":"Paiement","resume":"Résumé","verification":"Suivi.","cle":null,"active":null,"raisonSansInterrupteur":"Parcours de l'argent.","groupe":null}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val resultat = a.misesAJour("acces")
        assertEquals("2.30.0", resultat.version.nom)
        assertEquals(32, resultat.version.code)
        assertEquals(7, resultat.appareils)
        assertEquals(4, resultat.annonce?.envoyes)
        assertEquals(2, resultat.fonctionnalites.size)
        assertTrue(resultat.fonctionnalites[0].active)
        assertTrue(!resultat.fonctionnalites[1].active)
        assertEquals(2, resultat.misesAJour.size)
        assertTrue(resultat.misesAJour[0].active == true, "une nouveauté reliée à un interrupteur porte son état")
        assertNull(resultat.misesAJour[1].active, "une nouveauté sans interrupteur est toujours active")
        assertEquals("Parcours de l'argent.", resultat.misesAJour[1].raisonSansInterrupteur)
    }

    @Test
    fun lesLibellesDeFonctionnaliteSontLisibles() {
        assertEquals("Site public", libelleGroupeFonctionnalite("public"))
        assertEquals("Commande", libelleGroupeFonctionnalite("commande"))
        assertEquals("Console restaurant", libelleGroupeFonctionnalite("restaurant"))
        assertEquals("autre", libelleGroupeFonctionnalite("autre"), "un groupe inconnu est affiché tel quel")
        assertEquals("Autres", libelleGroupeFonctionnalite(null))
        assertEquals("Active", libelleEtatFonctionnalite(true))
        assertEquals("Coupée", libelleEtatFonctionnalite(false))
    }

    @Test
    fun lesClesDeLaListeDesMisesAJourNeSeChevauchentPas() {
        // Les interrupteurs et le journal partagent la MÊME liste défilante : une même chaîne des deux côtés
        // (« animations » des deux côtés) faisait planter l'application au premier défilement.
        assertTrue(cleInterrupteurEquipe("animations") != cleJournalEquipe("animations"))
        assertTrue(cleInterrupteurEquipe("animations") != cleJournalEquipe("animations-public"))
        assertTrue(cleJournalEquipe("zones") != cleInterrupteurEquipe("zones_livraison"))
        val cles = buildList {
            addAll(listOf("animations", "zones_livraison", "suivi_direct").map { cleInterrupteurEquipe(it) })
            addAll(listOf("animations", "zones", "paiement").map { cleJournalEquipe(it) })
        }
        assertEquals(cles.size, cles.toSet().size, "toutes les clés d'une même liste sont distinctes : $cles")
    }

    // --- Paramètres -----------------------------------------------------------

    @Test
    fun lesParametresSeLisent() = runTest {
        val a = apiParametres(MockEngine {
            respond(
                """{"ok":true,"parametres":{"commandePropositionDelaiMinutes":45,"prixPlatMaxGnf":2500000,
                    "disponibiliteFraicheurHeures":6,"conservationCoordonneesJours":90,"conservationNonClotureeJours":30,
                    "conservationAuditMois":12,"whatsappAssistance":"224622000000","delaiValidationHeures":null,
                    "positionCarteActive":true,"promesseSignature":"","promesseSousTitre":"","promessePartage":"",
                    "connexionFacebookActive":false,"connexionGoogleActive":true}}""",
                HttpStatusCode.OK, json,
            )
        })
        val p = a.parametres("acces")
        assertEquals(45, p.commandePropositionDelaiMinutes)
        assertEquals(2_500_000L, p.prixPlatMaxGnf)
        assertEquals("224622000000", p.whatsappAssistance)
        assertNull(p.delaiValidationHeures)
        assertTrue(p.positionCarteActive)
        assertTrue(p.connexionGoogleActive)
    }

    @Test
    fun lesReglagesSontAffichesEnClair() {
        val reglages = reglagesEquipe(ParametresEquipe())
        assertEquals(14, reglages.size)
        assertEquals("Délai de proposition d'une commande", reglages[0].libelle)
        assertEquals("30 minutes", reglages[0].valeur)
        // Le montant passe par le formateur GNF de l'application (séparateur de milliers insécable) : on vérifie le raccord, pas le caractère.
        assertEquals(formaterGnf(5_000_000L), reglages[1].valeur)
        assertEquals("6 heures", reglages[2].valeur)
        assertEquals("90 jours", reglages[3].valeur)
        assertEquals("12 mois", reglages[5].valeur)
        assertEquals("Désactivé", reglages[6].valeur, "un WhatsApp vide veut dire « désactivé », pas « 0 »")
        assertEquals("Aucun", reglages[7].valeur, "un délai de validation vide veut dire « aucun »")
        assertEquals("Désactivé", reglages[8].valeur, "par défaut le bouton de position est désactivé")
        assertEquals("Activé", reglagesEquipe(ParametresEquipe(positionCarteActive = true))[8].valeur, "activé quand il l'est")
        assertEquals("Texte par défaut", reglages[11].valeur, "un texte d'accueil vide veut dire « texte par défaut »")
    }

    @Test
    fun lesDureesSontLues() {
        assertEquals("30 minutes", dureeMinutes(30))
        assertEquals("1 h 30 min", dureeMinutes(90))
        assertEquals("6 heures", dureeHeures(6))
        assertEquals("3 jours", dureeHeures(72))
        assertEquals("90 jours", dureeJours(90))
        assertEquals("12 mois", dureeMois(12))
        assertEquals("Activé", ouNon(true))
        assertEquals("Désactivé", ouNon(false))
    }

    // --- Erreurs --------------------------------------------------------------

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val reponse = """{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}"""
        assertFailsWith<ErreurAcces> { apiBannieres(MockEngine { respond(reponse, HttpStatusCode.Forbidden, json) }).bannieres("acces", StatutBanniereEquipe.Toutes) }
        assertFailsWith<ErreurAcces> { apiMisesAJour(MockEngine { respond(reponse, HttpStatusCode.Forbidden, json) }).misesAJour("acces") }
        assertFailsWith<ErreurAcces> { apiParametres(MockEngine { respond(reponse, HttpStatusCode.Forbidden, json) }).parametres("acces") }
    }

    @Test
    fun uneConnexionImpossibleEstDitCommeTelle() = runTest {
        // Pas de réseau ou serveur injoignable : le message doit le dire, pas parler d'une « réponse illisible ».
        val erreur = assertFailsWith<ErreurReseau> {
            apiBannieres(MockEngine { throw IllegalStateException("connexion refusée") }).bannieres("acces", StatutBanniereEquipe.Toutes)
        }
        assertTrue(erreur.message!!.contains("Impossible de joindre Speedfood"), "message : ${erreur.message}")
    }

    @Test
    fun uneReponseIllisibleEstDitCommeTelle() = runTest {
        val erreur = assertFailsWith<ErreurReseau> {
            apiParametres(MockEngine { respond("pas du json", HttpStatusCode.OK, json) }).parametres("acces")
        }
        assertTrue(erreur.message!!.contains("illisible"), "message : ${erreur.message}")
    }

    // --- Écrans ---------------------------------------------------------------

    /** Faux serveur des bannières : ce qu'il a reçu, et une panne au deuxième appel. */
    private class FausseApiBannieres : BannieresEquipeApi {
        var statuts = mutableListOf<StatutBanniereEquipe>()
        var appels = 0
        var panneAuDeuxiemeAppel = false
        override suspend fun bannieres(jetonAcces: String, statut: StatutBanniereEquipe): ResultatBannieresEquipe {
            appels++
            statuts += statut
            if (panneAuDeuxiemeAppel && appels == 2) throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
            return ResultatBannieresEquipe(listOf(BanniereEquipe(id = "b1", titre = "Bannière")), false)
        }

        override suspend fun medias(jetonAcces: String): ResultatBannieresEquipe =
            ResultatBannieresEquipe(listOf(BanniereEquipe(id = "b1", titre = "Bannière", imageUrl = "https://exemple.gn/a.png")), false)
    }

    private fun session(connecte: Boolean): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    @Test
    fun leFiltreDeLEcranEstPasseAuServeur() = runTest {
        val api = FausseApiBannieres()
        val vm = BannieresEquipeViewModel(session(true), api)
        assertEquals(StatutBanniereEquipe.Toutes, (vm.etat.value as EtatBannieresEquipe.Pret).filtre)
        vm.filtrer(StatutBanniereEquipe.Publiees)
        assertEquals(StatutBanniereEquipe.Publiees, (vm.etat.value as EtatBannieresEquipe.Pret).filtre)
        assertEquals(2, api.appels, "le filtre déclenche un nouvel appel au serveur")
        assertEquals(StatutBanniereEquipe.Publiees, api.statuts.last())
    }

    @Test
    fun unRafraichissementNeEffacePasLeMessage() = runTest {
        val api = FausseApiBannieres()
        api.panneAuDeuxiemeAppel = true
        val vm = BannieresEquipeViewModel(session(true), api)
        vm.charger()
        val apresPanne = vm.etat.value as EtatBannieresEquipe.Pret
        assertTrue(apresPanne.message != null, "la panne est expliquée à la personne")
        vm.charger()
        val apres = vm.etat.value as EtatBannieresEquipe.Pret
        assertEquals(apresPanne.message, apres.message, "un rafraîchissement n'efface pas la confirmation")
    }

    /** Faux serveur des mises à jour et des paramètres. */
    private class FausseApiMisesAJour : MisesAJourEquipeApi {
        override suspend fun misesAJour(jetonAcces: String) = MisesAJourEquipe(
            version = com.speedfood.app.data.VersionEquipe(32, "2.30.0", "Contenu et paramètres"),
            appareils = 7,
            annonce = AnnonceVersionEquipe(31, "2.29.0", "2026-10-23T10:00:00Z", 5, 4),
            fonctionnalites = listOf(FonctionnaliteEquipe("zones", "Zones", "Zones", "public", true, "2026-10-14T10:00:00Z")),
            misesAJour = listOf(MiseAJourEquipe("zones", "2026-10-14", "Zones", "Résumé", "Accueil.", "zones", true, null, "public")),
        )
    }

    private class FausseApiParametres : ParametresEquipeApi {
        override suspend fun parametres(jetonAcces: String) = ParametresEquipe()
    }

    @Test
    fun lesEcransDeMisesAJourEtParametresSeCharge() = runTest {
        val maj = MisesAJourEquipeViewModel(session(true), FausseApiMisesAJour())
        assertEquals("2.30.0", (maj.etat.value as EtatMisesAJourEquipe.Pret).donnees.version.nom)

        val params = ParametresEquipeViewModel(session(true), FausseApiParametres())
        assertEquals(30, (params.etat.value as EtatParametresEquipe.Pret).parametres.commandePropositionDelaiMinutes)
    }

    @Test
    fun sansSessionLesEcransDemandentDeSeConnecter() = runTest {
        val vm = BannieresEquipeViewModel(session(false), FausseApiBannieres())
        assertTrue(vm.etat.value is EtatBannieresEquipe.NonConnecte, "sans session, l'écran demande de se connecter")
    }
}
