package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.DemandeReferencement
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.KtorReferencementsEquipeApi
import com.speedfood.app.data.StatutDemande
import com.speedfood.app.data.aRappeler
import com.speedfood.app.data.libelleStatutDemande
import com.speedfood.app.data.statutsProposes
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

class ReferencementsEquipeTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun api(moteur: MockEngine) = KtorReferencementsEquipeApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)

    @Test
    fun lesStatutsProposesExcluentLActuelEtLaCreation() {
        val d = DemandeReferencement(id = "d1", statut = "rappelee")
        assertEquals(listOf(StatutDemande.Nouvelle, StatutDemande.VisitePrevue, StatutDemande.Accord, StatutDemande.Refusee), statutsProposes(d))
        assertTrue(statutsProposes(DemandeReferencement(id = "d2", statut = "creee", etablissementCree = true)).isEmpty(), "établissement créé : la demande ne change plus")
        assertTrue(aRappeler(DemandeReferencement(statut = "nouvelle")))
        assertFalse(aRappeler(d))
        assertEquals("Établissement créé", libelleStatutDemande("creee"))
        assertEquals("Accord signé", libelleStatutDemande("accord"))
    }

    @Test
    fun lesDemandesSeLisent() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"demandes":[{"id":"d1","type":"restaurant","organisation":"Chez Awa","commune":"Kaloum","quartier":"Boulbinet","categories":"Grillades","responsable":"Awa Camara",
                    "telephone":"+224 622 00 00 01","statut":"nouvelle","etablissementCree":false,"creeLe":"2026-10-22T09:00:00Z"}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val d = a.demandes("acces").single()
        assertEquals("Chez Awa", d.organisation)
        assertEquals("nouvelle", d.statut)
        assertNull(d.indications)
    }

    @Test
    fun leChangementDeStatutEnvoieLeCodeDuServeur() = runTest {
        var corps: String? = null
        val a = api(MockEngine { r ->
            corps = r.body.toByteArray().decodeToString()
            respond("""{"ok":true,"message":"Statut enregistré."}""", HttpStatusCode.OK, json)
        })
        assertNull(a.changerStatut("acces", "d1", StatutDemande.VisitePrevue))
        val envoye = Json.parseToJsonElement(corps!!).jsonObject
        assertEquals("d1", envoye["id"]!!.jsonPrimitive.content)
        assertEquals("visite_prevue", envoye["statut"]!!.jsonPrimitive.content)
        val refus = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Cette demande n'existe plus ou son établissement est déjà créé."}}""", HttpStatusCode.BadRequest, json) })
        assertTrue(refus.changerStatut("acces", "d1", StatutDemande.Accord)!!.contains("déjà créé"))
    }

    @Test
    fun unAccesRefuseEstUneErreurDAcces() = runTest {
        val a = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"NON_AUTORISE","message":"Cet espace est réservé à l'équipe Speedfood."}}""", HttpStatusCode.Forbidden, json) })
        assertFailsWith<ErreurAcces> { a.demandes("acces") }
    }
}
