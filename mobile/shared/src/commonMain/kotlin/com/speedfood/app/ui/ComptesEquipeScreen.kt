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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.CompteEquipe
import com.speedfood.app.data.TypeCompteEquipe
import com.speedfood.app.data.dateCourteEquipe
import com.speedfood.app.data.libelleRoleSystemeEquipe
import com.speedfood.app.data.libellesAffiliationEquipe
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/**
 * Annuaire des comptes (équipe) : qui existe sur Speedfood, son rôle système, ses restaurants, sa date de création. Lecture seule : on
 * filtre et on cherche un compte, mais supprimer un compte, en supprimer plusieurs d'un coup, réinitialiser les questions de sécurité ou
 * attribuer un rôle reste sur le site : ces actions sont irréversibles ou réservées à `super_admin`.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComptesEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: ComptesEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Comptes", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatComptesEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatComptesEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatComptesEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatComptesEquipe.Pret -> ContenuComptes(e, siteUrl, viewModel)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ContenuComptes(e: EtatComptesEquipe.Pret, siteUrl: String, viewModel: ComptesEquipeViewModel) {
    val ouvreur = LocalUriHandler.current
    // Le champ suit la recherche appliquée : ce qui est écrit dans le champ est ce qui a été cherché.
    var saisie by remember(e.recherche) { mutableStateOf(e.recherche) }
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Sur cet écran, tout message est une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                OutlinedTextField(
                    value = saisie,
                    onValueChange = { saisie = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Rechercher par e-mail") },
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { viewModel.rechercher(saisie) }),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { viewModel.rechercher(saisie) }) { Text("Rechercher", color = Couleurs.Encre) }
                    if (saisie.isNotBlank()) {
                        TextButton(onClick = { saisie = ""; viewModel.rechercher("") }) { Text("Effacer", color = Couleurs.Encre) }
                    }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    TypeCompteEquipe.entries.forEach { type ->
                        FilterChip(
                            selected = e.filtre == type,
                            onClick = { viewModel.filtrer(type) },
                            label = { Text(type.libelle) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue),
                        )
                    }
                }
                Text(
                    if (e.comptes.size == 1) "1 compte" else "${e.comptes.size} comptes",
                    style = MaterialTheme.typography.titleMedium,
                )
                if (e.tronque) {
                    Text(
                        "Liste incomplète : l'annuaire a atteint sa borne de lecture. Affinez la recherche par e-mail pour trouver un compte absent.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Couleurs.AvertissementTexte,
                    )
                }
                Text(
                    "Consulter l'annuaire ne change rien. Supprimer un compte, en supprimer plusieurs d'un coup, réinitialiser les questions de sécurité ou attribuer un rôle se fait sur le site : ces actions sont irréversibles.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/acces/comptes") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Supprimer un compte sur le site", color = Couleurs.Encre) }
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/acces/roles") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Attribuer un rôle sur le site", color = Couleurs.Encre) }
                if (e.chargementEnCours) {
                    Text("Chargement…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (e.comptes.isEmpty()) {
            item(key = "vide") {
                Text("Aucun compte ne correspond à cette recherche.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        items(e.comptes, key = { it.utilisateurId }) { compte ->
            CarteCompte(compte)
        }
    }
}

@Composable
private fun CarteCompte(compte: CompteEquipe) {
    val role = libelleRoleSystemeEquipe(compte.roleSysteme)
    val affiliations = libellesAffiliationEquipe(compte.restaurants)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(compte.email, style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (role != null) Pastille(role, Ton.Succes)
                if (role == null && affiliations.isEmpty()) Pastille("Sans affiliation", Ton.Neutre)
                if (compte.test) Pastille("Test", Ton.Neutre)
            }
            affiliations.forEach { ligne ->
                Text(ligne, style = MaterialTheme.typography.bodyMedium, color = Couleurs.Encre)
            }
            Text(
                "Créé le ${dateCourteEquipe(compte.creeLe)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
