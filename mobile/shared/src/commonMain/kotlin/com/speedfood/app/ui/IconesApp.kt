package com.speedfood.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Pictogrammes que la bibliothèque d'icônes de base n'a pas. Dessinés sur la grille 24 × 24 de Material, en aplat (la couleur est celle de l'onglet, posée par l'appelant).
 * Ils remplacent le « i » d'information qui servait à tort pour « Activité » et « Gains ».
 */
internal object IconesApp {
    /** Histogramme : l'activité d'un restaurant. */
    val Histogramme: ImageVector by lazy {
        ImageVector.Builder("Histogramme", 24.dp, 24.dp, 24f, 24f).apply {
            path(fill = SolidColor(Color.Black)) {
                moveTo(4f, 12f); horizontalLineTo(8f); verticalLineTo(20f); horizontalLineTo(4f); close()
                moveTo(10f, 4f); horizontalLineTo(14f); verticalLineTo(20f); horizontalLineTo(10f); close()
                moveTo(16f, 9f); horizontalLineTo(20f); verticalLineTo(20f); horizontalLineTo(16f); close()
            }
        }.build()
    }

    /** Pièce : les gains d'un livreur (anneau, centre plein). */
    val Piece: ImageVector by lazy {
        ImageVector.Builder("Piece", 24.dp, 24.dp, 24f, 24f).apply {
            path(fill = SolidColor(Color.Black), pathFillType = PathFillType.EvenOdd) {
                moveTo(12f, 2f); arcTo(10f, 10f, 0f, true, true, 12f, 22f); arcTo(10f, 10f, 0f, true, true, 12f, 2f); close()
                moveTo(12f, 4.6f); arcTo(7.4f, 7.4f, 0f, true, false, 12f, 19.4f); arcTo(7.4f, 7.4f, 0f, true, false, 12f, 4.6f); close()
                moveTo(12f, 8.6f); arcTo(3.4f, 3.4f, 0f, true, true, 12f, 15.4f); arcTo(3.4f, 3.4f, 0f, true, true, 12f, 8.6f); close()
            }
        }.build()
    }

    /** Épingle : la course, le lieu de livraison. */
    val Epingle: ImageVector by lazy {
        ImageVector.Builder("Epingle", 24.dp, 24.dp, 24f, 24f).apply {
            path(fill = SolidColor(Color.Black), pathFillType = PathFillType.EvenOdd) {
                moveTo(12f, 2f)
                curveTo(8.13f, 2f, 5f, 5.13f, 5f, 9f)
                curveTo(5f, 14.25f, 12f, 22f, 12f, 22f)
                curveTo(12f, 22f, 19f, 14.25f, 19f, 9f)
                curveTo(19f, 5.13f, 15.87f, 2f, 12f, 2f)
                close()
                moveTo(12f, 6.4f); arcTo(2.6f, 2.6f, 0f, true, true, 12f, 11.6f); arcTo(2.6f, 2.6f, 0f, true, true, 12f, 6.4f); close()
            }
        }.build()
    }

    /** Mallette : l'espace professionnel. */
    val Mallette: ImageVector by lazy {
        ImageVector.Builder("Mallette", 24.dp, 24.dp, 24f, 24f).apply {
            path(fill = SolidColor(Color.Black), pathFillType = PathFillType.EvenOdd) {
                moveTo(3f, 8f); horizontalLineTo(21f); verticalLineTo(20f); horizontalLineTo(3f); close()
                moveTo(8f, 8f); verticalLineTo(5f); horizontalLineTo(16f); verticalLineTo(8f); horizontalLineTo(14f); verticalLineTo(7f); horizontalLineTo(10f); verticalLineTo(8f); close()
            }
        }.build()
    }
}
