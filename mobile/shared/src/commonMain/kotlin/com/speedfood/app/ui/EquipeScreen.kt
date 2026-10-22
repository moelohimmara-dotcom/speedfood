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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.ActionEquipe
import com.speedfood.app.data.CommandeEquipe
import com.speedfood.app.data.EntreeMenuEquipe
import com.speedfood.app.data.actionsEquipe
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.numeroAppel
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/** Espace équipe Speedfood : le menu du compte, comme sur le site `/system`. Une section native s'ouvre dans l'application, les autres sur le site. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, onRepartition: () -> Unit, onSupport: () -> Unit = {}, onLivraisons: () -> Unit = {}, onLivreurs: () -> Unit = {}, viewModel: EquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Équipe Speedfood", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatEquipe.Refuse -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatEquipe.Pret -> ContenuEquipe(e, siteUrl, onRepartition, onSupport, onLivraisons, onLivreurs)
            }
        }
    }
}

@Composable
internal fun ContenuEquipe(e: EtatEquipe.Pret, siteUrl: String, onRepartition: () -> Unit, onSupport: () -> Unit = {}, onLivraisons: () -> Unit = {}, onLivreurs: () -> Unit = {}) {
    val ouvreur = LocalUriHandler.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Rôle : ${libelleRole(e.acces.role)}", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        e.acces.groupes.forEach { groupe ->
            Text(groupe.libelle, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            groupe.entrees.forEach { entree ->
                CarteSection(entree) {
                    when (entree.chemin) {
                        "/system/repartition" -> onRepartition()
                        "/system/commandes" -> onSupport()
                        "/system/livraisons" -> onLivraisons()
                        "/system/livraisons/livreurs" -> onLivreurs()
                        else -> ouvreur.openUri("${siteUrl.trimEnd('/')}${entree.chemin}")
                    }
                }
            }
        }
        Text(
            "Les sections marquées « sur le site » s'ouvrent dans votre navigateur ; elles passent progressivement dans l'application.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun CarteSection(entree: EntreeMenuEquipe, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(entree.libelle, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
            Text(if (entree.natif) "Dans l'application" else "Sur le site", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private fun libelleRole(role: String) = when (role) {
    "super_admin" -> "Super administrateur"
    "operations" -> "Opérations"
    "content_editor" -> "Éditeur de contenu"
    "support" -> "Support"
    else -> role
}

/** Poste de répartition : les commandes actives des établissements tenus par l'équipe ; on joint le restaurant, on confirme, on suit, on remet. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RepartitionScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: RepartitionViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Répartition", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                actions = { TextButton(onClick = viewModel::actualiser) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatRepartition.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatRepartition.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatRepartition.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::actualiser)
                is EtatRepartition.Pret -> ContenuRepartition(e, viewModel::agir)
            }
        }
    }
}

@Composable
internal fun ContenuRepartition(e: EtatRepartition.Pret, surAction: (String, String) -> Unit) {
    val groupes = listOf(
        "À confirmer" to e.commandes.filter { it.statut == "en_attente" },
        "En préparation" to e.commandes.filter { it.statut == "acceptee" },
        "Prêtes" to e.commandes.filter { it.statut == "prete" },
    )
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Commandes des établissements tenus par l'équipe. Joignez le restaurant, confirmez, suivez la préparation puis la remise. La liste se met à jour toute seule.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        e.message?.let { BlocMessage(it, erreur = false) }
        if (e.commandes.isEmpty()) Text("Aucune commande en cours.", style = MaterialTheme.typography.bodyLarge)
        groupes.filter { it.second.isNotEmpty() }.forEach { (titre, liste) ->
            Text("$titre (${liste.size})", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            liste.forEach { CarteCommandeEquipe(it, e.actionEnCours, surAction) }
        }
    }
}

@Composable
private fun CarteCommandeEquipe(c: CommandeEquipe, occupe: Boolean, surAction: (String, String) -> Unit) {
    val ouvreur = LocalUriHandler.current
    var aConfirmer by remember { mutableStateOf<ActionEquipe?>(null) }
    val numero = numeroAppel(c.telephoneRestaurant)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(c.restaurantNom, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                if (c.estTest) Pastille("Test", Ton.Neutre)
            }
            Text("${c.reference} · ${formaterGnf(c.total)}", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            c.lignes.forEach { Text("${it.quantite} × ${it.nom}", style = MaterialTheme.typography.bodyMedium) }
            if (numero != null) {
                @OptIn(ExperimentalLayoutApi::class)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    TextButton(onClick = { ouvreur.openUri("tel:$numero") }) { Text("Appeler le restaurant", color = Couleurs.RougeFonce, maxLines = 1) }
                    TextButton(onClick = { ouvreur.openUri("https://wa.me/${numero.filter { it.isDigit() }}") }) { Text("WhatsApp", color = Couleurs.Encre, maxLines = 1) }
                }
            } else {
                Text("Aucun numéro à joindre pour cet établissement : ajoutez-le sur sa fiche (site).", style = MaterialTheme.typography.bodySmall, color = Couleurs.Danger)
            }
            actionsEquipe(c.statut).forEach { a ->
                if (a.destructive) {
                    OutlinedButton(onClick = { aConfirmer = a }, enabled = !occupe, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Danger)) {
                        Text(a.libelle, color = Couleurs.Danger)
                    }
                } else {
                    Button(onClick = { surAction(c.id, a.code) }, enabled = !occupe, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce)) {
                        Text(a.libelle)
                    }
                }
            }
        }
    }
    aConfirmer?.let { a ->
        AlertDialog(
            onDismissRequest = { aConfirmer = null },
            title = { Text("${a.libelle} ?") },
            text = { Text("${c.restaurantNom} · ${c.reference}. Cette action prévient le client et ne se défait pas.") },
            confirmButton = { TextButton(onClick = { aConfirmer = null; surAction(c.id, a.code) }) { Text("Oui, ${a.libelle.replaceFirstChar { it.lowercase() }}", color = Couleurs.Danger) } },
            dismissButton = { TextButton(onClick = { aConfirmer = null }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
}
