package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.MenuGere
import com.speedfood.app.data.RestaurateurApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatMenuGere {
    data object Chargement : EtatMenuGere
    data object NonConnecte : EtatMenuGere
    data class Erreur(val message: String) : EtatMenuGere

    /** [message] : retour de la dernière modification (refus du serveur) ; [actionEnCours] : un envoi est en route. */
    data class Pret(val menu: MenuGere, val message: String? = null, val actionEnCours: Boolean = false) : EtatMenuGere
}

/**
 * Menu du restaurateur : disponibilité des plats (remettre en vente, retirer, reconfirmer), prix, plats et suppléments. Chaque modification part au serveur,
 * qui revérifie tout ; le menu est relu juste après pour montrer ce qui a vraiment été enregistré. Les photos se gèrent sur le site.
 */
class MenuRestaurateurViewModel(private val session: SessionService, private val api: RestaurateurApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatMenuGere>(EtatMenuGere.Chargement)
    val etat: StateFlow<EtatMenuGere> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatMenuGere.NonConnecte
            return
        }
        try {
            val menu = api.menu(jeton)
            val avant = _etat.value as? EtatMenuGere.Pret
            _etat.value = EtatMenuGere.Pret(menu, avant?.message, avant?.actionEnCours ?: false)
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatMenuGere.Pret
            _etat.value = if (avant != null) avant.copy(message = e.message) else EtatMenuGere.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    private fun agir(action: String, champs: Map<String, Any?>) {
        val courant = _etat.value as? EtatMenuGere.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte restaurateur."
            } else {
                try {
                    api.modifierMenu(jeton, action, champs)
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            lire()
            (_etat.value as? EtatMenuGere.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    fun definirDisponibilite(platId: String, disponible: Boolean) = agir("disponibilite", mapOf("platId" to platId, "disponible" to disponible))

    fun confirmer(platId: String) = agir("confirmer", mapOf("platId" to platId))

    fun toutConfirmer() = agir("confirmer_tout", emptyMap())

    fun archiver(platId: String) = agir("archiver", mapOf("platId" to platId))

    fun creer(nom: String, description: String, prix: Int, prixPromo: Int?, sectionId: String?) =
        agir("creer", mapOf("nom" to nom.trim(), "description" to description.trim(), "prix" to prix, "prixPromo" to prixPromo, "sectionId" to sectionId))

    fun modifier(platId: String, nom: String, description: String, prix: Int, prixPromo: Int?, sectionId: String?) =
        agir("modifier", mapOf("platId" to platId, "nom" to nom.trim(), "description" to description.trim(), "prix" to prix, "prixPromo" to prixPromo, "sectionId" to sectionId))

    fun ajouterOption(platId: String, nom: String, prix: Int) = agir("option_ajouter", mapOf("platId" to platId, "nom" to nom.trim(), "prix" to prix))

    fun retirerOption(optionId: String) = agir("option_retirer", mapOf("optionId" to optionId))
}
