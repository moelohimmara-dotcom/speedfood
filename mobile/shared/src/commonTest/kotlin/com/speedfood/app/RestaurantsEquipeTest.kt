package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorRestaurantsEquipeApi
import com.speedfood.app.data.RestaurantEquipe
import com.speedfood.app.data.aNumeroAJoindre
import com.speedfood.app.data.libelleEtatPlat
import com.speedfood.app.data.visibleParLesClients
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.engine.mock.toByteArray
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class RestaurantsEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorRestaurantsEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @Test
    fun lesEtablissementsSeLisent() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"restaurants":[{"id":"r1","nom":"Chez Awa","categorie":"Grillades","quartier":"Boulbinet","publie":true,"ouvert":true,"suspendu":false,
                    "motifCorrection":null,"modeVente":"speedfood","horaires":"08h-22h","consignes":"Appeler avant","telephoneCommandes":"+224622000001",
                    "plats":3,"platsDisponibles":2}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val r = a.restaurants("acces").single()
        assertEquals("Chez Awa", r.nom)
        assertEquals("speedfood", r.modeVente)
        assertEquals(3, r.plats)
        assertEquals(2, r.platsDisponibles)
        assertTrue(visibleParLesClients(r))
        assertTrue(aNumeroAJoindre(r))
    }

    @Test
    fun laFicheDonneLeMenuEtLEtatDeChaquePlat() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"restaurant":{"id":"r1","nom":"Chez Awa","categorie":"Grillades","quartier":"Boulbinet","publie":false,"ouvert":false,
                    "suspendu":true,"motifCorrection":"Coordonnées à corriger","modeVente":"autonome","horaires":"","consignes":"","telephoneCommandes":null,
                    "plats":2,"platsDisponibles":0,"platsDetail":[
                    {"id":"p1","nom":"Poulet yassa","prix":6500,"disponible":true,"etat":"disponible"},
                    {"id":"p2","nom":"Riz gras","prix":4000,"disponible":false,"etat":"epuise"}]}}""",
                HttpStatusCode.OK, json,
            )
        })
        val r = a.fiche("acces", "r1")
        assertEquals(2, r.platsDetail.size)
        assertEquals("disponible", r.platsDetail[0].etat)
        assertEquals(6500, r.platsDetail[0].prix)
        assertFalse(visibleParLesClients(r), "suspendu : invisible par les clients")
        assertFalse(aNumeroAJoindre(r))
        assertEquals("Épuisé", libelleEtatPlat("epuise"))
        assertEquals("À confirmer", libelleEtatPlat("a_confirmer"))
    }

    @Test
    fun laModificationEnvoieLesHorairesEtLeNumero() = runTest {
        var corps: String? = null
        var chemin: String? = null
        val a = api(MockEngine { r ->
            chemin = r.url.encodedPath
            corps = r.body.toByteArray().decodeToString()
            respond("""{"ok":true,"message":"Horaires et numéro à joindre enregistrés."}""", HttpStatusCode.OK, json)
        })
        assertNull(a.enregistrerProfil("acces", "r1", "08h-22h", "+224622000001"))
        assertEquals("/api/v1/equipe/restaurants/r1/profil", chemin)
        val envoye = Json.parseToJsonElement(corps!!).jsonObject
        assertEquals("08h-22h", envoye["horaires"]!!.jsonPrimitive.content)
        assertEquals("+224622000001", envoye["telephone"]!!.jsonPrimitive.content)
    }

    @Test
    fun uneValidationRefuseeEstRemonteeEnClair() = runTest {
        val a = api(MockEngine {
            respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Renseignez les horaires avant d'enregistrer."}}""", HttpStatusCode.BadRequest, json)
        })
        assertTrue(a.enregistrerProfil("acces", "r1", "", "")!!.contains("horaires"))
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.restaurants("acces") }
        assertFailsWith<ErreurAcces> { a.fiche("acces", "r1") }
    }

    @Test
    fun unEtablissementNonVisibleEstSignale() {
        val suspendu = RestaurantEquipe(id = "r2", publie = true, suspendu = true)
        val nonPublie = RestaurantEquipe(id = "r3", publie = false, suspendu = false)
        assertFalse(visibleParLesClients(suspendu))
        assertFalse(visibleParLesClients(nonPublie))
        assertTrue(visibleParLesClients(RestaurantEquipe(id = "r4", publie = true, suspendu = false)))
    }
}
