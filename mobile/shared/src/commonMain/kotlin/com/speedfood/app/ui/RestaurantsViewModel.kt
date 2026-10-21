package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.RestaurantApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatListe {
    data object Chargement : EtatListe
    data class Pret(val restaurants: List<Restaurant>) : EtatListe
    data class Erreur(val message: String) : EtatListe
}

class RestaurantsViewModel(private val api: RestaurantApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatListe>(EtatListe.Chargement)
    val etat: StateFlow<EtatListe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        _etat.value = EtatListe.Chargement
        viewModelScope.launch {
            _etat.value = try {
                EtatListe.Pret(api.lister())
            } catch (e: ErreurReseau) {
                EtatListe.Erreur(e.message ?: "Une erreur est survenue.")
            } catch (e: Exception) {
                EtatListe.Erreur("Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }
}
