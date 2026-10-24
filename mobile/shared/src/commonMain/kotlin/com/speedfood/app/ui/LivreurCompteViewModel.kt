package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.DossierLivreur
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.LivreurApi
import com.speedfood.app.data.PosteFixe
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Onglet « Compte » du livreur : son état en ligne ou hors ligne, ses réglages (mode poste fixe) et l'état de son dossier d'activation.
 *
 * L'état affiché vient du serveur (le livreur voit la vérité, pas son bouton), et une panne garde la dernière état connu à l'écran.
 */
sealed interface EtatCompteLivreur {
    data object Chargement : EtatCompteLivreur
    data object NonConnecte : EtatCompteLivreur

    /** Le compte connecté n'est pas un compte livreur. */
    data object PasLivreur : EtatCompteLivreur

    data class Erreur(val message: String) : EtatCompteLivreur

    data class Pret(
        val etat: EtatLivreur,
        /** L'état des pièces du dossier : à jour ou manquante. Jamais le document, jamais le dossier. */
        val dossier: DossierLivreur? = null,
        /** Le mode poste fixe est-il actif ? */
        val posteFixe: Boolean = false,
        val actionEnCours: Boolean = false,
        val message: String? = null,
    ) : EtatCompteLivreur
}

class LivreurCompteViewModel(
    private val session: SessionService,
    private val api: LivreurApi,
    private val posteFixe: PosteFixe,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatCompteLivreur>(EtatCompteLivreur.Chargement)
    val etat: StateFlow<EtatCompteLivreur> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge l'état du livreur et l'état de son dossier. */
    fun charger() {
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatCompteLivreur.NonConnecte
                return@launch
            }
            val avant = _etat.value as? EtatCompteLivreur.Pret
            try {
                val etat = api.etat(jeton)
                if (etat == null) {
                    _etat.value = EtatCompteLivreur.PasLivreur
                    return@launch
                }
                val dossier = try {
                    api.dossier(jeton)
                } catch (_: ErreurReseau) {
                    avant?.dossier
                }
                _etat.value = EtatCompteLivreur.Pret(
                    etat = etat,
                    dossier = dossier,
                    posteFixe = posteFixe.actif.value,
                )
            } catch (e: ErreurAcces) {
                _etat.value = EtatCompteLivreur.Erreur(e.message ?: "Accès refusé.")
            } catch (e: ErreurReseau) {
                _etat.value = avant?.copy(message = e.message ?: "Connexion perdue : le statut affiché date de la dernière actualisation.")
                    ?: EtatCompteLivreur.Erreur(e.message ?: "Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
            }
        }
    }

    /** Relit le statut (l'écran le fait régulièrement, tant qu'il est visible). */
    fun rafraichirStatut() {
        viewModelScope.launch {
            val jeton = session.jetonValide() ?: return@launch
            val avant = _etat.value as? EtatCompteLivreur.Pret ?: return@launch
            try {
                val etat = api.etat(jeton) ?: return@launch
                _etat.value = avant.copy(etat = etat)
            } catch (_: ErreurReseau) {
                // Le statut affiché reste affiché : une panne de réseau ne vide pas l'écran.
            }
        }
    }

    /** Met le livreur en ligne ou hors ligne ; le serveur tranche, son refus est affiché. */
    fun basculer(enLigne: Boolean) {
        val courant = _etat.value as? EtatCompteLivreur.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte livreur."
            } else {
                try {
                    api.enLigne(jeton, enLigne)
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            charger()
            (_etat.value as? EtatCompteLivreur.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    /** Le livreur active ou coupe le mode poste fixe : l'écran reste allumé pendant la livraison. */
    fun definirPosteFixe(actif: Boolean) {
        posteFixe.definir(actif)
        (_etat.value as? EtatCompteLivreur.Pret)?.let { _etat.value = it.copy(posteFixe = actif) }
    }
}
