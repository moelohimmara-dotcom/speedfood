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
import com.speedfood.app.data.BanniereEquipe
import com.speedfood.app.data.libelleStatutBanniereEquipe
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/**
 * La bibliothèque de médias : les images utilisées par les bannières. Lecture seule, et pas un espace d'envoi : l'image se joint à une
 * bannière depuis l'écran « Bannières » du site, pour ne pas dupliquer ce flux.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MediasEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: MediasEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Médias", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatMediasEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatMediasEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatMediasEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatMediasEquipe.Pret -> ContenuMedias(e, siteUrl)
            }
        }
    }
}

@Composable
private fun ContenuMedias(e: EtatMediasEquipe.Pret, siteUrl: String) {
    val ouvreur = LocalUriHandler.current
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Sur cet écran, tout message est une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                Text(
                    if (e.medias.size == 1) "1 image utilisée par une bannière" else "${e.medias.size} images utilisées par une bannière",
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
                    "Images actuellement utilisées par une bannière. Pour ajouter ou remplacer une image, passez par l'écran « Bannières » du site.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/contenu/bannieres") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Ajouter une image sur le site", color = Couleurs.Encre) }
            }
        }
        if (e.medias.isEmpty()) {
            item(key = "vide") {
                Text("Aucune bannière n'a d'image pour l'instant.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        items(e.medias, key = { it.id }) { media ->
            CarteMedia(media)
        }
    }
}

@Composable
private fun CarteMedia(media: BanniereEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            ImageBanniere(media.imageUrl, 140.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(media.titre, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Pastille(
                    libelleStatutBanniereEquipe(media.statut),
                    if (media.statut == "publie") Ton.Succes else Ton.Neutre,
                )
            }
        }
    }
}
