package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AvisAModerer
import com.speedfood.app.data.AvisEquipeApi
import com.speedfood.app.data.DecisionAvis
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatAvisEquipe {
    data object Chargement : EtatAvisEquipe
    data object NonConnecte : EtatAvisEquipe
    data class Erreur(val message: String) : EtatAvisEquipe
    data class Pret(val avis: AvisAModerer, val message: String? = null, val actionEnCours: Boolean = false) : EtatAvisEquipe
}

/** Modération des avis dans l'espace équipe : lecture des signalements et alertes, décision motivée (le serveur revérifie la permission et journalise). */
class AvisEquipeViewModel(private val session: SessionService, private val api: AvisEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatAvisEquipe>(EtatAvisEquipe.Chargement)
    val etat: StateFlow<EtatAvisEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatAvisEquipe.NonConnecte
            return
        }
        try {
            _etat.value = EtatAvisEquipe.Pret(api.avis(jeton), message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatAvisEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatAvisEquipe.Pret
            _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatAvisEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    fun decider(avisId: String, decision: DecisionAvis, motif: String) {
        val courant = _etat.value as? EtatAvisEquipe.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val erreur = if (jeton == null) "Connectez-vous avec votre compte." else try {
                api.moderer(jeton, avisId, decision, motif)
            } catch (e: ErreurReseau) {
                e.message
            }
            lire(erreur ?: "Décision enregistrée.")
        }
    }
}
