package com.speedfood.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.EtatInstallation
import com.speedfood.app.data.InstallationMiseAJour
import com.speedfood.app.data.SuiviMiseAJour
import com.speedfood.app.data.VersionPubliee
import org.koin.compose.koinInject

/** Bandeau « Mise à jour disponible » en haut de l'application : installe la nouvelle version en un geste ; « Plus tard » le masque pour cette version (sauf version obligatoire). */
@Composable
fun BandeauMiseAJour(modifier: Modifier = Modifier) {
    val suivi: SuiviMiseAJour = koinInject()
    val installation: InstallationMiseAJour = koinInject()
    var version by remember { mutableStateOf<VersionPubliee?>(null) }
    LaunchedEffect(Unit) { version = suivi.verifier() }
    val proposee = version ?: return
    val etat by installation.etat.collectAsState()
    Surface(modifier.fillMaxWidth().statusBarsPadding(), color = MaterialTheme.colorScheme.primaryContainer, tonalElevation = 3.dp) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Mise à jour disponible : version ${proposee.nom}", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            if (proposee.notes.isNotBlank() && etat == EtatInstallation.Repos) Text(proposee.notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            ActionMiseAJour(proposee, suivi.urlTelechargement, installation, etat) {
                if (!proposee.obligatoire) {
                    TextButton(onClick = {
                        suivi.reporter(proposee)
                        version = null
                    }) { Text("Plus tard") }
                }
            }
        }
    }
}

/**
 * Le bouton de mise à jour et l'avancement, partagés par le bandeau et la page Compte. Sans installation en un geste (plateforme ou serveur), il ouvre la page de
 * téléchargement. [avant] reçoit les boutons secondaires (« Plus tard »).
 */
@Composable
fun ActionMiseAJour(
    version: VersionPubliee,
    urlTelechargement: String,
    installation: InstallationMiseAJour,
    etat: EtatInstallation,
    avant: @Composable () -> Unit = {},
) {
    val ouvreur = LocalUriHandler.current
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        when (etat) {
            is EtatInstallation.Telechargement -> {
                Text(
                    "Téléchargement… ${etat.pourcent} %" + if (version.apkTaille > 0) " (${version.apkTaille / 1_000_000} Mo)" else "",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                LinearProgressIndicator(progress = { etat.pourcent / 100f }, modifier = Modifier.fillMaxWidth())
            }
            EtatInstallation.Installation -> Text(
                "Confirmez l'installation dans la fenêtre du système. Speedfood redémarrera ensuite.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
            )
            EtatInstallation.AutorisationRequise -> {
                Text(
                    "Autorisez Speedfood à installer ses mises à jour dans le réglage qui s'est ouvert, puis revenez ici et reprenez.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Button(onClick = { installation.lancer(version) }) { Text("Reprendre") }
                }
            }
            is EtatInstallation.Echec -> {
                Text(etat.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                    TextButton(onClick = { ouvreur.openUri(urlTelechargement) }) { Text("Télécharger depuis le site") }
                    Button(onClick = { installation.reinitialiser(); installation.lancer(version) }) { Text("Réessayer") }
                }
            }
            EtatInstallation.Repos -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                avant()
                if (installation.possible(version)) {
                    Button(onClick = { installation.lancer(version) }) { Text("Mettre à jour") }
                } else {
                    TextButton(onClick = { ouvreur.openUri(urlTelechargement) }) { Text("Télécharger") }
                }
            }
        }
    }
}
