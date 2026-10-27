package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.speedfood.app.data.DemandeNotifications
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.VerrouEspacesPro
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject

/** Écran affiché à la place d'un espace professionnel verrouillé : la vérification du système s'ouvre toute seule, un bouton permet de la relancer. */
@Composable
internal fun EcranVerrou(espace: Espace, verrou: VerrouEspacesPro = koinInject(), espaces: EspaceService = koinInject()) {
    var echec by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { verrou.deverrouiller { ok -> echec = !ok } }
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(IconesApp.Cadenas, contentDescription = null, tint = Couleurs.RougeFonce)
        Text("${espace.libelle} verrouillé", style = MaterialTheme.typography.headlineSmall, textAlign = TextAlign.Center)
        Text(
            if (echec) "La vérification n'a pas abouti. Réessayez." else "Utilisez votre empreinte, votre visage ou le code de votre téléphone.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        BoutonPrincipal("Déverrouiller") { verrou.deverrouiller { ok -> echec = !ok } }
        TextButton(onClick = espaces::quitter) { Text("Revenir à l'espace client", color = Couleurs.Encre) }
    }
}

/** Section « Sécurité » des Paramètres, affichée seulement pour un compte qui a un espace professionnel : verrouillage par empreinte, visage ou code du téléphone. */
@Composable
internal fun SectionSecurite(verrou: VerrouEspacesPro = koinInject(), espaces: EspaceService = koinInject()) {
    val droits by espaces.roles.collectAsState()
    if (droits?.aUnEspacePro != true) return
    val actif by verrou.actif.collectAsState()
    var message by remember { mutableStateOf<String?>(null) }
    TitreRubrique("Sécurité")
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) {
            Text("Verrouiller mes espaces professionnels", style = MaterialTheme.typography.titleMedium)
            Text(
                "Demande votre empreinte, votre visage ou le code du téléphone à l'ouverture et après 2 minutes en arrière-plan. Utile sur un téléphone partagé au restaurant.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = actif, onCheckedChange = { voulu -> verrou.regler(voulu) { ok -> message = if (!ok && voulu) "Activation annulée ou impossible : configurez d'abord un verrouillage d'écran sur le téléphone." else null } })
    }
    if (!verrou.disponible()) Text("Aucun verrouillage d'écran n'est configuré sur ce téléphone : le verrou ne peut pas être activé.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    message?.let { BlocMessage(it, erreur = false) }
}

/**
 * Invitation à activer les notifications, affichée sur le suivi d'une commande (le moment où elles servent) et seulement si la plateforme les exige et qu'elles ne sont pas
 * autorisées. « Plus tard » la masque ; elle reste disponible dans Paramètres.
 */
@Composable
internal fun PrimerNotifications(demande: DemandeNotifications = koinInject(), stockage: StockageLocal = koinInject()) {
    var autorisee by remember { mutableStateOf(demande.autorisee()) }
    var reporte by remember { mutableStateOf(stockage.lire(CLE_PRIMER) == "plus_tard") }
    // Au retour de la fenêtre du système, on relit la réponse.
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { autorisee = demande.autorisee() }
    if (!demande.disponible || autorisee || reporte) return
    Card(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.AvertissementFond),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Être prévenu à chaque étape ?", style = MaterialTheme.typography.titleMedium, color = Couleurs.AvertissementTexte)
            Text("Acceptée, prête, en route : Speedfood vous le signale sur votre téléphone, sans ouvrir l'application. Vous pouvez le changer à tout moment.", style = MaterialTheme.typography.bodyMedium)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                TextButton(onClick = { stockage.ecrire(CLE_PRIMER, "plus_tard"); reporte = true }) { Text("Plus tard", color = Couleurs.Encre) }
                OutlinedButton(onClick = demande::demander, border = BorderStroke(2.dp, Couleurs.Encre)) { Text("Activer les notifications", color = Couleurs.Encre) }
            }
        }
    }
}

private const val CLE_PRIMER = "primer_notifications"
