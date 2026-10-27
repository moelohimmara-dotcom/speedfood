package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/**
 * En-tête de l'accueil du client : la marque, une question qui donne envie (« Qu'est-ce qu'on mange ? »), et la zone en pastille « Marché » juste en dessous. Il remplace la barre de titre
 * « Restaurants » : l'écran ouvre sur un appétit, pas sur un intitulé de liste. Il arrive en fondu, avant les cartes.
 */
@Composable
internal fun EnteteAccueil(zone: String?, surZone: (() -> Unit)?, modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 6.dp).apparition(0), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                Modifier.background(Couleurs.RougeFonce, RoundedCornerShape(50)).border(2.dp, Couleurs.Encre, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Speedfood", style = MaterialTheme.typography.labelLarge, color = Couleurs.Creme)
            }
            Text("Conakry", style = MaterialTheme.typography.labelMedium, color = Couleurs.Secondaire)
        }
        Text(
            "Qu'est-ce qu'on mange ?",
            style = MaterialTheme.typography.headlineLarge,
            color = Couleurs.Encre,
            modifier = Modifier.semantics { heading() },
        )
        if (zone != null && surZone != null) {
            Row(
                Modifier
                    .background(Couleurs.Surface, RoundedCornerShape(50))
                    .border(2.dp, Couleurs.Encre, RoundedCornerShape(50))
                    .clickable(onClick = surZone)
                    .padding(start = 10.dp, end = 14.dp, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Icon(IconesApp.Epingle, contentDescription = null, tint = Couleurs.RougeFonce, modifier = Modifier.size(18.dp))
                Text("Zone : $zone", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                Text("Changer", style = MaterialTheme.typography.labelMedium, color = Couleurs.RougeFonce)
            }
        }
    }
}
