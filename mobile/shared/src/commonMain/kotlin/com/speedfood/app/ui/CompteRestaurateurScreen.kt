package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/**
 * Onglet « Compte » de la coque du restaurateur qui n'a pas encore d'espace : son identité, les réglages, « Changer de profil », les liens légaux, la déconnexion et la suppression du compte.
 * Rien du monde du client (ni commandes, ni adresses, ni favoris).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CompteRestaurateurScreen(onParametres: () -> Unit, config: SpeedfoodConfig = koinInject(), viewModel: CompteViewModel = koinViewModel()) {
    val session by viewModel.connexion.collectAsState()
    val ouvreur = LocalUriHandler.current
    var deconnexion by remember { mutableStateOf(false) }
    var suppression by remember { mutableStateOf(false) }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopAppBar(title = { Text("Compte", style = MaterialTheme.typography.titleLarge) }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            CarteMarche(Modifier.fillMaxWidth()) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(Modifier.size(52.dp).background(Couleurs.Mangue, CircleShape), contentAlignment = Alignment.Center) {
                        val initiale = session?.email?.take(1)?.uppercase()
                        if (initiale != null) Text(initiale, style = MaterialTheme.typography.titleLarge, color = Couleurs.Encre) else Icon(IconesApp.Compte, contentDescription = null, tint = Couleurs.Encre)
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(session?.email ?: "Compte connecté", style = MaterialTheme.typography.titleMedium)
                        Text("Compte Speedfood · restaurateur", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            LigneMenu("Paramètres", IconesApp.Reglages, "Notifications, mises à jour, cet appareil", onParametres)
            LigneChangerProfil()
            TitreRubrique("Informations")
            LigneMenu("Conditions d'utilisation", IconesApp.Info) { ouvreur.openUri("${config.siteUrl.trimEnd('/')}/conditions") }
            LigneMenu("Confidentialité", IconesApp.Cadenas) { ouvreur.openUri("${config.siteUrl.trimEnd('/')}/confidentialite") }
            OutlinedButton(onClick = { deconnexion = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), border = BorderStroke(2.dp, Couleurs.Encre)) {
                Text("Me déconnecter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
            TextButton(onClick = { suppression = true }, modifier = Modifier.fillMaxWidth()) {
                Text("Supprimer mon compte", style = MaterialTheme.typography.labelLarge, color = Couleurs.Danger)
            }
            Text("Speedfood ${viewModel.infos.versionNom}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
    }
    if (deconnexion) DialogueDeconnexion(surAnnuler = { deconnexion = false }, surConfirmer = { effacer -> deconnexion = false; viewModel.deconnecter(effacer) })
    if (suppression) DialogueSuppressionCompte(surAnnuler = { suppression = false }, surConfirmer = { mot -> suppression = false; viewModel.supprimerCompte(mot) })
}
