package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AccesEquipe
import com.speedfood.app.data.AlerteCommande
import com.speedfood.app.data.CommandeEquipe
import com.speedfood.app.data.EquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.TableauEquipe
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Clock

sealed interface EtatEquipe {
    data object Chargement : EtatEquipe
    data object NonConnecte : EtatEquipe

    /** Compte sans rôle dans l'équipe, accès refusé (double authentification...), ou indisponible : message du serveur. */
    data class Refuse(val message: String) : EtatEquipe

    data class Pret(val acces: AccesEquipe, val tableau: TableauEquipe? = null) : EtatEquipe
}

/** Hub de l'espace équipe Speedfood : le menu du compte (mêmes sections que le site `/system`, déjà filtrées par permission côté serveur). */
class EquipeViewModel(private val session: SessionService, private val api: EquipeApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatEquipe>(EtatEquipe.Chargement)
    val etat: StateFlow<EtatEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        _etat.value = EtatEquipe.Chargement
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatEquipe.NonConnecte
                return@launch
            }
            _etat.value = try {
                val acces = api.moi(jeton)
                // Le tableau de bord est un confort : s'il ne charge pas, le menu s'affiche quand même.
                val tableau = try { api.tableau(jeton) } catch (_: ErreurReseau) { null }
                EtatEquipe.Pret(acces, tableau)
            } catch (e: ErreurAcces) {
                EtatEquipe.Refuse(e.message ?: "Cet espace est réservé à l'équipe Speedfood.")
            } catch (e: ErreurReseau) {
                EtatEquipe.Refuse(e.message ?: "Une erreur est survenue.")
            }
        }
    }
}

sealed interface EtatRepartition {
    data object Chargement : EtatRepartition
    data object NonConnecte : EtatRepartition
    data class Erreur(val message: String) : EtatRepartition

    /** [message] : retour de la dernière action ou alerte réseau ; [actionEnCours] : un envoi est en route. */
    data class Pret(val commandes: List<CommandeEquipe>, val message: String? = null, val actionEnCours: Boolean = false) : EtatRepartition
}

/**
 * Poste de répartition dans l'application : relit les commandes toutes les 10 secondes, fait sonner le téléphone à chaque NOUVELLE commande à confirmer (puis rappelle
 * toutes les 60 secondes tant qu'il en reste), et envoie les actions au serveur, qui revérifie tout (rôle, établissement tenu par l'équipe, proposition en cours).
 */
class RepartitionViewModel(
    private val session: SessionService,
    private val api: EquipeApi,
    private val alerte: AlerteCommande,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatRepartition>(EtatRepartition.Chargement)
    val etat: StateFlow<EtatRepartition> = _etat.asStateFlow()

    private var connues: Set<String>? = null
    private var dernierRappel = 0L

    init {
        alerte.garderEcranAllume(true)
        viewModelScope.launch {
            while (true) {
                rafraichir()
                delay(DELAI_MS)
            }
        }
    }

    override fun onCleared() {
        alerte.garderEcranAllume(false)
        super.onCleared()
    }

    fun actualiser() {
        viewModelScope.launch { rafraichir() }
    }

    private suspend fun rafraichir() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatRepartition.NonConnecte
            return
        }
        try {
            val commandes = api.repartition(jeton)
            val avant = _etat.value as? EtatRepartition.Pret
            _etat.value = EtatRepartition.Pret(commandes, avant?.message, avant?.actionEnCours ?: false)
            signalerNouvelles(commandes)
        } catch (e: ErreurAcces) {
            _etat.value = EtatRepartition.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatRepartition.Pret
            _etat.value = if (avant != null) avant.copy(message = "Connexion perdue : nouvelle tentative en cours.") else EtatRepartition.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    /** La première lecture ne sonne pas (les commandes déjà là ne sont pas nouvelles) ; ensuite une sonnerie par arrivée, puis un rappel périodique. */
    private fun signalerNouvelles(commandes: List<CommandeEquipe>) {
        val aConfirmer = commandes.filter { it.statut == "en_attente" }.map { it.id }.toSet()
        val maintenant = Clock.System.now().toEpochMilliseconds()
        val avant = connues
        connues = aConfirmer
        if (avant == null) {
            dernierRappel = maintenant
            return
        }
        if ((aConfirmer - avant).isNotEmpty() || (aConfirmer.isNotEmpty() && maintenant - dernierRappel >= RAPPEL_MS)) {
            alerte.sonner()
            dernierRappel = maintenant
        }
    }

    fun agir(commandeId: String, action: String) {
        val courant = _etat.value as? EtatRepartition.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte."
            } else {
                try {
                    api.agir(jeton, commandeId, action)
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            rafraichir()
            (_etat.value as? EtatRepartition.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    private companion object {
        const val DELAI_MS = 10_000L
        const val RAPPEL_MS = 60_000L
    }
}
