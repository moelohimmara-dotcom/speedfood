package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.BanniereEquipe
import com.speedfood.app.data.BannieresEquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StatutBanniereEquipe
import com.speedfood.app.data.statutBanniereEquipeValide
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatBannieresEquipe {
    data object Chargement : EtatBannieresEquipe
    data object NonConnecte : EtatBannieresEquipe
    data class Erreur(val message: String) : EtatBannieresEquipe
    data class Pret(
        val bannieres: List<BanniereEquipe>,
        val filtre: StatutBanniereEquipe = StatutBanniereEquipe.Toutes,
        /** Vrai si la liste est incomplète (borne de lecture atteinte). */
        val tronque: Boolean = false,
        val message: String? = null,
        val chargementEnCours: Boolean = false,
    ) : EtatBannieresEquipe
}

/**
 * Les bannières diffusées sur les écrans publics : on regarde ce qui est en ligne, on filtre par statut. L'application ne publie
 * rien : créer, publier ou supprimer une bannière se fait sur le site, parce qu'une bannière publiée change ce que voit le public.
 */
class BannieresEquipeViewModel(private val session: SessionService, private val api: BannieresEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatBannieresEquipe>(EtatBannieresEquipe.Chargement)
    val etat: StateFlow<EtatBannieresEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge les bannières avec le filtre en cours. */
    fun charger() {
        val courant = _etat.value as? EtatBannieresEquipe.Pret
        val filtre = courant?.filtre ?: StatutBanniereEquipe.Toutes
        // Un rafraîchissement ne doit pas effacer la confirmation de la dernière action : elle est toujours vraie.
        val message = courant?.message
        viewModelScope.launch { lire(filtre, message) }
    }

    /** Change le filtre (Toutes, Publiées, Brouillons) : le serveur filtre et renvoie la liste. */
    fun filtrer(statut: StatutBanniereEquipe) {
        val courant = _etat.value as? EtatBannieresEquipe.Pret ?: return
        if (courant.filtre == statut) return
        _etat.value = courant.copy(filtre = statut, message = null, chargementEnCours = true)
        viewModelScope.launch { lire(statut, null) }
    }

    private suspend fun lire(statut: StatutBanniereEquipe, message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatBannieresEquipe.NonConnecte
            return
        }
        try {
            val resultat = api.bannieres(jeton, statutBanniereEquipeValide(statut.code))
            _etat.value = EtatBannieresEquipe.Pret(resultat.bannieres, statut, resultat.tronque, message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatBannieresEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatBannieresEquipe.Pret
            _etat.value = avant?.copy(message = e.message, chargementEnCours = false) ?: EtatBannieresEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}
