package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import com.speedfood.app.data.CommandeHistorique
import com.speedfood.app.data.cleCommandeHistorique
import com.speedfood.app.data.dateHeureCommande
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleMode
import com.speedfood.app.data.libelleStatutCommande
import com.speedfood.app.data.resumeHistorique
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/**
 * L'historique des commandes du restaurant, page par page : ce qui s'est passé avant ce que la console montre en direct.
 *
 * Une commande terminée est un fait passé : l'application la lit, elle ne la modifie pas. Les coordonnées du client ne sont pas dans
 * l'historique : une commande vieille d'une semaine n'a pas à laisser traîner un numéro.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurateurHistoriqueScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: RestaurateurHistoriqueViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Historique des commandes", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatHistorique.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatHistorique.NonConnecte -> MessageEtat(
                    "Connectez-vous avec le compte de votre restaurant pour consulter l'historique de vos commandes.",
                    "Me connecter",
                    onConnexion,
                )
                is EtatHistorique.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatHistorique.Pret -> ContenuHistorique(e, viewModel)
            }
        }
    }
}

@Composable
private fun ContenuHistorique(e: EtatHistorique.Pret, viewModel: RestaurateurHistoriqueViewModel) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Ici, le message vient toujours d'une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                Text("Historique des commandes", style = MaterialTheme.typography.titleLarge)
                Text(resumeHistorique(e.commandes.size, e.total), style = MaterialTheme.typography.titleMedium)
                Text(
                    "Les commandes d'essai ne sont pas dans cet historique : elles ne comptent pas dans vos chiffres réels.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        if (e.commandes.isEmpty()) {
            item(key = "vide") {
                Text("Aucune commande dans l'historique.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        items(e.commandes, key = { cleCommandeHistorique(it.id) }) { commande ->
            CarteCommandeHistorique(commande)
        }

        item(key = "suite") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (e.pageSuivante != null) {
                    OutlinedButton(
                        onClick = viewModel::chargerPageSuivante,
                        enabled = !e.chargementEnCours,
                        modifier = Modifier.fillMaxWidth(),
                        border = BorderStroke(1.dp, Couleurs.Encre),
                    ) { Text(if (e.chargementEnCours) "Chargement…" else "Charger la suite", color = Couleurs.Encre) }
                } else if (e.commandes.isNotEmpty()) {
                    Text("Vous avez vu toutes les commandes.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

/** Une commande de l'historique : sa référence, sa date, son état et son montant. */
@Composable
private fun CarteCommandeHistorique(commande: CommandeHistorique) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(commande.reference, style = MaterialTheme.typography.titleMedium)
                Text(formaterGnf(commande.total), style = MaterialTheme.typography.titleMedium)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Pastille(libelleStatutCommande(commande.statut), tonStatutCommande(commande.statut))
                Text(libelleMode(commande.mode), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(dateHeureCommande(commande.creeLe), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                if (commande.nbLignes > 0) "${commande.nbLignes} article(s)" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Un statut terminé est une bonne nouvelle, un statut refusé ou annulé ne l'est pas : la couleur suit le statut. */
private fun tonStatutCommande(statut: String): Ton = when (statut) {
    "terminee" -> Ton.Succes
    "refusee", "annulee" -> Ton.Danger
    else -> Ton.Neutre
}
