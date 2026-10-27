package com.speedfood.app.design

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
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

/** Échelle typographique : titres lourds, texte lisible (la police maison sera embarquée au lot suivant). */
private val typographie = Typography(
    headlineLarge = TextStyle(fontSize = 30.sp, lineHeight = 34.sp, fontWeight = FontWeight.ExtraBold),
    headlineMedium = TextStyle(fontSize = 24.sp, lineHeight = 28.sp, fontWeight = FontWeight.ExtraBold),
    titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 24.sp, fontWeight = FontWeight.ExtraBold),
    titleMedium = TextStyle(fontSize = 17.sp, lineHeight = 22.sp, fontWeight = FontWeight.Bold),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.ExtraBold),
    labelMedium = TextStyle(fontSize = 12.sp, lineHeight = 16.sp, fontWeight = FontWeight.Bold),
)

private val formes = Shapes(
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
)

@Composable
fun SpeedfoodTheme(contenu: @Composable () -> Unit) {
    MaterialTheme(colorScheme = schemaClair, typography = typographie, shapes = formes, content = contenu)
}
