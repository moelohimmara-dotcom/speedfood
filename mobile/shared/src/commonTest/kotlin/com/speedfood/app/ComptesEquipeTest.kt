package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AffiliationRestaurantEquipe
import com.speedfood.app.data.CompteEquipe
import com.speedfood.app.data.ComptesEquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorComptesEquipeApi
import com.speedfood.app.data.ResultatComptesEquipe
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.TypeCompteEquipe
import com.speedfood.app.data.dateCourteEquipe
import com.speedfood.app.data.libelleAffiliationEquipe
import com.speedfood.app.data.libelleRoleSystemeEquipe
import com.speedfood.app.data.libellesAffiliationEquipe
import com.speedfood.app.data.resumeCompteEquipe
import com.speedfood.app.data.typeCompteEquipeValide
import com.speedfood.app.ui.ComptesEquipeViewModel
import com.speedfood.app.ui.EtatComptesEquipe
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

@OptIn(ExperimentalCoroutinesApi::class)
class ComptesEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorComptesEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    @Test
    fun lesComptesSeLisent() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"tronque":false,"comptes":[
                    {"utilisateurId":"u1","email":"a@exemple.gn","creeLe":"2026-10-22T08:00:00Z","roleSysteme":"super_admin","restaurants":[],"test":false},
                    {"utilisateurId":"u2","email":"b@exemple.gn","creeLe":"2026-10-20T15:00:00Z","roleSysteme":null,
                     "restaurants":[{"restaurantId":"r1","nom":"Chez Awa","role":"owner"}],"test":true}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val resultat = a.comptes("acces", "", TypeCompteEquipe.Tous)
        assertEquals(2, resultat.comptes.size)
        assertEquals("a@exemple.gn", resultat.comptes[0].email)
        assertEquals("super_admin", resultat.comptes[0].roleSysteme)
        assertEquals("Chez Awa", resultat.comptes[1].restaurants[0].nom)
        assertTrue(resultat.comptes[1].test)
        assertTrue(!resultat.tronque)
    }

    @Test
    fun laRechercheEtLeFiltreSontEnvoyesAuServeur() = runTest {
        var requete = ""
        val a = api(MockEngine { r ->
            requete = r.url.encodedQuery
            respond("""{"ok":true,"tronque":true,"comptes":[]}""", HttpStatusCode.OK, json)
        })
        val resultat = a.comptes("acces", "  a@exemple.gn  ", TypeCompteEquipe.Test)
        assertTrue(requete.contains("q=a%40exemple.gn"), "la recherche part au serveur : $requete")
        assertTrue(requete.contains("type=test"), "le filtre part au serveur : $requete")
        assertTrue(resultat.tronque, "une liste incomplète est signalée")
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.comptes("acces", "", TypeCompteEquipe.Tous) }
    }

    @Test
    fun uneConnexionImpossibleEstDitCommeTelle() = runTest {
        // Pas de réseau ou serveur injoignable : le message doit le dire, pas parler d'une « réponse illisible ».
        val a = api(MockEngine { throw IllegalStateException("connexion refusée") })
        val erreur = assertFailsWith<ErreurReseau> { a.comptes("acces", "", TypeCompteEquipe.Tous) }
        assertTrue(erreur.message!!.contains("Impossible de joindre Speedfood"), "message : ${erreur.message}")
    }

    @Test
    fun lesLibellesSontLisibles() {
        assertEquals("Super administrateur", libelleRoleSystemeEquipe("super_admin"))
        assertEquals("Opérations", libelleRoleSystemeEquipe("operations"))
        assertEquals("Support", libelleRoleSystemeEquipe("support"))
        assertEquals("lecture_seule", libelleRoleSystemeEquipe("lecture_seule"), "un rôle hors matrice est affiché tel quel")
        assertNull(libelleRoleSystemeEquipe(null))
        assertEquals("Propriétaire", libelleAffiliationEquipe("owner"))
        assertEquals("Équipier", libelleAffiliationEquipe("manager"))
        assertEquals(
            listOf("Propriétaire de Chez Awa", "Équipier de Maquis du Port"),
            libellesAffiliationEquipe(
                listOf(
                    AffiliationRestaurantEquipe("r1", "Chez Awa", "owner"),
                    AffiliationRestaurantEquipe("r2", "Maquis du Port", "manager"),
                ),
            ),
        )
    }

    @Test
    fun unFiltreInconnuRetombeSurTous() {
        assertEquals(TypeCompteEquipe.Tous, typeCompteEquipeValide("nimporte"))
        assertEquals(TypeCompteEquipe.Tous, typeCompteEquipeValide(null))
        assertEquals(TypeCompteEquipe.SansAffiliation, typeCompteEquipeValide("sans_affiliation"))
        assertEquals(TypeCompteEquipe.Test, typeCompteEquipeValide("test"))
    }

    @Test
    fun laDateDeCreationEstLisible() {
        assertEquals("22/10/2026", dateCourteEquipe("2026-10-22T08:00:00Z"))
        assertEquals("01/02/2026", dateCourteEquipe("2026-02-01"))
        assertEquals("pas une date", dateCourteEquipe("pas une date"), "une date illisible est renvoyée telle quelle")
    }

    @Test
    fun leResumeReunitRoleRestaurantsEtDate() {
        val compte = CompteEquipe(
            utilisateurId = "u2",
            email = "b@exemple.gn",
            creeLe = "2026-10-20T15:00:00Z",
            roleSysteme = "operations",
            restaurants = listOf(AffiliationRestaurantEquipe("r1", "Chez Awa", "owner")),
        )
        assertEquals("Opérations · Propriétaire de Chez Awa · 20/10/2026", resumeCompteEquipe(compte))
    }

    /** Faux serveur : l'annuaire, un compteur d'appels, et une panne au deuxième appel. */
    private class FausseApi : ComptesEquipeApi {
        var filtres = mutableListOf<Pair<String, TypeCompteEquipe>>()
        var appels = 0
        var panneAuDeuxiemeAppel = false
        override suspend fun comptes(jetonAcces: String, recherche: String, type: TypeCompteEquipe): ResultatComptesEquipe {
            appels++
            filtres += recherche to type
            if (panneAuDeuxiemeAppel && appels == 2) throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
            return ResultatComptesEquipe(listOf(CompteEquipe(utilisateurId = "u1", email = "a@exemple.gn")), false)
        }
    }

    private fun session(connecte: Boolean): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    @Test
    fun leFiltreEstPasseAuServeur() = runTest {
        val api = FausseApi()
        val vm = ComptesEquipeViewModel(session(true), api)
        val initial = vm.etat.value as EtatComptesEquipe.Pret
        assertEquals(TypeCompteEquipe.Tous, initial.filtre)
        vm.filtrer(TypeCompteEquipe.Test)
        assertEquals(TypeCompteEquipe.Test, (vm.etat.value as EtatComptesEquipe.Pret).filtre)
        assertEquals(2, api.appels, "le filtre déclenche un nouvel appel au serveur")
        assertEquals(TypeCompteEquipe.Test, api.filtres.last().second)
    }

    @Test
    fun laRechercheEstPasseeAuServeur() = runTest {
        val api = FausseApi()
        val vm = ComptesEquipeViewModel(session(true), api)
        vm.rechercher("a@exemple.gn")
        assertEquals("a@exemple.gn", (vm.etat.value as EtatComptesEquipe.Pret).recherche)
        assertEquals("a@exemple.gn", api.filtres.last().first)
        assertEquals(TypeCompteEquipe.Tous, api.filtres.last().second, "la recherche garde le filtre en cours")
    }

    @Test
    fun unRafraichissementNeEffacePasLeMessage() = runTest {
        val api = FausseApi()
        api.panneAuDeuxiemeAppel = true
        val vm = ComptesEquipeViewModel(session(true), api)
        vm.charger()
        val apresPanne = vm.etat.value as EtatComptesEquipe.Pret
        assertTrue(apresPanne.message != null, "la panne est expliquée à la personne")
        vm.charger()
        val apres = vm.etat.value as EtatComptesEquipe.Pret
        assertEquals(apresPanne.message, apres.message, "un rafraîchissement n'efface pas la confirmation")
    }
}
