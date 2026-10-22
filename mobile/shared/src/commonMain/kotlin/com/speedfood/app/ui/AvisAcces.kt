package com.speedfood.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.AvisAcces
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.design.Couleurs
import kotlinx.coroutines.delay
import org.koin.compose.koinInject

/**
 * Bandeau d'information en bas de l'écran quand l'état de l'accès change sans que la personne l'ait demandé ou quand l'écran d'où elle venait n'existe plus :
 * « Vous êtes déconnecté », « Votre session a expiré » (avec « Me reconnecter »), « Votre accès à l'espace X a été retiré ». Il disparaît seul.
 */
@Composable
fun BandeauAvisAcces(modifier: Modifier = Modifier, espaces: EspaceService = koinInject()) {
    var avis by remember { mutableStateOf<AvisAcces?>(null) }
    LaunchedEffect(Unit) { espaces.avis.collect { avis = it } }
    val courant = avis ?: return
    // Un avis avec action reste plus longtemps : la personne doit avoir le temps de répondre.
    LaunchedEffect(courant) {
        delay(if (courant.reconnexion) 20_000 else 7_000)
        if (avis == courant) avis = null
    }
    Surface(
        modifier.fillMaxWidth().navigationBarsPadding().padding(start = 16.dp, end = 16.dp, bottom = 88.dp),
        shape = MaterialTheme.shapes.medium,
        color = Couleurs.Encre,
        tonalElevation = 6.dp,
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(courant.message, style = MaterialTheme.typography.bodyMedium, color = Couleurs.Creme, modifier = Modifier.weight(1f))
            if (courant.reconnexion) {
                TextButton(onClick = { espaces.demanderConnexion(); avis = null }) { Text("Me reconnecter", color = Couleurs.Mangue) }
            } else {
                TextButton(onClick = { avis = null }) { Text("OK", color = Couleurs.Mangue) }
            }
        }
    }
}

/** Propose le choix de l'espace quand un compte aux plusieurs espaces professionnels vient de se connecter depuis « Espace professionnel ». */
@Composable
fun ChoixEspaceDialogue(espaces: EspaceService = koinInject()) {
    val choix by espaces.choixAProposer.collectAsState()
    val roles by espaces.roles.collectAsState()
    val droits = roles
    if (!choix || droits == null) return
    AlertDialog(
        onDismissRequest = espaces::fermerChoix,
        title = { Text("Quel espace ouvrir ?") },
        text = { Text("Ce compte a plusieurs espaces. Vous pourrez en changer à tout moment depuis Compte.") },
        confirmButton = {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.End) {
                droits.espacesPro.forEach { e -> TextButton(onClick = { espaces.entrer(e) }) { Text(e.libelle, color = Couleurs.RougeFonce) } }
                TextButton(onClick = { espaces.entrer(Espace.Client) }) { Text("Rester client", color = Couleurs.Encre) }
            }
        },
    )
}
