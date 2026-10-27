package com.speedfood.app.design

import androidx.compose.ui.graphics.Color

/** Fond plein et couleur du texte posé dessus (le contraste AA est celui de chaque paire : texte encre sur orange et mangue, crème sur rouge et encre). */
data class Teinte(val fond: Color, val texte: Color)

private val teintesMarque = listOf(
    Teinte(Couleurs.RougeFonce, Couleurs.Creme),
    Teinte(Couleurs.Orange, Couleurs.Encre),
    Teinte(Couleurs.Mangue, Couleurs.Encre),
    Teinte(Couleurs.Encre, Couleurs.Creme),
)

private fun sansAccents(s: String) = s.lowercase().map {
    when (it) {
        'é', 'è', 'ê', 'ë' -> 'e'
        'à', 'â', 'ä' -> 'a'
        'î', 'ï' -> 'i'
        'ô', 'ö' -> 'o'
        'ù', 'û', 'ü' -> 'u'
        'ç' -> 'c'
        else -> it
    }
}.joinToString("")

/**
 * Couleur d'une vignette sans photo, par catégorie (règle verrouillée de `DESIGN-SYSTEM.md` §0) : riz et sauces → rouge, grillades → orange, fast-food → mangue, petit-déjeuner → encre.
 * Une catégorie inconnue (ou aucune) reçoit une teinte stable tirée de son nom : la même carte a toujours la même couleur, et la liste n'est plus un mur de beige.
 */
fun teinteCategorie(categorie: String?, nom: String = ""): Teinte {
    val c = sansAccents(categorie.orEmpty())
    return when {
        "riz" in c || "sauce" in c -> teintesMarque[0]
        "grill" in c || "brochette" in c -> teintesMarque[1]
        "fast" in c || "burger" in c || "pizza" in c || "sandwich" in c -> teintesMarque[2]
        "petit" in c || "dejeuner" in c || "boulanger" in c || "cafe" in c -> teintesMarque[3]
        else -> teintesMarque[(sansAccents(categorie ?: nom).sumOf { it.code }) % teintesMarque.size]
    }
}
