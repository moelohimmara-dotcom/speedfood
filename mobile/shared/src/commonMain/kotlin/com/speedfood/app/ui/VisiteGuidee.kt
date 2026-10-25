package com.speedfood.app.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/** Une page de la visite : ce qu'elle dit, et le dessin qui l'accompagne (une pure fonction de l'avancement d'entrée et d'une boucle continue). */
private class Diapo(val titre: String, val texte: String, val dessin: Int)

/** Deux écrans : la promesse de découverte, puis le choix de zone sans permission au lancement. */
private val DIAPOS = listOf(
    Diapo(
        "Découvrez avant de commander",
        "Parcourez les restaurants et les plats sans créer de compte. Choisissez votre zone quand vous êtes prêt.",
        0,
    ),
    Diapo(
        "Choisissez où vous livrer",
        "Votre zone se change en un geste depuis l'accueil. Aucune position n'est demandée sans votre accord. Vous pouvez commander sans compte jusqu'à l'envoi.",
        2,
    ),
)

val NOMBRE_DIAPOS = DIAPOS.size

/** Clé de stockage : la visite guidée n'est proposée automatiquement qu'au premier lancement ; elle reste accessible depuis l'écran d'accueil. */
const val CLE_VISITE_VUE = "visite_vue"

private fun doux(x: Float): Float = x * x * (3f - 2f * x)
private fun segment(t: Float, debut: Float, duree: Float): Float = ((t - debut) / duree).coerceIn(0f, 1f)
private fun ressort(x: Float): Float {
    // Rebond très court : lisible sans effet « jouet » ni déplacement excessif.
    val c1 = 1.2f
    val c3 = c1 + 1f
    val y = x - 1f
    return 1f + c3 * y * y * y + c1 * y * y
}

/**
 * Visite guidée : des pages qui défilent d'un geste (et se préparent en s'animant quand elles arrivent), avec « Passer » à tout moment pour aller à l'essentiel.
 * [surTermine] est appelé en passant, ou en arrivant au bout.
 */
@Composable
fun VisiteGuidee(surTermine: () -> Unit) {
    val pager = rememberPagerState(pageCount = { NOMBRE_DIAPOS })
    val portee = rememberCoroutineScope()
    // Une seule respiration lente : elle garde la page vivante sans solliciter constamment le GPU.
    val boucle by rememberInfiniteTransition(label = "respiration-visite").animateFloat(0f, 1f, infiniteRepeatable(tween(5_000, easing = LinearEasing), RepeatMode.Restart), label = "phase-respiration")
    val derniere = pager.currentPage == NOMBRE_DIAPOS - 1

    Column(
        Modifier
            .fillMaxSize()
            .background(Couleurs.Creme)
            .safeDrawingPadding()
            .padding(horizontal = 20.dp, vertical = 12.dp)
            .semantics { contentDescription = "Visite guidée, écran ${pager.currentPage + 1} sur $NOMBRE_DIAPOS" },
    ) {
        Row(Modifier.fillMaxWidth().height(48.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${pager.currentPage + 1} / $NOMBRE_DIAPOS",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f).semantics { contentDescription = "Progression : écran ${pager.currentPage + 1} sur $NOMBRE_DIAPOS" },
            )
            TextButton(onClick = surTermine) {
                Text("Passer la visite", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
        }
        HorizontalPager(pager, Modifier.weight(1f).fillMaxWidth()) { page ->
            PageVisite(page, pager, boucle)
        }
        Column(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Points(pager.currentPage, NOMBRE_DIAPOS)
            BoutonPrincipal(if (derniere) "C'est parti" else "Suivant") {
                if (derniere) surTermine() else portee.launch { pager.animateScrollToPage(pager.currentPage + 1) }
            }
        }
    }
}

@Composable
private fun PageVisite(page: Int, pager: PagerState, boucle: Float) {
    val active = pager.currentPage == page
    val entree = remember(page) { Animatable(0f) }
    LaunchedEffect(active) {
        if (active) {
            entree.snapTo(0f)
            entree.animateTo(1f, tween(1_100, easing = LinearEasing))
        }
    }
    // Décalage de la page par rapport au centre (−1 à 1) : sert à l'effet de profondeur pendant le glissement.
    val decalage = ((pager.currentPage - page) + pager.currentPageOffsetFraction).coerceIn(-1f, 1f)
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp, Alignment.CenterVertically)) {
        Box(
            Modifier.size(280.dp).graphicsLayer {
                translationX = decalage * -160f
                alpha = 1f - abs(decalage) * 0.7f
                val s = 1f - abs(decalage) * 0.12f
                scaleX = s
                scaleY = s
            },
            contentAlignment = Alignment.Center,
        ) {
            IllustrationVisite(DIAPOS[page].dessin, if (active) entree.value else 1f, boucle)
        }
        Column(
            Modifier.graphicsLayer {
                translationX = decalage * -60f
                alpha = 1f - abs(decalage) * 0.9f
            },
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(DIAPOS[page].titre, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
            Text(DIAPOS[page].texte, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        }
    }
}

/** Points de progression : le point actif s'allonge et prend la couleur de la marque. */
@Composable
internal fun Points(courant: Int, total: Int) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(total) { i ->
            val largeur by animateDpAsState(if (i == courant) 26.dp else 8.dp, tween(280))
            val couleur by animateColorAsState(if (i == courant) Couleurs.RougeFonce else Couleurs.Bordure, tween(280))
            Box(Modifier.height(8.dp).size(largeur, 8.dp).background(couleur, CircleShape))
        }
    }
}

