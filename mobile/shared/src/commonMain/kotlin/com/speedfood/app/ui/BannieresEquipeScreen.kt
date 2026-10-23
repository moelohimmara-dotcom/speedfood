package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import com.speedfood.app.data.BanniereEquipe
import com.speedfood.app.data.StatutBanniereEquipe
import com.speedfood.app.data.dateCourteEquipe
import com.speedfood.app.data.libelleStatutBanniereEquipe
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/**
 * Les bannières diffusées sur les écrans publics : on regarde ce qui est en ligne, on filtre par statut. L'application ne publie rien :
 * créer, publier ou supprimer une bannière se fait sur le site, parce qu'une bannière publiée change ce que voit le public.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BannieresEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: BannieresEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Bannières", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatBannieresEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatBannieresEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatBannieresEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatBannieresEquipe.Pret -> ContenuBannieres(e, siteUrl, viewModel)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ContenuBannieres(e: EtatBannieresEquipe.Pret, siteUrl: String, viewModel: BannieresEquipeViewModel) {
    val ouvreur = LocalUriHandler.current
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Sur cet écran, tout message est une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    StatutBanniereEquipe.entries.forEach { statut ->
                        FilterChip(
                            selected = e.filtre == statut,
                            onClick = { viewModel.filtrer(statut) },
                            label = { Text(statut.libelle) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue),
                        )
                    }
                }
                Text(
                    if (e.bannieres.size == 1) "1 bannière" else "${e.bannieres.size} bannières",
                    style = MaterialTheme.typography.titleMedium,
                )
                if (e.tronque) {
                    Text(
                        "Liste incomplète : l'affichage a atteint sa borne de lecture.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Couleurs.AvertissementTexte,
                    )
                }
                Text(
                    "Consulter ne change rien. Créer, publier, dépublier ou supprimer une bannière se fait sur le site : une bannière publiée apparaît sur les écrans du public.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/contenu/bannieres") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Publier une bannière sur le site", color = Couleurs.Encre) }
                if (e.chargementEnCours) {
                    Text("Chargement…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (e.bannieres.isEmpty()) {
            item(key = "vide") {
                Text("Aucune bannière ne correspond à ce filtre.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        items(e.bannieres, key = { it.id }) { banniere ->
            CarteBanniere(banniere)
        }
    }
}

@Composable
private fun CarteBanniere(banniere: BanniereEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (!banniere.imageUrl.isNullOrBlank()) {
                ImageBanniere(banniere.imageUrl, 120.dp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(banniere.titre, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Pastille(
                    libelleStatutBanniereEquipe(banniere.statut),
                    if (banniere.statut == "publie") Ton.Succes else Ton.Neutre,
                )
            }
            if (banniere.texte.isNotBlank()) {
                Text(banniere.texte, style = MaterialTheme.typography.bodyMedium)
            }
            if (!banniere.lien.isNullOrBlank()) {
                Text("Lien : ${banniere.lien}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(
                "Ordre ${banniere.ordre} · créée le ${dateCourteEquipe(banniere.creeLe)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
