package com.speedfood.app.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDp
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs
import kotlinx.coroutines.delay

/**
 * Carte « Marché » du site public : contour encre épais et ombre décalée pleine (effet autocollant), qui s'enfonce quand on appuie. Pour les écrans du client ; les espaces
 * professionnels gardent des cartes calmes à contour fin (`DESIGN-SYSTEM.md`, addendum direction B).
 */
@Composable
internal fun CarteMarche(
    modifier: Modifier = Modifier,
    surClic: (() -> Unit)? = null,
    rayon: Dp = 16.dp,
    fond: androidx.compose.ui.graphics.Color = Couleurs.Surface,
    contenu: @Composable () -> Unit,
) {
    val source = remember { MutableInteractionSource() }
    val enfoncee by source.collectIsPressedAsState()
    val decalage by animateDpAsState(if (enfoncee) 3.dp else 0.dp, spring(dampingRatio = 0.6f, stiffness = 900f), label = "appui")
    val forme = RoundedCornerShape(rayon)
    val ombre = 4.dp
    Box(
        modifier
            // Une carte prend la hauteur de son contenu, même dans un parent qui impose une hauteur minimale.
            .wrapContentHeight(androidx.compose.ui.Alignment.Top)
            .padding(end = ombre, bottom = ombre)
            .drawBehind {
                // L'ombre ne bouge pas ; la carte glisse dessus.
                drawRoundRect(Couleurs.Encre, Offset(ombre.toPx(), ombre.toPx()), size, CornerRadius(rayon.toPx()))
            },
    ) {
        Card(
            modifier = Modifier
                .offset(decalage, decalage)
                .fillMaxWidth()
                .then(if (surClic != null) Modifier.clickable(interactionSource = source, indication = null, onClick = surClic) else Modifier),
            shape = forme,
            colors = CardDefaults.cardColors(containerColor = fond),
            border = BorderStroke(2.dp, Couleurs.Encre),
        ) { contenu() }
    }
}

/**
 * Arrivée en fondu et glissement des premiers éléments d'une liste, l'un après l'autre (45 ms d'écart). Seuls les 8 premiers bougent : les éléments qu'on fait défiler ensuite
 * apparaissent immédiatement, sinon la liste « rejoue » son animation à chaque défilement.
 */
@Composable
internal fun Modifier.apparition(rang: Int): Modifier {
    if (rang >= 8) return this
    val progres = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        delay(rang * 45L)
        progres.animateTo(1f, tween(340, easing = FastOutSlowInEasing))
    }
    return graphicsLayer {
        alpha = progres.value
        translationY = (1f - progres.value) * 22.dp.toPx()
    }
}

/** Bloc gris qui pulse : à la place d'un cercle qui tourne, on montre la forme de ce qui arrive (impression de vitesse). */
@Composable
internal fun Squelette(modifier: Modifier = Modifier, forme: Shape = RoundedCornerShape(10.dp)) {
    val t = rememberInfiniteTransition(label = "squelette")
    val alpha by t.animateFloat(0.45f, 1f, infiniteRepeatable(tween(850), RepeatMode.Reverse), label = "alpha")
    Box(modifier.graphicsLayer { this.alpha = alpha }.background(Couleurs.Bordure, forme))
}

/** Trois fausses cartes de restaurant pendant le chargement de la liste. */
@Composable
internal fun SquelettesCartes(nombre: Int = 4) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        repeat(nombre) {
            CarteMarche(Modifier.fillMaxWidth()) {
                androidx.compose.foundation.layout.Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Squelette(Modifier.size(72.dp), RoundedCornerShape(14.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Squelette(Modifier.fillMaxWidth(0.6f).height(18.dp))
                        Squelette(Modifier.fillMaxWidth(0.9f).height(12.dp))
                        Squelette(Modifier.fillMaxWidth(0.4f).height(14.dp), RoundedCornerShape(50))
                    }
                }
            }
        }
    }
}

/** Petit rebond quand [cle] change (le nombre d'articles du panier qui monte) : on voit que l'ajout a été pris en compte. Rien à la première composition. */
@Composable
internal fun Modifier.rebond(cle: Any): Modifier {
    val echelle = remember { Animatable(1f) }
    val premiere = remember { booleanArrayOf(true) }
    LaunchedEffect(cle) {
        if (premiere[0]) {
            premiere[0] = false
            return@LaunchedEffect
        }
        echelle.snapTo(1f)
        echelle.animateTo(1.45f, tween(110))
        echelle.animateTo(1f, spring(dampingRatio = 0.35f, stiffness = 500f))
    }
    return graphicsLayer {
        scaleX = echelle.value
        scaleY = echelle.value
    }
}

/**
 * Frise du suivi d'une commande : des pastilles reliées par un trait qui se remplit jusqu'à l'étape en cours ; l'étape en cours pulse, les étapes faites portent une coche.
 * L'état est aussi dit par le texte de chaque étape (la couleur seule ne dit rien).
 */
