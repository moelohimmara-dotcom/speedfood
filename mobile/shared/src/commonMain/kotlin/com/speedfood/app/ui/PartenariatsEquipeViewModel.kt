package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.DemandePartenariatEquipe
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.PartenariatsEquipeApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StatutPartenariatEquipe
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatPartenariatsEquipe {
    data object Chargement : EtatPartenariatsEquipe
    data object NonConnecte : EtatPartenariatsEquipe
    data class Erreur(val message: String) : EtatPartenariatsEquipe
    data class Pret(val partenariats: List<DemandePartenariatEquipe>, val message: String? = null, val actionEnCours: Boolean = false) : EtatPartenariatsEquipe
}

/**
 * Demandes de partenariat (équipe) : lecture, contact de la personne et changement de statut ; le serveur revérifie la permission et journalise
 * chaque changement. La suppression d'une demande reste sur le site.
 */
class PartenariatsEquipeViewModel(private val session: SessionService, private val api: PartenariatsEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatPartenariatsEquipe>(EtatPartenariatsEquipe.Chargement)
    val etat: StateFlow<EtatPartenariatsEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        // Un rafraîchissement ne doit pas effacer la confirmation de la dernière action : elle est toujours vraie.
        val message = (_etat.value as? EtatPartenariatsEquipe.Pret)?.message
        viewModelScope.launch { lire(message) }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatPartenariatsEquipe.NonConnecte
            return
        }
        try {
            _etat.value = EtatPartenariatsEquipe.Pret(api.partenariats(jeton), message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatPartenariatsEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatPartenariatsEquipe.Pret
            _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatPartenariatsEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    fun changerStatut(id: String, statut: StatutPartenariatEquipe) {
        val courant = _etat.value as? EtatPartenariatsEquipe.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val erreur = if (jeton == null) "Connectez-vous avec votre compte." else try {
                api.changerStatut(jeton, id, statut)
            } catch (e: ErreurAcces) {
                e.message ?: "Accès refusé."
            } catch (e: ErreurReseau) {
                e.message
            }
            if (jeton == null) {
                _etat.value = EtatPartenariatsEquipe.NonConnecte
                return@launch
            }
            lire(erreur ?: "Statut enregistré : ${statut.libelle}.")
        }
    }
}
