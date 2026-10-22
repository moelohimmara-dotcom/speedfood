package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ActiviteApi
import com.speedfood.app.data.ActiviteRestaurant
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.GainsLivreur
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** État d'un écran de bilan (Activité du restaurateur, Gains du livreur). Les données déjà affichées sont gardées si une actualisation échoue. */
sealed interface EtatBilan<out T> {
    data object Chargement : EtatBilan<Nothing>
    data object NonConnecte : EtatBilan<Nothing>
    data class Erreur(val message: String) : EtatBilan<Nothing>
    data class Pret<T>(val donnees: T, val message: String? = null) : EtatBilan<T>
}

private abstract class ChargeurBilan<T>(private val session: SessionService) {
    suspend fun lire(avant: EtatBilan<T>, appel: suspend (String) -> T?): EtatBilan<T> {
        val jeton = session.jetonValide() ?: return EtatBilan.NonConnecte
        return try {
            val donnees = appel(jeton) ?: return EtatBilan.Erreur("Ce compte n'a pas d'espace pour ces informations.")
            EtatBilan.Pret(donnees)
        } catch (e: ErreurAcces) {
            EtatBilan.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            if (avant is EtatBilan.Pret<T>) avant.copy(message = "Connexion perdue : les chiffres affichés datent de la dernière actualisation.") else EtatBilan.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }
}

class ActiviteRestaurantViewModel(session: SessionService, private val api: ActiviteApi) : ViewModel() {
    private val chargeur = object : ChargeurBilan<ActiviteRestaurant>(session) {}
    private val _etat = MutableStateFlow<EtatBilan<ActiviteRestaurant>>(EtatBilan.Chargement)
    val etat: StateFlow<EtatBilan<ActiviteRestaurant>> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { _etat.value = chargeur.lire(_etat.value) { api.restaurant(it) } }
    }
}

class GainsLivreurViewModel(session: SessionService, private val api: ActiviteApi) : ViewModel() {
    private val chargeur = object : ChargeurBilan<GainsLivreur>(session) {}
    private val _etat = MutableStateFlow<EtatBilan<GainsLivreur>>(EtatBilan.Chargement)
    val etat: StateFlow<EtatBilan<GainsLivreur>> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { _etat.value = chargeur.lire(_etat.value) { api.livreur(it) } }
    }
}
