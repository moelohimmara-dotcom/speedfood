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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.SuiviCommande
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

private val ETAPES = listOf("en_attente" to "Envoyée", "acceptee" to "Acceptée", "prete" to "Prête", "terminee" to "Terminée")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuiviScreen(jeton: String, onRetour: () -> Unit, viewModel: SuiviViewModel = koinViewModel(parameters = { parametersOf(jeton) })) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Suivi de commande", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatSuivi.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatSuivi.Introuvable -> MessageEtat("Cette commande est introuvable.", "Retour", onRetour)
                is EtatSuivi.Erreur -> MessageEtat(e.message, "Retour", onRetour)
                is EtatSuivi.Pret -> Column(Modifier.fillMaxSize()) {
                    PrimerNotifications()
                    Box(Modifier.weight(1f)) { ContenuSuivi(e, viewModel::repondre) }
                }
            }
        }
    }
}

@Composable
internal fun ContenuSuivi(e: EtatSuivi.Pret, surReponse: (Boolean) -> Unit) {
    val s: SuiviCommande = e.suivi
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(s.reference, style = MaterialTheme.typography.headlineMedium)
        Text(s.restaurant.nom, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        val termine = s.statut in STATUTS_FINAUX
        val ton = when (s.statut) {
            "refusee", "annulee" -> Ton.Danger
            "acceptee", "prete", "terminee" -> Ton.Succes
            else -> Ton.Neutre
        }
        Pastille(libelleStatut(s.statut, s.etatDerive), ton)
        e.alerte?.let { BlocMessage(it, erreur = false) }

        if (s.statut !in setOf("refusee", "annulee")) {
            val indexActuel = ETAPES.indexOfFirst { it.first == s.statut }.coerceAtLeast(0)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                ETAPES.forEachIndexed { i, (_, nom) ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                        Box(
                            Modifier.padding(bottom = 4.dp),
                        ) {
                            Text(if (i <= indexActuel) "●" else "○", color = if (i <= indexActuel) Couleurs.Succes else Couleurs.Secondaire, style = MaterialTheme.typography.titleMedium)
                        }
                        Text(nom, style = MaterialTheme.typography.labelMedium, color = if (i <= indexActuel) Couleurs.Encre else Couleurs.Secondaire)
                    }
                }
            }
        }

        s.propositionActive?.let { p ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.medium,
                colors = CardDefaults.cardColors(containerColor = Couleurs.AvertissementFond),
                border = BorderStroke(1.dp, Couleurs.Mangue),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Le restaurant propose un changement", style = MaterialTheme.typography.titleMedium, color = Couleurs.AvertissementTexte)
                    Text("Nouveau total des plats : ${formaterGnf(p.nouveauSousTotal)} (au lieu de ${formaterGnf(s.sousTotal)}).", style = MaterialTheme.typography.bodyMedium)
                    if (p.nouveauxFraisLivraison > 0) Text("Frais de livraison : ${formaterGnf(p.nouveauxFraisLivraison)}.", style = MaterialTheme.typography.bodyMedium)
                    p.conditionsModifiees?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
                    Text("Rien n'est préparé tant que vous n'avez pas répondu.", style = MaterialTheme.typography.labelMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        androidx.compose.material3.Button(
                            onClick = { surReponse(true) },
                            enabled = !e.envoiReponse,
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme),
                        ) { Text("Accepter", style = MaterialTheme.typography.labelLarge) }
                        OutlinedButton(onClick = { surReponse(false) }, enabled = !e.envoiReponse, border = BorderStroke(2.dp, Couleurs.Encre)) {
                            Text("Refuser", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                        }
                    }
                }
            }
        }
        e.reponse?.let { BlocMessage(it, erreur = false) }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
            border = BorderStroke(1.dp, Couleurs.Bordure),
        ) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Votre commande", style = MaterialTheme.typography.titleMedium)
                s.lignes.forEach { l ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${l.quantite} × ${l.nom}" + if (l.options.isNotEmpty()) " (+ ${l.options.joinToString(", ") { it.nom }})" else "", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Text(formaterGnf(l.prix * l.quantite), style = MaterialTheme.typography.bodyMedium)
                    }
                }
                if (s.fraisLivraisonEstime > 0) Text("Livraison estimée : ${formaterGnf(s.fraisLivraisonEstime)}", style = MaterialTheme.typography.bodyMedium)
                Text("Total : ${formaterGnf(s.total)}", style = MaterialTheme.typography.titleMedium)
                Text("Vous réglez directement le restaurant.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (!termine) Text("Cet écran se met à jour tout seul.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
