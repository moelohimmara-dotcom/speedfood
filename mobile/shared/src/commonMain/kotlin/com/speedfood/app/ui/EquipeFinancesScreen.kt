package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.FinancesEquipe
import com.speedfood.app.data.LigneFinanceEquipe
import com.speedfood.app.data.cleLigneFinanceEquipe
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleStatutVersementFinance
import com.speedfood.app.data.tauxFinanceAffiche
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EquipeFinancesScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: EquipeFinancesViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        topBar = {
            TopAppBar(
                title = { Text("Finances") },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatBilan.Chargement -> MessageEtat("Chargement des finances…", "Actualiser", viewModel::charger)
                EtatBilan.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatBilan.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatBilan.Pret -> ContenuEquipeFinances(e.donnees, e.message, siteUrl)
            }
        }
    }
}

@Composable
internal fun ContenuEquipeFinances(finances: FinancesEquipe, message: String?, siteUrl: String) {
    val ouvreur = LocalUriHandler.current
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item(key = "finances-entete") {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 12.dp)) {
                message?.let { BlocMessage(it, erreur = false) }
                Text("Période : 1–31 octobre 2026", style = MaterialTheme.typography.titleMedium)
                Text("Rythme factice : ${finances.parametres.rythme} · devise ${finances.parametres.devise}", style = MaterialTheme.typography.bodySmall)
                Text("Taux affichés = développement uniquement : aucun taux ne peut être modifié dans l'application.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                TextButton(onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/finances") }) { Text("Modifier ou exporter : ouvrir le site") }
            }
        }
        items(finances.releve, key = { cleLigneFinanceEquipe(it.etablissementId) }) { ligne -> CarteLigneFinance(ligne) }
        if (finances.releve.isEmpty()) item(key = "finances-vide") { Text("Aucun relevé pour cette période.", modifier = Modifier.padding(vertical = 20.dp)) }
    }
}

@Composable
private fun CarteLigneFinance(ligne: LigneFinanceEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(ligne.etablissementNom, style = MaterialTheme.typography.titleMedium)
                Text(libelleStatutVersementFinance(ligne.versement.statut), style = MaterialTheme.typography.labelLarge)
            }
            Text("Taux : ${tauxFinanceAffiche(ligne.taux)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            TexteMontant("Ventes", ligne.ventesGnf)
            TexteMontant("Commission", ligne.commissionGnf)
            TexteMontant("Frais de livraison", ligne.fraisLivraisonGnf)
            TexteMontant("Remboursements", ligne.remboursementsGnf)
            TexteMontant("Net à reverser", ligne.netAReverserGnf)
            ligne.versement.reference?.let { Text("Référence de versement : $it", style = MaterialTheme.typography.bodySmall) }
            Text("Le versement et toute reprise restent sur le site.", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun TexteMontant(libelle: String, montant: Int) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(libelle, style = MaterialTheme.typography.bodyMedium)
        Text(formaterGnf(montant), style = if (libelle == "Net à reverser") MaterialTheme.typography.titleSmall else MaterialTheme.typography.bodyMedium)
    }
}
