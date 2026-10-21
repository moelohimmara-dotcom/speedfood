package com.speedfood.app

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import com.speedfood.app.data.ClientCourse
import com.speedfood.app.data.CommandeRestaurateur
import com.speedfood.app.data.EtatRestaurateur
import com.speedfood.app.data.LigneApercu
import com.speedfood.app.data.OptionSuivie
import com.speedfood.app.data.PropositionApercu
import com.speedfood.app.data.RestaurantResume
import com.speedfood.app.data.CourseLivreur
import com.speedfood.app.data.EstimationLivraison
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.FicheLivreur
import com.speedfood.app.data.OffreLivreur
import com.speedfood.app.data.LigneEnvoyee
import com.speedfood.app.data.QuartierChoix
import com.speedfood.app.data.FiltreRestaurants
import com.speedfood.app.data.LignePanier
import com.speedfood.app.data.LigneSuivie
import com.speedfood.app.data.Menu
import com.speedfood.app.data.Panier
import com.speedfood.app.data.PropositionSuivie
import com.speedfood.app.data.RestaurantSuivi
import com.speedfood.app.data.SuiviCommande
import com.speedfood.app.ui.CarteCommande
import com.speedfood.app.ui.CommandeAffichee
import com.speedfood.app.ui.ContenuPanier
import com.speedfood.app.ui.ContenuSuivi
import com.speedfood.app.ui.ContenuLivreur
import com.speedfood.app.ui.IllustrationVisite
import com.speedfood.app.ui.SceneOuverture
import com.speedfood.app.ui.VisiteGuidee
import com.speedfood.app.ui.EtatCommande
import com.speedfood.app.ui.EtatEspaceLivreur
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
import com.speedfood.app.ui.ContenuConsole
import com.speedfood.app.ui.EtatConsole
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

    @Test fun entree() = capturer("entree") { EntreeScreen(onClient = {}, onRestaurateur = {}, onLivreur = {}, onVisite = {}) }


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

    private val quartiersExemple = listOf(QuartierChoix("q1", "Kaloum"), QuartierChoix("q2", "Dixinn Port"), QuartierChoix("q3", "Hafia I"))

    private fun formulaire(connecte: Boolean, etat: EtatCommande) = capturer(
        if (!connecte) "commande-hors-connexion" else if (etat.livraison) "commande-livraison" else "commande",
        hauteur = 1200,
    ) {
        FormulaireCommande(Modifier, panierExemple, connecte, etat, quartiersExemple, onConnexion = {}, onMode = {}, onQuartier = {}, onEnvoyer = { _, _, _, _ -> })
    }

    @Test fun commandeConnecte() = formulaire(true, EtatCommande(erreur = "Indiquez votre nom (2 caractères au moins)."))

    @Test fun commandeNonConnecte() = formulaire(false, EtatCommande())

    @Test
    fun commandeEnLivraison() = formulaire(
        true,
        EtatCommande(livraison = true, quartierId = "q2", estimation = EstimationLivraison.Ok(9500, 2.4, false, 25, "2,4 km environ")),
    )

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
    fun carteCommande() = capturer("mes-commandes", hauteur = 420) {
        CarteCommande(
            CommandeAffichee("SF-0042", "jeton", "1", "Chez Awa", 0L, 66000, "acceptee", true, listOf(LigneEnvoyee("p1", 2, listOf("o1")))),
            onOuvrir = {},
        )
    }

    private fun livreur(etat: EtatLivreur, message: String? = null) = EtatEspaceLivreur.Pret(etat, message, positionAutorisee = true, positionDisponible = true)
    private val ficheActive = FicheLivreur("l1", "Mamadou Barry", "disponible", "Moto", "actif")

    @Test
    fun livreurOffre() = capturer("livreur-offre", hauteur = 900) {
        val offre = OffreLivreur("o1", "2099-01-01T00:00:30Z", "Chez Awa", 2.4, 9500, 0.8)
        ContenuLivreur(livreur(EtatLivreur(ficheActive, offre = offre, positionConnue = true)), kotlin.time.Instant.parse("2099-01-01T00:00:00Z").toEpochMilliseconds() - 0L, {}, { _, _ -> }, { _, _, _ -> }, {})
    }

    @Test
    fun livreurCourseARemettre() = capturer("livreur-course", hauteur = 1100) {
        val course = CourseLivreur(
            "c1", "vers_client", "speedfood", "En route vers vous", "SF-9", "prete", "Chez Awa", fraisGnf = 9500,
            client = ClientCourse("Aminata Diallo", "+224622123456", "Rue KA-012, près de la mosquée Fayçal"),
        )
        ContenuLivreur(livreur(EtatLivreur(ficheActive.copy(statut = "en_course"), course = course, positionConnue = true), "Code incorrect. 2 essai(s) restant(s)."), 0L, {}, { _, _ -> }, { _, _, _ -> }, {})
    }

    @Test
    fun livreurHorsLigneSansPosition() = capturer("livreur-hors-ligne", hauteur = 700) {
        ContenuLivreur(
            EtatEspaceLivreur.Pret(EtatLivreur(ficheActive.copy(statut = "hors_ligne")), positionAutorisee = false, positionDisponible = true),
            0L, {}, { _, _ -> }, { _, _, _ -> }, {},
        )
    }

    @Test
    fun livreurFicheEnExamen() = capturer("livreur-candidat", hauteur = 500) {
        ContenuLivreur(livreur(EtatLivreur(ficheActive.copy(cycle = "candidat", statut = "hors_ligne"))), 0L, {}, { _, _ -> }, { _, _, _ -> }, {})
    }

    @Test fun ouverture0() = capturer("ouverture-1", hauteur = 700) { SceneOuverture(350f) }

    @Test fun ouverture1() = capturer("ouverture-2", hauteur = 700) { SceneOuverture(850f) }

    @Test fun ouverture2() = capturer("ouverture-3", hauteur = 700) { SceneOuverture(1500f) }

    @Test fun ouverture3() = capturer("ouverture-4", hauteur = 700) { SceneOuverture(2800f) }

    @Test fun visiteGuidee() = capturer("visite-1", hauteur = 860) { VisiteGuidee {} }

    @Test
    fun visiteIllustrations() = capturer("visite-illustrations", hauteur = 1400) {
        androidx.compose.foundation.layout.Column(Modifier.fillMaxSize()) {
            for (i in 0..4) IllustrationVisite(i, 1f, 0.3f)
        }
    }

    private val maintenantConsole = kotlin.time.Instant.parse("2026-10-21T12:00:00Z").toEpochMilliseconds()

    @Test
    fun consoleRestaurateur() = capturer("console-restaurateur", hauteur = 1500) {
        val commandes = listOf(
            CommandeRestaurateur(
                "c1", "SF-4KVB9", "en_attente", "en_attente", "livraison", clientNom = "Aminata Diallo", clientTelephone = "+224622123456", clientAdresse = "Rue KA-012, Kaloum",
                sousTotal = 66000, fraisLivraisonEstime = 9500, creeLe = "2026-10-21T11:56:00Z",
                lignes = listOf(LigneApercu("Poulet braisé", 30000, 2, listOf(OptionSuivie("Piment", 500))), LigneApercu("Jus de bissap", 5000, 1)),
            ),
            CommandeRestaurateur(
                "c2", "SF-7RTM2", "en_attente", "attente_confirmation_client", "retrait", clientNom = "Mamadou Barry", clientTelephone = "+224666000111",
                sousTotal = 45000, creeLe = "2026-10-21T11:40:00Z", lignes = listOf(LigneApercu("Poisson grillé", 45000, 1)),
                propositionActive = PropositionApercu("p1", 40000, 0, "Capitaine remplacé par du thiof"),
            ),
            CommandeRestaurateur(
                "c3", "SF-2HXN8", "acceptee", "acceptee", "retrait", clientNom = "Fatou Camara", clientTelephone = "+224655999888",
                sousTotal = 25000, creeLe = "2026-10-21T11:30:00Z", lignes = listOf(LigneApercu("Riz gras", 25000, 1)),
            ),
        )
        ContenuConsole(
            EtatConsole.Pret(EtatRestaurateur(RestaurantResume("r1", "Chez Awa", ouvert = true, accepteCommandes = true), commandes)),
            maintenantConsole, { _, _ -> }, { _, _, _, _ -> }, { _, _ -> },
        )
    }
}
