package com.speedfood.app.ui

import com.speedfood.app.data.dateLisible
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.AvisAModerer
import com.speedfood.app.data.DecisionAvis
import com.speedfood.app.data.SignalementAvis
import com.speedfood.app.data.controleDecision
import com.speedfood.app.data.decisionsPossibles
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Modération des avis (équipe) : les signalements à examiner, une décision motivée par avis, puis les alertes de qualité. Permission `commande.support`, tout est journalisé. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AvisEquipeScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: AvisEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Avis", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatAvisEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatAvisEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatAvisEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatAvisEquipe.Pret -> ContenuAvisEquipe(e, viewModel::decider)
            }
        }
    }
}

@Composable
internal fun ContenuAvisEquipe(e: EtatAvisEquipe.Pret, surDecision: (String, DecisionAvis, String) -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text("Les avis sont publiés tout de suite et modérés après coup : examinez les signalements, masquez un commentaire ou annulez une note, toujours avec un motif.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Signalements à examiner (${e.avis.signalements.size})", style = MaterialTheme.typography.titleLarge)
        if (e.avis.signalements.isEmpty()) Text("Aucun signalement. Quand un client ou un restaurant signale un avis, il apparaît ici.", style = MaterialTheme.typography.bodyMedium)
        e.avis.signalements.forEach { s -> CarteSignalement(s, e.actionEnCours, surDecision) }
        Text("Alertes de qualité (${e.avis.alertes.size})", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 6.dp))
        if (e.avis.alertes.isEmpty()) Text("Aucune alerte : un restaurant ou un livreur apparaît ici sous 3,5 sur 5 avec 5 notes au moins.", style = MaterialTheme.typography.bodyMedium)
        e.avis.alertes.forEach { a ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                colors = CardDefaults.cardColors(containerColor = Couleurs.AvertissementFond),
                border = BorderStroke(1.dp, Couleurs.Bordure),
            ) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(a.cible, style = MaterialTheme.typography.titleMedium)
                    Text(libelleAlerte(a.type), style = MaterialTheme.typography.bodyMedium, color = Couleurs.AvertissementTexte)
                    Text(a.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

internal fun libelleAlerte(type: String): String = when (type) {
    "restaurant_sous_seuil" -> "Restaurant sous 3,5 sur 5"
    "livreur_sous_seuil" -> "Livreur sous 3,5 sur 5"
    "livreur_trois_mauvaises" -> "Livreur : trois mauvaises notes de suite"
    else -> "Alerte de qualité"
}

@Composable
private fun CarteSignalement(s: SignalementAvis, occupe: Boolean, surDecision: (String, DecisionAvis, String) -> Unit) {
    var motif by remember(s.avisId) { mutableStateOf("") }
    var erreur by remember(s.avisId) { mutableStateOf<String?>(null) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("${s.restaurantNom} · ${s.note} sur 5", style = MaterialTheme.typography.titleMedium)
            if (s.statutAvis != "publie") Text(if (s.statutAvis == "annule") "Note annulée" else "Commentaire masqué", style = MaterialTheme.typography.labelLarge, color = Couleurs.Danger)
            Text(s.commentaire ?: "(pas de commentaire)", style = MaterialTheme.typography.bodyMedium)
            Text("Signalé : ${dateLisible(s.date)} · motif : ${s.motif}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(
                value = motif,
                onValueChange = { motif = it.take(300); erreur = null },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Motif de la décision") },
                supportingText = { Text("Obligatoire pour masquer ou annuler ; facultatif sinon.") },
            )
            erreur?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = Couleurs.Danger) }
            decisionsPossibles(s.statutAvis).forEach { d ->
                OutlinedButton(
                    onClick = { controleDecision(d, motif)?.let { erreur = it } ?: surDecision(s.avisId, d, motif) },
                    enabled = !occupe,
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, if (d.motifExige) Couleurs.Danger else Couleurs.Encre),
                ) { Text(d.libelle, color = if (d.motifExige) Couleurs.Danger else Couleurs.Encre) }
            }
        }
    }
}
