package com.speedfood.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.ui.semantics.Role
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import coil3.compose.SubcomposeAsyncImage
import coil3.compose.SubcomposeAsyncImageContent
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton

/**
 * Case à cocher dont toute la ligne réagit (la case ET le texte), avec une cible tactile d'au moins 48 dp : sur un téléphone, on tape sur la phrase, pas sur un carré de 24 dp.
 * La ligne porte le rôle « case à cocher » pour le lecteur d'écran ; la case elle-même n'est qu'un dessin.
 */
@Composable
internal fun LigneACocher(coche: Boolean, surChangement: (Boolean) -> Unit, modifier: Modifier = Modifier, contenu: @Composable () -> Unit) {
    Row(
        modifier.heightIn(min = 48.dp).toggleable(value = coche, role = Role.Checkbox, onValueChange = surChangement),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Checkbox(checked = coche, onCheckedChange = null, colors = CheckboxDefaults.colors(checkedColor = Couleurs.RougeFonce))
        Box(Modifier.weight(1f)) { contenu() }
    }
}

/**
 * Libellé d'un onglet de la barre du bas : une seule ligne, et le réglage « grande police » du téléphone est plafonné à 1,2× ici seulement (4 onglets sur ~360 dp ne laissent pas la place
 * d'un mot comme « Commandes » à 1,6× : il se coupait en « Command / es »). Le reste de l'application suit le réglage complet.
 */
@Composable
internal fun LibelleOnglet(texte: String) {
    val d = LocalDensity.current
    CompositionLocalProvider(LocalDensity provides Density(d.density, minOf(d.fontScale, 1.2f))) {
        Text(texte, style = MaterialTheme.typography.labelMedium, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
    }
}

/** « 1 article », « 3 articles » : le pluriel s'accorde (plus de « article(s) »). */
internal fun libelleArticles(n: Int): String = if (n > 1) "$n articles" else "$n article"

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

/**
 * Image d'une bannière. Une image qui ne se charge pas ne laisse pas un grand rectangle vide : elle est remplacée par un cadre crème qui
 * dit ce qui s'est passé. Une image qui manque est un problème visible, pas un détail.
 */
@Composable
internal fun ImageBanniere(url: String?, hauteur: Dp) {
    Box(
        Modifier.fillMaxWidth().height(hauteur).background(Couleurs.Creme),
        contentAlignment = Alignment.Center,
    ) {
        if (url.isNullOrBlank()) {
            Text("Sans image", style = MaterialTheme.typography.bodySmall, color = Couleurs.Secondaire)
        } else {
            SubcomposeAsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = Alignment.Center,
                modifier = Modifier.fillMaxSize(),
            ) portee@{
                // Dans Coil 3.5, l'état du peintre est un flux : `painter.state.value` est l'état courant, et son changement recompose l'écran.
                // Le cadre est centré explicitement (et le receiver nommé rend l'accès au peintre explicite) : un message d'image en haut à gauche se lit comme un défaut d'affichage.
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    when (this@portee.painter.state.value) {
                        is AsyncImagePainter.State.Success -> this@portee.SubcomposeAsyncImageContent()
                        is AsyncImagePainter.State.Error -> Text(
                            "Image indisponible",
                            style = MaterialTheme.typography.bodySmall,
                            color = Couleurs.Secondaire,
                        )
                        else -> Text("Chargement de l'image…", style = MaterialTheme.typography.bodySmall, color = Couleurs.Secondaire)
                    }
                }
            }
        }
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
