package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorListeAttenteEquipeApi
import com.speedfood.app.data.ListeAttenteEquipeApi
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.ZoneAttenteEquipe
import com.speedfood.app.data.libelleNiveauAttenteEquipe
import com.speedfood.app.data.nonPrevenuesEquipe
import com.speedfood.app.data.resumeZoneAttenteEquipe
import com.speedfood.app.data.zoneAMarquerPrevenueEquipe
import com.speedfood.app.ui.EtatListeAttenteEquipe
import com.speedfood.app.ui.ListeAttenteEquipeViewModel
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
class ListeAttenteEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorListeAttenteEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    @Test
    fun lesZonesSeLisent() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"zones":[{"niveau":"commune","id":"z1","nom":"Ratoma","contexte":"Conakry","personnes":12,"prevenues":5,"derniere":"2026-10-20T18:00:00Z"},
                    {"niveau":"region","id":"z2","nom":"Kindia","contexte":"Guinée","personnes":3,"prevenues":0,"derniere":"2026-10-19T09:00:00Z"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val zones = a.zones("acces")
        assertEquals(2, zones.size)
        assertEquals("commune", zones[0].niveau)
        assertEquals("Ratoma", zones[0].nom)
        assertEquals(12, zones[0].personnes)
        assertEquals(5, zones[0].prevenues)
        assertEquals("Kindia", zones[1].nom)
    }

    @Test
    fun leMarquageEnvoieLeNiveauEtLIdentifiant() = runTest {
        var corps: String? = null
        var chemin: String? = null
        val a = api(MockEngine { r ->
            chemin = r.url.encodedPath
            corps = r.body.toByteArray().decodeToString()
            respond("""{"ok":true,"message":"Zone marquée."}""", HttpStatusCode.OK, json)
        })
        assertNull(a.marquerPrevenue("acces", "commune", "z1"))
        assertEquals("/api/v1/equipe/liste-attente/prevenue", chemin)
        val envoye = Json.parseToJsonElement(corps!!).jsonObject
        assertEquals("commune", envoye["niveau"]!!.jsonPrimitive.content)
        assertEquals("z1", envoye["id"]!!.jsonPrimitive.content)
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.zones("acces") }
    }

    @Test
    fun leRefusDuServeurRenvoieLeMessageLisible() = runTest {
        val refus = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Cette zone est déjà prévenue."}}""", HttpStatusCode.BadRequest, json) })
        assertTrue(refus.marquerPrevenue("acces", "commune", "z1")!!.contains("déjà prévenue"))
    }

    @Test
    fun lesNiveauxOntUnLibelleEtUnCompte() {
        assertEquals("Région", libelleNiveauAttenteEquipe("region"))
        assertEquals("Préfecture", libelleNiveauAttenteEquipe("prefecture"))
        assertEquals("Commune", libelleNiveauAttenteEquipe("commune"))
        assertEquals("Quartier", libelleNiveauAttenteEquipe("quartier"))
        assertEquals(7, nonPrevenuesEquipe(12, 5))
        assertTrue(zoneAMarquerPrevenueEquipe(12, 5))
        assertFalse(zoneAMarquerPrevenueEquipe(5, 5))
    }

    @Test
    fun uneZoneSansCompteNeRestePasMarquable() {
        // Une zone vide (serveur qui n'envoie pas les compteurs) ne doit pas proposer une action sans effet.
        val z = ZoneAttenteEquipe(niveau = "commune", id = "z9", nom = "Matoto")
        assertEquals(0, z.personnes)
        assertEquals(0, z.prevenues)
        assertEquals(0, nonPrevenuesEquipe(z.personnes, z.prevenues))
        assertFalse(zoneAMarquerPrevenueEquipe(z.personnes, z.prevenues))
    }

    @Test
    fun uneZoneEntierementPrevenueEstExpliquee() {
        // Bouton inactif + phrase d'état : sans cela, l'écran montrait un bouton qui semble actif et ne fait rien.
        assertEquals("8 personne(s) pas encore prévenue(s).", resumeZoneAttenteEquipe(12, 4))
        assertTrue(zoneAMarquerPrevenueEquipe(12, 4))
        assertEquals("Toutes les personnes de cette zone ont été prévenues.", resumeZoneAttenteEquipe(3, 3))
        assertFalse(zoneAMarquerPrevenueEquipe(3, 3))
        assertEquals("Personne n'attend dans cette zone.", resumeZoneAttenteEquipe(0, 0))
    }

    /** Faux serveur : une zone, et le marquage toujours accepté. */
    private class FausseApi : ListeAttenteEquipeApi {
        var marques = 0
        override suspend fun zones(jetonAcces: String) = listOf(ZoneAttenteEquipe(niveau = "commune", id = "z1", nom = "Ratoma", personnes = 7, prevenues = 0))
        override suspend fun marquerPrevenue(jetonAcces: String, niveau: String, id: String): String? {
            marques++
            return null
        }
    }

    private fun session(connecte: Boolean): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    @Test
    fun leMarquageEcritSurLeServeurEtConfirme() = runTest {
        val api = FausseApi()
        val vm = ListeAttenteEquipeViewModel(session(true), api)
        assertEquals(1, (vm.etat.value as EtatListeAttenteEquipe.Pret).zones.size)
        vm.marquerPrevenue("commune", "z1")
        val apres = vm.etat.value as EtatListeAttenteEquipe.Pret
        assertEquals(1, api.marques, "le marquage part au serveur")
        assertEquals("Zone marquée comme prévenue.", apres.message, "la personne voit ce qui vient de se passer")
    }

    @Test
    fun unRafraichissementNeEffacePasLaConfirmation() = runTest {
        val vm = ListeAttenteEquipeViewModel(session(true), FausseApi())
        vm.marquerPrevenue("commune", "z1")
        vm.charger()
        assertEquals("Zone marquée comme prévenue.", (vm.etat.value as EtatListeAttenteEquipe.Pret).message)
    }
}
