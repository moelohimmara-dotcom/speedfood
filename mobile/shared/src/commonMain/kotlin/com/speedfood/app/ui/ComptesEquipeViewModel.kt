package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.CompteEquipe
import com.speedfood.app.data.ComptesEquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.TypeCompteEquipe
import com.speedfood.app.data.typeCompteEquipeValide
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatComptesEquipe {
    data object Chargement : EtatComptesEquipe
    data object NonConnecte : EtatComptesEquipe
    data class Erreur(val message: String) : EtatComptesEquipe
    data class Pret(
        val comptes: List<CompteEquipe>,
        val tronque: Boolean,
        val filtre: TypeCompteEquipe = TypeCompteEquipe.Tous,
        val recherche: String = "",
        val message: String? = null,
        val chargementEnCours: Boolean = false,
    ) : EtatComptesEquipe
}

/**
 * Annuaire des comptes (équipe) : lecture seule. On regarde qui existe, on filtre, on cherche un compte par e-mail ; les écritures
 * irréversibles (suppression, suppression groupée, réinitialisation des questions de sécurité) et l'attribution des rôles restent sur le site.
 */
class ComptesEquipeViewModel(private val session: SessionService, private val api: ComptesEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatComptesEquipe>(EtatComptesEquipe.Chargement)
    val etat: StateFlow<EtatComptesEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge l'annuaire avec le filtre et la recherche en cours. */
    fun charger() {
        val courant = _etat.value as? EtatComptesEquipe.Pret
        val filtre = courant?.filtre ?: TypeCompteEquipe.Tous
        val recherche = courant?.recherche ?: ""
        // Un rafraîchissement ne doit pas effacer la confirmation de la dernière action : elle est toujours vraie.
        val message = courant?.message
        viewModelScope.launch { lire(filtre, recherche, message) }
    }

    /** Change le filtre (Tous, Restaurateurs, Rôles système, Sans affiliation, Comptes de test) : le serveur filtre et renvoie la liste. */
    fun filtrer(type: TypeCompteEquipe) {
        val courant = _etat.value as? EtatComptesEquipe.Pret ?: return
        if (courant.filtre == type) return
        _etat.value = courant.copy(filtre = type, message = null, chargementEnCours = true)
        viewModelScope.launch { lire(type, courant.recherche, null) }
    }

    /** Recherche un compte par e-mail : le serveur filtre et renvoie la liste. */
    fun rechercher(recherche: String) {
        val courant = _etat.value as? EtatComptesEquipe.Pret ?: return
        _etat.value = courant.copy(recherche = recherche, message = null, chargementEnCours = true)
        viewModelScope.launch { lire(courant.filtre, recherche, null) }
    }

    private suspend fun lire(filtre: TypeCompteEquipe, recherche: String, message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatComptesEquipe.NonConnecte
            return
        }
        try {
            val resultat = api.comptes(jeton, recherche, typeCompteEquipeValide(filtre.code))
            _etat.value = EtatComptesEquipe.Pret(resultat.comptes, resultat.tronque, filtre, recherche, message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatComptesEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatComptesEquipe.Pret
            _etat.value = avant?.copy(message = e.message, chargementEnCours = false) ?: EtatComptesEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}
