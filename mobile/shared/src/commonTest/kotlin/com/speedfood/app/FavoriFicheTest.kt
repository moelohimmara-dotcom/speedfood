package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ClientApi
import com.speedfood.app.data.EspaceClient
import com.speedfood.app.data.FavoriClient
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.RetourClient
import com.speedfood.app.data.Session
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.ui.FavoriRestaurantViewModel
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
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

@OptIn(ExperimentalCoroutinesApi::class)
class FavoriFicheTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    @BeforeTest
    fun avant() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @AfterTest
    fun apres() = Dispatchers.resetMain()

    private class FausseApi(var favoris: List<String>) : ClientApi {
        var bascules = 0
        override suspend fun espace(jetonAcces: String) = EspaceClient(null, emptyList(), favoris.map { FavoriClient(it, "R", true) }, emptyList())
        override suspend fun profil(jetonAcces: String, champs: Map<String, Any?>) = RetourClient(true, "")
        override suspend fun adresse(jetonAcces: String, action: String, champs: Map<String, String>) = RetourClient(true, "")
        override suspend fun basculerFavori(jetonAcces: String, restaurantId: String): RetourClient {
            bascules++
            val present = restaurantId in favoris
            favoris = if (present) favoris - restaurantId else favoris + restaurantId
            return RetourClient(true, if (present) "Favori retiré." else "Favori enregistré.", !present)
        }
        override suspend fun supprimerCompte(jetonAcces: String, confirmation: String) = RetourClient(true, "")
    }

    private fun session(connecte: Boolean): SessionService {
        val stockage = StockageMemoire()
        if (connecte) stockage.ecrire(SessionService.CLE, Json.encodeToString(Session.serializer(), Session("acces", "renouv", 9_999_999_999L, "u1", "a@b.test")))
        return SessionService(KtorAuthApi(HttpClient(MockEngine { respond("{}", HttpStatusCode.OK, json) }) { install(ContentNegotiation) { json() } }, config) { 0L }, stockage) { 0L }
    }

    @Test
    fun leCoeurLitLEtatDuCompteEtBasculeSurLeServeur() = runTest {
        val api = FausseApi(favoris = listOf("r1"))
        val vm = FavoriRestaurantViewModel(session(true), api, "r1")
        assertEquals(true, vm.favori.value, "r1 est déjà dans les favoris du compte")
        assertTrue(vm.basculer())
        assertEquals(false, vm.favori.value)
        assertEquals("Favori retiré.", vm.message.value)
        assertTrue(vm.basculer())
        assertEquals(true, vm.favori.value)
        assertEquals(2, api.bascules)
    }

    @Test
    fun sansCompteLAppuiDemandeLaConnexionEtNAppelleRien() = runTest {
        val api = FausseApi(favoris = emptyList())
        val vm = FavoriRestaurantViewModel(session(false), api, "r1")
        assertNull(vm.favori.value)
        assertFalse(vm.basculer(), "faux : l'écran ouvre la connexion")
        assertEquals(0, api.bascules)
    }
}
