package com.speedfood.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/**
 * Les règles de la plateforme, en clair et en court : ce que le livreur a le droit de faire, et ce qu'il doit faire.
 */
val REGLES_LIVREUR = listOf(
    "Une course commence au restaurant et se termine au client. Le code du client est demandé à la remise.",
    "Les frais affichés sont les frais de la course. Speedfood n'encaisse rien dans l'application.",
    "Une course que vous ne pouvez pas livrer doit être déclarée : l'équipe Speedfood reprend le client.",
)

/**
 * Assistance conducteur : une aide courte et utile — la règle de la plateforme, le numéro de l'assistance, et quoi faire d'un incident.
 * Ce n'est pas un centre d'aide : trois règles, un appel, un incident.
 *
 * Elle s'ouvre en dialogue, dans l'écran où le livreur en a besoin : aucun détour par un autre écran, et l'aide reste lisible même hors connexion.
 */
@Composable
fun DialogueAssistanceLivreur(whatsapp: String?, courseEnCours: String?, onFermer: () -> Unit) {
    val ouvreur = LocalUriHandler.current
    AlertDialog(
        onDismissRequest = onFermer,
        title = { Text("Assistance conducteur") },
        text = {
            Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Règles de la plateforme", style = MaterialTheme.typography.titleSmall)
                REGLES_LIVREUR.forEach { regle ->
                    Text("• $regle", style = MaterialTheme.typography.bodyMedium)
                }
                Text("Appeler l'assistance", style = MaterialTheme.typography.titleSmall)
                if (whatsapp == null) {
                    Text(
                        "Le numéro d'assistance n'est pas encore disponible. Écrivez à l'équipe Speedfood depuis l'onglet Compte.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text("Assistance Speedfood : $whatsapp", style = MaterialTheme.typography.bodyMedium)
                    TextButton(onClick = { ouvreur.openUri("https://wa.me/${whatsapp.filter { it.isDigit() }}") }) {
                        Text("Écrire sur WhatsApp", color = Couleurs.RougeFonce)
                    }
                }
                Text("Un incident ?", style = MaterialTheme.typography.titleSmall)
                Text(
                    if (courseEnCours != null) "La course $courseEnCours est en cours. Si la livraison est impossible, déclarez-la dans l'onglet Courses : l'équipe Speedfood est prévenue et reprend le client."
                    else "Aucune course n'est en cours. Pour un incident (véhicule, panne, retard), appelez l'assistance : c'est traité tout de suite.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Ne signalez jamais une pièce d'identité, un numéro de carte ni un code client dans un message : l'équipe Speedfood ne les demande jamais.",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        },
        confirmButton = { TextButton(onClick = onFermer) { Text("Fermer", color = Couleurs.Encre) } },
    )
}
