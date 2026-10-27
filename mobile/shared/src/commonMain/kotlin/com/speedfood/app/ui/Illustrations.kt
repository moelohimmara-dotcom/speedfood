package com.speedfood.app.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/**
 * Illustrations des états (vide, erreur, connexion) : même langage que les pictogrammes de la page d'accueil du site (contour encre épais, aplats de la marque). Elles remplacent
 * le texte nu : un écran vide ou en erreur reste chaleureux. Une légère flottaison les anime ; le texte du message reste toujours là, l'image ne porte jamais seule l'information.
 */
internal enum class GenreIllustration {
    /** Bol fumant : rien à montrer (aucun résultat, aucune commande). */
    Bol,

    /** Sac : le panier. */
    Sac,

    /** Nuage : le serveur ne répond pas, ou la réponse est inutilisable. */
    Nuage,

    /** Cadenas : il faut se connecter. */
    Cadenas,
}

/** Choisit l'illustration d'après le message et le bouton de l'état (les ~50 écrans appellent le même composant, sans rien changer à leurs appels). */
internal fun genreIllustration(message: String, libelleBouton: String?): GenreIllustration = when {
    message.contains("panier", ignoreCase = true) -> GenreIllustration.Sac
    message.startsWith("Connectez-vous", ignoreCase = true) || libelleBouton == "Me connecter" -> GenreIllustration.Cadenas
    libelleBouton == "Réessayer" || message.contains("Impossible", ignoreCase = true) || message.contains("répondu", ignoreCase = true) -> GenreIllustration.Nuage
    else -> GenreIllustration.Bol
}

private fun DrawScope.contour(u: Float) = Stroke(width = 3.2f * u, cap = StrokeCap.Round, join = StrokeJoin.Round)

