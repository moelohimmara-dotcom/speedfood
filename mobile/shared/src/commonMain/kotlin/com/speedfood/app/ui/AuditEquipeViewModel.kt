package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AuditEquipe
import com.speedfood.app.data.AuditEquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatAuditEquipe {
    data object Chargement : EtatAuditEquipe
    data object NonConnecte : EtatAuditEquipe
    data class Erreur(val message: String) : EtatAuditEquipe
    data class Pret(
        val donnees: AuditEquipe = AuditEquipe(),
        /** Type d'action filtré (`null` = toutes les actions). */
        val action: String? = null,
        /** Période filtrée (`null` = tout l'historique). */
        val periode: Int? = null,
        /** Panne de lecture à expliquer à la personne ; les données déjà affichées restent affichées. */
        val message: String? = null,
        val chargementEnCours: Boolean = false,
    ) : EtatAuditEquipe
}

/**
 * Le journal d'audit : les quatre indicateurs d'activité, les filtres (type d'action, période) et les entrées du journal.
 * L'application ne change rien : elle lit, elle filtre, et le serveur filtre avec elle. Le journal est en écriture seule par
 * le serveur, donc aucune action n'est proposée ici.
 */
class AuditEquipeViewModel(private val session: SessionService, private val api: AuditEquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatAuditEquipe>(EtatAuditEquipe.Chargement)
    val etat: StateFlow<EtatAuditEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge le journal avec les filtres en cours. */
    fun charger() {
        val courant = _etat.value as? EtatAuditEquipe.Pret
        val action = courant?.action
        val periode = courant?.periode
        // Un rafraîchissement ne doit pas effacer le message de panne : il reste visible tant que la personne ne change pas de filtre.
        val message = courant?.message
        viewModelScope.launch { lire(action, periode, message) }
    }

    /** Change le type d'action : le serveur filtre et renvoie le journal. */
    fun filtrerAction(code: String?) {
        val courant = _etat.value as? EtatAuditEquipe.Pret ?: return
        if (courant.action == code) return
        _etat.value = courant.copy(action = code, message = null, chargementEnCours = true)
        viewModelScope.launch { lire(code, courant.periode, null) }
    }

    /** Change la période : le serveur filtre et renvoie le journal. */
    fun filtrerPeriode(valeur: Int?) {
        val courant = _etat.value as? EtatAuditEquipe.Pret ?: return
        if (courant.periode == valeur) return
        _etat.value = courant.copy(periode = valeur, message = null, chargementEnCours = true)
        viewModelScope.launch { lire(courant.action, valeur, null) }
    }

    private suspend fun lire(action: String?, periode: Int?, message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatAuditEquipe.NonConnecte
            return
        }
        try {
            val donnees = api.audit(jeton, action, periode)
            _etat.value = EtatAuditEquipe.Pret(donnees, action, periode, message)
        } catch (e: ErreurAcces) {
            _etat.value = EtatAuditEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            // Les données déjà affichées restent affichées : la panne s'ajoute à l'écran, elle ne le remplace pas.
            val avant = _etat.value as? EtatAuditEquipe.Pret
            _etat.value = avant?.copy(message = e.message, chargementEnCours = false) ?: EtatAuditEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}
