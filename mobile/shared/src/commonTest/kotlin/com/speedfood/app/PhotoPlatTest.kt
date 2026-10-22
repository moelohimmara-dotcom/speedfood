package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.KtorRestaurateurApi
import com.speedfood.app.data.PhotoChoisie
import com.speedfood.app.data.PhotoIndisponible
import com.speedfood.app.data.ResultatPhoto
import com.speedfood.app.data.SelecteurPhoto
import com.speedfood.app.data.ErreurReseau
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
import kotlin.test.Test
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PhotoPlatTest {
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun laPhotoPartEnMultipartAvecLeJetonEtLeBonPlat() = runTest {
        var chemin = ""
        var entete: String? = null
        var type: String? = null
        var corps = ByteArray(0)
        val moteur = MockEngine { requete ->
            chemin = requete.url.encodedPath
            entete = requete.headers[HttpHeaders.Authorization]
            type = requete.body.contentType?.toString()
            corps = requete.body.toByteArray()
            respond("""{"ok":true}""", HttpStatusCode.OK, json)
        }
        val message = KtorRestaurateurApi(client(moteur), config).envoyerPhoto("jeton-x", "plat-1", PhotoChoisie(byteArrayOf(1, 2, 3, 4)))
        assertNull(message)
        assertEquals("/api/v1/restaurant/menu/photo", chemin)
        assertEquals("Bearer jeton-x", entete)
        assertTrue(type!!.startsWith("multipart/form-data"))
        val texte = corps.decodeToString(throwOnInvalidSequence = false)
        assertContains(texte, "name=\"platId\"")
        assertContains(texte, "plat-1")
        assertContains(texte, "name=\"photo\"")
        assertContains(texte, "image/jpeg")
        assertFalse(texte.contains("name=\"retirer\""))
    }

    @Test
    fun leRetraitEnvoieSeulementLePlatEtLeDrapeau() = runTest {
        var corps = ByteArray(0)
        val moteur = MockEngine { requete ->
            corps = requete.body.toByteArray()
            respond("""{"ok":true}""", HttpStatusCode.OK, json)
        }
        assertNull(KtorRestaurateurApi(client(moteur), config).retirerPhoto("jeton-x", "plat-1"))
        val texte = corps.decodeToString(throwOnInvalidSequence = false)
        assertContains(texte, "name=\"retirer\"")
        assertFalse(texte.contains("name=\"photo\""))
    }

    @Test
    fun unRefusDuServeurSeLitEnClair() = runTest {
        val moteur = MockEngine { respond("""{"ok":false,"erreur":{"code":"VALIDATION","message":"L'image ne peut pas dépasser 5 Mo."}}""", HttpStatusCode.OK, json) }
        assertEquals("L'image ne peut pas dépasser 5 Mo.", KtorRestaurateurApi(client(moteur), config).envoyerPhoto("j", "p", PhotoChoisie(byteArrayOf(1))))
    }

    @Test
    fun uneReponseIllisibleOuUnReseauCoupeNeLevePasDeFauxSucces() = runTest {
        val illisible = MockEngine { respond("pas du json", HttpStatusCode.OK, json) }
        assertTrue(KtorRestaurateurApi(client(illisible), config).envoyerPhoto("j", "p", PhotoChoisie(byteArrayOf(1)))!!.contains("illisible"))
        val coupe = MockEngine { throw RuntimeException("réseau coupé") }
        val erreur = runCatching { KtorRestaurateurApi(client(coupe), config).retirerPhoto("j", "p") }.exceptionOrNull()
        assertTrue(erreur is ErreurReseau)
    }

    @Test
    fun sansSelecteurLeChoixEstUneErreurClaire() = runTest {
        val selecteur: SelecteurPhoto = PhotoIndisponible()
        assertFalse(selecteur.disponible)
        assertTrue(selecteur.choisir() is ResultatPhoto.Erreur)
    }
}
