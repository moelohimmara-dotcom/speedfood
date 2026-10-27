package com.speedfood.app.ui

import com.speedfood.app.data.dateLisible
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
import com.speedfood.app.data.PaiementVu
import com.speedfood.app.data.PaiementsEquipe
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleEtatPaiement
import com.speedfood.app.data.libelleVersement
import com.speedfood.app.data.paiementEnAlerte
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Paiements en ligne (équipe) : état du paiement en ligne, chiffres de tête, liste. LECTURE SEULE : les décisions qui déplacent de l'argent restent sur le site. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaiementsEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: PaiementsEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Paiements", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatBilan.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatBilan.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatBilan.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatBilan.Pret -> ContenuPaiementsEquipe(e.donnees, e.message, siteUrl)
            }
        }
    }
}

@Composable
internal fun ContenuPaiementsEquipe(p: PaiementsEquipe, message: String?, siteUrl: String) {
    val ouvreur = LocalUriHandler.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        message?.let { BlocMessage(it, erreur = false) }
        BlocMessage(
            if (p.reglages.actif) "Paiement en ligne allumé, fournisseur : " + (if (p.reglages.fournisseur == "simulation") "démonstration (aucun argent réel)." else "Chap Chap Pay.")
            else "Paiement en ligne éteint : les clients ne le voient pas.",
            erreur = false,
        )
        if (!p.reglages.valeursValidees) Text("Les frais, délais et plafonds sont des valeurs de simulation : elles n'ont pas été validées.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Compteur("En attente du client", p.compteurs.enAttente, false, Modifier.weight(1f))
            Compteur("Versements à traiter", p.compteurs.versementsATraiter, p.compteurs.versementsATraiter > 0, Modifier.weight(1f))
            Compteur("Litiges à décider", p.compteurs.litigesAHumain, p.compteurs.litigesAHumain > 0, Modifier.weight(1f))
        }
        Text("Cet écran est en lecture seule : reprendre un versement ou trancher un litige déplace de l'argent et se fait sur le site.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedButton(onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/paiements") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
            Text("Ouvrir les décisions sur le site", color = Couleurs.Encre)
        }
        if (p.paiements.isEmpty()) Text("Aucun paiement en ligne. Un paiement apparaît ici quand un client choisit de payer en ligne sur sa page de suivi.", style = MaterialTheme.typography.bodyMedium)
        p.paiements.forEach { CartePaiement(it) }
    }
}

@Composable
private fun Compteur(libelle: String, valeur: Int, alerte: Boolean, modifier: Modifier) {
    Card(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (alerte) Couleurs.DangerFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (alerte) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(10.dp)) {
            Text(valeur.toString(), style = MaterialTheme.typography.headlineSmall, color = if (alerte) Couleurs.Danger else Couleurs.Encre)
            Text(libelle, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun CartePaiement(p: PaiementVu) {
    val alerte = paiementEnAlerte(p)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (alerte) Couleurs.DangerFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (alerte) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(p.commandeReference, style = MaterialTheme.typography.titleMedium)
                Text(libelleEtatPaiement(p.etat), style = MaterialTheme.typography.labelLarge, color = if (alerte) Couleurs.Danger else Couleurs.Encre)
            }
            Text(p.restaurantNom + " · " + (if (p.operateur == "orange_money") "Orange Money" else "MTN MoMo") + if (p.fournisseur == "simulation") " · démonstration" else "", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(formaterGnf(p.totalGnf), style = MaterialTheme.typography.titleSmall)
            Text(
                "Restaurant ${formaterGnf(p.restaurantGnf)}" + (if (p.livreurGnf > 0) " · livreur ${formaterGnf(p.livreurGnf)}" else "") + " · Speedfood ${formaterGnf(p.speedfoodBrutGnf)} − frais ${formaterGnf(p.fraisMobileGnf)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            p.versements.forEach { v ->
                Text(
                    (if (v.beneficiaire == "restaurant") "Restaurant" else "Livreur") + " : ${libelleVersement(v.etat)} (${formaterGnf(v.montantGnf)})" + (v.erreurCode?.let { " · ${it.replace('_', ' ')}" } ?: ""),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            p.litiges.forEach { l -> Text("Litige : ${l.situation.replace('_', ' ')} · " + (if (l.etat == "a_humain") "à décider" else l.etat), style = MaterialTheme.typography.bodySmall, color = Couleurs.Danger) }
            if (p.rembourseGnf > 0) Text("Remboursé : ${formaterGnf(p.rembourseGnf)}", style = MaterialTheme.typography.bodySmall)
            Text("Créé : ${dateLisible(p.creeLe)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
