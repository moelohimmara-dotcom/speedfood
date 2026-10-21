package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AlerteCommande
import com.speedfood.app.data.CommandeRestaurateur
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EtatRestaurateur
import com.speedfood.app.data.RestaurateurApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.classerCommandes
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Clock

/** Clé du stockage local : « oui » ou « non » à l'alerte application fermée. Absente tant que la question n'a pas été posée. */
const val CLE_ALERTE_ARRIERE_PLAN = "restaurateur_alerte_arriere_plan"

sealed interface EtatConsole {
    data object Chargement : EtatConsole
    data object NonConnecte : EtatConsole

    /** Accès refusé ou indisponible, avec le message du serveur (compte non restaurateur, double authentification à utiliser sur le site...). */
    data class Erreur(val message: String) : EtatConsole

    /** [message] : retour de la dernière action (refus du serveur) ou alerte réseau ; [actionEnCours] : un envoi est en route. */
    data class Pret(
        val etat: EtatRestaurateur,
        val message: String? = null,
        val actionEnCours: Boolean = false,
        /** Choix du restaurateur d'être alerté application fermée (null = pas encore demandé) ; [arrierePlanPossible] : la plateforme le permet. */
        val alerteArrierePlan: Boolean? = null,
        val arrierePlanPossible: Boolean = false,
    ) : EtatConsole
}

/** Montants d'une proposition : entiers en GNF, jamais négatifs. Renvoie un message, ou null si tout est correct (le serveur revérifie). */
fun verifierProposition(sousTotal: String, frais: String, conditions: String, sousTotalActuel: Int, fraisActuels: Int): String? {
    val s = sousTotal.trim().toIntOrNull()
    val f = frais.trim().toIntOrNull()
    return when {
        s == null || s < 0 -> "Indiquez le nouveau total des plats en GNF (nombre entier)."
        f == null || f < 0 -> "Indiquez les frais de livraison en GNF (0 si aucun)."
        conditions.trim().length > 500 -> "Les conditions ne peuvent pas dépasser 500 caractères."
        s == sousTotalActuel && f == fraisActuels && conditions.isBlank() -> "Rien à proposer : changez le montant, les frais ou ajoutez une condition."
        else -> null
    }
}

/**
 * Console du restaurateur : relit les commandes toutes les 5 secondes, fait sonner le téléphone à chaque NOUVELLE commande à traiter (puis rappelle toutes
 * les 30 secondes tant qu'il en reste), et envoie les actions au serveur, qui décide de tout (machine à états, proposition en cours, droits du membre).
 */
class RestaurateurViewModel(
    private val session: SessionService,
    private val api: RestaurateurApi,
    private val alerte: AlerteCommande,
    private val stockage: StockageLocal,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatConsole>(EtatConsole.Chargement)
    val etat: StateFlow<EtatConsole> = _etat.asStateFlow()

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

    private suspend fun rafraichir() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatConsole.NonConnecte
            return
        }
        try {
            val etat = api.etat(jeton)
            val avant = _etat.value as? EtatConsole.Pret
            val choix = choixArrierePlan()
            _etat.value = EtatConsole.Pret(etat, avant?.message, avant?.actionEnCours ?: false, choix, alerte.arrierePlanPossible)
            if (alerte.arrierePlanPossible && choix == true) alerte.demarrerArrierePlan()
            signalerNouvelles(etat.commandes)
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatConsole.Pret
            _etat.value = if (avant != null) avant.copy(message = "Connexion perdue : nouvelle tentative en cours.") else EtatConsole.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    /** La première lecture ne sonne pas (les commandes déjà là ne sont pas nouvelles) ; ensuite, une sonnerie par commande arrivée, puis un rappel périodique. */
    private fun signalerNouvelles(commandes: List<CommandeRestaurateur>) {
        val aTraiter = classerCommandes(commandes).aTraiter.map { it.id }.toSet()
        val maintenant = Clock.System.now().toEpochMilliseconds()
        val avant = connues
        connues = aTraiter
        if (avant == null) {
            dernierRappel = maintenant
            return
        }
        // Le service d'arrière-plan, quand il tourne, alerte déjà (notification sonore) : l'application n'ajoute pas une seconde sonnerie.
        if (alerte.arrierePlanActif) return
        if ((aTraiter - avant).isNotEmpty()) {
            alerte.sonner()
            dernierRappel = maintenant
        } else if (aTraiter.isNotEmpty() && maintenant - dernierRappel >= RAPPEL_MS) {
            alerte.sonner()
            dernierRappel = maintenant
        }
    }

    private fun agir(action: suspend (String) -> String?) {
        val courant = _etat.value as? EtatConsole.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte restaurateur."
            } else {
                try {
                    action(jeton)
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            rafraichir()
            (_etat.value as? EtatConsole.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    private fun choixArrierePlan(): Boolean? = when (stockage.lire(CLE_ALERTE_ARRIERE_PLAN)) {
        "oui" -> true
        "non" -> false
        else -> null
    }

    /** Enregistre le choix du restaurateur (alerte application fermée : oui ou non) ; « non » arrête aussitôt le service. */
    fun choisirAlerteArrierePlan(oui: Boolean) {
        stockage.ecrire(CLE_ALERTE_ARRIERE_PLAN, if (oui) "oui" else "non")
        (_etat.value as? EtatConsole.Pret)?.let { _etat.value = it.copy(alerteArrierePlan = oui) }
        if (oui) alerte.demarrerArrierePlan() else alerte.arreterArrierePlan()
    }

    fun traiter(commandeId: String, action: String) = agir { api.agir(it, commandeId, action) }

    fun proposer(commandeId: String, sousTotal: Int, frais: Int, conditions: String) = agir { api.proposer(it, commandeId, sousTotal, frais, conditions) }

    fun definirStatut(champ: String, valeur: Boolean) = agir { api.definirStatut(it, champ, valeur) }

    fun confirmerPaiement(commandeId: String, decision: String) = agir { api.confirmerPaiement(it, commandeId, decision) }

    fun emettreDocument(commandeId: String, type: String) = agir { api.emettreDocument(it, commandeId, type) }

    override fun onCleared() {
        alerte.garderEcranAllume(false)
        super.onCleared()
    }

    companion object {
        const val DELAI_MS = 5_000L
        const val RAPPEL_MS = 30_000L
    }
}
