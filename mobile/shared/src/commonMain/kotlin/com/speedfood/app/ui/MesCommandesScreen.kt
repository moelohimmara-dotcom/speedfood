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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.ancienneteLisible
import org.koin.compose.koinInject
import kotlin.time.Clock

/** Compte et commandes passées depuis cet appareil (la référence et le jeton de suivi reçus à l'envoi sont gardés sur le téléphone). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MesCommandesScreen(
    onRetour: () -> Unit,
    onOuvrir: (String) -> Unit,
    onConnexion: () -> Unit,
    locales: CommandesLocales = koinInject(),
    sessionService: SessionService = koinInject(),
) {
    val session by sessionService.session.collectAsState()
    var commandes by remember { mutableStateOf(locales.lister()) }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Mon compte", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (session != null) {
                Text(session?.email ?: "Compte connecté", style = MaterialTheme.typography.titleMedium)
                OutlinedButton(
                    onClick = {
                        sessionService.deconnecter()
                        locales.oublier()
                        commandes = emptyList()
                    },
                    border = BorderStroke(2.dp, Couleurs.Encre),
                ) { Text("Me déconnecter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre) }
            } else {
                BlocMessage("Vous n'êtes pas connecté. Connectez-vous pour envoyer des commandes.", erreur = false)
                BoutonPrincipal("Me connecter", surClic = onConnexion)
            }
            Text("Mes commandes", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            if (commandes.isEmpty()) {
                Text("Aucune commande passée depuis cet appareil pour l'instant.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            commandes.forEach { CarteCommandeLocale(it, onOuvrir) }
        }
    }
}

@Composable
internal fun CarteCommandeLocale(c: CommandeLocale, onOuvrir: (String) -> Unit) {
    val age = Clock.System.now().toEpochMilliseconds() - c.creeLe
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onOuvrir(c.jeton) },
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(c.reference, style = MaterialTheme.typography.titleMedium)
                Text(c.restaurantNom, style = MaterialTheme.typography.bodyMedium)
                Text(ancienneteLisible(age), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(formaterGnf(c.total), style = MaterialTheme.typography.labelLarge)
        }
    }
}
