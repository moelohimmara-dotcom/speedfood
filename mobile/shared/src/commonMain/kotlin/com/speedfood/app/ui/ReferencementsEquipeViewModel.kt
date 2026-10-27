package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.DemandeReferencement
import com.speedfood.app.data.OptionsCreation
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
    data class Pret(
        val demandes: List<DemandeReferencement>,
        val message: String? = null,
        val actionEnCours: Boolean = false,
        /** Listes officielles pour créer un établissement, chargées à la première ouverture de la fenêtre de création. */
        val options: OptionsCreation? = null,
    ) : EtatReferencements
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
            val options = (_etat.value as? EtatReferencements.Pret)?.options
            _etat.value = EtatReferencements.Pret(api.demandes(jeton), message, options = options)
        } catch (e: ErreurAcces) {
            _etat.value = EtatReferencements.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatReferencements.Pret
            _etat.value = avant?.copy(message = e.message, actionEnCours = false) ?: EtatReferencements.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    /** Exécute une action serveur puis relit la liste : le message affiché est celui du serveur en cas d'échec, [succes] sinon. Jamais deux actions à la fois. */
    private fun agir(succes: String, action: suspend (jeton: String) -> String?) {
        val courant = _etat.value as? EtatReferencements.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val erreur = if (jeton == null) "Connectez-vous avec votre compte." else try {
                action(jeton)
            } catch (e: ErreurReseau) {
                e.message
            } catch (e: ErreurAcces) {
                e.message
            }
            lire(erreur ?: succes)
        }
    }

    fun changerStatut(id: String, statut: StatutDemande, motif: String? = null) =
        agir("Statut enregistré : ${statut.libelle}.") { api.changerStatut(it, id, statut, motif) }

    fun creerEtablissement(id: String, categorieId: String, quartierId: String) =
        agir("Établissement créé (non publié). Complétez sa fiche sur le site avant de le publier.") { api.creerEtablissement(it, id, categorieId, quartierId) }

    fun rattacherCompte(id: String) = agir("Compte rattaché : le candidat voit maintenant son espace restaurateur.") { api.rattacherCompte(it, id) }

    /** Charge les listes officielles une fois (catégories, quartiers) au moment d'ouvrir la fenêtre de création. */
    fun chargerOptions() {
        val courant = _etat.value as? EtatReferencements.Pret ?: return
        if (courant.options != null) return
        viewModelScope.launch {
            val jeton = session.jetonValide() ?: return@launch
            try {
                val options = api.options(jeton)
                (_etat.value as? EtatReferencements.Pret)?.let { _etat.value = it.copy(options = options) }
            } catch (e: ErreurReseau) {
                (_etat.value as? EtatReferencements.Pret)?.let { _etat.value = it.copy(message = e.message) }
            } catch (e: ErreurAcces) {
                (_etat.value as? EtatReferencements.Pret)?.let { _etat.value = it.copy(message = e.message) }
            }
        }
    }
}
