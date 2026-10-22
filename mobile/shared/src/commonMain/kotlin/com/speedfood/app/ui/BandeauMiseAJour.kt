package com.speedfood.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.SuiviMiseAJour
import com.speedfood.app.data.VersionPubliee
import org.koin.compose.koinInject

/** Bandeau « Mise à jour disponible » en haut de l'application : ouvre la page de téléchargement ; « Plus tard » le masque pour cette version (sauf version obligatoire). */
@Composable
fun BandeauMiseAJour(modifier: Modifier = Modifier) {
    val suivi: SuiviMiseAJour = koinInject()
    var version by remember { mutableStateOf<VersionPubliee?>(null) }
    LaunchedEffect(Unit) { version = suivi.verifier() }
    val ouvreur = LocalUriHandler.current
    val proposee = version ?: return
    Surface(modifier.fillMaxWidth().statusBarsPadding(), color = MaterialTheme.colorScheme.primaryContainer, tonalElevation = 3.dp) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Mise à jour disponible : version ${proposee.nom}", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            if (proposee.notes.isNotBlank()) Text(proposee.notes, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
                if (!proposee.obligatoire) {
                    TextButton(onClick = {
                        suivi.reporter(proposee)
                        version = null
                    }) { Text("Plus tard") }
                }
                TextButton(onClick = { ouvreur.openUri(suivi.urlTelechargement) }) { Text("Télécharger") }
            }
        }
    }
}
