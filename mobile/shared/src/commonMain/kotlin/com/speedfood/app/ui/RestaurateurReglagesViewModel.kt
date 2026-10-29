package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.HorairesSemaine
import com.speedfood.app.data.JourHoraire
import com.speedfood.app.data.PreferencesRestaurateur
import com.speedfood.app.data.ReglagesRestaurateur
import com.speedfood.app.data.ReglagesRestaurateurApi
import com.speedfood.app.data.verifierDelaiPreparation
import com.speedfood.app.data.RestaurateurApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.formaterHoraires
import com.speedfood.app.data.parseHoraires
import com.speedfood.app.data.verifierHoraires
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatReglages {
    data object Chargement : EtatReglages
    data object NonConnecte : EtatReglages
    data class Erreur(val message: String) : EtatReglages

    /**
     * [horaires] : la semaine affichée, que le restaurateur modifie. [horairesLibres] : le texte du serveur n'est pas dans le format de
     * l'application (écrit sur le site) — il est alors affiché tel quel, jamais réécrit sans demande.
     */
    data class Pret(
        val reglages: ReglagesRestaurateur = ReglagesRestaurateur(),
        val horaires: HorairesSemaine = HorairesSemaine(),
        val horairesLibres: Boolean = false,
        val sonActif: Boolean = true,
        val posteFixe: Boolean = true,
        val message: String? = null,
        val enregistrementEnCours: Boolean = false,
        val actionEnCours: Boolean = false,
        /** Le délai de préparation tel que saisi (texte : vide = aucune estimation), enregistré à la demande. */
        val delaiSaisi: String = "",
        val delaiEnCours: Boolean = false,
    ) : EtatReglages
}

/**
 * Les réglages du poste de travail : les horaires d'ouverture que le restaurateur déclare, les plats à reconfirmer (règle du serveur) et les
 * deux préférences du téléphone (son des nouvelles commandes, mode « poste fixe »).
 *
 * Les horaires sont la seule chose que l'application écrit ici. La publication du menu et de ses prix engage le client : elle reste sur le site.
 */
