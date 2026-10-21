package com.speedfood.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/** Piste restaurateur : honnête sur l'état réel (la console native arrive au lot N3) et sans rien promettre de plus. */
@Composable
fun RestaurateurBientotScreen(siteUrl: String, onRetour: () -> Unit) {
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PictoRestaurateur()
        Text("Votre console arrive", style = MaterialTheme.typography.headlineMedium)
        Text(
            "La console restaurateur de l'application est en préparation. En attendant, gérez vos commandes, votre menu et vos plats du jour " +
                "depuis le site : ${siteUrl.removePrefix("https://")}.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Button(onClick = onRetour, colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme)) {
            Text("Retour", style = MaterialTheme.typography.labelLarge)
        }
    }
}
