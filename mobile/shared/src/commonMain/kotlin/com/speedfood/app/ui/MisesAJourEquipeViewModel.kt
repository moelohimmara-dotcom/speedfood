package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.MisesAJourEquipe
import com.speedfood.app.data.MisesAJourEquipeApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatMisesAJourEquipe {
    data object Chargement : EtatMisesAJourEquipe
    data object NonConnecte : EtatMisesAJourEquipe
    data class Erreur(val message: String) : EtatMisesAJourEquipe
    data class Pret(
        val donnees: MisesAJourEquipe,
        val message: String? = null,
        val chargementEnCours: Boolean = false,
    ) : EtatMisesAJourEquipe
}

/**
 * L'état des mises à jour : la version publiée, la dernière annonce envoyée aux téléphones, les interrupteurs pilotables et le journal
 * des nouveautés livrées. L'application montre l'état ; elle ne bascule rien et n'annonce rien (ces actions ont un effet immédiat sur
 * le public, ou envoient des notifications : elles restent sur le site).
 */
class MisesAJourEquipeViewModel(private val session: SessionService, private val api: MisesAJourEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatMisesAJourEquipe>(EtatMisesAJourEquipe.Chargement)
    val etat: StateFlow<EtatMisesAJourEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge l'état des mises à jour. */
    fun charger() {
        val message = (_etat.value as? EtatMisesAJourEquipe.Pret)?.message
        viewModelScope.launch { lire(message) }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatMisesAJourEquipe.NonConnecte
            return
        }
        try {
            _etat.value = EtatMisesAJourEquipe.Pret(api.misesAJour(jeton), message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatMisesAJourEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatMisesAJourEquipe.Pret
            _etat.value = avant?.copy(message = e.message, chargementEnCours = false) ?: EtatMisesAJourEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}
