package com.speedfood.app

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.ImageComposeScene
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import com.speedfood.app.data.QuartierRef
import com.speedfood.app.data.Restaurant
import com.speedfood.app.design.SpeedfoodTheme
import com.speedfood.app.ui.EntreeScreen
import com.speedfood.app.ui.ListeRestaurants
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
}
