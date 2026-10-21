package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.Menu
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.RestaurantFiche
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatFiche {
    data object Chargement : EtatFiche
    data class Pret(val fiche: RestaurantFiche, val menu: Menu) : EtatFiche
    data object Introuvable : EtatFiche
    data class Erreur(val message: String) : EtatFiche
}

class RestaurantViewModel(private val api: RestaurantApi, private val restaurantId: String) : ViewModel() {
    private val _etat = MutableStateFlow<EtatFiche>(EtatFiche.Chargement)
    val etat: StateFlow<EtatFiche> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        _etat.value = EtatFiche.Chargement
        viewModelScope.launch {
            _etat.value = try {
                coroutineScope {
                    val fiche = async { api.fiche(restaurantId) }
                    val menu = async { api.menu(restaurantId) }
                    val f = fiche.await()
                    if (f == null) EtatFiche.Introuvable else EtatFiche.Pret(f, menu.await())
                }
            } catch (e: ErreurReseau) {
                EtatFiche.Erreur(e.message ?: "Une erreur est survenue.")
            } catch (e: Exception) {
                EtatFiche.Erreur("Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }
}
