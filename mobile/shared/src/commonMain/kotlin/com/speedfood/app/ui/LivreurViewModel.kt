package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.FournisseurPosition
import com.speedfood.app.data.LivreurApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Clock

sealed interface EtatEspaceLivreur {
    data object Chargement : EtatEspaceLivreur
    data object NonConnecte : EtatEspaceLivreur

    /** Le compte connecté n'est pas un compte livreur (les comptes livreurs sont créés par l'équipe Speedfood). */
    data object PasLivreur : EtatEspaceLivreur

    /** [message] : retour de la dernière action (refus du serveur, par exemple « commande pas encore prête ») ou alerte réseau ; [actionEnCours] : un envoi est en route. */
    data class Pret(
        val etat: EtatLivreur,
        val message: String? = null,
        val actionEnCours: Boolean = false,
        val positionAutorisee: Boolean = false,
        val positionDisponible: Boolean = false,
    ) : EtatEspaceLivreur

    data class Erreur(val message: String) : EtatEspaceLivreur
}

/** Le livreur doit être suivi (position envoyée, écran allumé) tant qu'il est en ligne ou en course. */
fun doitSuivreLaPosition(etat: EtatLivreur): Boolean = etat.livreur.cycle == "actif" && etat.livreur.statut != "hors_ligne"

/**
 * Espace livreur : relit l'état toutes les 5 secondes (2,5 s tant qu'une offre attend une réponse), envoie la position toutes les 8 secondes tant que le livreur
 * est en ligne ou en course, et laisse le serveur décider de tout (machine à états, code de remise, commande prête).
 */
class LivreurViewModel(
    private val session: SessionService,
    private val api: LivreurApi,
    private val position: FournisseurPosition,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatEspaceLivreur>(EtatEspaceLivreur.Chargement)
    val etat: StateFlow<EtatEspaceLivreur> = _etat.asStateFlow()

    private var derniere: Pair<Double, Double>? = null
    private var dernierEnvoi = 0L
    private var suivi = false

    init {
        viewModelScope.launch {
            while (true) {
                rafraichir()
                val courant = _etat.value
                delay(if (courant is EtatEspaceLivreur.Pret && courant.etat.offre != null) DELAI_OFFRE_MS else DELAI_MS)
            }
        }
    }

    private suspend fun rafraichir() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            arreterSuivi()
            _etat.value = EtatEspaceLivreur.NonConnecte
            return
        }
        try {
            val etat = api.etat(jeton)
            if (etat == null) {
                arreterSuivi()
                _etat.value = EtatEspaceLivreur.PasLivreur
                return
            }
            val avant = _etat.value as? EtatEspaceLivreur.Pret
            _etat.value = EtatEspaceLivreur.Pret(
                etat = etat,
                message = avant?.message,
                actionEnCours = avant?.actionEnCours ?: false,
                positionAutorisee = position.autorisee(),
                positionDisponible = position.disponible,
            )
            ajusterSuivi(etat)
            envoyerPositionSiBesoin(jeton, etat)
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatEspaceLivreur.Pret
            _etat.value = if (avant != null) avant.copy(message = "Connexion perdue : nouvelle tentative en cours.") else EtatEspaceLivreur.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    private fun ajusterSuivi(etat: EtatLivreur) {
        if (doitSuivreLaPosition(etat) && position.disponible && position.autorisee()) {
            if (!suivi) {
                suivi = true
                position.garderEcranAllume(true)
                position.demarrer { lat, lon -> derniere = lat to lon }
            }
        } else {
            arreterSuivi()
        }
    }

    private fun arreterSuivi() {
        if (suivi) {
            suivi = false
            position.arreter()
            position.garderEcranAllume(false)
        }
    }

    private suspend fun envoyerPositionSiBesoin(jeton: String, etat: EtatLivreur) {
        val p = derniere ?: return
        val maintenant = Clock.System.now().toEpochMilliseconds()
        if (!suivi || !doitSuivreLaPosition(etat) || maintenant - dernierEnvoi < INTERVALLE_POSITION_MS) return
        dernierEnvoi = maintenant
        try {
            api.position(jeton, p.first, p.second)
        } catch (_: ErreurReseau) {
            // Un envoi manqué n'est pas grave : le suivant arrive dans quelques secondes.
        }
    }

    fun demanderPosition() {
        position.demanderAutorisation()
    }

    /** Lance une action, affiche le refus éventuel du serveur, puis relit l'état pour montrer ce qui a vraiment changé. */
    private fun agir(action: suspend (String) -> String?) {
        val courant = _etat.value as? EtatEspaceLivreur.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte livreur."
            } else {
                try {
                    action(jeton)
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            rafraichir()
            (_etat.value as? EtatEspaceLivreur.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    fun basculer(enLigne: Boolean) = agir { api.enLigne(it, enLigne) }

    fun repondreOffre(offreId: String, accepter: Boolean) = agir { api.repondreOffre(it, offreId, accepter) }

    fun avancer(vers: String, code: String? = null, raison: String? = null) = agir { api.avancer(it, vers, code, raison) }

    override fun onCleared() {
        arreterSuivi()
        super.onCleared()
    }

    companion object {
        const val DELAI_MS = 5_000L
        const val DELAI_OFFRE_MS = 2_500L
        const val INTERVALLE_POSITION_MS = 8_000L
    }
}