/**
 * Dessin de la page [page] (0 à 4). [p] : avancement d'entrée de 0 à 1 (les éléments arrivent l'un après l'autre) ; [boucle] : 0 à 1 en continu (petits
 * mouvements qui gardent la page vivante). Même langage visuel que les pictogrammes de l'accueil : trait encre épais, aplats de la marque.
 */
@Composable
internal fun IllustrationVisite(page: Int, p: Float, boucle: Float) {
    Canvas(Modifier.size(260.dp)) {
        val u = size.minDimension / 100f
        scale(u, u, pivot = Offset.Zero) {
            when (page) {
                0 -> dessinRestaurants(p * 1000f, boucle)
                1 -> dessinDisponibilite(p * 1000f, boucle)
                2 -> dessinLivraison(p * 1000f, boucle)
                3 -> dessinSuivi(p * 1000f, boucle)
                else -> dessinEspaces(p * 1000f, boucle)
            }
        }
    }
}

private val TRAIT = 1.6f
private fun trait() = Stroke(width = TRAIT, cap = StrokeCap.Round, join = StrokeJoin.Round)

private fun DrawScope.disque(centre: Offset, rayon: Float, fond: Color, a: Float = 1f) {
    drawCircle(fond, rayon, centre, alpha = a)
    drawCircle(Couleurs.Encre, rayon, centre, alpha = a, style = trait())
}

/** 1. Une devanture à store rayé ; des repères tombent sur la carte l'un après l'autre. */
private fun DrawScope.dessinRestaurants(t: Float, boucle: Float) {
    drawCircle(Couleurs.Mangue, 38f, Offset(50f, 56f), alpha = 0.35f * doux(segment(t, 0f, 300f)))
    val monte = ressort(segment(t, 0f, 500f))
    translate(0f, (1f - monte) * 24f) {
        drawRoundRect(Couleurs.Surface, Offset(24f, 46f), Size(52f, 34f), CornerRadius(3f))
        drawRoundRect(Couleurs.Encre, Offset(24f, 46f), Size(52f, 34f), CornerRadius(3f), style = trait())
        val store = Path().apply { moveTo(20f, 46f); lineTo(26f, 24f); lineTo(74f, 24f); lineTo(80f, 46f); close() }
        drawPath(store, Couleurs.RougeFonce)
        drawPath(store, Couleurs.Encre, style = trait())
        for (i in 1..3) drawLine(Couleurs.Creme, Offset(20f + i * 15f, 46f), Offset(26f + i * 12f, 24f), 1.6f)
        drawRoundRect(Couleurs.Mangue, Offset(43f, 58f), Size(14f, 22f), CornerRadius(2f))
        drawRoundRect(Couleurs.Encre, Offset(43f, 58f), Size(14f, 22f), CornerRadius(2f), style = trait())
    }
    // Trois repères de carte qui tombent et rebondissent.
    listOf(Offset(14f, 28f), Offset(50f, 10f), Offset(86f, 30f)).forEachIndexed { i, pos ->
        val q = ressort(segment(t, 350f + i * 160f, 450f))
        val rebond = sin((boucle + i * 0.33f) * 2f * PI.toFloat()) * 1.6f
        translate(pos.x, pos.y + (1f - q) * -30f + rebond) {
            val rep = Path().apply { moveTo(0f, 10f); cubicTo(-9f, -2f, -6f, -10f, 0f, -10f); cubicTo(6f, -10f, 9f, -2f, 0f, 10f); close() }
            drawPath(rep, Couleurs.RougeFonce, alpha = segment(t, 350f + i * 160f, 150f))
            drawPath(rep, Couleurs.Encre, alpha = segment(t, 350f + i * 160f, 150f), style = trait())
            drawCircle(Couleurs.Creme, 2.6f, Offset(0f, -3f), alpha = segment(t, 350f + i * 160f, 150f))
        }
    }
}