@Composable
internal fun FriseSuivi(etapes: List<String>, indexActuel: Int, modifier: Modifier = Modifier) {
    val progres by androidx.compose.animation.core.animateFloatAsState(indexActuel.toFloat(), tween(600, easing = FastOutSlowInEasing), label = "progres")
    val pulsation = rememberInfiniteTransition(label = "pulsation")
    val onde by pulsation.animateFloat(0f, 1f, infiniteRepeatable(tween(1400), RepeatMode.Restart), label = "onde")
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().height(34.dp)) {
            val n = etapes.size
            val pas = size.width / n
            val y = size.height / 2
            val rayon = 11.dp.toPx()
            fun x(i: Int) = pas * (i + 0.5f)
            // Trait de fond puis trait rempli jusqu'à la progression.
            drawLine(Couleurs.Bordure, Offset(x(0), y), Offset(x(n - 1), y), strokeWidth = 5.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
            drawLine(Couleurs.Succes, Offset(x(0), y), Offset(x(0) + (x(n - 1) - x(0)) * (progres / (n - 1)), y), strokeWidth = 5.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round)
            for (i in 0 until n) {
                val centre = Offset(x(i), y)
                when {
                    i < indexActuel -> {
                        drawCircle(Couleurs.Succes, rayon, centre)
                        drawCircle(Couleurs.Encre, rayon, centre, style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
                        val coche = androidx.compose.ui.graphics.Path().apply {
                            moveTo(centre.x - 4.5.dp.toPx(), centre.y + 0.5.dp.toPx()); lineTo(centre.x - 1.2.dp.toPx(), centre.y + 3.8.dp.toPx()); lineTo(centre.x + 5.dp.toPx(), centre.y - 3.5.dp.toPx())
                        }
                        drawPath(coche, Couleurs.Surface, style = androidx.compose.ui.graphics.drawscope.Stroke(2.4.dp.toPx(), cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
                    }
                    i == indexActuel -> {
                        // Onde qui s'élargit et s'efface, autour d'une pastille mangue cerclée d'encre.
                        drawCircle(Couleurs.Mangue.copy(alpha = (1f - onde) * 0.7f), rayon * (1f + onde * 0.9f), centre)
                        drawCircle(Couleurs.Mangue, rayon, centre)
                        drawCircle(Couleurs.Encre, rayon, centre, style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
                    }
                    else -> {
                        drawCircle(Couleurs.Surface, rayon, centre)
                        drawCircle(Couleurs.Bordure, rayon, centre, style = androidx.compose.ui.graphics.drawscope.Stroke(2.dp.toPx()))
                    }
                }
            }
        }
        androidx.compose.foundation.layout.Row(Modifier.fillMaxWidth()) {
            etapes.forEachIndexed { i, nom ->
                androidx.compose.material3.Text(
                    nom,
                    Modifier.weight(1f),
                    style = androidx.compose.material3.MaterialTheme.typography.labelMedium,
                    color = if (i <= indexActuel) Couleurs.Encre else Couleurs.Secondaire,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
    }
}

/**
 * Bouton d'action principale « Marché » : aplat rouge de la marque, contour encre, ombre décalée qui s'écrase à l'appui. Le texte reste blanc cassé sur rouge (contraste AA) ;
 * désactivé, il passe en gris lisible. C'est le seul bouton à dégradé/plein de l'écran (règle du design system : une seule action principale).
 */
@Composable
internal fun BoutonMarche(texte: String, actif: Boolean = true, surClic: () -> Unit) {
    val source = remember { MutableInteractionSource() }
    val enfonce by source.collectIsPressedAsState()
    val decalage by animateDpAsState(if (enfonce && actif) 3.dp else 0.dp, spring(dampingRatio = 0.6f, stiffness = 900f), label = "appui")
    val forme = RoundedCornerShape(14.dp)
    Box(
        Modifier
            .fillMaxWidth()
            .padding(end = 4.dp, bottom = 4.dp)
            .drawBehind { if (actif) drawRoundRect(Couleurs.Encre, Offset(4.dp.toPx(), 4.dp.toPx()), size, CornerRadius(14.dp.toPx())) },
    ) {
        androidx.compose.material3.Button(
            onClick = surClic,
            enabled = actif,
            interactionSource = source,
            modifier = Modifier.offset(decalage, decalage).fillMaxWidth().height(50.dp),
            shape = forme,
            border = BorderStroke(2.dp, if (actif) Couleurs.Encre else Couleurs.Bordure),
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = Couleurs.RougeFonce,
                contentColor = Couleurs.Creme,
                disabledContainerColor = Couleurs.Bordure,
                disabledContentColor = Couleurs.DesactiveTexte,
            ),
        ) { androidx.compose.material3.Text(texte, style = androidx.compose.material3.MaterialTheme.typography.labelLarge) }
    }
}

/** Pastille de choix « Marché » (filtre, mode de commande, adresse) : contour encre, mangue quand elle est choisie. Même rendu partout où l'on choisit parmi quelques options. */
@Composable
internal fun PastilleChoix(choisie: Boolean, surClic: () -> Unit, texte: String) {
    androidx.compose.material3.FilterChip(
        selected = choisie,
        onClick = surClic,
        label = { androidx.compose.material3.Text(texte, style = androidx.compose.material3.MaterialTheme.typography.labelMedium) },
        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
            containerColor = Couleurs.Surface,
            selectedContainerColor = Couleurs.Mangue,
            selectedLabelColor = Couleurs.Encre,
        ),
        border = androidx.compose.material3.FilterChipDefaults.filterChipBorder(
            enabled = true, selected = choisie,
            borderColor = Couleurs.Encre, selectedBorderColor = Couleurs.Encre, borderWidth = 1.5.dp, selectedBorderWidth = 2.dp,
        ),
    )
}
