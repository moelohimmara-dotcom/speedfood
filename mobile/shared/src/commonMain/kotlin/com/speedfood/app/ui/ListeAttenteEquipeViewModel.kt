package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.ListeAttenteEquipeApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.ZoneAttenteEquipe
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatListeAttenteEquipe {
    data object Chargement : EtatListeAttenteEquipe
    data object NonConnecte : EtatListeAttenteEquipe
    data class Erreur(val message: String) : EtatListeAttenteEquipe
    data class Pret(val zones: List<ZoneAttenteEquipe>, val message: String? = null, val actionEnCours: Boolean = false) : EtatListeAttenteEquipe
}

/**
 * Liste d'attente (équipe) : les zones où des personnes attendent un restaurant, avec le nombre de personnes et le nombre déjà prévenues, et le
 * marquage d'une zone comme prévenue (écriture tracée). Aucun contact n'est affiché : l'export et la suppression des contacts restent sur le site.
 */
class ListeAttenteEquipeViewModel(private val session: SessionService, private val api: ListeAttenteEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatListeAttenteEquipe>(EtatListeAttenteEquipe.Chargement)
    val etat: StateFlow<EtatListeAttenteEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        // Un rafraîchissement ne doit pas effacer la confirmation de la dernière action : elle est toujours vraie.
        val message = (_etat.value as? EtatListeAttenteEquipe.Pret)?.message
        viewModelScope.launch { lire(message) }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatListeAttenteEquipe.NonConnecte
            return
        }
        try {
            _etat.value = EtatListeAttenteEquipe.Pret(api.zones(jeton), message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatListeAttenteEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatListeAttenteEquipe.Pret
            _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatListeAttenteEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    /** Marque les personnes d'une zone comme prévenues (un restaurant vient d'ouvrir) ; le serveur journalise l'action. */
    fun marquerPrevenue(niveau: String, id: String) {
        val courant = _etat.value as? EtatListeAttenteEquipe.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val erreur = if (jeton == null) "Connectez-vous avec votre compte." else try {
                api.marquerPrevenue(jeton, niveau, id)
            } catch (e: ErreurAcces) {
                e.message ?: "Accès refusé."
            } catch (e: ErreurReseau) {
                e.message
            }
            if (jeton == null) {
                _etat.value = EtatListeAttenteEquipe.NonConnecte
                return@launch
            }
            lire(erreur ?: "Zone marquée comme prévenue.")
        }
    }
}
