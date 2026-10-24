package com.speedfood.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.speedfood.app.design.Couleurs
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/** Teintes du logotype (relevées sur le logo officiel : bordeaux du burger et des ailes, ocre de la vapeur et de la signature). */
private val Bordeaux = Color(0xFF7E1A1A)
private val Ocre = Color(0xFFC9922B)

/** Durée totale de la séquence d'ouverture, en millisecondes. */
/** Une ouverture courte : la marque est animée sans retenir la personne près de trois secondes. */
const val DUREE_OUVERTURE_MS = 1_600

private fun segment(t: Float, debut: Float, duree: Float): Float = ((t - debut) / duree).coerceIn(0f, 1f)

/** Ralentit en fin de course avec un petit dépassement (effet « ressort »), comme un objet qui se pose. */
private fun ressort(x: Float): Float {
    val c1 = 1.70158f
    val c3 = c1 + 1f
    val y = x - 1f
    return 1f + c3 * y * y * y + c1 * y * y
}

private fun doux(x: Float): Float = x * x * (3f - 2f * x)

/**
 * Logo Speedfood dessiné en vectoriel pour pouvoir l'animer : le burger tombe et se pose, les ailes se déploient d'un battement, la vapeur monte en ondulant.
 * [t] est le temps de la séquence en millisecondes (0 à [DUREE_OUVERTURE_MS]) : le dessin est une pure fonction de [t], donc identique à chaque lecture et
 * vérifiable image par image.
 */
@Composable
fun LogoAnime(t: Float, taille: Dp = 220.dp) {
    Canvas(Modifier.size(taille)) { dessinerLogo(t) }
}

private fun DrawScope.dessinerLogo(t: Float) {
    val u = size.minDimension / 100f
    scale(u, u, pivot = Offset.Zero) {
        // 1. Les ailes se déploient d'un battement : rotation depuis l'épaule avec dépassement.
        val ailes = ressort(segment(t, 420f, 700f))
        val alphaAiles = doux(segment(t, 420f, 260f))
        rotate(degrees = (1f - ailes) * 38f, pivot = Offset(54f, 62f)) {
            scale(0.55f + 0.45f * ailes, 0.55f + 0.45f * ailes, pivot = Offset(54f, 62f)) {
                dessinerAiles(alphaAiles)
            }
        }
        // 2. Le burger tombe d'en haut et se pose avec un léger écrasement.
        val chute = ressort(segment(t, 80f, 620f))
        val alphaBurger = doux(segment(t, 80f, 220f))
        val ecrase = 1f - 0.07f * sin(PI.toFloat() * segment(t, 560f, 260f))
        translate(0f, (1f - chute) * -34f) {
            scale(1f, ecrase, pivot = Offset(66f, 74f)) {
                dessinerBurger(alphaBurger)
            }
        }
        // 3. La vapeur monte en ondulant, puis continue doucement.
        dessinerVapeur(apparition = doux(segment(t, 900f, 700f)), phase = t * 0.0045f)
    }
}

private fun DrawScope.dessinerBurger(a: Float) {
    val dome = Path().apply {
        moveTo(36f, 53f)
        cubicTo(36f, 40f, 48f, 30f, 66f, 30f)
        cubicTo(86f, 30f, 98f, 41f, 98f, 53f)
        close()
    }
    drawPath(dome, Bordeaux, alpha = a)
    // Reflet sur le pain du dessus.
    val reflet = Path().apply {
        moveTo(55f, 41f)
        quadraticTo(66f, 33.5f, 79f, 37f)
    }
    drawPath(reflet, Couleurs.Creme, alpha = a, style = Stroke(width = 1.7f, cap = StrokeCap.Round))
    // Steak puis pain du dessous, séparés par un filet de vide comme sur le logo.
    drawRoundRect(Bordeaux, Offset(36f, 56f), Size(62f, 6f), CornerRadius(3f), alpha = a)
    drawRoundRect(Bordeaux, Offset(39f, 65f), Size(56f, 8f), CornerRadius(4f), alpha = a)
}

