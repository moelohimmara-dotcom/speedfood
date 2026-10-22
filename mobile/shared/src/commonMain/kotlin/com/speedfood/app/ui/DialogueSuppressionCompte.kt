package com.speedfood.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/** Confirmation de la suppression du compte : irréversible, donc le mot SUPPRIMER doit être écrit (le bouton reste grisé tant qu'il ne l'est pas). */
@Composable
internal fun DialogueSuppressionCompte(surAnnuler: () -> Unit, surConfirmer: (String) -> Unit) {
    var mot by remember { mutableStateOf("") }
    val valide = mot.trim().equals("SUPPRIMER", ignoreCase = true)
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Supprimer mon compte ?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Votre compte, votre profil, vos adresses, vos favoris et vos avis seront supprimés. Cette action est définitive. Les commandes déjà passées restent chez les restaurants.")
                Text("Pour confirmer, écrivez SUPPRIMER.", style = MaterialTheme.typography.bodyMedium)
                OutlinedTextField(value = mot, onValueChange = { mot = it }, singleLine = true, modifier = Modifier.fillMaxWidth(), label = { Text("SUPPRIMER") })
            }
        },
        confirmButton = { TextButton(onClick = { surConfirmer(mot) }, enabled = valide) { Text("Supprimer définitivement", color = if (valide) Couleurs.Danger else MaterialTheme.colorScheme.onSurfaceVariant) } },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Annuler", color = Couleurs.Encre) } },
    )
}
