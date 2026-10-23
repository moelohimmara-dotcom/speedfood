package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.DemandePartenariatEquipe
import com.speedfood.app.data.StatutPartenariatEquipe
import com.speedfood.app.data.aTraiterPartenariatEquipe
import com.speedfood.app.data.libelleFormePartenariatEquipe
import com.speedfood.app.data.libelleStatutPartenariatEquipe
import com.speedfood.app.data.numeroAppel
import com.speedfood.app.data.statutsProposesPartenariatEquipe
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/**
 * Demandes de partenariat (équipe) : qui veut rejoindre Speedfood et par quel moyen ; on répond hors Speedfood (e-mail, téléphone, WhatsApp)
 * puis on fait avancer le statut. Supprimer une demande reste sur le site : c'est irréversible.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PartenariatsEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: PartenariatsEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Partenariats", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatPartenariatsEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatPartenariatsEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatPartenariatsEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatPartenariatsEquipe.Pret -> ContenuPartenariats(e, siteUrl, viewModel::changerStatut)
            }
        }
    }
}

@Composable
private fun ContenuPartenariats(e: EtatPartenariatsEquipe.Pret, siteUrl: String, surStatut: (String, StatutPartenariatEquipe) -> Unit) {
    val ouvreur = LocalUriHandler.current
    val nouvelles = e.partenariats.count { aTraiterPartenariatEquipe(it.statut) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text(
            if (nouvelles == 0) "Aucune demande nouvelle." else "$nouvelles demande(s) à lire et à contacter.",
            style = MaterialTheme.typography.titleMedium,
            color = if (nouvelles == 0) Couleurs.Succes else Couleurs.Danger,
        )
        Text(
            "Les coordonnées sont des données personnelles : elles ne servent qu'à répondre à la demande. Supprimer une demande se fait sur le site.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedButton(
            onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/catalogue/partenariats") },
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, Couleurs.Encre),
        ) { Text("Supprimer une demande sur le site", color = Couleurs.Encre) }
        if (e.partenariats.isEmpty()) {
            Text("Aucune demande pour l'instant. Quand une personne remplit la page « Devenir partenaire », sa demande apparaît ici.", style = MaterialTheme.typography.bodyMedium)
        }
        // Les demandes à lire d'abord, puis les plus récentes.
        e.partenariats.sortedWith(compareByDescending<DemandePartenariatEquipe> { aTraiterPartenariatEquipe(it.statut) }.thenByDescending { it.creeLe }).forEach { d ->
            CartePartenariat(d, e.actionEnCours, ouvreur::openUri, surStatut)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CartePartenariat(d: DemandePartenariatEquipe, occupe: Boolean, ouvrir: (String) -> Unit, surStatut: (String, StatutPartenariatEquipe) -> Unit) {
    val alerte = aTraiterPartenariatEquipe(d.statut)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (alerte) Couleurs.AvertissementFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (alerte) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(d.organisation, style = MaterialTheme.typography.titleMedium)
            Text(
                listOf(d.nomContact, d.creeLe.take(10)).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(libelleFormePartenariatEquipe(d.forme), style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            if (d.message.isNotBlank()) Text(d.message, style = MaterialTheme.typography.bodyMedium)
            Text(d.contact, style = MaterialTheme.typography.bodyMedium)
            // On répond hors Speedfood : e-mail ou téléphone/WhatsApp, comme sur le site.
            if (d.contactType == "email") {
                OutlinedButton(onClick = { ouvrir("mailto:${d.contact}") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                    Text("Répondre par e-mail", color = Couleurs.Encre)
                }
            } else {
                numeroAppel(d.contact)?.let { numero ->
                    OutlinedButton(onClick = { ouvrir("tel:$numero") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                        Text("Appeler ${d.contact}", color = Couleurs.Encre)
                    }
                }
                OutlinedButton(onClick = { ouvrir("https://wa.me/${d.contact.filter { it.isDigit() }}") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                    Text("Répondre sur WhatsApp", color = Couleurs.Encre)
                }
            }
            Text(
                "${libelleStatutPartenariatEquipe(d.statut)} · reçue le ${d.creeLe.take(10)}",
                style = MaterialTheme.typography.labelLarge,
                color = if (alerte) Couleurs.Danger else Couleurs.Encre,
            )
            val propositions = statutsProposesPartenariatEquipe(d.statut)
            if (propositions.isNotEmpty()) {
                Text("Passer à :", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    propositions.forEach { s ->
                        AssistChip(onClick = { surStatut(d.id, s) }, enabled = !occupe, label = { Text(s.libelle) })
                    }
                }
            }
        }
    }
}
