package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.DemandePartenariatEquipe
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorPartenariatsEquipeApi
import com.speedfood.app.data.PartenariatsEquipeApi
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StatutPartenariatEquipe
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.aTraiterPartenariatEquipe
import com.speedfood.app.data.libelleFormePartenariatEquipe
import com.speedfood.app.data.libelleStatutPartenariatEquipe
import com.speedfood.app.data.statutsProposesPartenariatEquipe
import com.speedfood.app.ui.EtatPartenariatsEquipe
import com.speedfood.app.ui.PartenariatsEquipeViewModel
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
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class PartenariatsEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorPartenariatsEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    @Test
    fun lesDemandesSeLisent() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"partenariats":[{"id":"pa1","forme":"soutenir","organisation":"Association Kaloum","nomContact":"Fatou Camara",
                    "contactType":"email","contact":"contact@kaloum.test","message":"Nous soutenons Speedfood.","statut":"nouvelle","creeLe":"2026-10-22T08:00:00Z"},
                    {"id":"pa2","forme":"moyens","organisation":"Guinée Froid","nomContact":"Ibrahima Sylla","contactType":"telephone",
                    "contact":"+224622334455","message":"Nous fournissons la livraison.","statut":"en_cours","creeLe":"2026-10-20T15:00:00Z"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val liste = a.partenariats("acces")
        assertEquals(2, liste.size)
        assertEquals("Association Kaloum", liste[0].organisation)
        assertEquals("email", liste[0].contactType)
        assertEquals("nouvelle", liste[0].statut)
        assertEquals("telephone", liste[1].contactType)
    }

    @Test
    fun leChangementDeStatutEnvoieLeCodeDuServeur() = runTest {
        var corps: String? = null
        var chemin: String? = null
        val a = api(MockEngine { r ->
            chemin = r.url.encodedPath
            corps = r.body.toByteArray().decodeToString()
            respond("""{"ok":true,"message":"Statut enregistré."}""", HttpStatusCode.OK, json)
        })
        assertNull(a.changerStatut("acces", "pa1", StatutPartenariatEquipe.EnCours))
        assertEquals("/api/v1/equipe/partenariats/statut", chemin)
        val envoye = Json.parseToJsonElement(corps!!).jsonObject
        assertEquals("pa1", envoye["id"]!!.jsonPrimitive.content)
        assertEquals("en_cours", envoye["statut"]!!.jsonPrimitive.content)
        val refus = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Statut inconnu."}}""", HttpStatusCode.BadRequest, json) })
        assertTrue(a.changerStatut("acces", "pa1", StatutPartenariatEquipe.EnCours) == null)
        assertTrue(refus.changerStatut("acces", "pa1", StatutPartenariatEquipe.EnCours)!!.contains("Statut inconnu"))
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.partenariats("acces") }
    }

    @Test
    fun lesStatutsProposesExcluentLActuel() {
        assertEquals(
            listOf(StatutPartenariatEquipe.EnCours, StatutPartenariatEquipe.Traitee, StatutPartenariatEquipe.classee),
            statutsProposesPartenariatEquipe("nouvelle"),
        )
        assertFalse(statutsProposesPartenariatEquipe("classee").contains(StatutPartenariatEquipe.classee))
        assertTrue(aTraiterPartenariatEquipe("nouvelle"))
        assertFalse(aTraiterPartenariatEquipe("en_cours"))
        assertEquals("En cours", libelleStatutPartenariatEquipe("en_cours"))
        assertEquals("Soutenir la communauté", libelleFormePartenariatEquipe("soutenir"))
    }

    @Test
    fun uneDemandeSansStatutResteATraiter() {
        // Un serveur qui n'enverrait pas le statut ne doit pas faire disparaître la demande de la file.
        val d = DemandePartenariatEquipe(id = "pa3", organisation = "Fonds Jeune Guinée")
        assertEquals("", d.statut)
        assertFalse(aTraiterPartenariatEquipe(d.statut))
        assertTrue(statutsProposesPartenariatEquipe(d.statut).isNotEmpty())
    }

    /** Faux serveur : une demande, et le changement de statut toujours accepté. */
    private class FausseApi : PartenariatsEquipeApi {
        var changements = 0
        override suspend fun partenariats(jetonAcces: String) = listOf(DemandePartenariatEquipe(id = "pa1", organisation = "Association Kaloum", statut = "nouvelle"))
        override suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutPartenariatEquipe): String? {
            changements++
            return null
        }
    }

    private fun session(connecte: Boolean): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    @Test
    fun leChangementDeStatutEcritSurLeServeurEtConfirme() = runTest {
        val api = FausseApi()
        val vm = PartenariatsEquipeViewModel(session(true), api)
        vm.changerStatut("pa1", StatutPartenariatEquipe.EnCours)
        val apres = vm.etat.value as EtatPartenariatsEquipe.Pret
        assertEquals(1, api.changements, "le changement part au serveur")
        assertEquals("Statut enregistré : En cours.", apres.message, "la personne voit ce qui vient de se passer")
        vm.charger()
        assertEquals("Statut enregistré : En cours.", (vm.etat.value as EtatPartenariatsEquipe.Pret).message, "un rafraîchissement n'efface pas la confirmation")
    }
}
