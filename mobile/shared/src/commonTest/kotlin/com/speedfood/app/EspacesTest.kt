package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorMoiApi
import com.speedfood.app.data.MoiApi
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
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class EspacesTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private class FausseApi(var roles: RolesCompte?) : MoiApi {
        override suspend fun roles(jetonAcces: String) = roles
    }

    private fun session(stockage: StockageMemoire, connecte: Boolean): SessionService {
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(client(MockEngine { respond("{}", HttpStatusCode.OK, json) }), config) { 0L }, stockage) { 0L }
    }

    private fun service(stockage: StockageMemoire, session: SessionService, api: MoiApi) = EspaceService(session, api, stockage, CoroutineScope(UnconfinedTestDispatcher()))

    @Test
    fun unClientOrdinaireNaAucunEspacePro() {
        val aucun = RolesCompte()
        assertFalse(aucun.aUnEspacePro)
        assertTrue(aucun.espacesPro.isEmpty())
        assertTrue(aucun.autorise(Espace.Client))
        assertFalse(aucun.autorise(Espace.Equipe))
        val pro = RolesCompte(restaurateur = RoleRestaurateur("Chez Awa"), equipe = "support")
        assertEquals(listOf(Espace.Restaurateur, Espace.Equipe), pro.espacesPro)
        assertFalse(pro.autorise(Espace.Livreur))
    }

    @Test
    fun lesDroitsSeLisentSurLeServeurSansRienInventer() = runTest {
        val moteur = MockEngine { respond("""{"ok":true,"roles":{"restaurateur":{"restaurant":"Chez Awa"},"livreur":false,"equipe":null}}""", HttpStatusCode.OK, json) }
        val roles = KtorMoiApi(client(moteur), config).roles("jeton")
        assertEquals("Chez Awa", roles!!.restaurateur!!.restaurant)
        assertFalse(roles.livreur)
        assertNull(roles.equipe)
        assertNull(KtorMoiApi(client(MockEngine { respond("oops", HttpStatusCode.ServiceUnavailable, json) }), config).roles("jeton"), "serveur muet : droits inconnus, pas d'espace inventé")
    }

    @Test
    fun onNEntreQueDansUnEspaceAuquelOnADroit() {
        val stockage = StockageMemoire()
        val s = service(stockage, session(stockage, true), FausseApi(RolesCompte(livreur = true)))
        assertEquals(Espace.Client, s.espace.value)
        s.entrer(Espace.Equipe)
        assertEquals(Espace.Client, s.espace.value, "pas de rôle équipe : refus")
        s.entrer(Espace.Livreur)
        assertEquals(Espace.Livreur, s.espace.value)
        assertEquals("livreur", stockage.lire("espace_actif"))
        s.quitter()
        assertEquals(Espace.Client, s.espace.value)
        assertNull(stockage.lire("espace_actif"))
    }

    @Test
    fun auDemarrageOnReprendSonEspaceMaisUnDroitPerduRamenneAuClient() {
        val stockage = StockageMemoire()
        stockage.ecrire("espace_actif", "restaurateur")
        val avecDroit = service(stockage, session(stockage, true), FausseApi(RolesCompte(restaurateur = RoleRestaurateur())))
        assertEquals(Espace.Restaurateur, avecDroit.espace.value)

        val sansDroit = service(stockage, session(stockage, true), FausseApi(RolesCompte()))
        assertEquals(Espace.Client, sansDroit.espace.value, "le droit a été retiré : retour au client")
        assertNull(stockage.lire("espace_actif"))
    }

    @Test
    fun sansComptePersonneNEstDansUnEspacePro() {
        val stockage = StockageMemoire()
        stockage.ecrire("espace_actif", "equipe")
        val s = service(stockage, session(stockage, false), FausseApi(RolesCompte(equipe = "super_admin")))
        assertEquals(Espace.Client, s.espace.value)
        assertNull(s.roles.value)
    }
}
