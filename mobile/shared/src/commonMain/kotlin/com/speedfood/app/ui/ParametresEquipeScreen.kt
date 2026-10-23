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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.ReglageEquipe
import com.speedfood.app.data.reglagesEquipe
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/**
 * Les réglages globaux de l'application, en lecture seule : pratique en assistance (quel délai de proposition ? quel plafond de prix ?
 * quel numéro d'assistance ?). Les modifier reste sur le site, où le formulaire est validé, tracé au journal d'audit et borné par la base.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParametresEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: ParametresEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Paramètres", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatParametresEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatParametresEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatParametresEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatParametresEquipe.Pret -> ContenuParametres(e, siteUrl)
            }
        }
    }
}

@Composable
private fun ContenuParametres(e: EtatParametresEquipe.Pret, siteUrl: String) {
    val ouvreur = LocalUriHandler.current
    val reglages = reglagesEquipe(e.parametres)
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Sur cet écran, tout message est une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                Text(
                    "Règles métier appliquées à toute l'application. Consulter ne change rien : la modification se fait sur le site, où chaque changement est validé puis tracé au journal d'audit.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/parametres") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Modifier les paramètres sur le site", color = Couleurs.Encre) }
            }
        }
        items(reglages, key = { it.libelle }) { reglage ->
            CarteReglage(reglage)
        }
    }
}

@Composable
private fun CarteReglage(reglage: ReglageEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(reglage.libelle, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            Text(reglage.valeur, style = MaterialTheme.typography.titleMedium, color = Couleurs.Encre)
        }
    }
}
