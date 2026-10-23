package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import com.speedfood.app.data.FonctionnaliteEquipe
import com.speedfood.app.data.MiseAJourEquipe
import com.speedfood.app.data.cleInterrupteurEquipe
import com.speedfood.app.data.cleJournalEquipe
import com.speedfood.app.data.dateCourteEquipe
import com.speedfood.app.data.libelleEtatFonctionnalite
import com.speedfood.app.data.libelleGroupeFonctionnalite
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import org.koin.compose.viewmodel.koinViewModel

/**
 * L'état des mises à jour : la version publiée, la dernière annonce envoyée aux téléphones, les interrupteurs pilotables et le journal
 * des nouveautés livrées. L'application montre l'état ; elle ne bascule rien et n'annonce rien (ces actions ont un effet immédiat sur
 * le public, ou envoient des notifications : elles restent sur le site).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MisesAJourEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: MisesAJourEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Mises à jour", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatMisesAJourEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatMisesAJourEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatMisesAJourEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatMisesAJourEquipe.Pret -> ContenuMisesAJour(e, siteUrl)
            }
        }
    }
}

@Composable
private fun ContenuMisesAJour(e: EtatMisesAJourEquipe.Pret, siteUrl: String) {
    val ouvreur = LocalUriHandler.current
    val donnees = e.donnees
    val coupees = donnees.fonctionnalites.count { !it.active }
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "section-entete") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Sur cet écran, tout message est une panne de lecture : il doit ressembler à une erreur, pas à une information.
                e.message?.let { BlocMessage(it, erreur = true) }
                Text(
                    "Version publiée : ${donnees.version.nom} (numéro ${donnees.version.code}). ${donnees.appareils} appareil(s) enregistré(s) pour les notifications.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    donnees.annonce?.let {
                        "Dernière annonce : version ${it.versionNom}, le ${dateCourteEquipe(it.annonceeLe)} (${it.envoyes} notifié(s) sur ${it.appareils})."
                    } ?: "Aucune version n'a encore été annoncée.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Consulter ne change rien. Annoncer une version envoie une notification à tous les téléphones, et basculer un interrupteur retire une fonctionnalité au public : ces deux actions restent sur le site.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/mises-a-jour") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Annoncer la version sur le site", color = Couleurs.Encre) }
            }
        }
        item(key = "section-etat-general") {
            Text(
                if (coupees == 0) {
                    "Tout est actif : ${donnees.fonctionnalites.size} fonctionnalités pilotables, aucune coupée."
                } else {
                    "$coupees fonctionnalité(s) coupée(s) sur ${donnees.fonctionnalites.size}. Les visiteurs ne les voient plus ; les données déjà enregistrées ne sont pas touchées."
                },
                style = MaterialTheme.typography.bodyMedium,
                color = if (coupees == 0) Couleurs.Succes else Couleurs.Danger,
            )
        }
        item(key = "section-titre-interrupteurs") {
            Text("Interrupteurs", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 4.dp))
        }
        if (donnees.fonctionnalites.isEmpty()) {
            item(key = "section-vide-interrupteurs") {
                Text("Aucune fonctionnalité pilotable n'est enregistrée.", style = MaterialTheme.typography.bodyMedium)
            }
        }
        items(donnees.fonctionnalites, key = { cleInterrupteurEquipe(it.cle) }) { fonctionnalite ->
            CarteFonctionnalite(fonctionnalite)
        }
        item(key = "section-titre-journal") {
            Text("Nouveautés livrées", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        }
        items(donnees.misesAJour, key = { cleJournalEquipe(it.id) }) { miseAJour ->
            CarteMiseAJour(miseAJour)
        }
    }
}

@Composable
private fun CarteFonctionnalite(fonctionnalite: FonctionnaliteEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(fonctionnalite.libelle, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Pastille(libelleEtatFonctionnalite(fonctionnalite.active), if (fonctionnalite.active) Ton.Succes else Ton.Danger)
            }
            Text(fonctionnalite.description, style = MaterialTheme.typography.bodyMedium)
            Text(
                "${libelleGroupeFonctionnalite(fonctionnalite.groupe)} · dernière modification le ${dateCourteEquipe(fonctionnalite.miseAJourLe)}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun CarteMiseAJour(miseAJour: MiseAJourEquipe) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(dateCourteEquipe(miseAJour.date), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(miseAJour.titre, style = MaterialTheme.typography.titleMedium)
                }
                when (miseAJour.active) {
                    true -> Pastille("Active", Ton.Succes)
                    false -> Pastille("Coupée", Ton.Danger)
                    null -> Pastille("Toujours active", Ton.Neutre)
                }
            }
            Text(miseAJour.resume, style = MaterialTheme.typography.bodyMedium)
            Text("Vérifier : ${miseAJour.verification}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            miseAJour.raisonSansInterrupteur?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