class RestaurateurReglagesViewModel(
    private val session: SessionService,
    private val api: ReglagesRestaurateurApi,
    private val apiMenu: RestaurateurApi,
    private val stockage: StockageLocal,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatReglages>(EtatReglages.Chargement)
    val etat: StateFlow<EtatReglages> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge les réglages du serveur ; une panne laisse les horaires déjà affichés en place. */
    fun charger() {
        val message = (_etat.value as? EtatReglages.Pret)?.message
        viewModelScope.launch { lire(message) }
    }

    private suspend fun lire(message: String? = null) {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatReglages.NonConnecte
            return
        }
        try {
            val reglages = api.charger(jeton)
            val semaine = parseHoraires(reglages.horaires)
            _etat.value = EtatReglages.Pret(
                reglages = reglages,
                horaires = semaine ?: HorairesSemaine(),
                horairesLibres = semaine == null && reglages.horaires.isNotBlank(),
                sonActif = PreferencesRestaurateur.sonActif(stockage),
                posteFixe = PreferencesRestaurateur.posteFixe(stockage),
                message = message,
                delaiSaisi = reglages.delaiPreparationMinutes?.toString() ?: "",
            )
        } catch (e: ErreurAcces) {
            _etat.value = EtatReglages.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            // Les horaires déjà affichés restent affichés : la panne s'ajoute à l'écran, elle ne le remplace pas.
            val avant = _etat.value as? EtatReglages.Pret
            _etat.value = avant?.copy(message = e.message, enregistrementEnCours = false, actionEnCours = false)
                ?: EtatReglages.Erreur(e.message ?: "Impossible de joindre Speedfood.")
        }
    }

    /** Ouvre ou ferme un jour de la semaine ; les horaires ne sont enregistrés qu'à la demande du restaurateur. */
    fun modifierJour(index: Int, changement: (JourHoraire) -> JourHoraire) {
        val courant = _etat.value as? EtatReglages.Pret ?: return
        val jours = courant.horaires.jours.map { if (it.index == index) changement(it) else it }
        _etat.value = courant.copy(horaires = courant.horaires.copy(jours = jours), message = null)
    }

    /** Enregistre les horaires déclarés ; le serveur refuse un texte trop long ou illisible. */
    fun enregistrerHoraires() {
        val courant = _etat.value as? EtatReglages.Pret ?: return
        if (courant.enregistrementEnCours) return
        val probleme = verifierHoraires(courant.horaires)
        if (probleme != null) {
            _etat.value = courant.copy(message = probleme)
            return
        }
        _etat.value = courant.copy(enregistrementEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatReglages.NonConnecte
                return@launch
            }
            val texte = formaterHoraires(courant.horaires)
            val message = try {
                api.enregistrerHoraires(jeton, texte) ?: "Horaires enregistrés."
            } catch (e: ErreurAcces) {
                e.message ?: "Accès refusé."
            } catch (e: ErreurReseau) {
                e.message ?: "Impossible de joindre Speedfood."
            }
            val avant = _etat.value as? EtatReglages.Pret
            _etat.value = avant?.copy(enregistrementEnCours = false, message = message) ?: EtatReglages.Erreur(message)
        }
    }

    /** Met à jour le délai saisi (chiffres seulement, 3 au plus) ; rien n'est enregistré avant la demande du restaurateur. */
    fun modifierDelai(texte: String) {
        val courant = _etat.value as? EtatReglages.Pret ?: return
        _etat.value = courant.copy(delaiSaisi = texte.filter { it in '0'..'9' }.take(3), message = null)
    }

    /** Enregistre le délai habituel de préparation (vide = ne rien annoncer au client) ; le serveur refuse tout ce qui n'est pas de 5 à 240 minutes. */
    fun enregistrerDelai() {
        val courant = _etat.value as? EtatReglages.Pret ?: return
        if (courant.delaiEnCours) return
        val probleme = verifierDelaiPreparation(courant.delaiSaisi)
        if (probleme != null) {
            _etat.value = courant.copy(message = probleme)
            return
        }
        _etat.value = courant.copy(delaiEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatReglages.NonConnecte
                return@launch
            }
            val message = try {
                api.enregistrerDelai(jeton, courant.delaiSaisi) ?: if (courant.delaiSaisi.isBlank()) "Aucune estimation ne sera annoncée à vos clients." else "Délai enregistré : vos clients verront « prête vers » l'heure d'acceptation + ${courant.delaiSaisi.trim()} min."
            } catch (e: ErreurAcces) {
                e.message ?: "Accès refusé."
            } catch (e: ErreurReseau) {
                e.message ?: "Impossible de joindre Speedfood."
            }
            val avant = _etat.value as? EtatReglages.Pret
            _etat.value = avant?.copy(delaiEnCours = false, message = message) ?: EtatReglages.Erreur(message)
        }
    }

    /** Active ou coupe la sonnerie des nouvelles commandes (préférence de ce téléphone, pas du serveur). */
    fun basculerSon(actif: Boolean) {
        PreferencesRestaurateur.ecrireSon(stockage, actif)
        (_etat.value as? EtatReglages.Pret)?.let { _etat.value = it.copy(sonActif = actif, message = if (actif) "Son des nouvelles commandes : activé." else "Son des nouvelles commandes : coupé.") }
    }

    /** Active ou coupe le mode « poste fixe » (écran allumé, alerte continue). */
    fun basculerPosteFixe(actif: Boolean) {
        PreferencesRestaurateur.ecrirePosteFixe(stockage, actif)
        (_etat.value as? EtatReglages.Pret)?.let { _etat.value = it.copy(posteFixe = actif, message = if (actif) "Poste fixe : activé." else "Poste fixe : coupé.") }
    }

    /** Reconfirme un plat : c'est le serveur qui applique sa règle de fraîcheur et qui remet l'heure de confirmation. */
    fun confirmerPlat(platId: String) = agirMenu("confirmer", mapOf("platId" to platId), "Plat reconfirmé.")

    /** Reconfirme tous les plats à reconfirmer d'un coup. */
    fun toutConfirmer() = agirMenu("confirmer_tout", emptyMap(), "Tous les plats sont reconfirmés.")

    private fun agirMenu(action: String, champs: Map<String, Any?>, succes: String) {
        val courant = _etat.value as? EtatReglages.Pret ?: return
        if (courant.actionEnCours) return
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatReglages.NonConnecte
                return@launch
            }
            val message = try {
                apiMenu.modifierMenu(jeton, action, champs) ?: succes
            } catch (e: ErreurAcces) {
                e.message ?: "Accès refusé."
            } catch (e: ErreurReseau) {
                e.message ?: "Impossible de joindre Speedfood."
            }
            val avant = _etat.value as? EtatReglages.Pret
            _etat.value = avant?.copy(actionEnCours = false, message = message) ?: EtatReglages.Erreur(message)
            lire(message)
        }
    }
}
