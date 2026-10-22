package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import com.speedfood.app.disponibilite.ancienneteLisible
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import kotlin.time.Clock

/** Compte et historique des commandes : celles du compte (serveur) et celles de cet appareil, avec « commander à nouveau ». */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MesCommandesScreen(
    onRetour: () -> Unit,
    onOuvrir: (String) -> Unit,
    onConnexion: () -> Unit,
    onPanier: () -> Unit,
    racine: Boolean = false,
    viewModel: MesCommandesViewModel = koinViewModel(),
    sessionService: SessionService = koinInject(),
) {
    val session by sessionService.session.collectAsState()
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(if (racine) "Mes commandes" else "Mon compte", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { if (!racine) IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (racine) {
                if (session == null) {
                    BlocMessage("Vous n'êtes pas connecté. Connectez-vous pour envoyer des commandes et retrouver votre historique.", erreur = false)
                    BoutonPrincipal("Me connecter", surClic = onConnexion)
                }
            } else if (session != null) {
                Text(session?.email ?: "Compte connecté", style = MaterialTheme.typography.titleMedium)
                OutlinedButton(onClick = viewModel::essaiNotification, border = BorderStroke(1.dp, Couleurs.Bordure)) {
                    Text("Tester les notifications", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
                OutlinedButton(
                    onClick = viewModel::deconnecter,
                    border = BorderStroke(2.dp, Couleurs.Encre),
                ) { Text("Me déconnecter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre) }
            } else {
                BlocMessage("Vous n'êtes pas connecté. Connectez-vous pour envoyer des commandes et retrouver votre historique.", erreur = false)
                BoutonPrincipal("Me connecter", surClic = onConnexion)
            }
            if (!racine) Text("Mes commandes", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            etat.alerte?.let { BlocMessage(it, erreur = false) }
            etat.message?.let { BlocMessage(it, erreur = false) }
            if (etat.chargement && etat.commandes.isEmpty()) {
                Text("Chargement…", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else if (etat.commandes.isEmpty()) {
                Text("Aucune commande pour l'instant.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            etat.commandes.forEach { c ->
                CarteCommande(c, onOuvrir, onRecommander = { viewModel.recommander(c, onPanier) }, actif = !etat.recommandeEnCours)
            }
        }
    }
}

@Composable
internal fun CarteCommande(c: CommandeAffichee, onOuvrir: (String) -> Unit, onRecommander: () -> Unit = {}, actif: Boolean = true) {
    val age = c.creeLeMillis?.let { Clock.System.now().toEpochMilliseconds() - it }
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onOuvrir(c.jeton) },
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(c.reference, style = MaterialTheme.typography.titleMedium)
                    Text(c.restaurantNom, style = MaterialTheme.typography.bodyMedium)
                    val detail = listOfNotNull(if (c.livraison) "Livraison" else "Retrait", age?.let { ancienneteLisible(it) }).joinToString(" · ")
                    Text(detail, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(formaterGnf(c.total), style = MaterialTheme.typography.labelLarge)
            }
            c.statut?.let { s ->
                val ton = when (s) {
                    "refusee", "annulee" -> Ton.Danger
                    "acceptee", "prete", "terminee" -> Ton.Succes
                    else -> Ton.Neutre
                }
                Pastille(libelleStatut(s), ton)
            }
            if (c.peutRecommander) {
                OutlinedButton(onClick = onRecommander, enabled = actif, border = BorderStroke(2.dp, Couleurs.Encre)) {
                    Text("Commander à nouveau", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
            }
        }
    }
}
