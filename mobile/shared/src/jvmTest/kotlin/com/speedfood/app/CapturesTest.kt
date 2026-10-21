package com.speedfood.app

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.FiltreRestaurants
import com.speedfood.app.data.LignePanier
import com.speedfood.app.data.LigneSuivie
import com.speedfood.app.data.Menu
import com.speedfood.app.data.OptionSuivie
import com.speedfood.app.data.Panier
import com.speedfood.app.data.PropositionSuivie
import com.speedfood.app.data.RestaurantSuivi
import com.speedfood.app.data.SuiviCommande
import com.speedfood.app.ui.CarteCommandeLocale
import com.speedfood.app.ui.ContenuPanier
import com.speedfood.app.ui.ContenuSuivi
import com.speedfood.app.ui.EtatCommande
import com.speedfood.app.ui.EtatSuivi
import com.speedfood.app.ui.FormulaireCommande
import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.Plat
import com.speedfood.app.data.QuartierRef
import com.speedfood.app.data.RestaurantFiche
import com.speedfood.app.data.Section
import com.speedfood.app.data.Restaurant
import com.speedfood.app.design.SpeedfoodTheme
import com.speedfood.app.ui.EntreeScreen
import com.speedfood.app.ui.ContenuRestaurant
import com.speedfood.app.ui.ListeRestaurants
import com.speedfood.app.ui.RechercheEtListe
import com.speedfood.app.ui.RestaurateurBientotScreen
import org.jetbrains.skia.EncodedImageFormat
import java.io.File
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * Rend les écrans hors écran (sans émulateur) en images PNG dans `build/captures/` : c'est la preuve visuelle de ce que l'application
 * dessine, relue à chaque lot. Le test échoue si l'image est vide (écran blanc).
 */
class CapturesTest {
    private fun capturer(nom: String, largeur: Int = 412, hauteur: Int = 860, contenu: @androidx.compose.runtime.Composable () -> Unit) {
        val scene = ImageComposeScene(width = largeur * 2, height = hauteur * 2, density = Density(2f)) {
            SpeedfoodTheme { Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { contenu() } }
        }
        // Plusieurs rendus à des instants croissants : laisse finir les animations d'entrée.
        var image = scene.render(0L)
        for (i in 1..12) image = scene.render(i * 100_000_000L)
        val octets = image.encodeToData(EncodedImageFormat.PNG)!!.bytes
        scene.close()
        val dossier = File("build/captures").apply { mkdirs() }
        File(dossier, "$nom.png").writeBytes(octets)
        assertTrue(octets.size > 8_000, "capture « $nom » suspecte (${octets.size} octets) : écran vide ?")
    }

    @Test fun entree() = capturer("entree") { EntreeScreen(onClient = {}, onRestaurateur = {}) }

    @Test fun restaurateur() = capturer("restaurateur") { RestaurateurBientotScreen("https://speedfood-app.moelohimmara.workers.dev", onRetour = {}) }

    @Test
    fun listeDeRestaurants() = capturer("restaurants") {
        ListeRestaurants(
            listOf(
                Restaurant("1", "Chez Awa", "8h – 22h", ouvert = true, accepteCommandes = true, statutMisAJourLe = "2099-01-01T00:00:00Z", avisSomme = 9, avisTotal = 2, quartier = QuartierRef("Kaloum")),
                Restaurant("2", "Grillades du Port", "11h – 23h", ouvert = true, accepteCommandes = false, statutMisAJourLe = "2020-01-01T00:00:00Z", quartier = QuartierRef("Dixinn")),
                Restaurant("3", "Café Matam", null, ouvert = false, accepteCommandes = false, quartier = QuartierRef("Matam")),
            ),
        )
    }

    private val restaurantsExemple = listOf(
        Restaurant("1", "Chez Awa", "8h – 22h", ouvert = true, accepteCommandes = true, statutMisAJourLe = "2099-01-01T00:00:00Z", avisSomme = 9, avisTotal = 2, quartier = QuartierRef("Kaloum")),
        Restaurant("2", "Grillades du Port", "11h – 23h", ouvert = true, accepteCommandes = false, statutMisAJourLe = "2020-01-01T00:00:00Z", quartier = QuartierRef("Dixinn")),
        Restaurant("3", "Café Matam", null, ouvert = false, accepteCommandes = false, quartier = QuartierRef("Matam")),
    )

    @Test
    fun rechercheEtFiltre() = capturer("recherche") {
        RechercheEtListe(restaurantsExemple, onOuvrir = {}, requeteInitiale = "cafe", filtreInitial = FiltreRestaurants.Tous)
    }

