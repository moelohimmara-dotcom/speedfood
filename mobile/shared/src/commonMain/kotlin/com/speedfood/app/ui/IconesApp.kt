package com.speedfood.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Famille d'icônes de l'application : trait arrondi régulier sur la grille 24 × 24 (épaisseur 2, terminaisons et angles arrondis), comme le décide `DESIGN-SYSTEM.md` §4.
 * Une seule famille, au dessin de la marque, à la place des icônes génériques de Material (le « i » d'information servait à tout). Le dessin est en noir : la couleur est celle du
 * contexte (onglet actif, texte, accent), posée par l'appelant.
 */
internal object IconesApp {
    private fun icone(nom: String, bloc: ImageVector.Builder.() -> Unit): ImageVector =
        ImageVector.Builder(nom, 24.dp, 24.dp, 24f, 24f).apply(bloc).build()

    /** Trait arrondi (par défaut 2) : contour seul. */
    private fun ImageVector.Builder.trait(largeur: Float = 2f, dessin: PathBuilder.() -> Unit) {
        path(
            fill = null,
            stroke = SolidColor(Color.Black),
            strokeLineWidth = largeur,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            pathBuilder = dessin,
        )
    }

    /** Aplat : forme pleine (cœur d'un favori, étoile d'une note). */
    private fun ImageVector.Builder.plein(dessin: PathBuilder.() -> Unit) {
        path(fill = SolidColor(Color.Black), stroke = SolidColor(Color.Black), strokeLineWidth = 1.5f, strokeLineJoin = StrokeJoin.Round, pathBuilder = dessin)
    }

    /** Cercle de centre (cx, cy) et de rayon r, tracé en deux demi-arcs. */
    private fun PathBuilder.cercle(cx: Float, cy: Float, r: Float) {
        moveTo(cx - r, cy)
        arcTo(r, r, 0f, true, true, cx + r, cy)
        arcTo(r, r, 0f, true, true, cx - r, cy)
        close()
    }

    /** Restaurants : une devanture à auvent. */
    val Restaurants: ImageVector by lazy {
        icone("Restaurants") {
            trait {
                moveTo(3.5f, 9.5f); lineTo(5.5f, 4.5f); horizontalLineTo(18.5f); lineTo(20.5f, 9.5f); close()
                moveTo(5f, 12.5f); verticalLineTo(20f); horizontalLineTo(19f); verticalLineTo(12.5f)
                moveTo(10f, 20f); verticalLineTo(15.5f); horizontalLineTo(14f); verticalLineTo(20f)
            }
        }
    }

    /** Commandes : un ticket de caisse. */
    val Commandes: ImageVector by lazy {
        icone("Commandes") {
            trait {
                moveTo(6f, 3.5f); horizontalLineTo(18f); verticalLineTo(20.5f); lineTo(15f, 18.8f); lineTo(12f, 20.5f); lineTo(9f, 18.8f); lineTo(6f, 20.5f); close()
                moveTo(9.2f, 8.5f); horizontalLineTo(14.8f)
                moveTo(9.2f, 12.5f); horizontalLineTo(14.8f)
            }
        }
    }

    /** Panier : un sac à anses. */
    val Panier: ImageVector by lazy {
        icone("Panier") {
            trait {
                moveTo(5f, 8f); horizontalLineTo(19f); lineTo(18f, 20f); horizontalLineTo(6f); close()
                moveTo(9f, 8f); verticalLineTo(6.5f); arcTo(3f, 3f, 0f, false, true, 15f, 6.5f); verticalLineTo(8f)
            }
        }
    }

    /** Compte : une personne. */
    val Compte: ImageVector by lazy {
        icone("Compte") {
            trait {
                cercle(12f, 8f, 3.6f)
                moveTo(4.8f, 20.2f); curveTo(5.2f, 16.6f, 8f, 14.6f, 12f, 14.6f); curveTo(16f, 14.6f, 18.8f, 16.6f, 19.2f, 20.2f)
            }
        }
    }

    /** Tableau : quatre carrés (vue d'ensemble de l'équipe). */
    val Tableau: ImageVector by lazy {
        icone("Tableau") {
            trait {
                moveTo(4.5f, 4.5f); horizontalLineTo(10.5f); verticalLineTo(10.5f); horizontalLineTo(4.5f); close()
                moveTo(13.5f, 4.5f); horizontalLineTo(19.5f); verticalLineTo(10.5f); horizontalLineTo(13.5f); close()
                moveTo(4.5f, 13.5f); horizontalLineTo(10.5f); verticalLineTo(19.5f); horizontalLineTo(4.5f); close()
                moveTo(13.5f, 13.5f); horizontalLineTo(19.5f); verticalLineTo(19.5f); horizontalLineTo(13.5f); close()
            }
        }
    }

    /** Cloche : une nouvelle commande à traiter. */
    val Cloche: ImageVector by lazy {
        icone("Cloche") {
            trait {
                moveTo(6f, 16.5f); verticalLineTo(11f); arcTo(6f, 6f, 0f, false, true, 18f, 11f); verticalLineTo(16.5f); lineTo(19.5f, 18.5f); horizontalLineTo(4.5f); close()
                moveTo(10f, 21f); horizontalLineTo(14f)
            }
        }
    }

    /** Épingle : un lieu, une course. */
    val Epingle: ImageVector by lazy {
        icone("Epingle") {
            trait {
                moveTo(12f, 21.2f); curveTo(12f, 21.2f, 5.5f, 15.4f, 5.5f, 10f); arcTo(6.5f, 6.5f, 0f, false, true, 18.5f, 10f); curveTo(18.5f, 15.4f, 12f, 21.2f, 12f, 21.2f); close()
                cercle(12f, 10f, 2.4f)
            }
        }
    }

    /** Histogramme : l'activité. */
    val Histogramme: ImageVector by lazy {
        icone("Histogramme") {
            trait(largeur = 3f) {
                moveTo(5.5f, 19.5f); verticalLineTo(12f)
                moveTo(12f, 19.5f); verticalLineTo(5f)
                moveTo(18.5f, 19.5f); verticalLineTo(9.5f)
            }
        }
    }

    /** Pièce : les gains. */
    val Piece: ImageVector by lazy {
        icone("Piece") {
            trait {
                cercle(12f, 12f, 9f)
                moveTo(14.8f, 9.2f); arcTo(3.6f, 3.6f, 0f, true, false, 14.8f, 14.8f)
                moveTo(9f, 12f); horizontalLineTo(13f)
            }
        }
    }

    /** Mallette : l'espace professionnel. */
    val Mallette: ImageVector by lazy {
        icone("Mallette") {
            trait {
                moveTo(4f, 8f); horizontalLineTo(20f); verticalLineTo(19f); horizontalLineTo(4f); close()
                moveTo(9f, 8f); verticalLineTo(5.5f); horizontalLineTo(15f); verticalLineTo(8f)
                moveTo(4f, 13f); horizontalLineTo(20f)
            }
        }
    }

    private fun PathBuilder.formeCoeur() {
        moveTo(12f, 20.2f); curveTo(12f, 20.2f, 4f, 15.4f, 4f, 9.6f); arcTo(4.2f, 4.2f, 0f, false, true, 12f, 7.7f); arcTo(4.2f, 4.2f, 0f, false, true, 20f, 9.6f); curveTo(20f, 15.4f, 12f, 20.2f, 12f, 20.2f); close()
    }

    /** Cœur au trait : favori non choisi. */
    val CoeurTrait: ImageVector by lazy { icone("CoeurTrait") { trait { formeCoeur() } } }

    /** Cœur plein : favori choisi. */
    val Coeur: ImageVector by lazy { icone("Coeur") { plein { formeCoeur() } } }

    /** Étoile pleine : une note. */
    val Etoile: ImageVector by lazy {
        icone("Etoile") {
            plein {
                moveTo(12f, 3.6f); lineTo(14.6f, 9.1f); lineTo(20.5f, 9.8f); lineTo(16.1f, 13.8f); lineTo(17.3f, 19.7f); lineTo(12f, 16.7f); lineTo(6.7f, 19.7f); lineTo(7.9f, 13.8f); lineTo(3.5f, 9.8f); lineTo(9.4f, 9.1f); close()
            }
        }
    }

    /** Téléphone : un combiné. */
    val Telephone: ImageVector by lazy {
        icone("Telephone") {
            trait {
                moveTo(5.2f, 4.5f); horizontalLineTo(9f); lineTo(10.4f, 8.4f); lineTo(8.5f, 9.9f); curveTo(9.5f, 12.4f, 11.6f, 14.5f, 14.1f, 15.5f); lineTo(15.6f, 13.6f); lineTo(19.5f, 15f); verticalLineTo(18.8f)
                arcTo(1.7f, 1.7f, 0f, false, true, 17.8f, 20.5f); curveTo(10.5f, 20f, 4f, 13.5f, 3.5f, 6.2f); arcTo(1.7f, 1.7f, 0f, false, true, 5.2f, 4.5f); close()
            }
        }
    }

    /** Réglages : deux curseurs. */
    val Reglages: ImageVector by lazy {
        icone("Reglages") {
            trait {
                moveTo(4f, 8f); horizontalLineTo(8.5f)
                moveTo(13.5f, 8f); horizontalLineTo(20f)
                cercle(11f, 8f, 2.5f)
                moveTo(4f, 16f); horizontalLineTo(11f)
                moveTo(16f, 16f); horizontalLineTo(20f)
                cercle(13.5f, 16f, 2.5f)
            }
        }
    }

    /** Information : un cercle et un « i ». */
    val Info: ImageVector by lazy {
        icone("Info") {
            trait {
                cercle(12f, 12f, 9f)
                moveTo(12f, 11f); verticalLineTo(16f)
                moveTo(12f, 8f); horizontalLineTo(12.01f)
            }
        }
    }

    /** Cadenas : sécurité, confidentialité. */
    val Cadenas: ImageVector by lazy {
        icone("Cadenas") {
            trait {
                moveTo(6f, 11f); horizontalLineTo(18f); verticalLineTo(20f); horizontalLineTo(6f); close()
                moveTo(8.5f, 11f); verticalLineTo(8f); arcTo(3.5f, 3.5f, 0f, false, true, 15.5f, 8f); verticalLineTo(11f)
            }
        }
    }

    /** Recherche : une loupe. */
    val Recherche: ImageVector by lazy {
        icone("Recherche") {
            trait {
                cercle(11f, 11f, 6.2f)
                moveTo(15.6f, 15.6f); lineTo(20.2f, 20.2f)
            }
        }
    }

    /** Flèche de retour. */
    val Retour: ImageVector by lazy {
        icone("Retour") {
            trait {
                moveTo(19.5f, 12f); horizontalLineTo(5f)
                moveTo(11f, 6f); lineTo(5f, 12f); lineTo(11f, 18f)
            }
        }
    }

    /** Chevron : une ligne qui ouvre un écran. */
    val Chevron: ImageVector by lazy {
        icone("Chevron") {
            trait { moveTo(9f, 6f); lineTo(15f, 12f); lineTo(9f, 18f) }
        }
    }
}
