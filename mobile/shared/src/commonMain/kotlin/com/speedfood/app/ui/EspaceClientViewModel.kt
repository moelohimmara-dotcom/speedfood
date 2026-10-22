package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ClientApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EspaceClient
import com.speedfood.app.data.RetourClient
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatEspaceClient {
    data object Chargement : EtatEspaceClient
    data object NonConnecte : EtatEspaceClient
    data class Erreur(val message: String) : EtatEspaceClient

    /** [message] : retour de la dernière action (succès ou refus du serveur) ; [actionEnCours] : un envoi est en route. */
    data class Pret(val espace: EspaceClient, val message: String? = null, val actionEnCours: Boolean = false) : EtatEspaceClient
}

/** Profil, adresses, favoris et avis du compte : un seul chargement, puis chaque action est envoyée au serveur (qui revérifie tout) et l'espace est relu. */
class EspaceClientViewModel(private val session: SessionService, private val api: ClientApi) : ViewModel() {
    private val _etat = MutableStateFlow<EtatEspaceClient>(EtatEspaceClient.Chargement)
    val etat: StateFlow<EtatEspaceClient> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatEspaceClient.NonConnecte
            return
        }
        try {
            val espace = api.espace(jeton)
            val avant = _etat.value as? EtatEspaceClient.Pret
            _etat.value = EtatEspaceClient.Pret(espace, avant?.message, avant?.actionEnCours ?: false)
        } catch (e: ErreurAcces) {
            _etat.value = EtatEspaceClient.NonConnecte
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatEspaceClient.Pret
            _etat.value = if (avant != null) avant.copy(message = e.message) else EtatEspaceClient.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    private fun agir(envoi: suspend (String) -> RetourClient) {
        val courant = _etat.value as? EtatEspaceClient.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte."
            } else {
                try {
                    envoi(jeton).message
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            lire()
            (_etat.value as? EtatEspaceClient.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    fun enregistrerProfil(pseudo: String, avatar: String) = agir { api.profil(it, mapOf("pseudo" to pseudo.trim(), "avatar" to avatar)) }

    fun definirModePrefere(mode: String?) = agir { api.profil(it, mapOf("modePrefere" to mode)) }

    fun definirNotifications(actif: Boolean) = agir { api.profil(it, mapOf("notificationsCommande" to actif)) }

    fun ajouterAdresse(libelle: String, adresse: String) = agir { api.adresse(it, "ajouter", mapOf("libelle" to libelle.trim(), "adresse" to adresse.trim())) }

    fun supprimerAdresse(id: String) = agir { api.adresse(it, "supprimer", mapOf("adresseId" to id)) }

    fun adressePrincipale(id: String) = agir { api.adresse(it, "defaut", mapOf("adresseId" to id)) }

    fun retirerFavori(restaurantId: String) = agir { api.basculerFavori(it, restaurantId) }
}