/** 2. Une horloge dont l'aiguille tourne et une coche qui s'inscrit : la disponibilité a un horodatage. */
private fun DrawScope.dessinDisponibilite(t: Float, boucle: Float) {
    val entree = ressort(segment(t, 0f, 550f))
    scale(0.6f + 0.4f * entree, pivot = Offset(50f, 50f)) {
        disque(Offset(50f, 50f), 34f, Couleurs.Surface)
        disque(Offset(50f, 50f), 26f, Couleurs.Creme)
        for (i in 0 until 12) {
            val a = i * PI.toFloat() / 6f
            val long = if (i % 3 == 0) 4f else 2f
            drawLine(
                Couleurs.Encre,
                Offset(50f + sin(a) * (24f - long), 50f - cos(a) * (24f - long)),
                Offset(50f + sin(a) * 24f, 50f - cos(a) * 24f),
                1.2f, StrokeCap.Round,
            )
        }
        val ang = (boucle * 360f)
        rotate(ang, Offset(50f, 50f)) { drawLine(Couleurs.RougeFonce, Offset(50f, 50f), Offset(50f, 29f), 2f, StrokeCap.Round) }
        rotate(ang / 12f, Offset(50f, 50f)) { drawLine(Couleurs.Encre, Offset(50f, 50f), Offset(50f, 36f), 2.4f, StrokeCap.Round) }
        drawCircle(Couleurs.Encre, 2.2f, Offset(50f, 50f))
    }
    // Pastille « confirmé » qui se pose en bas à droite, puis sa coche se trace.
    val pastille = ressort(segment(t, 450f, 450f))
    scale(pastille, pivot = Offset(76f, 76f)) {
        disque(Offset(76f, 76f), 14f, Couleurs.Succes)
        val coche = segment(t, 750f, 250f)
        val trace = Path().apply { moveTo(69f, 76f); lineTo(74f, 81f); lineTo(83f, 70f) }
        // Tracé progressif de la coche : segment par segment.
        val p1 = Path().apply { moveTo(69f, 76f); lineTo(69f + 5f * minOf(1f, coche * 2f), 76f + 5f * minOf(1f, coche * 2f)) }
        drawPath(p1, Couleurs.Creme, style = Stroke(width = 3f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        if (coche > 0.5f) {
            val k = (coche - 0.5f) * 2f
            drawPath(Path().apply { moveTo(74f, 81f); lineTo(74f + 9f * k, 81f - 11f * k) }, Couleurs.Creme, style = Stroke(width = 3f, cap = StrokeCap.Round))
        }
        if (trace.isEmpty) return@scale
    }
}

/** 3. Un scooter traverse la scène sur sa route, caisse sur le porte-bagages ; des traits de vitesse défilent derrière. */
private fun DrawScope.dessinLivraison(t: Float, boucle: Float) {
    val arrivee = doux(segment(t, 0f, 700f))
    drawLine(Couleurs.Bordure, Offset(4f, 78f), Offset(96f, 78f), 2.4f, StrokeCap.Round)
    for (i in 0 until 4) {
        val x = ((boucle * 100f + i * 26f) % 100f)
        drawLine(Couleurs.Bordure, Offset(100f - x, 84f), Offset(100f - x + 8f, 84f), 1.6f, StrokeCap.Round)
    }
    val rebond = sin(boucle * 2f * PI.toFloat() * 4f) * 0.7f
    translate(-60f * (1f - arrivee), rebond) {
        disque(Offset(28f, 68f), 9f, Couleurs.Surface)
        disque(Offset(74f, 68f), 9f, Couleurs.Surface)
        rotate(boucle * 360f * 3f, Offset(28f, 68f)) { drawLine(Couleurs.Encre, Offset(28f, 68f), Offset(28f, 61f), 1.2f, StrokeCap.Round) }
        rotate(boucle * 360f * 3f, Offset(74f, 68f)) { drawLine(Couleurs.Encre, Offset(74f, 68f), Offset(74f, 61f), 1.2f, StrokeCap.Round) }
        val corps = Path().apply { moveTo(28f, 68f); lineTo(44f, 68f); lineTo(54f, 48f); lineTo(66f, 48f); lineTo(74f, 68f) }
        drawPath(corps, Couleurs.RougeFonce, style = Stroke(width = 4.4f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawRoundRect(Couleurs.Mangue, Offset(10f, 38f), Size(30f, 24f), CornerRadius(3f))
        drawRoundRect(Couleurs.Encre, Offset(10f, 38f), Size(30f, 24f), CornerRadius(3f), style = trait())
        drawLine(Couleurs.Encre, Offset(10f, 46f), Offset(40f, 46f), 1.2f)
        drawPath(Path().apply { moveTo(66f, 48f); lineTo(63f, 34f); lineTo(74f, 34f) }, Couleurs.Encre, style = trait())
    }
    // Étiquette de frais qui apparaît : « vous voyez le prix avant d'envoyer ».
    val etiquette = ressort(segment(t, 650f, 400f))
    scale(etiquette, pivot = Offset(78f, 24f)) {
        drawRoundRect(Couleurs.Surface, Offset(56f, 14f), Size(36f, 20f), CornerRadius(5f))
        drawRoundRect(Couleurs.Encre, Offset(56f, 14f), Size(36f, 20f), CornerRadius(5f), style = trait())
        drawCircle(Couleurs.Mangue, 3.2f, Offset(63f, 24f))
        drawLine(Couleurs.Encre, Offset(70f, 21f), Offset(86f, 21f), 2f, StrokeCap.Round)
        drawLine(Couleurs.Secondaire, Offset(70f, 27f), Offset(81f, 27f), 2f, StrokeCap.Round)
    }
}

/** 4. Quatre étapes qui s'allument l'une après l'autre le long d'une ligne de progression : envoyée, acceptée, prête, terminée. */
private fun DrawScope.dessinSuivi(t: Float, boucle: Float) {
    val xs = listOf(14f, 38f, 62f, 86f)
    drawLine(Couleurs.Bordure, Offset(xs.first(), 50f), Offset(xs.last(), 50f), 3f, StrokeCap.Round)
    val avance = doux(segment(t, 150f, 800f))
    drawLine(Couleurs.Succes, Offset(xs.first(), 50f), Offset(xs.first() + (xs.last() - xs.first()) * avance, 50f), 3f, StrokeCap.Round)
    xs.forEachIndexed { i, x ->
        val allume = ressort(segment(t, 150f + i * 250f, 350f))
        val actif = i == 3 && segment(t, 900f, 100f) >= 1f
        val rayon = 7f + (if (actif) 1.2f * sin(boucle * 2f * PI.toFloat()) else 0f)
        scale(0.7f + 0.3f * allume, pivot = Offset(x, 50f)) {
            disque(Offset(x, 50f), rayon, if (allume > 0.6f) Couleurs.Succes else Couleurs.Surface)
            if (allume > 0.6f) {
                drawPath(Path().apply { moveTo(x - 3f, 50f); lineTo(x - 0.8f, 52.4f); lineTo(x + 3.4f, 47.4f) }, Couleurs.Creme, style = Stroke(width = 1.9f, cap = StrokeCap.Round, join = StrokeJoin.Round))
            }
        }
        val montee = doux(segment(t, 250f + i * 250f, 300f))
        drawRoundRect(Couleurs.Bordure, Offset(x - 9f, 64f + (1f - montee) * 6f), Size(18f, 4f), CornerRadius(2f), alpha = montee)
    }
    // Bulle de proposition du restaurant : c'est le client qui tranche.
    val bulle = ressort(segment(t, 900f, 400f))
    scale(bulle, pivot = Offset(50f, 30f)) {
        drawRoundRect(Couleurs.AvertissementFond, Offset(26f, 14f), Size(48f, 18f), CornerRadius(6f))
        drawRoundRect(Couleurs.Mangue, Offset(26f, 14f), Size(48f, 18f), CornerRadius(6f), style = trait())
        drawLine(Couleurs.AvertissementTexte, Offset(32f, 23f), Offset(52f, 23f), 2f, StrokeCap.Round)
        drawCircle(Couleurs.Succes, 3.2f, Offset(60f, 23f))
        drawCircle(Couleurs.Danger, 3.2f, Offset(68f, 23f))
    }
}

/** 5. Les trois espaces : client, restaurateur, livreur, qui arrivent en cascade. */
private fun DrawScope.dessinEspaces(t: Float, boucle: Float) {
    val fonds = listOf(Couleurs.Creme, Couleurs.Mangue, Couleurs.Surface)
    val positions = listOf(Offset(50f, 22f), Offset(24f, 66f), Offset(76f, 66f))
    positions.forEachIndexed { i, c ->
        val q = ressort(segment(t, i * 220f, 450f))
        val flotte = sin((boucle + i * 0.33f) * 2f * PI.toFloat()) * 1.8f
        scale(q, pivot = Offset(c.x, c.y + flotte)) {
            drawRoundRect(Couleurs.Encre, Offset(c.x - 17f + 1.6f, c.y - 17f + 1.6f + flotte), Size(34f, 34f), CornerRadius(8f))
            drawRoundRect(fonds[i], Offset(c.x - 17f, c.y - 17f + flotte), Size(34f, 34f), CornerRadius(8f))
            drawRoundRect(Couleurs.Encre, Offset(c.x - 17f, c.y - 17f + flotte), Size(34f, 34f), CornerRadius(8f), style = trait())
            when (i) {
                0 -> { // panier
                    val corps = Path().apply { moveTo(c.x - 9f, c.y - 3f + flotte); lineTo(c.x + 9f, c.y - 3f + flotte); lineTo(c.x + 7f, c.y + 10f + flotte); lineTo(c.x - 7f, c.y + 10f + flotte); close() }
                    drawPath(corps, Couleurs.RougeFonce)
                    drawPath(corps, Couleurs.Encre, style = trait())
                    drawPath(Path().apply { moveTo(c.x - 4f, c.y - 3f + flotte); cubicTo(c.x - 4f, c.y - 13f + flotte, c.x + 4f, c.y - 13f + flotte, c.x + 4f, c.y - 3f + flotte) }, Couleurs.Encre, style = trait())
                }
                1 -> { // devanture
                    drawRoundRect(Couleurs.Surface, Offset(c.x - 9f, c.y - 1f + flotte), Size(18f, 11f), CornerRadius(1.5f))
                    drawRoundRect(Couleurs.Encre, Offset(c.x - 9f, c.y - 1f + flotte), Size(18f, 11f), CornerRadius(1.5f), style = trait())
                    val store = Path().apply { moveTo(c.x - 11f, c.y - 1f + flotte); lineTo(c.x - 8f, c.y - 9f + flotte); lineTo(c.x + 8f, c.y - 9f + flotte); lineTo(c.x + 11f, c.y - 1f + flotte); close() }
                    drawPath(store, Couleurs.RougeFonce)
                    drawPath(store, Couleurs.Encre, style = trait())
                }
                else -> { // scooter
                    drawCircle(Couleurs.Encre, 3.4f, Offset(c.x - 9f, c.y + 8f + flotte), style = trait())
                    drawCircle(Couleurs.Encre, 3.4f, Offset(c.x + 9f, c.y + 8f + flotte), style = trait())
                    drawPath(Path().apply { moveTo(c.x - 9f, c.y + 8f + flotte); lineTo(c.x - 2f, c.y + 8f + flotte); lineTo(c.x + 3f, c.y - 1f + flotte); lineTo(c.x + 7f, c.y - 1f + flotte); lineTo(c.x + 9f, c.y + 8f + flotte) }, Couleurs.RougeFonce, style = Stroke(width = 2.4f, cap = StrokeCap.Round, join = StrokeJoin.Round))
                    drawRoundRect(Couleurs.Mangue, Offset(c.x - 14f, c.y - 8f + flotte), Size(11f, 9f), CornerRadius(1.5f))
                    drawRoundRect(Couleurs.Encre, Offset(c.x - 14f, c.y - 8f + flotte), Size(11f, 9f), CornerRadius(1.5f), style = trait())
                }
            }
        }
    }
    // Fils qui relient les trois espaces : une même application.
    val lien = doux(segment(t, 650f, 350f))
    drawLine(Couleurs.Bordure, Offset(50f, 40f), Offset(30f, 50f), 1.6f, StrokeCap.Round, alpha = lien)
    drawLine(Couleurs.Bordure, Offset(50f, 40f), Offset(70f, 50f), 1.6f, StrokeCap.Round, alpha = lien)
    drawLine(Couleurs.Bordure, Offset(41f, 66f), Offset(59f, 66f), 1.6f, StrokeCap.Round, alpha = lien)
}
