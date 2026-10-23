package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.ActionAuditEquipe
import com.speedfood.app.data.EntreeJournalEquipe
import com.speedfood.app.data.IndicateurAuditEquipe
import com.speedfood.app.data.actionsAuditEquipeFiltrees
import com.speedfood.app.data.cleActionAuditEquipe
import com.speedfood.app.data.cleEntreeAuditEquipe
import com.speedfood.app.data.cleIndicateurAuditEquipe
import com.speedfood.app.data.dateHeureJournalAudit
import com.speedfood.app.data.libelleActionAuditEquipe
import com.speedfood.app.data.libellePeriodeAuditEquipe
import com.speedfood.app.data.miseEnFormeEntreeAudit
import com.speedfood.app.data.resumeJournalAudit
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/**
 * Le journal d'audit : les quatre indicateurs d'activité, les filtres (type d'action, période) et les entrées du journal.
 * L'application ne change rien : elle lit, elle filtre, et elle renvoie vers le site pour la version complète.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuditEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: AuditEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Journal d'audit", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatAuditEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatAuditEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatAuditEquipe.Erreur -> ErreurLecture(e.message, viewModel::charger)
                is EtatAuditEquipe.Pret -> ContenuAudit(e, siteUrl, viewModel)
            }
        }
    }
}

/** Une panne de lecture : toujours en rouge, avec un message qui dit ce qui est cassé et un moyen de réessayer. */
@Composable
private fun ErreurLecture(message: String, onReessayer: () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BlocMessage(message, erreur = true)
        OutlinedButton(onClick = onReessayer, border = BorderStroke(1.dp, Couleurs.Encre)) {
            Text("Réessayer", color = Couleurs.Encre)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ContenuAudit(e: EtatAuditEquipe.Pret, siteUrl: String, viewModel: AuditEquipeViewModel) {
    val ouvreur = LocalUriHandler.current
    var dialogueActions by remember { mutableStateOf(false) }
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Sur cet écran, tout message est une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                Text(
                    "Consulter ne change rien. Le journal d'audit est écrit par le serveur seul : l'application le lit et le filtre, elle n'y écrit jamais.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/audit") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Voir le journal sur le site", color = Couleurs.Encre) }
                if (e.chargementEnCours) {
                    Text("Chargement…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        item(key = "titre-indicateurs") {
            Text("Indicateurs", style = MaterialTheme.typography.titleLarge)
        }
        items(e.donnees.indicateurs, key = { cleIndicateurAuditEquipe(it.cle) }) { indicateur ->
            TuileIndicateur(indicateur)
        }
        item(key = "filtres") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Filtres", style = MaterialTheme.typography.titleLarge)
                OutlinedButton(
                    onClick = { dialogueActions = true },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Type d'action : ${libelleActionAuditEquipe(e.action, e.donnees.actions)}", color = Couleurs.Encre) }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    e.donnees.periodes.forEach { periode ->
                        FilterChip(
                            selected = e.periode == periode.valeur,
                            onClick = { viewModel.filtrerPeriode(periode.valeur) },
                            label = { Text(libellePeriodeAuditEquipe(periode.valeur, e.donnees.periodes)) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue),
                        )
                    }
                }
            }
        }
        item(key = "titre-journal") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Journal", style = MaterialTheme.typography.titleLarge)
                Text(resumeJournalAudit(e.donnees.journal.size), style = MaterialTheme.typography.titleMedium)
                if (e.donnees.tronque) {
                    Text(
                        "Liste incomplète : le journal affiché a atteint sa borne de lecture.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Couleurs.AvertissementTexte,
                    )
                }
            }
        }
        if (e.donnees.journal.isEmpty()) {
            item(key = "journal-sans-entree") {
                Text("Aucune action ne correspond à ces filtres.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        items(e.donnees.journal, key = { cleEntreeAuditEquipe(it.id) }) { entree ->
            CarteEntree(entree, siteUrl)
        }
    }
    if (dialogueActions) {
        DialogueActions(
            actions = e.donnees.actions,
            selection = e.action,
            onChoisir = { dialogueActions = false; viewModel.filtrerAction(it) },
            onFermer = { dialogueActions = false },
        )
    }
}

/** Un indicateur : le chiffre, son libellé et sa définition écrite (le chiffre seul se prête à toutes les interprétations). */
@Composable
private fun TuileIndicateur(indicateur: IndicateurAuditEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(indicateur.valeur.toString(), style = MaterialTheme.typography.headlineMedium, color = Couleurs.Encre)
            Text(indicateur.libelle, style = MaterialTheme.typography.titleMedium)
            Text(indicateur.definition, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/**
 * Sélecteur de type d'action : le catalogue vient du serveur (une centaine d'actions), donc recherche textuelle et liste
 * défilante de hauteur bornée.
 */
@Composable
private fun DialogueActions(
    actions: List<ActionAuditEquipe>,
    selection: String?,
    onChoisir: (String?) -> Unit,
    onFermer: () -> Unit,
) {
    var recherche by remember { mutableStateOf("") }
    val filtrees = actionsAuditEquipeFiltrees(actions, recherche)
    AlertDialog(
        onDismissRequest = onFermer,
        title = { Text("Type d'action") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = recherche,
                    onValueChange = { recherche = it },
                    label = { Text("Rechercher une action") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                LazyColumn(Modifier.heightIn(max = 360.dp)) {
                    item(key = "action-toutes-les-actions") {
                        LigneAction("Toutes les actions", null, selection == null) { onChoisir(null) }
                    }
                    items(filtrees, key = { cleActionAuditEquipe(it.code) }) { action ->
                        LigneAction(action.libelle, action.code, selection == action.code) { onChoisir(action.code) }
                    }
                    if (filtrees.isEmpty()) {
                        item(key = "action-aucune-resultat") {
                            Text("Aucune action ne correspond à cette recherche.", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onFermer) { Text("Fermer", color = Couleurs.Encre) } },
    )
}

/** Une ligne du sélecteur d'action : le libellé, le code en petit, et la pastille de la sélection en cours. */
@Composable
private fun LigneAction(libelle: String, code: String?, choisi: Boolean, onClic: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClic).padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(libelle, style = MaterialTheme.typography.bodyLarge)
            if (!code.isNullOrBlank()) {
                Text(code, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (choisi) Pastille("Choisie", Ton.Succes)
    }
}

/** Une entrée du journal : quand, quoi, par qui, sur quoi et pourquoi. */
@Composable
private fun CarteEntree(entree: EntreeJournalEquipe, siteUrl: String) {
    val ouvreur = LocalUriHandler.current
    val affichee = miseEnFormeEntreeAudit(entree)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(entree.libelle.ifBlank { entree.action }, style = MaterialTheme.typography.titleMedium)
            Text(dateHeureJournalAudit(entree.horodatage), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Par ${affichee.auteur}", style = MaterialTheme.typography.bodyMedium)
            // La cible n'est un lien que si le serveur connaît son adresse sur le site ; sinon elle reste un texte simple.
            if (affichee.cibleUrl != null) {
                TextButton(onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}${affichee.cibleUrl}") }) {
                    Text(affichee.cible, color = Couleurs.RougeFonce, maxLines = 1)
                }
            } else {
                Text(affichee.cible, style = MaterialTheme.typography.bodyMedium)
            }
            affichee.motif?.let {
                Text("Motif : $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
