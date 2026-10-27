package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorHistoriqueRestaurateurApi
import com.speedfood.app.data.erreurTechnique
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Une erreur dit la vérité : une vraie coupure parle de connexion, une réponse inutilisable du serveur n'en parle pas, une annulation n'est pas une erreur. */
class ErreurTechniqueTest {
    @Test
    fun uneCoupureParleDeConnexionEtUneReponseInutilisableNon() {
        assertTrue(erreurTechnique(IllegalStateException("connexion refusée")).message!!.contains("Vérifiez votre connexion"))
        val inattendue = erreurTechnique(SerializationException("json"))
        assertFalse(inattendue.message!!.contains("connexion"), "message : ${inattendue.message}")
        assertTrue(inattendue.message!!.contains("inattendue"))
    }

    @Test
    fun uneAnnulationEstRelanceeEtNonTransformeeEnErreur() {
        assertFailsWith<CancellationException> { erreurTechnique(CancellationException("écran quitté")) }
    }

    @Test
    fun unePageDErreurDuServeurNeDitPasDeVerifierLaConnexion() = runTest {
        val config = SpeedfoodConfig("https://exemple.supabase.co", "cle", "https://exemple.test")
        val api = KtorHistoriqueRestaurateurApi(
            HttpClient(MockEngine { respond("<html>Not found</html>", HttpStatusCode.NotFound, headersOf(HttpHeaders.ContentType, "text/html")) }) {
                install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
            },
            config,
        )
        val erreur = assertFailsWith<com.speedfood.app.data.ErreurReseau> { api.historique("acces", 1, 20) }
        assertFalse(erreur.message!!.contains("Vérifiez votre connexion"), "message : ${erreur.message}")
    }
}
