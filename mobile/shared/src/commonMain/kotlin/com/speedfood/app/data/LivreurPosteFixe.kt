package com.speedfood.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Clé du stockage local : « oui » ou « non » pour le mode poste fixe. Absente tant que le livreur n'a pas choisi. */
const val CLE_POSTE_FIXE = "livreur_poste_fixe"

/**
 * Mode poste fixe : l'écran reste allumé pendant la livraison.
 *
 * Un seul détenteur du drapeau « écran allumé » : le suivi de position l'active déjà quand le livreur est en ligne ; le mode poste fixe
 * l'active en plus pendant une course, même quand le suivi est confié au service de la plateforme. Les deux réglages vivent ici pour
 * qu'un écran ne contrarie jamais l'autre.
 */
class PosteFixe(private val position: FournisseurPosition, private val stockage: StockageLocal) {
    private val _actif = MutableStateFlow(stockage.lire(CLE_POSTE_FIXE) == "oui")

    /** Le livreur a-t-il choisi le mode poste fixe ? */
    val actif: StateFlow<Boolean> = _actif.asStateFlow()

    private var suiviActif = false
    private var livraisonEnCours = false

    /** Le livreur choisit (ou renonce) le mode poste fixe ; le choix est gardé sur l'appareil. */
    fun definir(actif: Boolean) {
        stockage.ecrire(CLE_POSTE_FIXE, if (actif) "oui" else "non")
        _actif.value = actif
        appliquer()
    }

    /** L'état du livreur change : le suivi de position d'un côté, la course en cours de l'autre. */
    fun majuter(suiviActif: Boolean, livraisonEnCours: Boolean) {
        this.suiviActif = suiviActif
        this.livraisonEnCours = livraisonEnCours
        appliquer()
    }

    /** L'écran doit-il rester allumé maintenant ? */
    fun doitResterAllume(): Boolean = suiviActif || (_actif.value && livraisonEnCours)

    private fun appliquer() {
        position.garderEcranAllume(doitResterAllume())
    }
}
