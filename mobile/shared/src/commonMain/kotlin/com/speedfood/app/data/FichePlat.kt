package com.speedfood.app.data

/** Sélection locale d'un plat : aucun prix saisi par le client n'est envoyé au serveur. */
data class SelectionPlat(val plat: Plat, val options: List<OptionPlat> = emptyList(), val quantite: Int = 1) {
    val prixUnitaire: Int get() = plat.prixEffectif + options.filter { it.disponible }.sumOf { it.prix }
    val prixTotal: Int get() = prixUnitaire * quantite.coerceIn(1, QUANTITE_MAX_LIGNE)
}

fun totalPlat(plat: Plat, options: List<OptionPlat>, quantite: Int): Int =
    SelectionPlat(plat, options, quantite).prixTotal

fun cleOptionPlat(platId: String, optionId: String) = "plat-$platId-option-$optionId"