@Composable
internal fun Illustration(genre: GenreIllustration, taille: Dp = 132.dp, modifier: Modifier = Modifier) {
    // Flottaison douce : 5 dp d'amplitude, 2,4 s l'aller. Le système réduit ou coupe les animations si la personne l'a demandé (échelle de durée des animations d'Android).
    val flottaison = rememberInfiniteTransition(label = "flottaison")
    val dy by flottaison.animateFloat(-1f, 1f, infiniteRepeatable(tween(2400, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "dy")
    Canvas(modifier.size(taille).graphicsLayer { translationY = dy * 5.dp.toPx() }) {
        val u = size.minDimension / 100f
        when (genre) {
            GenreIllustration.Bol -> bol(u)
            GenreIllustration.Sac -> sac(u)
            GenreIllustration.Nuage -> nuage(u)
            GenreIllustration.Cadenas -> cadenas(u)
        }
    }
}

private fun DrawScope.bol(u: Float) {
    // Vapeur
    for (x in listOf(34f, 50f, 66f)) {
        val v = Path().apply { moveTo(x * u, 36 * u); cubicTo((x - 7) * u, 29 * u, (x + 7) * u, 22 * u, x * u, 15 * u) }
        drawPath(v, Couleurs.Mangue, style = Stroke(width = 4.2f * u, cap = StrokeCap.Round))
    }
    // Contenu qui dépasse
    drawCircle(Couleurs.Rouge, radius = 7 * u, center = Offset(36 * u, 47 * u))
    drawCircle(Couleurs.Mangue, radius = 8 * u, center = Offset(52 * u, 44 * u))
    drawCircle(Couleurs.Orange, radius = 6.5f * u, center = Offset(66 * u, 48 * u))
    drawCircle(Couleurs.Encre, radius = 7 * u, center = Offset(36 * u, 47 * u), style = contour(u))
    drawCircle(Couleurs.Encre, radius = 8 * u, center = Offset(52 * u, 44 * u), style = contour(u))
    drawCircle(Couleurs.Encre, radius = 6.5f * u, center = Offset(66 * u, 48 * u), style = contour(u))
    // Bol
    val corps = Path().apply {
        moveTo(12 * u, 52 * u); lineTo(88 * u, 52 * u)
        cubicTo(88 * u, 76 * u, 70 * u, 88 * u, 50 * u, 88 * u)
        cubicTo(30 * u, 88 * u, 12 * u, 76 * u, 12 * u, 52 * u); close()
    }
    drawPath(corps, Couleurs.RougeFonce)
    drawPath(corps, Couleurs.Encre, style = contour(u))
    drawRoundRect(Couleurs.Encre, Offset(36 * u, 88 * u), Size(28 * u, 6 * u), CornerRadius(3 * u))
    drawLine(Couleurs.Creme, Offset(24 * u, 62 * u), Offset(34 * u, 74 * u), strokeWidth = 3.2f * u, cap = StrokeCap.Round)
}

private fun DrawScope.sac(u: Float) {
    val anse = Path().apply { moveTo(36 * u, 38 * u); cubicTo(36 * u, 8 * u, 64 * u, 8 * u, 64 * u, 38 * u) }
    drawPath(anse, Couleurs.Encre, style = contour(u))
    val corps = Path().apply { moveTo(20 * u, 36 * u); lineTo(80 * u, 36 * u); lineTo(74 * u, 88 * u); lineTo(26 * u, 88 * u); close() }
    drawPath(corps, Couleurs.Orange)
    drawPath(corps, Couleurs.Encre, style = contour(u))
    drawCircle(Couleurs.Mangue, radius = 11 * u, center = Offset(50 * u, 62 * u))
    drawCircle(Couleurs.Encre, radius = 11 * u, center = Offset(50 * u, 62 * u), style = contour(u))
    val sourire = Path().apply { moveTo(44 * u, 60 * u); quadraticTo(50 * u, 67 * u, 56 * u, 60 * u) }
    drawPath(sourire, Couleurs.Encre, style = contour(u))
}

private fun DrawScope.nuage(u: Float) {
    val n = Path().apply {
        moveTo(26 * u, 76 * u)
        cubicTo(8 * u, 76 * u, 8 * u, 50 * u, 28 * u, 50 * u)
        cubicTo(30 * u, 30 * u, 60 * u, 26 * u, 66 * u, 46 * u)
        cubicTo(88 * u, 42 * u, 96 * u, 76 * u, 74 * u, 76 * u); close()
    }
    drawPath(n, Couleurs.Surface)
    drawPath(n, Couleurs.Encre, style = contour(u))
    drawLine(Couleurs.RougeFonce, Offset(50 * u, 50 * u), Offset(50 * u, 64 * u), strokeWidth = 4.4f * u, cap = StrokeCap.Round)
    drawCircle(Couleurs.RougeFonce, radius = 2.6f * u, center = Offset(50 * u, 71 * u))
    // Petites gouttes : le signal qui se perd
    drawCircle(Couleurs.Mangue, radius = 4 * u, center = Offset(20 * u, 88 * u))
    drawCircle(Couleurs.Orange, radius = 3 * u, center = Offset(80 * u, 90 * u))
}

private fun DrawScope.cadenas(u: Float) {
    val anse = Path().apply { moveTo(36 * u, 46 * u); lineTo(36 * u, 34 * u); cubicTo(36 * u, 14 * u, 64 * u, 14 * u, 64 * u, 34 * u); lineTo(64 * u, 46 * u) }
    drawPath(anse, Couleurs.Encre, style = Stroke(width = 5.2f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
    drawRoundRect(Couleurs.Mangue, Offset(24 * u, 44 * u), Size(52 * u, 42 * u), CornerRadius(8 * u))
    drawRoundRect(Couleurs.Encre, Offset(24 * u, 44 * u), Size(52 * u, 42 * u), CornerRadius(8 * u), style = contour(u))
    drawCircle(Couleurs.Encre, radius = 5 * u, center = Offset(50 * u, 62 * u))
    drawLine(Couleurs.Encre, Offset(50 * u, 62 * u), Offset(50 * u, 74 * u), strokeWidth = 4.4f * u, cap = StrokeCap.Round)
}
