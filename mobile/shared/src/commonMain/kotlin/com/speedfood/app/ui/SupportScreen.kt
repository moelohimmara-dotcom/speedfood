package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.CommandeSupport
import com.speedfood.app.data.STATUTS_RECHERCHE
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleStatutCommande
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

/** Support des commandes : recherche par référence, statut, « du jour ». Les coordonnées des clients restent masquées dans cette liste. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportCommandesScreen(onRetour: () -> Unit, onConnexion: () -> Unit, onOuvrir: (String) -> Unit, viewModel: SupportViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Support commandes", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatSupport.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatSupport.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatSupport.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::rechercher)
                is EtatSupport.Pret -> ContenuSupport(e, viewModel::definirReference, viewModel::definirStatut, viewModel::basculerJour, viewModel::rechercher, onOuvrir)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ContenuSupport(
    e: EtatSupport.Pret,
    surReference: (String) -> Unit,
    surStatut: (String) -> Unit,
    surJour: () -> Unit,
    surRecherche: () -> Unit,
    surOuvrir: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(
            value = e.reference,
            onValueChange = surReference,
            label = { Text("Référence de la commande") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = surRecherche, enabled = !e.enCours, colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce)) { Text(if (e.enCours) "Recherche…" else "Rechercher") }
            FilterChip(selected = e.jour, onClick = surJour, label = { Text("Du jour") })
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            STATUTS_RECHERCHE.chunked(4).forEach { ligne ->
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ligne.forEach { s -> FilterChip(selected = e.statut == s, onClick = { surStatut(s) }, label = { Text(if (s == "tous") "Tous" else libelleStatutCommande(s)) }) }
                }
            }
        }
        Text("${e.commandes.size} commande(s)", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        e.commandes.forEach { CarteCommandeSupport(it) { surOuvrir(it.id) } }
    }
}

@Composable
private fun CarteCommandeSupport(c: CommandeSupport, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(c.reference, style = MaterialTheme.typography.titleMedium)
                Text(libelleStatutCommande(c.statut), style = MaterialTheme.typography.labelLarge, color = Couleurs.RougeFonce)
            }
            Text("${c.restaurantNom} · ${formaterGnf(c.total)}", style = MaterialTheme.typography.bodyMedium)
            Text("${c.clientNom} · ${c.telephoneAffiche}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Détail d'une commande pour le support : historique, propositions, changement de statut et révélation des coordonnées (chacun avec un motif obligatoire, tracé). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DetailSupportScreen(commandeId: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: DetailSupportViewModel = koinViewModel(parameters = { parametersOf(commandeId) })) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Commande", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatDetailSupport.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatDetailSupport.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatDetailSupport.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatDetailSupport.Pret -> ContenuDetailSupport(e, viewModel::changerStatut, viewModel::reveler)
            }
        }
    }
}

@Composable
internal fun ContenuDetailSupport(e: EtatDetailSupport.Pret, surStatut: (String, String) -> Unit, surReveler: (String) -> Unit) {
    val c = e.detail.commande
    var motifPour by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text(c.reference, style = MaterialTheme.typography.headlineSmall)
        Text("${libelleStatutCommande(c.statut)} · ${c.restaurantNom}", style = MaterialTheme.typography.titleMedium, color = Couleurs.RougeFonce)
        Text("Plats ${formaterGnf(c.sousTotal)} + livraison ${formaterGnf(c.fraisLivraisonEstime)} = ${formaterGnf(c.total)}", style = MaterialTheme.typography.bodyMedium)

        Text("Client", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        Text(c.clientNom, style = MaterialTheme.typography.bodyLarge)
        val coordonnees = e.coordonnees
        if (coordonnees != null) {
            Text("Téléphone : ${coordonnees.telephone}", style = MaterialTheme.typography.bodyMedium)
            Text("Adresse : ${coordonnees.adresse.ifBlank { "—" }}", style = MaterialTheme.typography.bodyMedium)
            Text("Consultation tracée dans le journal d'audit.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            Text("Téléphone : ${c.telephoneAffiche}", style = MaterialTheme.typography.bodyMedium)
            Text("Adresse : ${c.adresseAffichee.ifBlank { "—" }}", style = MaterialTheme.typography.bodyMedium)
            if (e.detail.peutReveler) {
                OutlinedButton(onClick = { motifPour = "reveler" }, enabled = !e.actionEnCours, border = BorderStroke(1.dp, Couleurs.Encre)) { Text("Révéler les coordonnées", color = Couleurs.Encre) }
            }
        }

        if (e.detail.transitions.isNotEmpty()) {
            Text("Action de support", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            Text("Le client et le restaurant voient ce changement. Un motif est obligatoire.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            e.detail.transitions.forEach { vers ->
                OutlinedButton(onClick = { motifPour = vers }, enabled = !e.actionEnCours, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Danger)) {
                    Text("Passer à « ${libelleStatutCommande(vers)} »", color = Couleurs.Danger)
                }
            }
        }

        if (c.propositions.isNotEmpty()) {
            Text("Propositions du restaurant", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            c.propositions.forEach { p ->
                Text(
                    "v${p.version} · ${formaterGnf(p.sousTotalPrecedent)} → ${formaterGnf(p.nouveauSousTotal)} (livraison ${formaterGnf(p.nouveauxFraisLivraison)}) · ${p.statut}" + (p.conditionsModifiees?.let { " · $it" } ?: ""),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }

        Text("Historique", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        c.historique.forEach { h ->
            Text(
                "${h.horodatage.take(16).replace('T', ' ')} · ${h.statutPrecedent?.let { libelleStatutCommande(it) + " → " } ?: ""}${libelleStatutCommande(h.statutSuivant)} · ${h.acteur}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
    motifPour?.let { cible -> DialogueMotif(titre = if (cible == "reveler") "Révéler les coordonnées" else "Passer à « ${libelleStatutCommande(cible)} »", surAnnuler = { motifPour = null }) { motif ->
        motifPour = null
        if (cible == "reveler") surReveler(motif) else surStatut(cible, motif)
    } }
}

/** Saisie d'un motif obligatoire (500 caractères au plus) avant une action sensible ; le serveur le revérifie et le journalise. */
@Composable
internal fun DialogueMotif(titre: String, surAnnuler: () -> Unit, surConfirmer: (String) -> Unit) {
    var motif by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text(titre) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Indiquez pourquoi (obligatoire, tracé dans le journal d'audit).", style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(value = motif, onValueChange = { if (it.length <= 500) motif = it }, label = { Text("Motif") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
            }
        },
        confirmButton = { TextButton(onClick = { surConfirmer(motif) }, enabled = motif.isNotBlank()) { Text("Confirmer", color = Couleurs.Danger) } },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Retour", color = Couleurs.Encre) } },
    )
}