    @Test
    fun ficheEtMenu() = capturer("fiche-restaurant", hauteur = 1100) {
        val fiche = RestaurantFiche(
            id = "1", nom = "Chez Awa", horaires = "8h – 22h", consignes = "Commandes jusqu'à 21h30.", ouvert = true, accepteCommandes = true,
            statutMisAJourLe = "2099-01-01T00:00:00Z", moyensPaiement = listOf("Espèces", "Orange Money"), avisSomme = 9, avisTotal = 2, quartier = QuartierRef("Kaloum"),
        )
        val menu = Menu(
            sections = listOf(Section("s1", "Plats", 1), Section("s2", "Boissons", 2)),
            plats = listOf(
                Plat("p1", "Poulet braisé", "Avec attiéké et sauce piment", 35000, prixPromo = 30000, confirmeLe = "2099-01-01T00:00:00Z", sectionId = "s1", options = listOf(OptionPlat("o1", "Piment", 500))),
                Plat("p2", "Poisson grillé", "Capitaine du jour", 45000, confirmeLe = "2020-01-01T00:00:00Z", sectionId = "s1"),
                Plat("p3", "Riz gras", "", 25000, disponible = false, sectionId = "s1"),
                Plat("p4", "Jus de bissap", "", 5000, confirmeLe = "2099-01-01T00:00:00Z", sectionId = "s2"),
            ),
        )
        ContenuRestaurant(fiche, menu)
    }

    private val rizGras = Plat("p1", "Poulet braisé", "", 35000, prixPromo = 30000, options = listOf(OptionPlat("o1", "Piment", 500)))
    private val bissap = Plat("p4", "Jus de bissap", "", 5000)
    private val panierExemple = Panier(
        restaurantId = "1",
        restaurantNom = "Chez Awa",
        lignes = listOf(LignePanier(rizGras, listOf(OptionPlat("o1", "Piment", 500)), 2), LignePanier(bissap, emptyList(), 1)),
    )

    @Test
    fun ficheAvecBoutonsAjouter() = capturer("fiche-ajouter", hauteur = 1100) {
        val fiche = RestaurantFiche(id = "1", nom = "Chez Awa", horaires = "8h – 22h", ouvert = true, accepteCommandes = true, statutMisAJourLe = "2099-01-01T00:00:00Z", quartier = QuartierRef("Kaloum"))
        val menu = Menu(
            sections = listOf(Section("s1", "Plats", 1), Section("s2", "Boissons", 2)),
            plats = listOf(
                rizGras.copy(confirmeLe = "2099-01-01T00:00:00Z", sectionId = "s1"),
                Plat("p3", "Riz gras", "", 25000, disponible = false, sectionId = "s1"),
                bissap.copy(confirmeLe = "2099-01-01T00:00:00Z", sectionId = "s2"),
            ),
        )
        ContenuRestaurant(fiche, menu, surPlat = {})
    }

    @Test fun panier() = capturer("panier") { ContenuPanier(panierExemple, null, onVoirRestaurant = {}) }

    @Test
    fun commandeConnecte() = capturer("commande", hauteur = 1000) {
        FormulaireCommande(Modifier, panierExemple, connecte = true, etat = EtatCommande(erreur = "Indiquez votre nom (2 caractères au moins)."), onConnexion = {}, onEnvoyer = { _, _, _ -> })
    }

    @Test
    fun commandeNonConnecte() = capturer("commande-hors-connexion") {
        FormulaireCommande(Modifier, panierExemple, connecte = false, etat = EtatCommande(), onConnexion = {}, onEnvoyer = { _, _, _ -> })
    }

    @Test
    fun suiviAvecProposition() = capturer("suivi-proposition", hauteur = 1000) {
        val suivi = SuiviCommande(
            reference = "SF-0042", statut = "en_attente", etatDerive = "attente_confirmation_client", restaurant = RestaurantSuivi("1", "Chez Awa"),
            lignes = listOf(LigneSuivie("Poulet braisé", 30000, 2, listOf(OptionSuivie("Piment", 500))), LigneSuivie("Jus de bissap", 5000, 1)),
            sousTotal = 66000, propositionActive = PropositionSuivie("prop", 61000, 0, "Le poulet est remplacé par du poisson grillé."),
        )
        ContenuSuivi(EtatSuivi.Pret(suivi), surReponse = {})
    }

    @Test
    fun suiviAcceptee() = capturer("suivi-acceptee") {
        val suivi = SuiviCommande(reference = "SF-0043", statut = "acceptee", restaurant = RestaurantSuivi("1", "Chez Awa"), lignes = listOf(LigneSuivie("Jus de bissap", 5000, 2)), sousTotal = 10000)
        ContenuSuivi(EtatSuivi.Pret(suivi, alerte = "Connexion perdue : nouvelle tentative en cours."), surReponse = {})
    }

    @Test
    fun carteCommandeLocale() = capturer("mes-commandes", hauteur = 300) {
        CarteCommandeLocale(CommandeLocale("SF-0042", "jeton", "Chez Awa", 0L, 66000), onOuvrir = {})
    }
}
