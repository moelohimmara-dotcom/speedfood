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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import com.speedfood.app.data.JOURS_SEMAINE
import com.speedfood.app.data.JourHoraire
import com.speedfood.app.data.cleJourHoraire
import com.speedfood.app.data.clePlatAReconfirmer
import com.speedfood.app.data.resumeHoraires
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.etatRestaurant
import com.speedfood.app.disponibilite.libelleEtat
import org.koin.compose.viewmodel.koinViewModel

/**
 * Les réglages du poste de travail : les horaires d'ouverture que le restaurateur déclare, les plats à reconfirmer et les deux préférences du
 * téléphone (son des nouvelles commandes, mode « poste fixe »).
 *
 * Ce que l'application n'écrit pas : le menu et ses prix. Publier un prix engage le client, cela reste sur le site.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurateurReglagesScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: RestaurateurReglagesViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Horaires et poste de travail", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatReglages.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatReglages.NonConnecte -> MessageEtat(
                    "Connectez-vous avec le compte de votre restaurant pour déclarer vos horaires et régler votre poste de travail.",
                    "Me connecter",
                    onConnexion,
                )
                is EtatReglages.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatReglages.Pret -> ContenuReglages(e, siteUrl, viewModel)
            }
        }
    }
}

@Composable
private fun ContenuReglages(e: EtatReglages.Pret, siteUrl: String, viewModel: RestaurateurReglagesViewModel) {
    val etatService = etatRestaurant(e.reglages.ouvert, e.reglages.accepteCommandes)
    val libelleService = libelleEtat(etatService)
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                e.message?.let { BlocMessage(it, erreur = false) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Service", style = MaterialTheme.typography.labelLarge)
                    Pastille(libelleService.texte, libelleService.ton)
                }
                Text(
                    "La pause se met et se lève depuis la console des commandes : « Mettre en pause » coupe les nouvelles commandes sans fermer le restaurant.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item(key = "titre-horaires") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Horaires d'ouverture", style = MaterialTheme.typography.titleLarge)
                Text(resumeHoraires(e.horaires), style = MaterialTheme.typography.titleMedium)
                Text(
                    "Vos horaires sont visibles par vos clients sur le site. Ils ne disent pas quand vous êtes en pause : la pause, elle, se lève depuis la console.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (e.horairesLibres) {
                    BlocMessage(
                        "Les horaires enregistrés sur le site ne sont pas dans le format de l'application : ils sont affichés tels quels et ne seront remplacés que si vous enregistrez ci-dessous.",
                        erreur = false,
                    )
                    Text(e.reglages.horaires, style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        items(e.horaires.jours.sortedBy { it.index }, key = { cleJourHoraire(it.index) }) { jour ->
            LigneJourHoraire(jour, !e.enregistrementEnCours) { nouveau -> viewModel.modifierJour(jour.index) { nouveau } }
        }

        item(key = "actions-horaires") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = viewModel::enregistrerHoraires,
                    enabled = !e.enregistrementEnCours,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme),
                ) {
                    Text(if (e.enregistrementEnCours) "Enregistrement…" else "Enregistrer les horaires")
                }
                if (e.enregistrementEnCours) {
                    Text("Enregistrement en cours.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        item(key = "titre-plats") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Plats à reconfirmer (${e.reglages.platsAReconfirmer.size})", style = MaterialTheme.typography.titleLarge)
                Text(
                    "Speedfood demande de reconfirmer un plat dont la disponibilité n'a pas été rafraîchie depuis un moment : c'est le serveur qui décide, l'application se contente de l'annoncer. Confirmez que le plat est toujours disponible.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        if (e.reglages.platsAReconfirmer.isEmpty()) {
            item(key = "aucun-plat") {
                Text("Aucun plat à reconfirmer.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            items(e.reglages.platsAReconfirmer, key = { clePlatAReconfirmer(it.id) }) { plat ->
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(plat.nom, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                    OutlinedButton(
                        onClick = { viewModel.confirmerPlat(plat.id) },
                        enabled = !e.actionEnCours,
                        border = BorderStroke(1.dp, Couleurs.Encre),
                    ) { Text("Confirmer", color = Couleurs.Encre) }
                }
            }
            item(key = "tout-confirmer") {
                OutlinedButton(
                    onClick = viewModel::toutConfirmer,
                    enabled = !e.actionEnCours,
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Tout confirmer", color = Couleurs.Encre) }
            }
        }

        item(key = "titre-son") {
            Text("Son des nouvelles commandes", style = MaterialTheme.typography.titleLarge)
        }

        item(key = "interrupteur-son") {
            InterrupteurReglage(
                libelle = if (e.sonActif) "Activé" else "Coupe",
                actif = e.sonActif,
                modifiable = true,
                aide = "Le téléphone sonne à chaque nouvelle commande à traiter. Le volume est celui de votre téléphone (réglage « Notifications ») : Speedfood ne change jamais le volume.",
                surChangement = viewModel::basculerSon,
            )
        }

        item(key = "titre-poste-fixe") {
            Text("Poste fixe", style = MaterialTheme.typography.titleLarge)
        }

        item(key = "interrupteur-poste-fixe") {
            InterrupteurReglage(
                libelle = if (e.posteFixe) "Activé" else "Coupe",
                actif = e.posteFixe,
                modifiable = true,
                aide = "L'écran de la console reste allumé et l'alerte continue tant que le restaurant est ouvert. Coupez-le pour laisser le téléphone s'éteindre.",
                surChangement = viewModel::basculerPosteFixe,
            )
        }

        item(key = "pied") {
            Text(
                "Le menu et ses prix se publient sur le site : ${siteUrl.trimEnd('/')}/restaurant",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Un jour de la semaine : ouvert ou fermé, avec les deux heures quand il est ouvert. */
@Composable
private fun LigneJourHoraire(jour: JourHoraire, modifiable: Boolean, surChangement: (JourHoraire) -> Unit) {
    val nom = JOURS_SEMAINE.getOrElse(jour.index) { "Jour ${jour.index + 1}" }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(nom, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Switch(
                    checked = jour.ouvert,
                    onCheckedChange = { surChangement(jour.copy(ouvert = it)) },
                    enabled = modifiable,
                    colors = SwitchDefaults.colors(checkedTrackColor = Couleurs.Succes, checkedThumbColor = Couleurs.Surface),
                )
            }
            if (jour.ouvert) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = jour.ouverture,
                        onValueChange = { surChangement(jour.copy(ouverture = it)) },
                        label = { Text("Ouverture") },
                        singleLine = true,
                        enabled = modifiable,
                        modifier = Modifier.weight(1f),
                    )
                    OutlinedTextField(
                        value = jour.fermeture,
                        onValueChange = { surChangement(jour.copy(fermeture = it)) },
                        label = { Text("Fermeture") },
                        singleLine = true,
                        enabled = modifiable,
                        modifier = Modifier.weight(1f),
                    )
                }
            } else {
                Text("Fermé", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

/** Un interrupteur de réglage : l'état est écrit, l'aide dit ce que le réglage change (et ce qu'il ne change pas). */
@Composable
private fun InterrupteurReglage(libelle: String, actif: Boolean, modifiable: Boolean, aide: String, surChangement: (Boolean) -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(libelle, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
                Switch(
                    checked = actif,
                    onCheckedChange = surChangement,
                    enabled = modifiable,
                    colors = SwitchDefaults.colors(checkedTrackColor = Couleurs.Succes, checkedThumbColor = Couleurs.Surface),
                )
            }
            Text(aide, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
