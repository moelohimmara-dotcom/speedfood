package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.FinancesEquipe
import com.speedfood.app.data.FinancesEquipeApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Finances d'équipe : lecture seule, conservation du relevé déjà affiché en cas de panne. */
class EquipeFinancesViewModel(private val session: SessionService, private val api: FinancesEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatBilan<FinancesEquipe>>(EtatBilan.Chargement)
    val etat: StateFlow<EtatBilan<FinancesEquipe>> = _etat.asStateFlow()

    init { charger() }

    fun charger() {
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatBilan.NonConnecte
                return@launch
            }
            val avant = _etat.value
            _etat.value = try {
                EtatBilan.Pret(api.finances(jeton))
            } catch (e: ErreurAcces) {
                EtatBilan.Erreur(e.message ?: "Session expirée, reconnectez-vous.")
            } catch (e: ErreurReseau) {
                if (avant is EtatBilan.Pret<FinancesEquipe>) avant.copy(message = e.message ?: "Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
                else EtatBilan.Erreur(e.message ?: "Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
            }
        }
    }
}
