package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs
import androidx.compose.foundation.clickable
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics

/**
 * Écran de choix du profil, après le logo : « Je veux commander » ou « J'ai un restaurant ». Un lien discret mène aux livreurs et à l'équipe. Il ne s'affiche qu'au premier lancement
 * ou après une déconnexion : un compte connecté va directement à son espace.
 */
@Composable
fun EcranChoixProfil(surConsommateur: () -> Unit, surRestaurateur: () -> Unit, surProfessionnel: () -> Unit) {
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        Text("Bienvenue sur Speedfood", style = MaterialTheme.typography.headlineMedium, color = Couleurs.Encre)
        Text("Que souhaitez-vous faire ?", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(6.dp))
        CarteProfil(IconesApp.Panier, "Je veux commander", "Les restaurants de ma zone", surConsommateur)
        CarteProfil(IconesApp.Restaurants, "J'ai un restaurant", "Le faire référencer sur Speedfood", surRestaurateur)
        Spacer(Modifier.height(32.dp))
        TextButton(onClick = surProfessionnel, modifier = Modifier.fillMaxWidth()) {
            Text("Livreur ou équipe Speedfood ?", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun CarteProfil(icone: ImageVector, titre: String, soustitre: String, surChoix: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = surChoix).semantics { role = Role.Button },
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.5.dp, Couleurs.Encre),
    ) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(icone, contentDescription = null, tint = Couleurs.RougeFonce, modifier = Modifier.size(32.dp))
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(titre, style = MaterialTheme.typography.titleMedium, color = Couleurs.Encre)
                Text(soustitre, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
