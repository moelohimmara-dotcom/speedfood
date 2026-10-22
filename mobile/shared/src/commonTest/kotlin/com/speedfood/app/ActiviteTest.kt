package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorActiviteApi
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class ActiviteTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorActiviteApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @Test
    fun lActiviteDuRestaurantSeLitAvecLeJeton() = runTest {
        var autorisation: String? = null
        val a = api(MockEngine { r ->
            autorisation = r.headers[HttpHeaders.Authorization]
            respond(
                """{"ok":true,"aujourdhui":{"recues":4,"terminees":3,"chiffreGnf":120000},"semaine":{"recues":20,"terminees":16,"chiffreGnf":640000},
                    "repartition":{"recues":20,"terminees":16,"refusees":2,"annulees":1,"enCours":1},
                    "recentes":[{"reference":"SF-9","mode":"livraison","totalGnf":40000,"creeLe":"2026-10-22T10:00:00Z"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val r = a.restaurant("acces")
        assertEquals("Bearer acces", autorisation)
        assertEquals(120_000, r.aujourdhui.chiffreGnf)
        assertEquals(16, r.semaine.terminees)
        assertEquals(2, r.repartition.refusees)
        assertEquals("SF-9", r.recentes.single().reference)
    }

    @Test
    fun lesGainsDuLivreurEtLeCompteSansEspaceLivreur() = runTest {
        val g = api(MockEngine { respond("""{"ok":true,"gains":{"aujourdhui":{"courses":2,"fraisGnf":19000},"semaine":{"courses":9,"fraisGnf":85500},"recentes":[{"id":"l1","reference":"SF-1","restaurantNom":"Chez Awa","fraisGnf":9500,"livreeLe":"2026-10-22T09:00:00Z"}]}}""", HttpStatusCode.OK, json) }).livreur("acces")
        assertEquals(19_000, g!!.aujourdhui.fraisGnf)
        assertEquals("Chez Awa", g.recentes.single().restaurantNom)
        assertNull(api(MockEngine { respond("""{"ok":true,"gains":null}""", HttpStatusCode.OK, json) }).livreur("acces"), "pas un compte livreur")
    }

    @Test
    fun unAccesRefuseNEstPasUneCoupureDuReseau() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Ce compte n'est rattaché à aucun restaurant."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.restaurant("acces") }
    }
}
