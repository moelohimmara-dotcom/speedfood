package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.PaiementsEquipe
import com.speedfood.app.data.PaiementsEquipeApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Paiements en ligne (équipe), lecture seule. Les données déjà affichées sont gardées si une actualisation échoue. */
class PaiementsEquipeViewModel(private val session: SessionService, private val api: PaiementsEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatBilan<PaiementsEquipe>>(EtatBilan.Chargement)
    val etat: StateFlow<EtatBilan<PaiementsEquipe>> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatBilan.NonConnecte
                return@launch
            }
            _etat.value = try {
                EtatBilan.Pret(api.paiements(jeton))
            } catch (e: ErreurAcces) {
                EtatBilan.Erreur(e.message ?: "Accès refusé.")
            } catch (e: ErreurReseau) {
                val avant = _etat.value as? EtatBilan.Pret<PaiementsEquipe>
                avant?.copy(message = "Connexion perdue : les chiffres affichés datent de la dernière actualisation.") ?: EtatBilan.Erreur(e.message ?: "Une erreur est survenue.")
            }
        }
    }
}
