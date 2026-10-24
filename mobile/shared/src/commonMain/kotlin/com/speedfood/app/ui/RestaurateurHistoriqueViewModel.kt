package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.CommandeHistorique
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.HistoriqueRestaurateurApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatHistorique {
    data object Chargement : EtatHistorique
    data object NonConnecte : EtatHistorique
    data class Erreur(val message: String) : EtatHistorique

    /** [commandes] : les pages déjà chargées, les plus récentes d'abord. [message] : panne expliquée, les commandes déjà affichées restent affichées. */
    data class Pret(
        val commandes: List<CommandeHistorique> = emptyList(),
        val page: Int = 1,
        val total: Int = 0,
        val pageSuivante: Int? = null,
        val chargementEnCours: Boolean = false,
        val message: String? = null,
    ) : EtatHistorique
}

/**
 * L'historique des commandes, paginé : la première page au chargement, la page suivante quand le restaurateur la demande. Les pages déjà
 * chargées restent affichées : une panne en cours de route n'efface rien.
 */
class RestaurateurHistoriqueViewModel(
    private val session: SessionService,
    private val api: HistoriqueRestaurateurApi,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatHistorique>(EtatHistorique.Chargement)
    val etat: StateFlow<EtatHistorique> = _etat.asStateFlow()

    init {
        chargerPremierePage()
    }

    /** Recharge l'historique depuis la première page (rafraîchissement). */
    fun charger() {
        _etat.value = EtatHistorique.Chargement
        chargerPremierePage()
    }

    private fun chargerPremierePage() {
        viewModelScope.launch { lire(1, remplacer = true) }
    }

    /** Charge la page suivante et l'ajoute à l'historique déjà affiché. */
    fun chargerPageSuivante() {
        val courant = _etat.value as? EtatHistorique.Pret ?: return
        val suivante = courant.pageSuivante ?: return
        if (courant.chargementEnCours) return
        _etat.value = courant.copy(chargementEnCours = true, message = null)
        viewModelScope.launch { lire(suivante, remplacer = false) }
    }

    private suspend fun lire(page: Int, remplacer: Boolean) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatHistorique.NonConnecte
            return
        }
        try {
            val reponse = api.historique(jeton, page, TAILLE_PAGE)
            val avant = _etat.value as? EtatHistorique.Pret
            val commandes = if (remplacer || avant == null) reponse.commandes else avant.commandes + reponse.commandes
            _etat.value = EtatHistorique.Pret(
                commandes = commandes,
                page = reponse.page,
                total = reponse.total,
                pageSuivante = reponse.pageSuivante,
                chargementEnCours = false,
                message = null,
            )
        } catch (e: ErreurAcces) {
            _etat.value = EtatHistorique.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            // Les commandes déjà affichées restent affichées : la panne s'ajoute à l'écran, elle ne le remplace pas.
            val avant = _etat.value as? EtatHistorique.Pret
            _etat.value = avant?.copy(chargementEnCours = false, message = e.message)
                ?: EtatHistorique.Erreur(e.message ?: "Impossible de joindre Speedfood.")
        }
    }

    companion object {
        /** Nombre de commandes par page : assez pour remplir l'écran, assez peu pour rester rapide sur une connexion lente. */
        const val TAILLE_PAGE = 20
    }
}
