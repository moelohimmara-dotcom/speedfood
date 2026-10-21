package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.ActionPaiement
import com.speedfood.app.data.CommandeRestaurateur
import com.speedfood.app.data.DocumentsCommande
import com.speedfood.app.data.KtorRestaurateurApi
import com.speedfood.app.data.MenuGere
import com.speedfood.app.data.PlatGere
import com.speedfood.app.data.SectionGeree
import com.speedfood.app.data.actionsPaiement
import com.speedfood.app.data.verifierPlatSaisie
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MenuEtPaiementTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    private fun commande(
        statut: String = "non_demande",
        mode: String? = null,
        visible: Boolean = true,
        documents: DocumentsCommande = DocumentsCommande(),
        recuWa: String? = "https://wa.me/224622123456?text=recu",
        factureWa: String? = null,
    ) = CommandeRestaurateur(
        "c1", "SF-1", "acceptee", "acceptee", paiementStatut = statut, paiementMode = mode, paiementVisible = visible,
        documents = documents, lienRecuWhatsApp = recuWa, lienFactureWhatsApp = factureWa,
    )

    private fun libelles(c: CommandeRestaurateur) = actionsPaiement(c).map { it.libelle }

    @Test
    fun avantAcceptationRienADireDuPaiement() {
        assertTrue(actionsPaiement(commande(visible = false)).isEmpty())
    }

    @Test
    fun unPaiementDeclarePeutEtreConfirmeOuConteste() {
        val a = actionsPaiement(commande("declare", "orange_money"))
        assertEquals(listOf("Paiement reçu", "Pas reçu"), a.take(2).map { it.libelle })
        assertEquals(listOf("recu", "non_recu"), a.take(2).map { it.code })
        assertNull(a[0].confirmation, "confirmer la réception ne demande pas de second avis")
        assertNotNull(a[1].confirmation, "contester prévient le client : on confirme avant")
    }

    @Test
    fun lesEspecesSEncaissentEtLeNonDemandeSeMarqueCommePaye() {
        assertEquals("Espèces encaissées", actionsPaiement(commande("especes")).first().libelle)
        val marquer = actionsPaiement(commande("non_demande")).first()
        assertEquals("Marquer comme payée", marquer.libelle)
        assertNotNull(marquer.confirmation)
        assertEquals("Marquer comme payée", actionsPaiement(commande("non_recu")).first().libelle)
    }

    @Test
    fun unPaiementEnLigneSeConfirmeParLePrestataireJamaisALaMain() {
        for (s in listOf("non_demande", "non_recu", "declare").filter { it != "declare" }) {
            assertTrue(actionsPaiement(commande(s, "speedfood")).none { it.genre == ActionPaiement.Genre.Paiement }, "$s en ligne : aucune action de paiement")
        }
    }

    @Test
    fun recuEtFactureSuiventLeStatutEtLesNumerosDejaEtablis() {
        // Payé, sans reçu numéroté : on peut l'établir ; sans facture : on peut l'établir.
        assertEquals(
            listOf(ActionPaiement.Genre.WhatsApp, ActionPaiement.Genre.Document, ActionPaiement.Genre.Document),
            actionsPaiement(commande("recu")).map { it.genre },
        )
        assertEquals(listOf("Envoyer le reçu sur WhatsApp", "Établir le reçu numéroté", "Établir une facture"), libelles(commande("recu")))
        // Pas encore payé : récapitulatif, pas de reçu numéroté.
        assertTrue(libelles(commande("especes")).contains("Envoyer le récapitulatif sur WhatsApp"))
        assertTrue(libelles(commande("especes")).none { it.contains("reçu numéroté") })
        // Reçu et facture déjà établis : seul l'envoi de la facture reste.
        val faits = commande("recu", documents = DocumentsCommande("R-2026-0001", "F-2026-0007"), factureWa = "https://wa.me/224622123456?text=facture")
        assertEquals(listOf("Envoyer le reçu sur WhatsApp", "Envoyer la facture F-2026-0007 sur WhatsApp"), libelles(faits))
        assertEquals("https://wa.me/224622123456?text=facture", actionsPaiement(faits).last().code, "le lien est composé par le serveur, l'application ne fait que l'ouvrir")
    }

    @Test
    fun leMenuSeRangeParSectionAvecLesPlatsOrphelinsALaFin() {
        val menu = MenuGere(
            sections = listOf(SectionGeree("s1", "Plats"), SectionGeree("s2", "Boissons"), SectionGeree("s3", "Vide")),
            plats = listOf(
                PlatGere("p1", "Riz", prix = 25_000, sectionId = "s1"),
                PlatGere("p2", "Jus", prix = 5_000, sectionId = "s2"),
                PlatGere("p3", "Poulet", prix = 35_000, sectionId = "s1"),
                PlatGere("p4", "Sans section", prix = 1_000),
                PlatGere("p5", "Section disparue", prix = 1_000, sectionId = "inconnue"),
            ),
        )
        val g = menu.groupes()
        assertEquals(listOf("Plats", "Boissons", "Autres plats"), g.map { it.first }, "une section sans plat n'apparaît pas")
        assertEquals(listOf("p1", "p3"), g[0].second.map { it.id })
        assertEquals(listOf("p4", "p5"), g[2].second.map { it.id })
    }

    @Test
    fun laSaisieDUnPlatEstControlee() {
        assertNotNull(verifierPlatSaisie("", "", "1000", ""))
        assertNotNull(verifierPlatSaisie("x".repeat(121), "", "1000", ""))
        assertNotNull(verifierPlatSaisie("Riz", "d".repeat(501), "1000", ""))
        assertNotNull(verifierPlatSaisie("Riz", "", "", ""))
        assertNotNull(verifierPlatSaisie("Riz", "", "abc", ""))
        assertNotNull(verifierPlatSaisie("Riz", "", "1000", "1001"), "promo au-dessus du prix")
        assertNotNull(verifierPlatSaisie("Riz", "", "1000", "abc"))
        assertNull(verifierPlatSaisie("Riz", "", "1000", ""))
        assertNull(verifierPlatSaisie("Riz", "Avec poulet", "1000", "800"))
        assertNull(verifierPlatSaisie("Riz", "", "0", "0"))
    }

    @Test
    fun leMenuSeLitDepuisLeServeur() = runTest {
        val api = KtorRestaurateurApi(
            client(MockEngine {
                respond(
                    """{"ok":true,"sections":[{"id":"s1","nom":"Plats"}],"plats":[
                        {"id":"p1","nom":"Riz gras","description":"","prix":35000,"prixPromo":30000,"disponible":true,"confirmeLe":"2099-01-01T00:00:00Z","sectionId":"s1",
                         "options":[{"id":"o1","nom":"Piment","prix":500,"disponible":true}]}]}""",
                    HttpStatusCode.OK, json,
                )
            }),
            config,
        )
        val menu = api.menu("t")
        val plat = menu.plats.single()
        assertEquals(30_000, plat.commeMenuClient().prixEffectif)
        assertEquals("Piment", plat.options.single().nom)
        assertEquals("Plats", menu.groupes().single().first)
    }

    @Test
    fun lesModificationsDuMenuEnvoientLeBonCorps() = runTest {
        val vus = mutableListOf<Pair<String, String>>()
        val api = KtorRestaurateurApi(
            client(MockEngine { r ->
                vus += r.url.encodedPath to r.body.toByteArray().decodeToString()
                if (r.url.encodedPath.endsWith("/document")) respond("""{"ok":false,"erreur":{"code":"CONFLIT_ETAT","message":"La facture s'établit une fois la commande acceptée."}}""", HttpStatusCode.Conflict, json)
                else respond("""{"ok":true}""", HttpStatusCode.OK, json)
            }),
            config,
        )
        assertNull(api.modifierMenu("t", "disponibilite", mapOf("platId" to "p1", "disponible" to false)))
        assertNull(api.modifierMenu("t", "creer", mapOf("nom" to "Riz", "description" to "", "prix" to 25_000, "prixPromo" to null, "sectionId" to null)))
        assertNull(api.modifierMenu("t", "confirmer_tout", emptyMap()))
        assertNull(api.confirmerPaiement("t", "c1", "recu"))
        assertNotNull(api.emettreDocument("t", "c1", "facture"))

        fun corps(fin: String, n: Int = 0) = Json.parseToJsonElement(vus.filter { it.first.endsWith(fin) }[n].second).jsonObject
        val dispo = vus.filter { it.first.endsWith("/menu/action") }.map { Json.parseToJsonElement(it.second).jsonObject }
        assertEquals("disponibilite", dispo[0]["action"]!!.jsonPrimitive.content)
        assertEquals("false", dispo[0]["disponible"]!!.jsonPrimitive.content)
        assertEquals("25000", dispo[1]["prix"]!!.jsonPrimitive.content)
        assertTrue(!dispo[1].containsKey("prixPromo") && !dispo[1].containsKey("sectionId"), "les champs vides ne sont pas envoyés")
        assertEquals("confirmer_tout", dispo[2]["action"]!!.jsonPrimitive.content)
        assertEquals("recu", corps("/paiement")["decision"]!!.jsonPrimitive.content)
        assertEquals("facture", corps("/document")["type"]!!.jsonPrimitive.content)
    }
}
