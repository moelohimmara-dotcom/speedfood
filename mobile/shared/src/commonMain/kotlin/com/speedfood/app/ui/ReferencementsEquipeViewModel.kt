package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.DemandeReferencement
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.ReferencementsEquipeApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StatutDemande
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatReferencements {
    data object Chargement : EtatReferencements
    data object NonConnecte : EtatReferencements
    data class Erreur(val message: String) : EtatReferencements
    data class Pret(val demandes: List<DemandeReferencement>, val message: String? = null, val actionEnCours: Boolean = false) : EtatReferencements
}

/** Demandes de référencement (équipe) : lecture et changement de statut ; le serveur revérifie la permission et journalise chaque changement. */
class ReferencementsEquipeViewModel(private val session: SessionService, private val api: ReferencementsEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatReferencements>(EtatReferencements.Chargement)
    val etat: StateFlow<EtatReferencements> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatReferencements.NonConnecte
            return
        }
        try {
            _etat.value = EtatReferencements.Pret(api.demandes(jeton), message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatReferencements.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatReferencements.Pret
            _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatReferencements.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    fun changerStatut(id: String, statut: StatutDemande) {
        val courant = _etat.value as? EtatReferencements.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val erreur = if (jeton == null) "Connectez-vous avec votre compte." else try {
                api.changerStatut(jeton, id, statut)
            } catch (e: ErreurReseau) {
                e.message
            }
            lire(erreur ?: "Statut enregistré : ${statut.libelle}.")
        }
    }
}
