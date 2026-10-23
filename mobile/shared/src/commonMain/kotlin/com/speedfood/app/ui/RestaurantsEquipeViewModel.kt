package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.RestaurantEquipe
import com.speedfood.app.data.RestaurantsEquipeApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatRestaurantsEquipe {
    data object Chargement : EtatRestaurantsEquipe
    data object NonConnecte : EtatRestaurantsEquipe
    data class Erreur(val message: String) : EtatRestaurantsEquipe

    /** La liste est chargée ; `fiche` est ouverte quand on a choisi un établissement. */
    data class Pret(
        val restaurants: List<RestaurantEquipe>,
        val fiche: RestaurantEquipe? = null,
        val message: String? = null,
        val actionEnCours: Boolean = false,
    ) : EtatRestaurantsEquipe
}

/**
 * Établissements (équipe) : liste, fiche (identité, publication, horaires, consignes, numéro à joindre, menu) et modification SIMPLE des horaires
 * et du numéro à joindre. Le serveur revérifie la permission et journalise chaque écriture ; ici on ne fait que l'affichage.
 */
class RestaurantsEquipeViewModel(private val session: SessionService, private val api: RestaurantsEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatRestaurantsEquipe>(EtatRestaurantsEquipe.Chargement)
    val etat: StateFlow<EtatRestaurantsEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatRestaurantsEquipe.NonConnecte
            return
        }
        try {
            _etat.value = EtatRestaurantsEquipe.Pret(api.restaurants(jeton), message = message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatRestaurantsEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatRestaurantsEquipe.Pret
            _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatRestaurantsEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    /** Ouvre la fiche d'un établissement ; la liste reste en mémoire derrière. */
    fun ouvrirFiche(id: String) {
        val courant = _etat.value as? EtatRestaurantsEquipe.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatRestaurantsEquipe.NonConnecte
                return@launch
            }
            try {
                val fiche = api.fiche(jeton, id)
                _etat.value = (_etat.value as? EtatRestaurantsEquipe.Pret)?.copy(fiche = fiche, actionEnCours = false)
                    ?: EtatRestaurantsEquipe.Pret(emptyList(), fiche)
            } catch (e: ErreurAcces) {
                _etat.value = EtatRestaurantsEquipe.Erreur(e.message ?: "Accès refusé.")
            } catch (e: ErreurReseau) {
                val avant = _etat.value as? EtatRestaurantsEquipe.Pret
                _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatRestaurantsEquipe.Erreur(e.message ?: "Une erreur est survenue.")
            }
        }
    }

    /** Ferme la fiche et revient à la liste. */
    fun fermerFiche() {
        val courant = _etat.value as? EtatRestaurantsEquipe.Pret ?: return
        _etat.value = courant.copy(fiche = null, message = null)
    }

    /**
     * Enregistre les horaires et le numéro à joindre. Le serveur revalide (horaires obligatoires, numéro guinéen) ; après l'écriture on relit la
     * fiche pour afficher l'état réel, jamais une version supposée.
     */
    fun enregistrerProfil(horaires: String, telephone: String) {
        val courant = _etat.value as? EtatRestaurantsEquipe.Pret ?: return
        val id = courant.fiche?.id ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val erreur = if (jeton == null) "Connectez-vous avec votre compte." else try {
                api.enregistrerProfil(jeton, id, horaires, telephone)
            } catch (e: ErreurAcces) {
                e.message ?: "Accès refusé."
            } catch (e: ErreurReseau) {
                e.message
            }
            if (jeton == null) {
                _etat.value = EtatRestaurantsEquipe.NonConnecte
                return@launch
            }
            try {
                val fiche = api.fiche(jeton, id)
                val liste = try {
                    api.restaurants(jeton)
                } catch (e: Exception) {
                    courant.restaurants
                }
                _etat.value = EtatRestaurantsEquipe.Pret(liste, fiche, message = erreur ?: "Horaires et numéro à joindre enregistrés.", actionEnCours = false)
            } catch (e: ErreurReseau) {
                val avant = _etat.value as? EtatRestaurantsEquipe.Pret
                val texte = erreur ?: e.message ?: "Une erreur est survenue."
                _etat.value = avant?.copy(message = texte, actionEnCours = false) ?: EtatRestaurantsEquipe.Erreur(texte)
            }
        }
    }
}
