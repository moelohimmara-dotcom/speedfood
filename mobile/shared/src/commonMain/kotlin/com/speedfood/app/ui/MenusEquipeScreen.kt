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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.MenuEquipeResume
import com.speedfood.app.data.PlatMenuEquipe
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Menus à reconfirmer : un menu dont les plats ne sont plus « frais » s'affiche « à confirmer » chez les clients ; l'équipe les reconfirme ici en un geste. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenusEquipeScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: MenusEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    val ouvert = (etat as? EtatMenusEquipe.Pret)?.ouvert
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Menus à reconfirmer", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = { if (ouvert != null) viewModel.ouvrir(null) else onRetour() }) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatMenusEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatMenusEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatMenusEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatMenusEquipe.Pret -> ContenuMenusEquipe(e, viewModel::ouvrir, viewModel::reconfirmerTout, viewModel::reconfirmerPlat, viewModel::definirDisponibilite)
            }
        }
    }
}

@Composable
internal fun ContenuMenusEquipe(
    e: EtatMenusEquipe.Pret,
    surOuvrir: (String?) -> Unit,
    surToutReconfirmer: (String) -> Unit,
    surPlatReconfirmer: (String, String) -> Unit,
    surDisponibilite: (String, String, Boolean) -> Unit,
) {
    var confirmation by remember { mutableStateOf<MenuEquipeResume?>(null) }
    val total = e.menus.sumOf { it.aReconfirmer }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        val ouvert = e.menus.firstOrNull { it.restaurantId == e.ouvert }
        if (ouvert != null) {
            DetailMenu(ouvert, e, surPlatReconfirmer, surDisponibilite) { confirmation = ouvert }
        } else {
            Text(
                "Un plat non reconfirmé depuis ${e.fraicheurHeures} h s'affiche « à confirmer » chez les clients. Appelez le restaurant, puis reconfirmez ses plats ici. $total plat(s) à reconfirmer au total.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (e.menus.isEmpty()) Text("Aucun établissement n'est tenu par l'équipe pour l'instant.", style = MaterialTheme.typography.bodyLarge)
            e.menus.forEach { m -> CarteMenu(m, e.actionEnCours, { surOuvrir(m.restaurantId) }) { confirmation = m } }
        }
    }
    confirmation?.let { m ->
        AlertDialog(
            onDismissRequest = { confirmation = null },
            title = { Text("Reconfirmer tout le menu de ${m.nom} ?") },
            text = { Text("Tous les plats actuellement en vente seront marqués confirmés à l'instant. Ne le faites qu'après avoir joint le restaurant : les clients verront ces plats comme disponibles.") },
            confirmButton = { TextButton(onClick = { confirmation = null; surToutReconfirmer(m.restaurantId) }) { Text("Oui, reconfirmer", color = Couleurs.Danger) } },
            dismissButton = { TextButton(onClick = { confirmation = null }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
}

@Composable
private fun CarteMenu(m: MenuEquipeResume, occupe: Boolean, onOuvrir: () -> Unit, onToutReconfirmer: () -> Unit) {
    val alerte = m.aReconfirmer > 0
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onOuvrir),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (alerte) Couleurs.DangerFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (alerte) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(m.nom, style = MaterialTheme.typography.titleMedium)
            Text("${m.plats} plat(s) · ${m.aReconfirmer} à reconfirmer · ${m.epuises} épuisé(s)", style = MaterialTheme.typography.bodyMedium)
            Text(
                m.derniereConfirmation?.let { "Dernière confirmation : ${it.take(16).replace('T', ' ')}" } ?: "Jamais confirmé",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (alerte) {
                Button(onClick = onToutReconfirmer, enabled = !occupe, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce)) { Text("Tout reconfirmer") }
            }
        }
    }
}

@Composable
private fun DetailMenu(m: MenuEquipeResume, e: EtatMenusEquipe.Pret, surPlatReconfirmer: (String, String) -> Unit, surDisponibilite: (String, String, Boolean) -> Unit, onToutReconfirmer: () -> Unit) {
    Text(m.nom, style = MaterialTheme.typography.headlineSmall)
    if (m.aReconfirmer > 0) {
        Button(onClick = onToutReconfirmer, enabled = !e.actionEnCours, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce)) { Text("Tout reconfirmer (${m.aReconfirmer})") }
    }
    val plats = e.detail?.plats
    if (plats == null) {
        CircularProgressIndicator(color = Couleurs.RougeFonce)
    } else {
        plats.forEach { p -> LignePlat(p, e.actionEnCours, { surPlatReconfirmer(m.restaurantId, p.id) }) { surDisponibilite(m.restaurantId, p.id, it) } }
    }
}

@Composable
private fun LignePlat(p: PlatMenuEquipe, occupe: Boolean, onReconfirmer: () -> Unit, onDisponibilite: (Boolean) -> Unit) {
    val (libelle, couleur) = when (p.etat) {
        "disponible" -> "En vente · confirmé" to Couleurs.Succes
        "a_confirmer" -> "À reconfirmer" to Couleurs.Danger
        else -> "Épuisé" to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(p.nom, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Text(formaterGnf(p.prix), style = MaterialTheme.typography.labelLarge)
            }
            Text(libelle + (p.confirmeLe?.let { " · ${it.take(16).replace('T', ' ')}" } ?: ""), style = MaterialTheme.typography.labelMedium, color = couleur)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (p.disponible && p.etat == "a_confirmer") OutlinedButton(onClick = onReconfirmer, enabled = !occupe, border = BorderStroke(1.dp, Couleurs.Encre)) { Text("Reconfirmer", color = Couleurs.Encre) }
                OutlinedButton(onClick = { onDisponibilite(!p.disponible) }, enabled = !occupe, border = BorderStroke(1.dp, if (p.disponible) Couleurs.Danger else Couleurs.Encre)) {
                    Text(if (p.disponible) "Marquer épuisé" else "Remettre en vente", color = if (p.disponible) Couleurs.Danger else Couleurs.Encre)
                }
            }
        }
    }
}
