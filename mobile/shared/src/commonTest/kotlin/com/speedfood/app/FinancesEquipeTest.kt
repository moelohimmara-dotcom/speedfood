package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.KtorFinancesEquipeApi
import com.speedfood.app.data.cleLigneFinanceEquipe
import com.speedfood.app.data.libelleStatutVersementFinance
import com.speedfood.app.data.tauxFinanceAffiche
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
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class FinancesEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val entetes = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorFinancesEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @Test
    fun lesFinancesSontLuesEnGetSansEcriture() = runTest {
        var methode = ""
        var chemin = ""
        val finances = api(MockEngine { requete ->
            methode = requete.method.value
            chemin = requete.url.encodedPath
            respond(
                """{"ok":true,"parametres":{"tauxDefaut":0.1,"rythme":"hebdomadaire","devise":"GNF"},"contrats":[{"etablissementId":"r1","etablissementNom":"Chez Awa","taux":0.1,"effectifLe":"2026-10-01T00:00:00Z"}],"releve":[{"etablissementId":"r1","etablissementNom":"Chez Awa","ventesGnf":30000,"commissionGnf":3000,"fraisLivraisonGnf":5000,"remboursementsGnf":0,"netAReverserGnf":32000,"taux":0.1,"effectifLe":"2026-10-01T00:00:00Z","versement":{"statut":"a_verser","reference":null}}]}""",
                HttpStatusCode.OK, entetes,
            )
        }).finances("jeton")
        assertEquals("GET", methode)
        assertEquals("/api/v1/equipe/finances", chemin)
        assertEquals("Chez Awa", finances.releve.single().etablissementNom)
        assertEquals("releve-r1", cleLigneFinanceEquipe("r1"))
    }

    @Test
    fun refus401403EstUneErreurDAcces() = runTest {
        val api = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Accès refusé."}}""", HttpStatusCode.Forbidden, entetes) })
        assertFailsWith<ErreurAcces> { api.finances("jeton") }
    }

    @Test
    fun reponseIllisibleEstDistincte() = runTest {
        val api = api(MockEngine { respond("ceci n'est pas du json", HttpStatusCode.OK, entetes) })
        val erreur = assertFailsWith<ErreurReseau> { api.finances("jeton") }
        assertContains(erreur.message.orEmpty(), "réponse de Speedfood est illisible")
    }

    @Test
    fun panneDeConnexionNeMentPasSurUneReponseIllisible() = runTest {
        val api = api(MockEngine { error("connexion coupée") })
        val erreur = assertFailsWith<ErreurReseau> { api.finances("jeton") }
        assertContains(erreur.message.orEmpty(), "Impossible de joindre Speedfood")
    }

    @Test
    fun libellesEtTauxSignalentLeModeDeveloppement() {
        assertEquals("À verser", libelleStatutVersementFinance("a_verser"))
        assertEquals("Versé", libelleStatutVersementFinance("verse"))
        assertEquals("10 % (développement)", tauxFinanceAffiche(0.10))
    }
}
