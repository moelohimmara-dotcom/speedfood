package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.DecisionAvis
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorAvisEquipeApi
import com.speedfood.app.data.controleDecision
import com.speedfood.app.data.decisionsPossibles
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
import kotlin.test.assertNull
import kotlin.test.assertTrue

class AvisEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorAvisEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @Test
    fun lesDecisionsDependentDeLEtatDeLAvis() {
        assertEquals(listOf(DecisionAvis.MasquerCommentaire, DecisionAvis.AnnulerNote, DecisionAvis.ClasserSansSuite), decisionsPossibles("publie"))
        assertEquals(listOf(DecisionAvis.Retablir, DecisionAvis.ClasserSansSuite), decisionsPossibles("annule"))
        assertEquals(listOf(DecisionAvis.Retablir, DecisionAvis.ClasserSansSuite), decisionsPossibles("commentaire_masque"))
    }

    @Test
    fun retirerUnContenuPublicExigeUnMotif() {
        assertEquals("Indiquez le motif (5 caractères au moins).", controleDecision(DecisionAvis.MasquerCommentaire, "  nul "))
        assertNull(controleDecision(DecisionAvis.MasquerCommentaire, "propos injurieux"))
        assertNull(controleDecision(DecisionAvis.Retablir, ""), "rétablir ou classer sans suite : motif facultatif")
        assertNull(controleDecision(DecisionAvis.ClasserSansSuite, ""))
    }

    @Test
    fun lesSignalementsEtLesAlertesSeLisent() = runTest {
        var autorisation: String? = null
        val a = api(MockEngine { r ->
            autorisation = r.headers[HttpHeaders.Authorization]
            respond(
                """{"ok":true,"signalements":[{"id":"s1","avisId":"a1","motif":"insultes","date":"2026-10-22T09:00:00Z","restaurantNom":"Chez Awa","note":1,"commentaire":"nul","statutAvis":"publie"}],
                    "alertes":[{"type":"livreur_trois_mauvaises","cible":"Mamadou","detail":"3 notes de 2 ou moins"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val r = a.avis("acces")
        assertEquals("Bearer acces", autorisation)
        assertEquals("a1", r.signalements.single().avisId)
        assertEquals("livreur_trois_mauvaises", r.alertes.single().type)
    }

    @Test
    fun uneDecisionEnvoieLeCodeDuServeurEtLeMotif() = runTest {
        var corps: String? = null
        val a = api(MockEngine { r ->
            corps = r.body.toByteArray().decodeToString()
            if (corps!!.contains("annuler_note") && !corps!!.contains("\"motif\":\"\"")) respond("""{"ok":true,"message":"Décision enregistrée."}""", HttpStatusCode.OK, json)
            else respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Indiquez le motif (5 caractères au moins)."}}""", HttpStatusCode.BadRequest, json)
        })
        assertNull(a.moderer("acces", "a1", DecisionAvis.AnnulerNote, "  propos injurieux  "))
        val envoye = Json.parseToJsonElement(corps!!).jsonObject
        assertEquals("annuler_note", envoye["action"]!!.jsonPrimitive.content)
        assertEquals("propos injurieux", envoye["motif"]!!.jsonPrimitive.content)
        assertTrue(a.moderer("acces", "a1", DecisionAvis.AnnulerNote, "")!!.contains("motif"))
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.avis("acces") }
    }
}
