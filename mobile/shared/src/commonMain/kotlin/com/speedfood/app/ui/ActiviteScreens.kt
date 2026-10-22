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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.ActiviteRestaurant
import com.speedfood.app.data.GainsLivreur
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Un bloc de chiffres (« Aujourd'hui », « 7 derniers jours ») : une ligne de valeurs, chacune avec son libellé. */
@Composable
private fun BlocChiffres(titre: String, valeurs: List<Pair<String, String>>) {
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

@Composable
private fun LigneHistorique(gauche: String, detail: String, droite: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(gauche, style = MaterialTheme.typography.titleSmall)
            Text(detail, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(droite, style = MaterialTheme.typography.titleSmall)
    }
}

private fun jourHeure(iso: String?): String = iso?.take(16)?.replace('T', ' ') ?: ""

/** Cadre commun : barre de titre avec « Actualiser », corps selon l'état. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun <T> CadreBilan(titre: String, etat: EtatBilan<T>, surActualiser: () -> Unit, surConnexion: () -> Unit, contenu: @Composable (T) -> Unit) {
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(titre, style = MaterialTheme.typography.titleLarge) },
                actions = { TextButton(onClick = surActualiser) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (etat) {
                EtatBilan.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatBilan.NonConnecte -> MessageEtat("Connectez-vous avec votre compte professionnel.", "Me connecter", surConnexion)
                is EtatBilan.Erreur -> MessageEtat(etat.message, "Réessayer", surActualiser)
                is EtatBilan.Pret -> Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    etat.message?.let { BlocMessage(it, erreur = false) }
                    contenu(etat.donnees)
                }
            }
        }
    }
}

/** Onglet « Activité » du restaurateur. Le chiffre est la somme des plats des commandes terminées (hors frais de livraison, refus et annulations). */
@Composable
fun ActiviteRestaurantScreen(onConnexion: () -> Unit, viewModel: ActiviteRestaurantViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    CadreBilan("Activité", etat, viewModel::charger, onConnexion) { a -> ContenuActiviteRestaurant(a) }
}

@Composable
internal fun ContenuActiviteRestaurant(a: ActiviteRestaurant) {
    BlocChiffres("Aujourd'hui", listOf(a.aujourdhui.recues.toString() to "commandes reçues", a.aujourdhui.terminees.toString() to "terminées", formaterGnf(a.aujourdhui.chiffreGnf) to "chiffre"))
    BlocChiffres("7 derniers jours", listOf(a.semaine.recues.toString() to "commandes reçues", a.semaine.terminees.toString() to "terminées", formaterGnf(a.semaine.chiffreGnf) to "chiffre"))
    val r = a.repartition
    BlocChiffres("Issue des commandes (7 jours)", listOf(r.terminees.toString() to "terminées", r.refusees.toString() to "refusées", r.annulees.toString() to "annulées", r.enCours.toString() to "en cours"))
    Text("Chiffre = plats des commandes terminées, sans les frais de livraison. Les commandes de test sont exclues.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text("Dernières commandes terminées", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 6.dp))
    if (a.recentes.isEmpty()) Text("Aucune commande terminée ces 7 derniers jours.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    a.recentes.forEach { c -> LigneHistorique(c.reference, jourHeure(c.creeLe) + if (c.mode == "livraison") " · livraison" else " · retrait", formaterGnf(c.totalGnf)) }
}

/** Onglet « Gains » du livreur : ses courses livrées et leurs frais de course (ce n'est pas une paie). */
@Composable
fun GainsLivreurScreen(onConnexion: () -> Unit, viewModel: GainsLivreurViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    CadreBilan("Gains", etat, viewModel::charger, onConnexion) { g -> ContenuGainsLivreur(g) }
}

@Composable
internal fun ContenuGainsLivreur(g: GainsLivreur) {
    BlocChiffres("Aujourd'hui", listOf(g.aujourdhui.courses.toString() to "courses livrées", formaterGnf(g.aujourdhui.fraisGnf) to "frais de course"))
    BlocChiffres("7 derniers jours", listOf(g.semaine.courses.toString() to "courses livrées", formaterGnf(g.semaine.fraisGnf) to "frais de course"))
    Text("Le montant est le frais de livraison de chaque course livrée. Ce n'est pas une paie : la règle de rémunération sera précisée par Speedfood.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Text("Dernières courses", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 6.dp))
    if (g.recentes.isEmpty()) Text("Aucune course livrée ces 7 derniers jours.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    g.recentes.forEach { c -> LigneHistorique(c.reference.ifBlank { "Course" }, listOf(c.restaurantNom, jourHeure(c.livreeLe)).filter { it.isNotBlank() }.joinToString(" · "), formaterGnf(c.fraisGnf)) }
}
