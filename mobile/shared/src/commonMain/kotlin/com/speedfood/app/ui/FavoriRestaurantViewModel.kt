package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ClientApi
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Cœur « favori » de la fiche d'un restaurant. L'état vient du serveur (la liste des favoris du compte) ; null tant qu'il est inconnu ou sans compte connecté. Le serveur
 * revérifie tout (restaurant publié, 100 favoris au plus).
 */
class FavoriRestaurantViewModel(private val session: SessionService, private val api: ClientApi, private val restaurantId: String) : ViewModel() {
    private val _favori = MutableStateFlow<Boolean?>(null)
    val favori: StateFlow<Boolean?> = _favori.asStateFlow()
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()
    private var enCours = false

    init {
        viewModelScope.launch {
            val jeton = session.jetonValide() ?: return@launch
            try {
                _favori.value = api.espace(jeton).favoris.any { it.restaurantId == restaurantId }
            } catch (_: ErreurReseau) {
                // Meilleur effort : sans l'état, le cœur reste vide et un appui le recalcule côté serveur.
            }
        }
    }

    /** Ajoute ou retire le restaurant des favoris. Renvoie faux si personne n'est connecté (l'écran propose alors la connexion). */
    suspend fun basculer(): Boolean {
        if (enCours) return true
        val jeton = session.jetonValide() ?: return false
        enCours = true
        try {
            val retour = api.basculerFavori(jeton, restaurantId)
            if (retour.ok) _favori.value = retour.favori
            _message.value = retour.message
        } catch (e: ErreurReseau) {
            _message.value = e.message
        } finally {
            enCours = false
        }
        return true
    }

    fun messageLu() {
        _message.value = null
    }
}