private fun DrawScope.dessinerAiles(a: Float) {
    // Trois plumes en éventail depuis l'épaule du burger, de la plus basse à la plus haute ; un filet de la couleur du fond les sépare, comme sur le logo.
    val basse = Path().apply {
        moveTo(44f, 60f)
        cubicTo(32f, 57f, 16f, 54f, 5f, 49f)
        cubicTo(22f, 43f, 38f, 46f, 46f, 54f)
        close()
    }
    val milieu = Path().apply {
        moveTo(46f, 55f)
        cubicTo(34f, 46f, 16f, 36f, 3f, 27f)
        cubicTo(24f, 22f, 42f, 32f, 50f, 46f)
        close()
    }
    val haute = Path().apply {
        moveTo(50f, 49f)
        cubicTo(44f, 36f, 34f, 24f, 22f, 12f)
        cubicTo(40f, 12f, 54f, 24f, 58f, 42f)
        close()
    }
    for (plume in listOf(basse, milieu, haute)) {
        drawPath(plume, Bordeaux, alpha = a)
        drawPath(plume, Couleurs.Creme, alpha = a, style = Stroke(width = 1.5f))
    }
}

private fun DrawScope.dessinerVapeur(apparition: Float, phase: Float) {
    if (apparition <= 0f) return
    val volutes = listOf(Triple(55f, 0.0f, 24f), Triple(65f, 1.7f, 28f), Triple(75f, 3.3f, 22f))
    for ((x0, dephasage, hauteur) in volutes) {
        val trace = Path()
        val pas = 36
        val fin = (pas * apparition).toInt()
        for (i in 0..fin) {
            val f = i / pas.toFloat()
            val y = 27f - f * hauteur
            val x = x0 + 2.4f * sin(f * 2f * PI.toFloat() * 1.25f + phase * 2f + dephasage)
            if (i == 0) trace.moveTo(x, y) else trace.lineTo(x, y)
        }
        drawPath(trace, Ocre, alpha = min(1f, apparition * 1.4f), style = Stroke(width = 1.8f, cap = StrokeCap.Round))
    }
}

/** Le mot « SPEEDFOOD » lettre après lettre, puis la signature : même ordre de lecture que le logo. */
@Composable
fun LogotypeAnime(t: Float) {
    val mot = "SPEEDFOOD"
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row {
            mot.forEachIndexed { i, lettre ->
                val p = doux(segment(t, 1_050f + i * 55f, 380f))
                Text(
                    lettre.toString(),
                    modifier = Modifier.graphicsLayer {
                        alpha = p
                        translationY = (1f - p) * 18f
                    },
                    color = Bordeaux,
                    fontFamily = FontFamily.Serif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 34.sp,
                )
            }
        }
        val signature = doux(segment(t, 1_700f, 500f))
        Text(
            "QUICK & TASTY",
            modifier = Modifier.alpha(signature),
            color = Ocre,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
            letterSpacing = (3f + (1f - signature) * 6f).sp,
            textAlign = TextAlign.Center,
        )
    }
}

/** Dessin complet de l'ouverture à l'instant [t] (cercle d'onde, logo, logotype) : sert à l'écran réel et aux captures. */
@Composable
fun SceneOuverture(t: Float, modifier: Modifier = Modifier.fillMaxSize()) {
    Box(modifier, contentAlignment = Alignment.Center) {
        // Onde qui s'élargit derrière le logo au moment où le burger se pose.
        val onde = segment(t, 500f, 900f)
        Canvas(Modifier.fillMaxSize()) {
            if (onde in 0.001f..0.999f) {
                val rayon = max(size.width, size.height) * 0.6f * doux(onde)
                drawCircle(Couleurs.Mangue, radius = rayon, center = center, alpha = (1f - onde) * 0.28f)
            }
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            LogoAnime(t)
            LogotypeAnime(t)
        }
    }
}

/**
 * Écran d'ouverture : le logo s'anime au lancement de l'application (≈ 2,8 s), un toucher passe directement à la suite. [surTermine] est appelé une seule fois.
 */
@Composable
fun EcranOuverture(surTermine: () -> Unit) {
    var t by remember { mutableFloatStateOf(0f) }
    var fini by remember { mutableStateOf(false) }
    val horloge = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        horloge.animateTo(DUREE_OUVERTURE_MS.toFloat(), tween(DUREE_OUVERTURE_MS, easing = LinearEasing)) { t = value }
        if (!fini) {
            fini = true
            surTermine()
        }
    }
    Box(
        Modifier.fillMaxSize().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) {
            if (!fini) {
                fini = true
                surTermine()
            }
        },
    ) {
        SceneOuverture(t)
    }
}
