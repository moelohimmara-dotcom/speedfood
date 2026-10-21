package com.speedfood.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs

/** Pastille du pictogramme : trait épais encre, aplats de la marque, ombre décalée (même langage que les illustrations du site). */
@Composable
private fun PastillePicto(fond: Color, dessin: DrawScope.() -> Unit) {
    Box(
        modifier = Modifier
            .size(64.dp)
            .background(Couleurs.Encre, RoundedCornerShape(14.dp))
            .padding(end = 3.dp, bottom = 3.dp),
        contentAlignment = Alignment.TopStart,
    ) {
        Box(
            modifier = Modifier
                .size(61.dp)
                .background(fond, RoundedCornerShape(14.dp))
                .border(2.5.dp, Couleurs.Encre, RoundedCornerShape(14.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(Modifier.size(40.dp)) { dessin() }
        }
    }
}

private fun DrawScope.trait() = Stroke(width = size.minDimension * 0.07f, cap = StrokeCap.Round, join = StrokeJoin.Round)

/** Panier (public « client ») : anse, corps rouge, pastille mangue. */
@Composable
fun PictoClient() = PastillePicto(Couleurs.Creme) {
    val u = size.minDimension / 40f
    val corps = Path().apply {
        moveTo(5 * u, 14 * u); lineTo(35 * u, 14 * u); lineTo(32 * u, 33 * u)
        quadraticTo(31.6f * u, 36 * u, 28.6f * u, 36 * u); lineTo(11.4f * u, 36 * u)
        quadraticTo(8.4f * u, 36 * u, 8 * u, 33 * u); close()
    }
    drawPath(corps, Couleurs.RougeFonce)
    drawPath(corps, Couleurs.Encre, style = trait())
    val anse = Path().apply { moveTo(13 * u, 14 * u); cubicTo(13 * u, 3 * u, 27 * u, 3 * u, 27 * u, 14 * u) }
    drawPath(anse, Couleurs.Encre, style = trait())
    drawCircle(Couleurs.Mangue, radius = 4.5f * u, center = Offset(20 * u, 25 * u))
    drawCircle(Couleurs.Encre, radius = 4.5f * u, center = Offset(20 * u, 25 * u), style = trait())
}

/** Devanture à store rayé (public « restaurateur »). */
@Composable
fun PictoRestaurateur() = PastillePicto(Couleurs.Mangue) {
    val u = size.minDimension / 40f
    drawRoundRect(Couleurs.Surface, Offset(5 * u, 17 * u), Size(30 * u, 19 * u), CornerRadius(2 * u))
    drawRoundRect(Couleurs.Encre, Offset(5 * u, 17 * u), Size(30 * u, 19 * u), CornerRadius(2 * u), style = trait())
    val store = Path().apply { moveTo(3 * u, 17 * u); lineTo(6 * u, 6 * u); lineTo(34 * u, 6 * u); lineTo(37 * u, 17 * u); close() }
    drawPath(store, Couleurs.RougeFonce)
    drawPath(store, Couleurs.Encre, style = trait())
    drawRoundRect(Couleurs.Mangue, Offset(16 * u, 24 * u), Size(8 * u, 12 * u), CornerRadius(1.5f * u))
    drawRoundRect(Couleurs.Encre, Offset(16 * u, 24 * u), Size(8 * u, 12 * u), CornerRadius(1.5f * u), style = trait())
}

/** Scooter avec sa caisse de livraison (public « livreur »). */
@Composable
fun PictoLivreur() = PastillePicto(Couleurs.Surface) {
    val u = size.minDimension / 40f
    drawCircle(Couleurs.Surface, radius = 5 * u, center = Offset(8 * u, 29 * u))
    drawCircle(Couleurs.Encre, radius = 5 * u, center = Offset(8 * u, 29 * u), style = trait())
    drawCircle(Couleurs.Surface, radius = 5 * u, center = Offset(32 * u, 29 * u))
    drawCircle(Couleurs.Encre, radius = 5 * u, center = Offset(32 * u, 29 * u), style = trait())
    val corps = Path().apply { moveTo(8 * u, 29 * u); lineTo(17 * u, 29 * u); lineTo(23 * u, 17 * u); lineTo(29 * u, 17 * u); lineTo(32 * u, 29 * u) }
    drawPath(corps, Couleurs.RougeFonce, style = Stroke(width = size.minDimension * 0.1f, cap = StrokeCap.Round, join = StrokeJoin.Round))
    drawRoundRect(Couleurs.Mangue, Offset(3 * u, 8 * u), Size(15 * u, 12 * u), CornerRadius(2 * u))
    drawRoundRect(Couleurs.Encre, Offset(3 * u, 8 * u), Size(15 * u, 12 * u), CornerRadius(2 * u), style = trait())
    val guidon = Path().apply { moveTo(27 * u, 17 * u); lineTo(26 * u, 10 * u); lineTo(32 * u, 10 * u) }
    drawPath(guidon, Couleurs.Encre, style = trait())
}
