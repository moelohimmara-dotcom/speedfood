package com.speedfood.app

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.EtatPlat
import com.speedfood.app.data.FiltreRestaurants
import com.speedfood.app.data.KtorRestaurantApi
import com.speedfood.app.data.Menu
import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.Plat
import com.speedfood.app.data.QuartierRef
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.Section
import com.speedfood.app.data.etatPlat
import com.speedfood.app.data.filtrerRestaurants
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.normaliser
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
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MenuTest {
    private val heure = 3_600_000L
    private val config = SpeedfoodConfig("https://exemple.supabase.co", "cle-publique-de-test", "https://exemple.test")
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private val idResto = "11111111-2222-3333-4444-555555555555"

    private fun client(moteur: MockEngine) = HttpClient(moteur) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }

    @Test
    fun formatDesMontantsGnf() {
        assertEquals("0 GNF", formaterGnf(0))
        assertEquals("500 GNF", formaterGnf(500))
        assertEquals("35 000 GNF", formaterGnf(35_000))
        assertEquals("1 250 000 GNF", formaterGnf(1_250_000))
        assertEquals("-3 000 GNF", formaterGnf(-3000))
    }

    @Test
    fun prixEffectifEtPromo() {
        assertEquals(30_000, Plat(id = "a", nom = "A", prix = 35_000, prixPromo = 30_000).prixEffectif)
        assertTrue(Plat(id = "a", nom = "A", prix = 35_000, prixPromo = 30_000).enPromo)
        assertEquals(35_000, Plat(id = "a", nom = "A", prix = 35_000).prixEffectif)
        assertEquals(35_000, Plat(id = "a", nom = "A", prix = 35_000, prixPromo = 40_000).prixEffectif, "un prix promo supérieur est ignoré")
        assertEquals(0, Plat(id = "a", nom = "A", prix = 5_000, prixPromo = 0).prixEffectif)
    }

    @Test
    fun etatDUnPlat() {
        val plat = Plat(id = "a", nom = "A", prix = 1000)
        assertEquals(EtatPlat.Disponible, etatPlat(plat, 2 * heure))
        assertEquals(EtatPlat.Disponible, etatPlat(plat, 6 * heure))
        assertEquals(EtatPlat.AConfirmer, etatPlat(plat, 6 * heure + 1))
        assertEquals(EtatPlat.AConfirmer, etatPlat(plat, null), "jamais confirmé : à confirmer, jamais disponible")
        assertEquals(EtatPlat.Epuise, etatPlat(plat.copy(disponible = false), 1 * heure))
    }

    @Test
    fun menuGroupeParSectionDansLOrdre() {
        val menu = Menu(
            sections = listOf(Section("s2", "Boissons", 2), Section("s1", "Plats", 1), Section("s3", "Vide", 3)),
            plats = listOf(
                Plat(id = "p1", nom = "Riz", prix = 1000, sectionId = "s1"),
                Plat(id = "p2", nom = "Jus", prix = 500, sectionId = "s2"),
                Plat(id = "p3", nom = "Pain", prix = 200),
                Plat(id = "p4", nom = "Orphelin", prix = 300, sectionId = "inconnue"),
            ),
        )
        val groupes = menu.groupes()
        assertEquals(listOf("Plats", "Boissons", "Autres plats"), groupes.map { it.first })
        assertEquals(listOf("Pain", "Orphelin"), groupes.last().second.map { it.nom })
    }

    @Test
    fun rechercheSansCasseNiAccents() {
        val liste = listOf(
            Restaurant("1", "Café Matam", ouvert = true, accepteCommandes = true, quartier = QuartierRef("Matam")),
            Restaurant("2", "Chez Awa", ouvert = true, accepteCommandes = false, quartier = QuartierRef("Kaloum")),
            Restaurant("3", "Grillades du Port", ouvert = false, quartier = QuartierRef("Dixinn")),
        )
        assertEquals(listOf("1"), filtrerRestaurants(liste, "CAFE", FiltreRestaurants.Tous).map { it.id })
        assertEquals(listOf("2"), filtrerRestaurants(liste, "kaloum awa", FiltreRestaurants.Tous).map { it.id })
        assertEquals(emptyList(), filtrerRestaurants(liste, "kaloum matam", FiltreRestaurants.Tous).map { it.id })
        assertEquals(listOf("1", "2", "3"), filtrerRestaurants(liste, "  ", FiltreRestaurants.Tous).map { it.id })
        assertEquals(listOf("1", "2"), filtrerRestaurants(liste, "", FiltreRestaurants.Ouverts).map { it.id })
        assertEquals(listOf("1"), filtrerRestaurants(liste, "", FiltreRestaurants.Commandables).map { it.id })
        assertEquals("cafe matam", normaliser("  Café   MATAM "))
    }

    @Test
    fun ficheEtMenuDepuisLApi() = runTest {
        val chemins = mutableListOf<String>()
        val api = KtorRestaurantApi(
            client(
                MockEngine { requete ->
                    chemins += requete.url.encodedPath + "?" + requete.url.encodedQuery
                    when {
                        requete.url.encodedPath.endsWith("/restaurants") -> respond(
                            """[{"id":"$idResto","nom":"Chez Awa","horaires":"8h-22h","ouvert":true,"accepte_commandes":true,"moyens_paiement":["Espèces","Orange Money"],"quartier":{"nom":"Kaloum"},"inconnu":1}]""",
                            HttpStatusCode.OK,
                            json,
                        )
                        requete.url.encodedPath.endsWith("/menu_sections") -> respond("""[{"id":"s1","nom":"Plats","position":1}]""", HttpStatusCode.OK, json)
                        requete.url.encodedPath.endsWith("/menu_items") -> respond(
                            """[{"id":"p1","nom":"Poulet braisé","description":"Avec attiéké","prix":35000,"prix_promo":30000,"disponible":true,
                                "disponibilite_confirmee_le":"2026-10-21T10:00:00+00:00","photo_url":null,"section_id":"s1",
                                "menu_item_options":[{"id":"o1","nom":"Piment","prix":500,"disponible":true}]}]""",
                            HttpStatusCode.OK,
                            json,
                        )
                        else -> respond("[]", HttpStatusCode.NotFound, json)
                    }
                },
            ),
            config,
        )

        val fiche = api.fiche(idResto)
        assertNotNull(fiche)
        assertEquals("Chez Awa", fiche.nom)
        assertEquals(listOf("Espèces", "Orange Money"), fiche.moyensPaiement)

        val menu = api.menu(idResto)
        assertEquals(1, menu.plats.size)
        assertEquals(listOf(OptionPlat("o1", "Piment", 500, true)), menu.plats[0].options)
        assertEquals("Plats", menu.groupes().single().first)

        assertTrue(chemins.any { it.contains("id=eq.$idResto") }, "la fiche est demandée par identifiant")
        assertTrue(chemins.any { it.contains("restaurant_id=eq.$idResto") && it.contains("archive_le=is.null") && it.contains("limit=500") }, "menu : plats non archivés, lecture bornée")
    }

    @Test
    fun unIdentifiantInvalideNEstJamaisEnvoyeAuServeur() = runTest {
        var appels = 0
        val api = KtorRestaurantApi(client(MockEngine { appels++; respond("[]", HttpStatusCode.OK, json) }), config)
        assertNull(api.fiche("1&select=*"))
        assertNull(api.fiche("pas-un-uuid"))
        assertTrue(api.menu("x or 1=1").plats.isEmpty())
        assertEquals(0, appels)
    }

    @Test
    fun uneFicheAbsenteDonneNull() = runTest {
        val api = KtorRestaurantApi(client(MockEngine { respond("[]", HttpStatusCode.OK, json) }), config)
        assertNull(api.fiche(idResto))
    }
}
