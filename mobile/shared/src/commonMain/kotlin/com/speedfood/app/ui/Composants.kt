package com.speedfood.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton

/** Pastille d'état : fond clair et texte foncé du ton (succès, neutre, danger), toujours avec un texte (la couleur seule ne dit rien). */
@Composable
internal fun Pastille(texte: String, ton: Ton) {
    val (fond, encre) = when (ton) {
        Ton.Succes -> Couleurs.SuccesFond to Couleurs.Succes
        Ton.Danger -> Couleurs.DangerFond to Couleurs.Danger
        Ton.Neutre -> Couleurs.AvertissementFond to Couleurs.AvertissementTexte
    }
    Box(Modifier.clip(CircleShape).background(fond).padding(horizontal = 10.dp, vertical = 3.dp)) {
        Text(texte, style = MaterialTheme.typography.labelMedium, color = encre)
    }
}

/** Vignette carrée : l'image si elle existe, sinon l'initiale du nom sur fond crème. */
@Composable
internal fun Vignette(url: String?, nom: String, taille: Dp = 72.dp) {
    val forme = RoundedCornerShape(14.dp)
    Box(Modifier.size(taille).clip(forme).background(Couleurs.Creme), contentAlignment = Alignment.Center) {
        if (!url.isNullOrBlank()) {
            AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Text(nom.take(1).uppercase(), style = MaterialTheme.typography.headlineMedium, color = Couleurs.RougeFonce)
        }
    }
}
