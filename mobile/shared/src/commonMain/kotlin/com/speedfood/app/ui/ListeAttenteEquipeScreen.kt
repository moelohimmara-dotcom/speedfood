package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
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
import com.speedfood.app.data.ZoneAttenteEquipe
import com.speedfood.app.data.libelleNiveauAttenteEquipe
import com.speedfood.app.data.nonPrevenuesEquipe
import com.speedfood.app.data.resumeZoneAttenteEquipe
import com.speedfood.app.data.zoneAMarquerPrevenueEquipe
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/**
 * Liste d'attente (équipe) : les zones où des personnes attendent un restaurant, et combien. L'application n'affiche que des nombres : quand un
 * restaurant ouvre, on contacte les personnes hors Speedfood puis on marque la zone comme prévenue. L'export des contacts et leur suppression
 * (irréversible) se font sur le site.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ListeAttenteEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: ListeAttenteEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Liste d'attente", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatListeAttenteEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatListeAttenteEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatListeAttenteEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatListeAttenteEquipe.Pret -> ContenuListeAttente(e, siteUrl, viewModel::marquerPrevenue)
            }
        }
    }
}

@Composable
private fun ContenuListeAttente(e: EtatListeAttenteEquipe.Pret, siteUrl: String, surPrevenue: (String, String) -> Unit) {
    val ouvreur = LocalUriHandler.current
    val total = e.zones.sumOf { it.personnes }
    val prevenues = e.zones.sumOf { it.prevenues }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text("$total personne(s) en attente", style = MaterialTheme.typography.titleMedium)
        Text(
            "${e.zones.size} zone(s) concernée(s) · $prevenues personne(s) déjà prévenue(s)",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            "Seuls des nombres sont affichés : les contacts sont des données personnelles, ils sortent par l'export — et se suppriment — sur le site.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedButton(
            onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/catalogue/liste-attente") },
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, Couleurs.Encre),
        ) { Text("Exporter les contacts sur le site", color = Couleurs.Encre) }
        if (e.zones.isEmpty()) {
            Text("Personne n'attend pour l'instant. Quand quelqu'un s'inscrit dans une zone sans restaurant, la zone apparaît ici.", style = MaterialTheme.typography.bodyMedium)
        }
        e.zones.forEach { z -> CarteZone(z, e.actionEnCours, surPrevenue) }
    }
}

@Composable
private fun CarteZone(z: ZoneAttenteEquipe, occupe: Boolean, surPrevenue: (String, String) -> Unit) {
    val restantes = nonPrevenuesEquipe(z.personnes, z.prevenues)
    // Un bouton inactif doit le PARAÎTRE : sans traitement visuel, il ressemble à un bouton actif et le clic ne fait rien (audit du 23 octobre 2026).
    val actif = !occupe && zoneAMarquerPrevenueEquipe(z.personnes, z.prevenues)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(z.nom, style = MaterialTheme.typography.titleMedium)
            Text(
                listOf(libelleNiveauAttenteEquipe(z.niveau), z.contexte).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${z.personnes} personne(s) en attente", style = MaterialTheme.typography.bodyMedium)
                Text("${z.prevenues} prévenue(s)", style = MaterialTheme.typography.labelMedium, color = Couleurs.Encre)
            }
            Text("Dernière inscription le ${z.derniere.take(10)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                resumeZoneAttenteEquipe(z.personnes, z.prevenues),
                style = MaterialTheme.typography.bodySmall,
                color = if (restantes > 0) Couleurs.Danger else Couleurs.Secondaire,
            )
            OutlinedButton(
                onClick = { surPrevenue(z.niveau, z.id) },
                enabled = actif,
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, if (actif) Couleurs.Encre else Couleurs.Bordure),
            ) { Text("Marquer comme prévenues", color = if (actif) Couleurs.Encre else Couleurs.DesactiveTexte) }
        }
    }
}
