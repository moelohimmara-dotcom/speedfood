package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorClientApi
import com.speedfood.app.data.StockageMemoire
import com.speedfood.app.data.VerrouAppareil
import com.speedfood.app.data.VerrouEspacesPro
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
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SecuriteTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")

    private class FauxVerrou(var utilisable: Boolean = true, var accepte: Boolean = true) : VerrouAppareil {
        var demandes = 0
        override fun utilisable() = utilisable
        override fun authentifier(titre: String, surResultat: (Boolean) -> Unit) {
            demandes++
            surResultat(accepte)
        }
    }

    @Test
    fun lActivationDemandeUneVerificationEtUnRefusNActivePas() {
        val stockage = StockageMemoire()
        val faux = FauxVerrou(accepte = false)
        val v = VerrouEspacesPro(stockage, faux)
        var resultat: Boolean? = null
        v.regler(true) { resultat = it }
        assertEquals(false, resultat)
        assertFalse(v.actif.value, "vérification refusée : le verrou reste éteint")
        faux.accepte = true
        v.regler(true) { resultat = it }
        assertTrue(v.actif.value && v.deverrouille.value)
        assertEquals("1", stockage.lire(VerrouEspacesPro.CLE))
        v.regler(false)
        assertFalse(v.actif.value)
        assertEquals(null, stockage.lire(VerrouEspacesPro.CLE))
    }

    @Test
    fun unVerrouQuiNePeutPasSExecuterNeBloqueJamais() {
        val stockage = StockageMemoire()
        stockage.ecrire(VerrouEspacesPro.CLE, "1")
        val v = VerrouEspacesPro(stockage, FauxVerrou(utilisable = false))
        assertTrue(v.actif.value)
        assertTrue(v.peutAfficher(), "plus de verrouillage d'écran sur le téléphone : l'espace s'affiche, un restaurateur ne rate pas une commande")
        var essai: Boolean? = null
        VerrouEspacesPro(StockageMemoire(), FauxVerrou(utilisable = false)).regler(true) { essai = it }
        assertEquals(false, essai, "impossible d'activer sans verrouillage d'écran")
    }

    @Test
    fun ilSeReverrouilleApresLeDelaiEnArrierePlan() {
        var maintenant = 1_000_000L
        val stockage = StockageMemoire()
        stockage.ecrire(VerrouEspacesPro.CLE, "1")
        val v = VerrouEspacesPro(stockage, FauxVerrou(), { maintenant })
        assertFalse(v.peutAfficher(), "verrou actif au démarrage : à déverrouiller")
        v.deverrouiller()
        assertTrue(v.peutAfficher())
        v.quitte()
        maintenant += 60_000
        v.reprise()
        assertTrue(v.peutAfficher(), "une minute en arrière-plan : pas de nouvelle vérification")
        v.quitte()
        maintenant += VerrouEspacesPro.DELAI_MS + 1
        v.reprise()
        assertFalse(v.peutAfficher(), "au-delà du délai : verrouillé de nouveau")
    }

    @Test
    fun laSuppressionDeCompteEnvoieLaConfirmationEcriteEtLireLeRefus() = runTest {
        var corps: String? = null
        var autorisation: String? = null
        val moteur = MockEngine { r ->
            corps = r.body.toByteArray().decodeToString()
            autorisation = r.headers[HttpHeaders.Authorization]
            if (r.url.encodedPath.endsWith("/client/compte") && corps!!.contains("SUPPRIMER")) respond("""{"ok":true,"message":"Votre compte a été supprimé."}""", HttpStatusCode.OK, json)
            else respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"Écrivez SUPPRIMER pour confirmer la suppression."}}""", HttpStatusCode.BadRequest, json)
        }
        val api = KtorClientApi(HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }, config)
        val ok = api.supprimerCompte("acces", "SUPPRIMER")
        assertTrue(ok.ok)
        assertEquals("Bearer acces", autorisation)
        assertEquals("SUPPRIMER", Json.parseToJsonElement(corps!!).jsonObject["confirmation"]!!.jsonPrimitive.content)
        val refus = api.supprimerCompte("acces", "peut-être")
        assertFalse(refus.ok)
        assertTrue(refus.message.contains("SUPPRIMER"))
    }
}
