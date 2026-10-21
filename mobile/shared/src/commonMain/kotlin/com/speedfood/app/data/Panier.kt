package com.speedfood.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

const val QUANTITE_MAX_LIGNE = 30
const val LIGNES_MAX_PANIER = 50

/** Ligne de panier : un plat, ses suppléments choisis, une quantité. Deux mêmes plats avec des suppléments différents sont deux lignes distinctes. */
data class LignePanier(val plat: Plat, val options: List<OptionPlat>, val quantite: Int) {
    /** Prix d'une unité : prix payé du plat (promo comprise) plus les suppléments. Affichage seulement : le serveur recalcule tout. */
    val prixUnitaire: Int get() = plat.prixEffectif + options.sumOf { it.prix }
    val total: Int get() = prixUnitaire * quantite
    val cle: String get() = plat.id + "|" + options.map { it.id }.sorted().joinToString(",")
}

data class Panier(val restaurantId: String? = null, val restaurantNom: String? = null, val lignes: List<LignePanier> = emptyList()) {
    val sousTotal: Int get() = lignes.sumOf { it.total }
    val nombreArticles: Int get() = lignes.sumOf { it.quantite }
    val estVide: Boolean get() = lignes.isEmpty()
}

enum class ResultatAjout { Ajoute, AutreRestaurant, QuantiteMax, PanierPlein }

/**
 * Panier de l'application : UN seul restaurant à la fois (une commande = un restaurant). Ajouter un plat d'un autre restaurant ne remplace rien sans
 * confirmation ([remplacerEtAjouter]). Les montants affichés ne servent qu'à informer : le serveur recalcule chaque prix et refuse si le total vu diffère.
 */
class PanierService {
    private val _panier = MutableStateFlow(Panier())
    val panier: StateFlow<Panier> = _panier.asStateFlow()

    fun ajouter(restaurantId: String, restaurantNom: String, plat: Plat, options: List<OptionPlat>, quantite: Int = 1): ResultatAjout {
        val courant = _panier.value
        if (courant.restaurantId != null && courant.restaurantId != restaurantId && !courant.estVide) return ResultatAjout.AutreRestaurant
        return ajouterSansControle(restaurantId, restaurantNom, plat, options, quantite)
    }

    fun remplacerEtAjouter(restaurantId: String, restaurantNom: String, plat: Plat, options: List<OptionPlat>, quantite: Int = 1): ResultatAjout {
        _panier.value = Panier()
        return ajouterSansControle(restaurantId, restaurantNom, plat, options, quantite)
    }

    private fun ajouterSansControle(restaurantId: String, restaurantNom: String, plat: Plat, options: List<OptionPlat>, quantite: Int): ResultatAjout {
        var resultat = ResultatAjout.Ajoute
        _panier.update { p ->
            val nouvelle = LignePanier(plat, options.filter { it.disponible }.distinctBy { it.id }, quantite.coerceAtLeast(1))
            val existante = p.lignes.firstOrNull { it.cle == nouvelle.cle }
            when {
                existante != null -> {
                    val total = existante.quantite + nouvelle.quantite
                    if (total > QUANTITE_MAX_LIGNE) {
                        resultat = ResultatAjout.QuantiteMax
                        p
                    } else {
                        p.copy(lignes = p.lignes.map { if (it.cle == existante.cle) it.copy(quantite = total) else it })
                    }
                }
                p.lignes.size >= LIGNES_MAX_PANIER -> {
                    resultat = ResultatAjout.PanierPlein
                    p
                }
                nouvelle.quantite > QUANTITE_MAX_LIGNE -> {
                    resultat = ResultatAjout.QuantiteMax
                    p
                }
                else -> p.copy(restaurantId = restaurantId, restaurantNom = restaurantNom, lignes = p.lignes + nouvelle)
            }
        }
        return resultat
    }

    /** Change la quantité d'une ligne ; zéro la retire. Le panier vide oublie son restaurant. */
    fun definirQuantite(cle: String, quantite: Int) {
        _panier.update { p ->
            val lignes = if (quantite <= 0) p.lignes.filterNot { it.cle == cle }
            else p.lignes.map { if (it.cle == cle) it.copy(quantite = quantite.coerceAtMost(QUANTITE_MAX_LIGNE)) else it }
            if (lignes.isEmpty()) Panier() else p.copy(lignes = lignes)
        }
    }

    /**
     * Remet à jour le panier d'après le menu actuel du restaurant (après un refus pour « prix changés ») : chaque ligne reprend le plat et les suppléments
     * d'aujourd'hui ; un plat qui n'existe plus est retiré. Renvoie le nombre de lignes retirées.
     */
    fun actualiser(menu: Menu): Int {
        var retirees = 0
        _panier.update { p ->
            val lignes = p.lignes.mapNotNull { ligne ->
                val plat = menu.plats.firstOrNull { it.id == ligne.plat.id }
                if (plat == null) {
                    retirees++
                    null
                } else {
                    val options = ligne.options.mapNotNull { o -> plat.options.firstOrNull { it.id == o.id && it.disponible } }
                    ligne.copy(plat = plat, options = options)
                }
            }
            if (lignes.isEmpty()) Panier() else p.copy(lignes = lignes)
        }
        return retirees
    }

    fun vider() {
        _panier.value = Panier()
    }
}
