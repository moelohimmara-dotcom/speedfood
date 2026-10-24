package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.CourseLivree
import com.speedfood.app.data.cleHistoriqueLivreur
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import kotlinx.coroutines.delay
import org.koin.compose.viewmodel.koinViewModel

/**
 * Onglet « Gains » du livreur : les courses livrées, leurs frais de course, le gain attendu de la course en cours (mis à jour tout seul)
 * et l'historique des courses livrées, page par page.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LivreurGainsScreen(onConnexion: () -> Unit, viewModel: LivreurGainsViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    // Le gain attendu suit la course en cours : la lecture est relancée toute seule, le livreur n'a rien à faire.
    LaunchedEffect(Unit) {
        while (true) {
            delay(DELAI_GAIN_MS)
            viewModel.rafraichirGain()
        }
    }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Gains", style = MaterialTheme.typography.titleLarge) },
                actions = { TextButton(onClick = { viewModel.charger() }) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatGainsLivreur.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatGainsLivreur.NonConnecte -> MessageEtat("Connectez-vous avec votre compte livreur.", "Me connecter", onConnexion)
                EtatGainsLivreur.PasLivreur -> MessageEtat(
                    "Ce compte n'est pas un compte livreur. Les comptes livreurs sont créés par l'équipe Speedfood : contactez-la si vous souhaitez livrer.",
                    "Changer de compte",
                    onConnexion,
                )
                is EtatGainsLivreur.Erreur -> MessageEtat(e.message, "Réessayer", { viewModel.charger() })
                is EtatGainsLivreur.Pret -> ContenuGainsLivreur(e, viewModel)
            }
        }
    }
}

/** Délai de relecture du gain attendu : assez court pour suivre la course, assez long pour ménager la connexion. */
const val DELAI_GAIN_MS = 5_000L

@Composable
private fun ContenuGainsLivreur(e: EtatGainsLivreur.Pret, viewModel: LivreurGainsViewModel) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        e.message?.let { message -> item(key = "message") { BlocMessage(message, erreur = false) } }
        item(key = "aujourdhui") {
            BlocChiffresLivreur(
                "Aujourd'hui",
                listOf(e.bilan.aujourdhui.courses.toString() to "courses livrées", formaterGnf(e.bilan.aujourdhui.fraisGnf) to "frais de course"),
            )
        }
        item(key = "semaine") {
            BlocChiffresLivreur(
                "7 derniers jours",
                listOf(e.bilan.semaine.courses.toString() to "courses livrées", formaterGnf(e.bilan.semaine.fraisGnf) to "frais de course"),
            )
        }
        item(key = "attendu") { BlocGainAttendu(e) }
        item(key = "note") {
            Text(
                "Le montant est le frais de livraison de chaque course livrée. Ce n'est pas une paie : la règle de rémunération sera précisée par Speedfood.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        item(key = "historique-titre") {
            Text("Historique des courses livrées", style = MaterialTheme.typography.titleLarge)
        }
        if (e.historique.isEmpty()) {
            item(key = "historique-vide") {
                Text("Aucune course livrée à afficher pour l'instant.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            items(e.historique.size, key = { index -> cleHistoriqueLivreur(e.historique[index].id, index) }) { index ->
                LigneCourseLivree(e.historique[index])
            }
        }
        if (e.suite) {
            item(key = "suite") {
                if (e.chargementSuite) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(18.dp), color = Couleurs.RougeFonce)
                        Text("Chargement de la page ${e.page + 1}…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                } else {
                    OutlinedButton(onClick = { viewModel.chargerSuite() }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(2.dp, Couleurs.Encre)) {
                        Text("Charger la suite (page ${e.page + 1} sur ${e.pages})", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                    }
                }
            }
        }
    }
}

/** Un bloc de chiffres (« Aujourd'hui », « 7 derniers jours ») : une ligne de valeurs, chacune avec son libellé. */
@Composable
private fun BlocChiffresLivreur(titre: String, valeurs: List<Pair<String, String>>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(titre, style = MaterialTheme.typography.titleMedium)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                valeurs.forEach { (valeur, libelle) ->
                    // Les montants en GNF sont plus longs que les nombres : ils reçoivent plus de largeur (pas de retour à la ligne).
                    Column(Modifier.weight(if (valeur.contains("GNF")) 1.7f else 1f)) {
                        Text(valeur, style = MaterialTheme.typography.titleLarge)
                        Text(libelle, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}

/** Le gain attendu : les frais de la course en cours. Il bouge avec la course, sans rechargement manuel. */
@Composable
private fun BlocGainAttendu(e: EtatGainsLivreur.Pret) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Mangue),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("Gain attendu", style = MaterialTheme.typography.titleMedium)
            Text(formaterGnf(e.gainAttenduGnf), style = MaterialTheme.typography.headlineSmall)
            Text(
                if (e.enCours) "Frais de la course en cours : le chiffre suit la course, il n'y a rien à recharger."
                else "Aucune course en cours : rien à attendre pour l'instant.",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Une ligne d'historique : la course, quand, et ce qu'elle a rapporté. */
@Composable
private fun LigneCourseLivree(course: CourseLivree) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(course.reference.ifBlank { "Course" }, style = MaterialTheme.typography.titleSmall)
            Text(
                listOf(course.restaurantNom, jourHeure(course.livreeLe)).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Text(formaterGnf(course.fraisGnf), style = MaterialTheme.typography.titleSmall)
    }
}

private fun jourHeure(iso: String?): String = iso?.take(16)?.replace('T', ' ') ?: ""
