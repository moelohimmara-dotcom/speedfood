package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.SuiviCommande
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatSuivi {
    data object Chargement : EtatSuivi

    /** [alerte] : dernière relecture ratée (réseau) : on garde ce qu'on sait et on réessaie. [reponse] : message lié à la réponse à une proposition. */
    data class Pret(val suivi: SuiviCommande, val alerte: String? = null, val reponse: String? = null, val envoiReponse: Boolean = false) : EtatSuivi
    data object Introuvable : EtatSuivi
    data class Erreur(val message: String) : EtatSuivi
}

val STATUTS_FINAUX = setOf("terminee", "refusee", "annulee")

/** Libellé lisible d'un statut de commande (jamais le mot technique). */
fun libelleStatut(statut: String, etatDerive: String = statut): String = when {
    etatDerive == "attente_confirmation_client" -> "Le restaurant propose un changement"
    else -> when (statut) {
        "en_attente" -> "En attente du restaurant"
        "acceptee" -> "Acceptée, en préparation"
        "prete" -> "Prête"
        "terminee" -> "Terminée"
        "refusee" -> "Refusée par le restaurant"
        "annulee" -> "Annulée"
        else -> "Statut en cours de mise à jour"
    }
}

/** Relit le statut toutes les [DELAI_MS] millisecondes tant que l'écran est ouvert et que la commande n'est pas terminée. */
class SuiviViewModel(private val api: CommandeApi, private val jeton: String) : ViewModel() {
    private val _etat = MutableStateFlow<EtatSuivi>(EtatSuivi.Chargement)
    val etat: StateFlow<EtatSuivi> = _etat.asStateFlow()

    init {
        viewModelScope.launch {
            while (true) {
                relire()
                val e = _etat.value
                if (e is EtatSuivi.Pret && e.suivi.statut in STATUTS_FINAUX) break
                if (e is EtatSuivi.Introuvable) break
                delay(DELAI_MS)
            }
        }
    }

    private suspend fun relire() {
        try {
            val suivi = api.suivi(jeton)
            val avant = _etat.value as? EtatSuivi.Pret
            _etat.value = if (suivi == null) EtatSuivi.Introuvable else EtatSuivi.Pret(suivi, reponse = avant?.reponse)
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatSuivi.Pret
            _etat.value = if (avant != null) avant.copy(alerte = "Connexion perdue : nouvelle tentative en cours.") else EtatSuivi.Erreur(e.message ?: "Une erreur est survenue.")
        } catch (e: Exception) {
            _etat.value = EtatSuivi.Erreur("Une erreur est survenue. Réessayez dans un instant.")
        }
    }

    fun repondre(accepter: Boolean) {
        val courant = _etat.value as? EtatSuivi.Pret ?: return
        val proposition = courant.suivi.propositionActive ?: return
        _etat.value = courant.copy(envoiReponse = true, reponse = null)
        viewModelScope.launch {
            val erreur = try {
                api.repondreProposition(jeton, proposition.id, accepter)
            } catch (e: ErreurReseau) {
                e.message
            }
            relire()
            val apres = _etat.value as? EtatSuivi.Pret
            if (apres != null) {
                _etat.value = apres.copy(
                    envoiReponse = false,
                    reponse = erreur ?: if (accepter) "Vous avez accepté : le restaurant peut préparer votre commande." else "Vous avez refusé la proposition.",
                )
            }
        }
    }

    companion object {
        const val DELAI_MS = 15_000L
    }
}
