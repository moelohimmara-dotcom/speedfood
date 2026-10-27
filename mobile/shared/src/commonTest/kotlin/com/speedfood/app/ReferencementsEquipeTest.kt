package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ChoixCreation
import com.speedfood.app.data.DemandeReferencement
import com.speedfood.app.data.peutCreerEtablissement
import com.speedfood.app.data.quartiersCorrespondants
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

    @Test
    fun uneCandidatureDeLApplicationSeLitAvecSonDossier() = runTest {
        val a = api(MockEngine {
            respond(
                """{"ok":true,"demandes":[{"id":"d1","type":"restaurant","organisation":"Chez Awa","statut":"creee","etablissementCree":true,"creeLe":"2026-10-22T09:00:00Z",
                    "candidature":{"horaires":"9h-22h","moyensPaiement":["especes","orange_money"],"services":["livraison"],"nombrePlats":12,"avecLogo":true,"avecPhoto":false,
                    "motifRefus":null,"compteRattachable":true,"compteRattache":false}}]}""",
                HttpStatusCode.OK, json,
            )
        })
        val c = a.demandes("acces").single().candidature!!
        assertEquals(12, c.nombrePlats)
        assertTrue(c.compteRattachable && !c.compteRattache)
        assertEquals(listOf("especes", "orange_money"), c.moyensPaiement)
        assertNull(api(MockEngine { respond("""{"ok":true,"demandes":[{"id":"d2","statut":"nouvelle"}]}""", HttpStatusCode.OK, json) }).demandes("acces").single().candidature, "demande du site : pas de dossier")
    }

    @Test
    fun leRefusEnvoieLeMotifEtLaCreationEnvoieCategorieEtQuartier() = runTest {
        val corps = mutableListOf<String>()
        val chemins = mutableListOf<String>()
        val a = api(MockEngine { r ->
            chemins += r.url.encodedPath
            corps += r.body.toByteArray().decodeToString()
            respond("""{"ok":true}""", HttpStatusCode.OK, json)
        })
        assertNull(a.changerStatut("acces", "d1", StatutDemande.Refusee, "  Photos floues  "))
        assertNull(a.changerStatut("acces", "d1", StatutDemande.Rappelee))
        assertNull(a.creerEtablissement("acces", "d1", "cat-1", "q-1"))
        assertNull(a.rattacherCompte("acces", "d1"))
        assertEquals("Photos floues", Json.parseToJsonElement(corps[0]).jsonObject["motif"]!!.jsonPrimitive.content, "le motif est envoyé sans espaces autour")
        assertFalse(Json.parseToJsonElement(corps[1]).jsonObject.containsKey("motif"), "pas de motif vide envoyé")
        val creation = Json.parseToJsonElement(corps[2]).jsonObject
        assertEquals("cat-1", creation["categorieId"]!!.jsonPrimitive.content)
        assertEquals("q-1", creation["quartierId"]!!.jsonPrimitive.content)
        assertTrue(chemins[2].endsWith("/creer-etablissement") && chemins[3].endsWith("/rattacher"))
    }

    @Test
    fun uneCreationRefuseeEtUneReponseIllisibleNeSontJamaisUnSucces() = runTest {
        val refus = api(MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Un établissement a déjà été créé pour cette demande."}}""", HttpStatusCode.BadRequest, json) })
        assertTrue(refus.creerEtablissement("acces", "d1", "c", "q")!!.contains("déjà été créé"))
        val illisible = api(MockEngine { respond("<html>oups</html>", HttpStatusCode.OK, json) })
        assertTrue(illisible.rattacherCompte("acces", "d1")!!.contains("illisible"))
    }

    @Test
    fun lesOptionsEtLesReglesDeCreation() = runTest {
        val a = api(MockEngine { respond("""{"ok":true,"categories":[{"id":"c1","nom":"Grillades"}],"quartiers":[{"id":"q1","nom":"Kipé","commune":"Ratoma"},{"id":"q2","nom":"Boulbinet","commune":"Kaloum"}]}""", HttpStatusCode.OK, json) })
        val o = a.options("acces")
        assertEquals("Grillades", o.categories.single().nom)
        assertEquals(listOf("Kipé"), quartiersCorrespondants(o.quartiers, "kip").map { it.nom })
        assertEquals(listOf("Boulbinet"), quartiersCorrespondants(o.quartiers, "KALOUM").map { it.nom }, "la commune compte aussi")
        assertTrue(quartiersCorrespondants(o.quartiers, "k").isEmpty(), "une seule lettre : pas de liste")
        assertTrue(peutCreerEtablissement(DemandeReferencement(statut = "accord")))
        assertFalse(peutCreerEtablissement(DemandeReferencement(statut = "refusee")), "refusée : à rouvrir d'abord")
        assertFalse(peutCreerEtablissement(DemandeReferencement(statut = "creee", etablissementCree = true)))
        assertEquals(ChoixCreation("c1", "Grillades"), o.categories.single())
    }
}
