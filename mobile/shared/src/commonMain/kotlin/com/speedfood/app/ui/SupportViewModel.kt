package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.CommandeSupport
import com.speedfood.app.data.CoordonneesClient
import com.speedfood.app.data.DetailSupport
import com.speedfood.app.data.EquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatSupport {
    data object Chargement : EtatSupport
    data object NonConnecte : EtatSupport
    data class Erreur(val message: String) : EtatSupport

    data class Pret(val commandes: List<CommandeSupport>, val reference: String = "", val statut: String = "tous", val jour: Boolean = false, val enCours: Boolean = false) : EtatSupport
}

/** Recherche de commandes pour le support : référence, statut, « du jour ». Les coordonnées arrivent masquées par la base. */
class SupportViewModel(private val session: SessionService, private val api: EquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatSupport>(EtatSupport.Chargement)
    val etat: StateFlow<EtatSupport> = _etat.asStateFlow()

    private var reference = ""
    private var statut = "tous"
    private var jour = false

    init {
        rechercher()
    }

    fun definirReference(valeur: String) {
        reference = valeur
        (_etat.value as? EtatSupport.Pret)?.let { _etat.value = it.copy(reference = valeur) }
    }

    fun definirStatut(valeur: String) {
        statut = valeur
        rechercher()
    }

    fun basculerJour() {
        jour = !jour
        rechercher()
    }

    fun rechercher() {
        val avant = _etat.value as? EtatSupport.Pret
        if (avant != null) _etat.value = avant.copy(enCours = true, reference = reference, statut = statut, jour = jour)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatSupport.NonConnecte
                return@launch
            }
            _etat.value = try {
                EtatSupport.Pret(api.commandes(jeton, reference, statut, jour), reference, statut, jour)
            } catch (e: ErreurAcces) {
                EtatSupport.Erreur(e.message ?: "Accès refusé.")
            } catch (e: ErreurReseau) {
                EtatSupport.Erreur(e.message ?: "Une erreur est survenue.")
            }
        }
    }
}

sealed interface EtatDetailSupport {
    data object Chargement : EtatDetailSupport
    data object NonConnecte : EtatDetailSupport
    data class Erreur(val message: String) : EtatDetailSupport

    /** [coordonnees] : renseignées seulement après une révélation motivée, gardées en mémoire de l'écran (jamais sur le disque). */
    data class Pret(val detail: DetailSupport, val message: String? = null, val coordonnees: CoordonneesClient? = null, val actionEnCours: Boolean = false) : EtatDetailSupport
}

/** Détail d'une commande pour le support : historique, propositions, changement de statut motivé, révélation motivée des coordonnées. */
class DetailSupportViewModel(private val session: SessionService, private val api: EquipeApi, private val commandeId: String) : ViewModel() {
    private val _etat = MutableStateFlow<EtatDetailSupport>(EtatDetailSupport.Chargement)
    val etat: StateFlow<EtatDetailSupport> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatDetailSupport.NonConnecte
            return
        }
        try {
            val detail = api.commande(jeton, commandeId)
            val avant = _etat.value as? EtatDetailSupport.Pret
            _etat.value = EtatDetailSupport.Pret(detail, avant?.message, avant?.coordonnees, avant?.actionEnCours ?: false)
        } catch (e: ErreurAcces) {
            _etat.value = EtatDetailSupport.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatDetailSupport.Pret
            _etat.value = if (avant != null) avant.copy(message = e.message) else EtatDetailSupport.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    fun changerStatut(vers: String, motif: String) {
        val courant = _etat.value as? EtatDetailSupport.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte."
            } else {
                try {
                    api.changerStatut(jeton, commandeId, vers, motif.trim()) ?: "Transition appliquée et journalisée."
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            lire()
            (_etat.value as? EtatDetailSupport.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    fun reveler(motif: String) {
        val courant = _etat.value as? EtatDetailSupport.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            var coordonnees: CoordonneesClient? = null
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte."
            } else {
                try {
                    coordonnees = api.reveler(jeton, commandeId, motif.trim())
                    null
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            (_etat.value as? EtatDetailSupport.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message, coordonnees = coordonnees ?: it.coordonnees) }
        }
    }
}
