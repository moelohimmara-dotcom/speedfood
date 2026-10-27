package com.speedfood.app.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import org.jetbrains.compose.resources.Font
import speedfood.shared.generated.resources.Res
import speedfood.shared.generated.resources.bricolage
import speedfood.shared.generated.resources.manrope
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val schemaClair = lightColorScheme(
    primary = Couleurs.RougeFonce,
    onPrimary = Couleurs.Creme,
    secondary = Couleurs.Orange,
    onSecondary = Couleurs.Encre,
    tertiary = Couleurs.Mangue,
    onTertiary = Couleurs.Encre,
    background = Couleurs.Creme,
    onBackground = Couleurs.Encre,
    surface = Couleurs.Surface,
    onSurface = Couleurs.Encre,
    surfaceVariant = Couleurs.SurfaceAlt,
    // Fond des boîtes de dialogue (AlertDialog, menus déroulants hauts) : sans cela Material les peint en lavande, hors charte.
    surfaceContainerHigh = Couleurs.Surface,
    onSurfaceVariant = Couleurs.Secondaire,
    outline = Couleurs.Bordure,
    error = Couleurs.Danger,
    onError = Couleurs.Surface,
)

/**
 * Échelle typographique de la direction « Marché » : Bricolage Grotesque pour les titres (comme le site public), Manrope pour le texte, les libellés et les prix. Polices libres (OFL),
 * embarquées dans l'application (aucune requête vers un fournisseur). Ce sont des polices variables : chaque graisse est une instance de leur axe de graisse.
 */
@Composable
private fun typographie(): Typography {
    @Composable fun titre(poids: Int) = Font(Res.font.bricolage, FontWeight(poids), variationSettings = FontVariation.Settings(FontVariation.weight(poids)))
    @Composable fun texte(poids: Int) = Font(Res.font.manrope, FontWeight(poids), variationSettings = FontVariation.Settings(FontVariation.weight(poids)))
    val titres = FontFamily(titre(700), titre(800))
    val corps = FontFamily(texte(400), texte(500), texte(600), texte(700), texte(800))
    return Typography(
        headlineLarge = TextStyle(fontFamily = titres, fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.ExtraBold),
        headlineMedium = TextStyle(fontFamily = titres, fontSize = 24.sp, lineHeight = 28.sp, fontWeight = FontWeight.ExtraBold),
        headlineSmall = TextStyle(fontFamily = titres, fontSize = 22.sp, lineHeight = 27.sp, fontWeight = FontWeight.ExtraBold),
        titleSmall = TextStyle(fontFamily = titres, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold),
        titleLarge = TextStyle(fontFamily = titres, fontSize = 21.sp, lineHeight = 25.sp, fontWeight = FontWeight.ExtraBold),
        titleMedium = TextStyle(fontFamily = titres, fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold),
        bodyLarge = TextStyle(fontFamily = corps, fontSize = 16.sp, lineHeight = 23.sp, fontWeight = FontWeight.Normal),
        bodyMedium = TextStyle(fontFamily = corps, fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.Normal),
        bodySmall = TextStyle(fontFamily = corps, fontSize = 12.sp, lineHeight = 17.sp, fontWeight = FontWeight.Normal),
        labelLarge = TextStyle(fontFamily = corps, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.ExtraBold),
        labelMedium = TextStyle(fontFamily = corps, fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Bold),
        labelSmall = TextStyle(fontFamily = corps, fontSize = 11.sp, lineHeight = 15.sp, fontWeight = FontWeight.SemiBold),
    )
}

private val formes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
)

@Composable
fun SpeedfoodTheme(contenu: @Composable () -> Unit) {
    MaterialTheme(colorScheme = schemaClair, typography = typographie(), shapes = formes, content = contenu)
}
