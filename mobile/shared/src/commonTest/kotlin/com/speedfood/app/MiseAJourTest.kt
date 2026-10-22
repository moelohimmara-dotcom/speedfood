package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorVersionApi
import com.speedfood.app.data.NotificateurMiseAJour
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.SuiviMiseAJour
import com.speedfood.app.data.VersionApi
import com.speedfood.app.data.VersionPubliee
import com.speedfood.app.data.miseAJourDisponible
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
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MiseAJourTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test/")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private val v10 = VersionPubliee(10, "2.8.0", "Notes", false)

    private class FausseApi(var version: VersionPubliee?) : VersionApi {
        override suspend fun derniere() = version
    }

    private class Espion : NotificateurMiseAJour {
        val vues = mutableListOf<Pair<Int, String>>()
        override fun notifier(version: VersionPubliee, urlTelechargement: String) {
            vues += version.code to urlTelechargement
        }
    }

    @Test
    fun disponibleSeulementSiPlusRecente() {
        assertTrue(miseAJourDisponible(9, v10))
        assertFalse(miseAJourDisponible(10, v10))
        assertFalse(miseAJourDisponible(11, v10))
        assertFalse(miseAJourDisponible(0, v10), "numéro installé inconnu : pas d'invitation")
        assertFalse(miseAJourDisponible(9, null))
    }

    @Test
    fun proposeEtNotifieUneSeuleFoisParVersion() = runTest {
        val espion = Espion()
        val suivi = SuiviMiseAJour(FausseApi(v10), StockageMemoire(), 9, espion, config)
        assertEquals(v10, suivi.verifier())
        assertEquals(v10, suivi.verifier())
        assertEquals(listOf(10 to "https://exemple.test/installer"), espion.vues)
    }

    @Test
    fun aJourOuHorsLigneNeProposeRien() = runTest {
        val espion = Espion()
        assertNull(SuiviMiseAJour(FausseApi(v10), StockageMemoire(), 10, espion, config).verifier())
        assertNull(SuiviMiseAJour(FausseApi(null), StockageMemoire(), 9, espion, config).verifier())
        assertTrue(espion.vues.isEmpty())
    }

    @Test
    fun plusTardMasqueCetteVersionMaisPasLaSuivante() = runTest {
        val api = FausseApi(v10)
        val suivi = SuiviMiseAJour(api, StockageMemoire(), 9, Espion(), config)
        suivi.reporter(suivi.verifier()!!)
        assertNull(suivi.verifier())
        api.version = VersionPubliee(11, "2.9.0")
        assertEquals(11, suivi.verifier()?.code)
    }

    @Test
    fun versionObligatoireNePeutPasEtreReportee() = runTest {
        val obligatoire = VersionPubliee(10, "2.8.0", "Correctif de sécurité", true)
        val suivi = SuiviMiseAJour(FausseApi(obligatoire), StockageMemoire(), 9, Espion(), config)
        suivi.reporter(obligatoire)
        assertEquals(obligatoire, suivi.verifier())
    }

    @Test
    fun lectureDeLaRoutePublique() = runTest {
        val corps = """{"ok":true,"version":{"code":10,"nom":"2.8.0","notes":"Notes","obligatoire":false}}"""
        var chemin = ""
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            respond(corps, HttpStatusCode.OK, json)
        }
        val client = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }
        assertEquals(v10, KtorVersionApi(client, config).derniere())
        assertEquals("/api/v1/version", chemin)
        val panne = HttpClient(MockEngine { respond("oups", HttpStatusCode.InternalServerError, json) }) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }
        assertNull(KtorVersionApi(panne, config).derniere())
    }
}
