package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ActiviteApi
import com.speedfood.app.data.ActiviteRestaurant
import com.speedfood.app.data.CourseLivreur
import com.speedfood.app.data.CourseLivree
import com.speedfood.app.data.DossierLivreur
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.FileLivreur
import com.speedfood.app.data.FicheLivreur
import com.speedfood.app.data.FournisseurPosition
import com.speedfood.app.data.GainsLivreur
import com.speedfood.app.data.JourLivreur
import com.speedfood.app.data.KtorActiviteApi
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorLivreurApi
import com.speedfood.app.data.LivreurApi
import com.speedfood.app.data.PageHistoriqueLivreur
import com.speedfood.app.data.PieceDossierLivreur
import com.speedfood.app.data.PosteFixe
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.courseEnCours
import com.speedfood.app.data.coursesSuivantes
import com.speedfood.app.data.gainAttenduGnf
import com.speedfood.app.data.libelleStatutLivreur
import com.speedfood.app.ui.EtatCompteLivreur
import com.speedfood.app.ui.EtatGainsLivreur
import com.speedfood.app.ui.LivreurCompteViewModel
import com.speedfood.app.ui.LivreurGainsViewModel
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
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * Espace livreur : la file des courses, les gains en direct, l'historique paginé, le rappel des documents manquants et le mode poste fixe.
 * Faux serveur en mémoire (MockEngine) ou fausse API : aucun réseau réel.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class LivreurEspaceTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    private fun session(connecte: Boolean = true): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "livreur@test.sf")))
        return SessionService(KtorAuthApi(client(MockEngine { respond("{}", HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
    }

    /** Fausse API livreur : chaque réponse est pilotable, une panne peut être injectée. */
    private class FausseApiLivreur : LivreurApi {
        var etatLivreur: EtatLivreur? = null
        var file: FileLivreur? = null
        var dossier: DossierLivreur? = null
        var page: PageHistoriqueLivreur? = null
        var panne: Boolean = false
        var pagesDemandees = mutableListOf<Int>()
        var enLigneAppele: Boolean? = null

        private fun <T> refuserSiPanne(): T? = if (panne) throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.") else null

        override suspend fun etat(jetonAcces: String): EtatLivreur? {
            refuserSiPanne<Unit>()
            return etatLivreur
        }

        override suspend fun enLigne(jetonAcces: String, enLigne: Boolean): String? {
            refuserSiPanne<Unit>()
            enLigneAppele = enLigne
            return null
        }

        override suspend fun position(jetonAcces: String, latitude: Double, longitude: Double): String? {
            refuserSiPanne<Unit>()
            return null
        }

        override suspend fun repondreOffre(jetonAcces: String, offreId: String, accepter: Boolean): String? {
            refuserSiPanne<Unit>()
            return null
        }

        override suspend fun avancer(jetonAcces: String, vers: String, code: String?, raison: String?): String? {
            refuserSiPanne<Unit>()
            return null
        }

        override suspend fun file(jetonAcces: String): FileLivreur? {
            refuserSiPanne<Unit>()
            return file
        }

        override suspend fun historique(jetonAcces: String, page: Int): PageHistoriqueLivreur? {
            refuserSiPanne<Unit>()
            pagesDemandees += page
            return this.page
        }

        override suspend fun dossier(jetonAcces: String): DossierLivreur? {
            refuserSiPanne<Unit>()
            return dossier
        }
    }

    /** Fausse API d'activité : les totaux du livreur. */
    private class FausseActivite : ActiviteApi {
        var bilan = GainsLivreur(
            aujourdhui = JourLivreur(courses = 3, fraisGnf = 28500),
            semaine = JourLivreur(courses = 14, fraisGnf = 131000),
        )

        override suspend fun restaurant(jetonAcces: String) = ActiviteRestaurant()

        override suspend fun livreur(jetonAcces: String): GainsLivreur? = bilan
    }

    private class PositionFausse : FournisseurPosition {
        override val disponible = true
        var ecranAllume = false
        override fun autorisee() = true
        override fun demanderAutorisation() = Unit
        override fun demarrer(surPosition: (Double, Double) -> Unit) = Unit
        override fun arreter() = Unit
        override fun garderEcranAllume(actif: Boolean) {
            ecranAllume = actif
        }
    }

    private fun etatLivreur(statut: String = "en_course", frais: Int = 9500) = EtatLivreur(
        livreur = FicheLivreur(id = "l1", nom = "Livreur Essai", statut = statut, vehicule = "Moto", cycle = "actif"),
        course = CourseLivreur(livraisonId = "c1", statut = "recuperee", commandeReference = "SF-1042", restaurantNom = "Maquis du Port (essai)", fraisGnf = frais),
    )

    private fun fileEssai() = FileLivreur(
        listOf(
            CourseLivreur(livraisonId = "c1", statut = "recuperee", commandeReference = "SF-1042", restaurantNom = "Maquis du Port (essai)", quartier = "Dixinn", fraisGnf = 9500),
            CourseLivreur(livraisonId = "c2", statut = "assignee", commandeReference = "SF-1043", restaurantNom = "Maquis du Port (essai)", quartier = "Kaporo", heurePrevue = "18:30", fraisGnf = 8000),
            CourseLivreur(livraisonId = "c3", statut = "assignee", commandeReference = "SF-1044", restaurantNom = "Grill du Centre (essai)", quartier = "Matam", heurePrevue = "19:00", fraisGnf = 7500),
        ),
    )

    // ─── La file ──────────────────────────────────────────────────────────────────────────────────────────────────────────

    @Test
    fun laFileMontreLaCourseEnCoursPuisLesSuivantes() {
        val etat = etatLivreur()
        val file = fileEssai()
        assertEquals("c1", courseEnCours(etat, file)?.livraisonId)
        assertEquals(9500, gainAttenduGnf(etat, file))
        assertEquals(listOf("c2", "c3"), coursesSuivantes(etat, file).map { it.livraisonId })
    }

    @Test
    fun laFileSertDeRepliQuandLEtatNAContientPasLaCourse() {
        val etat = EtatLivreur(livreur = FicheLivreur(id = "l1", nom = "Livreur Essai", statut = "en_course", cycle = "actif"))
        val file = fileEssai()
        assertEquals("c1", courseEnCours(etat, file)?.livraisonId, "sans course dans l'état, la file donne la course en cours")
        assertEquals(9500, gainAttenduGnf(etat, file))
        assertEquals(listOf("c2", "c3"), coursesSuivantes(etat, file).map { it.livraisonId })
    }

    @Test
    fun sansCourseLeGainAttenduEstZero() {
        val etat = EtatLivreur(livreur = FicheLivreur(id = "l1", nom = "Livreur Essai", statut = "disponible", cycle = "actif"))
        assertEquals(0, gainAttenduGnf(etat, null))
        assertEquals(0, gainAttenduGnf(etat, FileLivreur()))
    }

    @Test
    fun lesClesDeListesNeSeChevauchentPas() {
        // Deux courses sans identifiant ne doivent jamais partager la même clé : un LazyColumn planterait dessus.
        assertTrue(com.speedfood.app.data.cleCourseFile("", 0) != com.speedfood.app.data.cleCourseFile("", 1))
        assertTrue(com.speedfood.app.data.cleHistoriqueLivreur("", 0) != com.speedfood.app.data.cleHistoriqueLivreur("", 1))
        assertTrue(com.speedfood.app.data.clePieceDossier("", 0) != com.speedfood.app.data.clePieceDossier("", 1))
        assertTrue(com.speedfood.app.data.cleCourseFile("c1", 0).startsWith("file-"))
        assertTrue(com.speedfood.app.data.cleHistoriqueLivreur("l1", 0).startsWith("historique-"))
    }

    // ─── Le réseau ───────────────────────────────────────────────────────────────────────────────────────────

    @Test
    fun laFileSeLitDepuisLeServeur() = runTest {
        var chemin: String? = null
        val api = KtorLivreurApi(
            client(MockEngine { r ->
                chemin = r.url.encodedPath
                respond(
                    """{"ok":true,"file":{"cours":[
                        {"livraisonId":"c1","statut":"recuperee","commandeReference":"SF-1042","restaurantNom":"Maquis du Port (essai)","fraisGnf":9500,"quartier":"Dixinn"},
                        {"livraisonId":"c2","statut":"assignee","commandeReference":"SF-1043","restaurantNom":"Maquis du Port (essai)","fraisGnf":8000,"quartier":"Kaporo","heurePrevue":"18:30"}]}}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val file = api.file("acces")!!
        assertEquals("/api/v1/livreur/file", chemin)
        assertEquals(2, file.cours.size)
        assertEquals("Dixinn", file.cours[0].quartier)
        assertEquals("18:30", file.cours[1].heurePrevue)
        assertEquals(8000, file.cours[1].fraisGnf)
    }

    @Test
    fun laPaginationEnvoieLaPageDemandee() = runTest {
        var corps: String? = null
        val api = KtorLivreurApi(
            client(MockEngine { r ->
                corps = r.body.toByteArray().decodeToString()
                respond(
                    """{"ok":true,"historique":{"courses":[{"id":"l6","reference":"SF-1035","restaurantNom":"Grill du Centre (essai)","fraisGnf":8000,"livreeLe":"2026-10-23T18:40:00Z"}],"page":2,"pages":3}}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val page = api.historique("acces", 2)!!
        assertEquals(2, page.page)
        assertEquals(3, page.pages)
        assertTrue(page.suite, "il reste une page après la page 2")
        assertEquals("2", Json.parseToJsonElement(corps!!).jsonObject["page"]!!.jsonPrimitive.content)
    }

    @Test
    fun leDossierNeRenvoieQueDesEtats() = runTest {
        val api = KtorLivreurApi(
            client(MockEngine {
                respond(
                    """{"ok":true,"dossier":{"pieces":[
                        {"code":"piece_identite","libelle":"Pièce d'identité","statut":"manquant","explication":"Déposez-la sur le site Speedfood."},
                        {"code":"urgence","libelle":"Personne à prévenir en cas de problème","statut":"a_jour","explication":"C'est fait."}]}}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val dossier = api.dossier("acces")!!
        assertEquals(1, dossier.manquantes.size)
        assertEquals("Pièce d'identité", dossier.manquantes.single().libelle)
        assertTrue(dossier.resume().contains("Pièce d'identité"))
    }

    // ─── Les gains en direct ──────────────────────────────────────────────────────────────────────────────

    @Test
    fun leGainAttenduSuitLaCourseQuiChange() = runTest {
        val api = FausseApiLivreur()
        api.etatLivreur = etatLivreur(frais = 9500)
        api.file = fileEssai()
        api.page = PageHistoriqueLivreur(courses = listOf(CourseLivree("l1", "SF-1", "Chez Awa (essai)", 9500)), page = 1, pages = 1)
        val vm = LivreurGainsViewModel(session(), api, FausseActivite())
        assertEquals(9500, (vm.etat.value as EtatGainsLivreur.Pret).gainAttenduGnf)

        // La course change : le gain attendu doit changer aussi, sans rechargement manuel.
        api.etatLivreur = etatLivreur(frais = 12000)
        vm.rafraichirGain()
        val apres = vm.etat.value as EtatGainsLivreur.Pret
        assertEquals(12000, apres.gainAttenduGnf, "le gain suit la course en cours")
        assertTrue(apres.enCours)
        assertEquals(28500, apres.bilan.aujourdhui.fraisGnf, "les totaux ne bougent pas")
    }

    @Test
    fun laPaginationChargeLaPageSuivante() = runTest {
        val api = FausseApiLivreur()
        api.etatLivreur = etatLivreur()
        api.file = fileEssai()
        api.page = PageHistoriqueLivreur(courses = listOf(CourseLivree("l1", "SF-1", "Chez Awa (essai)", 9500)), page = 1, pages = 2)
        val vm = LivreurGainsViewModel(session(), api, FausseActivite())
        val premiere = vm.etat.value as EtatGainsLivreur.Pret
        assertEquals(1, premiere.historique.size)
        assertEquals(1, premiere.page)
        assertTrue(premiere.suite)

        api.page = PageHistoriqueLivreur(courses = listOf(CourseLivree("l2", "SF-2", "Grill du Centre (essai)", 8000)), page = 2, pages = 2)
        vm.chargerSuite()
        val apres = vm.etat.value as EtatGainsLivreur.Pret
        assertEquals(listOf(1, 2), api.pagesDemandees, "la page 2 est demandée au serveur")
        assertEquals(2, apres.historique.size, "la page 2 s'ajoute à l'historique")
        assertEquals(2, apres.page)
        assertFalse(apres.suite, "il n'y a plus de page après la dernière")
        assertFalse(apres.chargementSuite)
    }

    @Test
    fun unePanneGardeLesChiffresAffiches() = runTest {
        val api = FausseApiLivreur()
        api.etatLivreur = etatLivreur()
        api.file = fileEssai()
        api.page = PageHistoriqueLivreur(courses = listOf(CourseLivree("l1", "SF-1", "Chez Awa (essai)", 9500)), page = 1, pages = 1)
        val vm = LivreurGainsViewModel(session(), api, FausseActivite())
        assertEquals(28500, (vm.etat.value as EtatGainsLivreur.Pret).bilan.aujourdhui.fraisGnf)

        api.panne = true
        vm.charger()
        val apres = vm.etat.value as EtatGainsLivreur.Pret
        assertEquals(28500, apres.bilan.aujourdhui.fraisGnf, "les chiffres déjà affichés sont conservés")
        assertEquals(1, apres.historique.size, "l'historique déjà affiché est conservé")
        assertNotNull(apres.message, "la panne est expliquée")
        assertTrue(apres.message!!.contains("Impossible de joindre Speedfood"))
    }

    // ─── Le compte du livreur ──────────────────────────────────────────────────────────────────────────────

    @Test
    fun leDocumentManquantEstSignaleSansDivulguerLeDossier() = runTest {
        val api = FausseApiLivreur()
        api.etatLivreur = EtatLivreur(livreur = FicheLivreur(id = "l1", nom = "Livreur Essai", statut = "disponible", cycle = "actif"))
        api.dossier = DossierLivreur(
            pieces = listOf(
                PieceDossierLivreur("piece_identite", "Pièce d'identité", "manquant", "Déposez-la sur le site Speedfood."),
                PieceDossierLivreur("urgence", "Personne à prévenir en cas de problème", "a_jour", "C'est fait."),
            ),
        )
        val vm = LivreurCompteViewModel(session(), api, PosteFixe(PositionFausse(), StockageMemoire()))
        val etat = vm.etat.value as EtatCompteLivreur.Pret
        val dossier = etat.dossier!!
        assertEquals(1, dossier.manquantes.size, "une seule pièce manque")
        assertEquals("Pièce d'identité", dossier.manquantes.single().libelle)
        assertTrue(dossier.resume().contains("Il manque 1 pièce"))

        // Rien de ce que l'application montre ne peut contenir un document : le modèle ne porte qu'un état et une phrase.
        val serialise = Json.encodeToString(DossierLivreur.serializer(), dossier)
        assertFalse(serialise.contains("numero", ignoreCase = true), "aucun numéro de pièce dans l'application")
        assertFalse(serialise.contains("document", ignoreCase = true))
        assertFalse(serialise.contains("scan", ignoreCase = true))
        assertFalse(serialise.contains("photo", ignoreCase = true))
    }

    @Test
    fun unDossierCompletNeSignaleRien() {
        val dossier = DossierLivreur(pieces = listOf(PieceDossierLivreur("piece_identite", "Pièce d'identité", "a_jour", "C'est fait.")))
        assertTrue(dossier.manquantes.isEmpty())
        assertEquals("Votre dossier est complet.", dossier.resume())
    }

    @Test
    fun leStatutHorsLigneEstClair() = runTest {
        assertEquals("Hors ligne", libelleStatutLivreur("hors_ligne"))
        assertEquals("En ligne", libelleStatutLivreur("disponible"))
        assertEquals("En course", libelleStatutLivreur("en_course"))

        val api = FausseApiLivreur()
        api.etatLivreur = EtatLivreur(livreur = FicheLivreur(id = "l1", nom = "Livreur Essai", statut = "hors_ligne", cycle = "actif"))
        val vm = LivreurCompteViewModel(session(), api, PosteFixe(PositionFausse(), StockageMemoire()))
        val etat = vm.etat.value as EtatCompteLivreur.Pret
        assertEquals("hors_ligne", etat.etat.livreur.statut)
        assertEquals("Hors ligne", libelleStatutLivreur(etat.etat.livreur.statut))
    }

    @Test
    fun laMiseEnLignePasseParLeServeur() = runTest {
        val api = FausseApiLivreur()
        api.etatLivreur = EtatLivreur(livreur = FicheLivreur(id = "l1", nom = "Livreur Essai", statut = "hors_ligne", cycle = "actif"))
        val vm = LivreurCompteViewModel(session(), api, PosteFixe(PositionFausse(), StockageMemoire()))
        vm.basculer(true)
        assertEquals(true, api.enLigneAppele, "la mise en ligne part au serveur")
    }

    // ─── Le mode poste fixe ─────────────────────────────────────────────────────────────────────────────────

    @Test
    fun leModePosteFixeGardeLEcranAllumePendantLaLivraison() {
        val position = PositionFausse()
        val posteFixe = PosteFixe(position, StockageMemoire())
        posteFixe.majuter(suiviActif = false, livraisonEnCours = true)
        assertFalse(position.ecranAllume, "sans le mode poste fixe, l'écran suit le suivi de position")

        posteFixe.definir(true)
        assertTrue(position.ecranAllume, "en mode poste fixe, l'écran reste allumé pendant la livraison")

        posteFixe.majuter(suiviActif = false, livraisonEnCours = false)
        assertFalse(position.ecranAllume, "hors livraison, l'écran n'est plus forcé")

        posteFixe.majuter(suiviActif = true, livraisonEnCours = false)
        assertTrue(position.ecranAllume, "le suivi de position garde lui aussi l'écran allumé")
    }

    @Test
    fun leChoixDuModePosteFixeEstGardeSurLAppareil() {
        val stockage = StockageMemoire()
        val posteFixe = PosteFixe(PositionFausse(), stockage)
        posteFixe.definir(true)
        assertEquals("oui", stockage.lire(com.speedfood.app.data.CLE_POSTE_FIXE))
        val autre = PosteFixe(PositionFausse(), stockage)
        assertTrue(autre.actif.value, "le choix est retrouvé au redémarrage")
    }
}
