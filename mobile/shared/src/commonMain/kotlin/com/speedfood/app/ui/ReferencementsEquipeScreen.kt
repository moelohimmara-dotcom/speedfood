package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.DemandeReferencement
import com.speedfood.app.data.StatutDemande
import com.speedfood.app.data.aRappeler
import com.speedfood.app.data.libelleStatutDemande
import com.speedfood.app.data.libelleTypeEtablissement
import com.speedfood.app.data.numeroAppel
import com.speedfood.app.data.statutsProposes
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Demandes de référencement (équipe) : qui veut rejoindre Speedfood, à rappeler en premier ; on appelle et on change le statut ici ; créer la fiche se fait sur le site. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferencementsEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: ReferencementsEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Référencements", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatReferencements.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatReferencements.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatReferencements.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatReferencements.Pret -> ContenuReferencements(e, siteUrl, viewModel::changerStatut)
            }
        }
    }
}

@Composable
internal fun ContenuReferencements(e: EtatReferencements.Pret, siteUrl: String, surStatut: (String, StatutDemande) -> Unit) {
    val ouvreur = LocalUriHandler.current
    val nouvelles = e.demandes.count { aRappeler(it) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text(
            if (nouvelles == 0) "Aucune demande à rappeler." else "$nouvelles demande(s) à rappeler sous 48 heures.",
            style = MaterialTheme.typography.titleMedium,
            color = if (nouvelles == 0) Couleurs.Succes else Couleurs.Danger,
        )
        Text("Les coordonnées sont des données personnelles : elles ne servent qu'à rappeler la personne. Créer la fiche de l'établissement ou supprimer une demande se fait sur le site.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/catalogue/referencements") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
            Text("Créer une fiche sur le site", color = Couleurs.Encre)
        }
        if (e.demandes.isEmpty()) Text("Aucune demande pour l'instant. Quand un établissement remplit la page « Demander à être référencé », sa demande apparaît ici.", style = MaterialTheme.typography.bodyMedium)
        // Les demandes à rappeler d'abord, puis les plus récentes.
        e.demandes.sortedWith(compareByDescending<DemandeReferencement> { aRappeler(it) }.thenByDescending { it.creeLe }).forEach { d ->
            CarteDemande(d, e.actionEnCours, ouvreur::openUri, surStatut)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CarteDemande(d: DemandeReferencement, occupe: Boolean, ouvrir: (String) -> Unit, surStatut: (String, StatutDemande) -> Unit) {
    var aConfirmer by remember(d.id) { mutableStateOf<StatutDemande?>(null) }
    val alerte = aRappeler(d)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (alerte) Couleurs.AvertissementFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (alerte) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(d.organisation, style = MaterialTheme.typography.titleMedium)
            Text(
                libelleTypeEtablissement(d.type) + " · " + listOf(d.quartier, d.commune).filter { it.isNotBlank() }.joinToString(", "),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            listOfNotNull(d.categories, d.specialites).filter { it.isNotBlank() }.takeIf { it.isNotEmpty() }?.let { Text(it.joinToString(" · "), style = MaterialTheme.typography.bodySmall) }
            d.indications?.takeIf { it.isNotBlank() }?.let { Text("Indications : $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Text("Responsable : ${d.responsable}", style = MaterialTheme.typography.bodyMedium)
            Text("${libelleStatutDemande(d.statut)} · reçue le ${d.creeLe.take(10)}", style = MaterialTheme.typography.labelLarge, color = if (alerte) Couleurs.Danger else Couleurs.Encre)
            numeroAppel(d.telephone)?.let { numero ->
                OutlinedButton(onClick = { ouvrir("tel:$numero") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) { Text("Appeler ${d.telephone}", color = Couleurs.Encre) }
            }
            val propositions = statutsProposes(d)
            if (propositions.isNotEmpty()) {
                Text("Passer à :", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    propositions.forEach { s ->
                        AssistChip(
                            onClick = { if (s == StatutDemande.Refusee) aConfirmer = s else surStatut(d.id, s) },
                            enabled = !occupe,
                            label = { Text(s.libelle) },
                        )
                    }
                }
            } else if (d.etablissementCree) {
                Text("Établissement créé : la demande ne change plus.", style = MaterialTheme.typography.bodySmall, color = Couleurs.Succes)
            }
        }
    }
    aConfirmer?.let { s ->
        AlertDialog(
            onDismissRequest = { aConfirmer = null },
            title = { Text("Marquer « ${s.libelle} » ?") },
            text = { Text("La demande de ${d.organisation} sera classée comme refusée. Vous pourrez la remettre dans un autre statut.") },
            confirmButton = { TextButton(onClick = { aConfirmer = null; surStatut(d.id, s) }) { Text("Confirmer", color = Couleurs.Danger) } },
            dismissButton = { TextButton(onClick = { aConfirmer = null }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
}
