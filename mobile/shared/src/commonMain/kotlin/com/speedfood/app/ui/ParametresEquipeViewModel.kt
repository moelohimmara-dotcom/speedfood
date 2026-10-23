package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.ParametresEquipe
import com.speedfood.app.data.ParametresEquipeApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatParametresEquipe {
    data object Chargement : EtatParametresEquipe
    data object NonConnecte : EtatParametresEquipe
    data class Erreur(val message: String) : EtatParametresEquipe
    data class Pret(
        val parametres: ParametresEquipe,
        val message: String? = null,
        val chargementEnCours: Boolean = false,
    ) : EtatParametresEquipe
}

/**
 * Les réglages globaux de l'application, en lecture seule. L'application permet de consulter un réglage (utile en assistance) ; les
 * modifier reste sur le site, où le formulaire est validé, tracé au journal d'audit et borné par la base.
 */
class ParametresEquipeViewModel(private val session: SessionService, private val api: ParametresEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatParametresEquipe>(EtatParametresEquipe.Chargement)
    val etat: StateFlow<EtatParametresEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge les réglages. */
    fun charger() {
        val message = (_etat.value as? EtatParametresEquipe.Pret)?.message
        viewModelScope.launch { lire(message) }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatParametresEquipe.NonConnecte
            return
        }
        try {
            _etat.value = EtatParametresEquipe.Pret(api.parametres(jeton), message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatParametresEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatParametresEquipe.Pret
            _etat.value = avant?.copy(message = e.message, chargementEnCours = false) ?: EtatParametresEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}
