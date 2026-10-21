package com.speedfood.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/**
 * Premier écran : des pistes séparées dès le départ, comme `/acces` sur le site. Le client parcourt les restaurants sans compte ;
 * le restaurateur a sa propre piste (sa console native arrive au lot N3) ; le livreur a la sienne (compte ouvert par l'équipe Speedfood).
 */
@Composable
fun EntreeScreen(onClient: () -> Unit, onRestaurateur: () -> Unit, onLivreur: () -> Unit, onVisite: () -> Unit = {}) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { visible = true }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Speedfood", style = MaterialTheme.typography.titleLarge, color = Couleurs.RougeFonce)
        Text("Qui êtes-vous ?", style = MaterialTheme.typography.headlineLarge)
        Text(
            "Trois espaces séparés, chacun avec son propre compte. Choisissez le vôtre.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(4.dp))

        AnimatedVisibility(visible, enter = fadeIn() + slideInVertically { it / 8 }) {
            CartePiste(
                picto = { PictoClient() },
                titre = "Je suis client",
                texte = "Je veux commander, retrouver mes commandes, mes adresses et mes restaurants favoris.",
                libelleBouton = "Parcourir les restaurants",
                onClick = onClient,
                principal = true,
            )
        }
        AnimatedVisibility(visible, enter = fadeIn() + slideInVertically { it / 6 }) {
            CartePiste(
                picto = { PictoRestaurateur() },
                titre = "Je suis restaurateur",
                texte = "Je tiens un restaurant et je veux recevoir des commandes, gérer mon menu et mes plats du jour.",
                libelleBouton = "Espace restaurateur",
                onClick = onRestaurateur,
                principal = false,
            )
        }
        AnimatedVisibility(visible, enter = fadeIn() + slideInVertically { it / 4 }) {
            CartePiste(
                picto = { PictoLivreur() },
                titre = "Je suis livreur",
                texte = "Je livre pour Speedfood ou pour un restaurant : je reçois des courses, je suis mon trajet et je remets la commande avec le code du client.",
                libelleBouton = "Espace livreur",
                onClick = onLivreur,
                principal = false,
            )
        }
        TextButton(onClick = onVisite, modifier = Modifier.fillMaxWidth()) {
            Text("Revoir la visite guidée", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
        }
    }
}

@Composable
private fun CartePiste(
    picto: @Composable () -> Unit,
    titre: String,
    texte: String,
    libelleBouton: String,
    onClick: () -> Unit,
    principal: Boolean,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            picto()
            Text(titre, style = MaterialTheme.typography.titleLarge)
            Text(texte, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (principal) {
                Button(
                    onClick = onClick,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme),
                ) { Text(libelleBouton, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center) }
            } else {
                OutlinedButton(
                    onClick = onClick,
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(2.dp, Couleurs.Encre),
                ) { Text(libelleBouton, style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre, textAlign = TextAlign.Center) }
            }
        }
    }
}
