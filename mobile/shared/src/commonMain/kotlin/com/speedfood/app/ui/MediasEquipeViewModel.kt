package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.BanniereEquipe
import com.speedfood.app.data.BannieresEquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatMediasEquipe {
    data object Chargement : EtatMediasEquipe
    data object NonConnecte : EtatMediasEquipe
    data class Erreur(val message: String) : EtatMediasEquipe
    data class Pret(
        val medias: List<BanniereEquipe>,
        /** Vrai si la liste est incomplète (borne de lecture atteinte). */
        val tronque: Boolean = false,
        val message: String? = null,
        val chargementEnCours: Boolean = false,
    ) : EtatMediasEquipe
}

/**
 * La bibliothèque de médias : les images utilisées par les bannières. Lecture seule, et pas un espace d'envoi : l'image se joint à une
 * bannière depuis l'écran « Bannières » du site, pour ne pas dupliquer ce flux.
 */
class MediasEquipeViewModel(private val session: SessionService, private val api: BannieresEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatMediasEquipe>(EtatMediasEquipe.Chargement)
    val etat: StateFlow<EtatMediasEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge la bibliothèque. */
    fun charger() {
        val message = (_etat.value as? EtatMediasEquipe.Pret)?.message
        viewModelScope.launch { lire(message) }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatMediasEquipe.NonConnecte
            return
        }
        try {
            val resultat = api.medias(jeton)
            _etat.value = EtatMediasEquipe.Pret(resultat.bannieres, resultat.tronque, message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatMediasEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatMediasEquipe.Pret
            _etat.value = avant?.copy(message = e.message, chargementEnCours = false) ?: EtatMediasEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}
