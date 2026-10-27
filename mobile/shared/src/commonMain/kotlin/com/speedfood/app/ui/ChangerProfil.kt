package com.speedfood.app.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.speedfood.app.data.ProfilService
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject

/**
 * Ligne « Changer de profil » avec sa confirmation : l'unique porte pour passer de consommateur à restaurateur ou à professionnel (et inversement). Elle ramène à l'écran de choix ;
 * le compte reste connecté et le panier est conservé. Présente dans chaque coque, au même endroit (l'onglet Compte).
 */
@Composable
internal fun LigneChangerProfil(profils: ProfilService = koinInject()) {
    var confirmation by remember { mutableStateOf(false) }
    LigneMenu("Changer de profil", IconesApp.Compte, "Consommateur, restaurateur ou professionnel") { confirmation = true }
    if (confirmation) {
        AlertDialog(
            onDismissRequest = { confirmation = false },
            title = { Text("Changer de profil ?") },
            text = { Text("Vous revenez à l'écran où l'on choisit qui l'on est. Votre compte reste connecté et votre panier est conservé.") },
            confirmButton = { TextButton(onClick = { confirmation = false; profils.demanderChangement() }) { Text("Changer", color = Couleurs.RougeFonce) } },
            dismissButton = { TextButton(onClick = { confirmation = false }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
}
