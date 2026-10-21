package com.speedfood.app.design

import androidx.compose.ui.graphics.Color

/**
 * Jetons de couleur de `docs/cadrage/DESIGN-SYSTEM.md`, portés tels quels (mêmes valeurs que `src/app/globals.css`).
 * Ne pas en inventer d'autres : toute nouvelle teinte se décide d'abord dans le design système.
 */
object Couleurs {
    val Rouge = Color(0xFFD9362B)
    val RougeFonce = Color(0xFFB82A20)
    val Orange = Color(0xFFFF7A1A)
    val Mangue = Color(0xFFFFC247)
    val Creme = Color(0xFFFFF6ED)
    val Surface = Color(0xFFFFFEFC)
    val SurfaceAlt = Color(0xFFFFFAF3)
    val Encre = Color(0xFF2B211D)
    /** Texte secondaire conforme AA (#75695F) ; ne jamais revenir à #80736C. */
    val Secondaire = Color(0xFF75695F)
    val Bordure = Color(0xFFE9DCD2)
    val Succes = Color(0xFF2E7D32)
    val SuccesFond = Color(0xFFE7F4E8)
    val Danger = Color(0xFFC62828)
    val DangerFond = Color(0xFFFBEAEA)
    val AvertissementFond = Color(0xFFFDF0DE)
    val AvertissementTexte = Color(0xFF8A4B00)
}
