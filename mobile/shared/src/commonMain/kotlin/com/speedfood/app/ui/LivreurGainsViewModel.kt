package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ActiviteApi
import com.speedfood.app.data.CourseLivree
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.GainsLivreur
import com.speedfood.app.data.LivreurApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.courseEnCours
import com.speedfood.app.data.gainAttenduGnf
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Onglet « Gains » du livreur : ses courses livrées, leurs frais de course, le gain attendu de la course en cours (mis à jour tout seul),
 * et l'historique des courses livrées page par page.
 *
 * Le gain attendu vient de la course en cours : il change dès que la course change, sans rechargement manuel (l'écran relance la lecture toutes les 5 secondes).
 * Une panne garde les chiffres déjà affichés.
 */
sealed interface EtatGainsLivreur {
    data object Chargement : EtatGainsLivreur
    data object NonConnecte : EtatGainsLivreur

    /** Le compte connecté n'est pas un compte livreur. */
    data object PasLivreur : EtatGainsLivreur

    data class Erreur(val message: String) : EtatGainsLivreur

    data class Pret(
        /** Les totaux : aujourd'hui et les 7 derniers jours. */
        val bilan: GainsLivreur = GainsLivreur(),
        /** Les frais de la course en cours : le gain attendu, mis à jour en direct. */
        val gainAttenduGnf: Int = 0,
        /** Y a-t-il une course en cours ? */
        val enCours: Boolean = false,
        /** Les courses livrées déjà chargées (page 1, puis les pages suivantes à la suite). */
        val historique: List<CourseLivree> = emptyList(),
        val page: Int = 1,
        val pages: Int = 1,
        /** Y a-t-il une page suivante ? */
        val suite: Boolean = false,
        /** Une page est en cours de chargement. */
        val chargementSuite: Boolean = false,
        /** Panne ou refus du serveur : les chiffres affichés restent en place. */
        val message: String? = null,
    ) : EtatGainsLivreur
}

class LivreurGainsViewModel(
    private val session: SessionService,
    private val api: LivreurApi,
    private val activite: ActiviteApi,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatGainsLivreur>(EtatGainsLivreur.Chargement)
    val etat: StateFlow<EtatGainsLivreur> = _etat.asStateFlow()

    init {
        charger()
    }

    /** Recharge tout : totaux, gain attendu et première page d'historique. */
    fun charger() {
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatGainsLivreur.NonConnecte
                return@launch
            }
            val avant = _etat.value as? EtatGainsLivreur.Pret
            try {
                val bilan = activite.livreur(jeton)
                if (bilan == null) {
                    _etat.value = EtatGainsLivreur.PasLivreur
                    return@launch
                }
                val etat = api.etat(jeton)
                val file = api.file(jeton)
                val historique = api.historique(jeton, 1)
                _etat.value = EtatGainsLivreur.Pret(
                    bilan = bilan,
                    gainAttenduGnf = gainAttenduGnf(etat, file),
                    enCours = courseEnCours(etat, file) != null,
                    historique = historique?.courses.orEmpty(),
                    page = historique?.page ?: 1,
                    pages = historique?.pages ?: 1,
                    suite = historique?.suite ?: false,
                )
            } catch (e: ErreurAcces) {
                _etat.value = EtatGainsLivreur.Erreur(e.message ?: "Accès refusé.")
            } catch (e: ErreurReseau) {
                _etat.value = avant?.copy(message = e.message ?: "Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
                    ?: EtatGainsLivreur.Erreur(e.message ?: "Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.")
            }
        }
    }

    /**
     * Gain attendu : relit la course en cours. Le gain suit la course sans rechargement manuel ; une panne garde le gain affiché.
     */
    fun rafraichirGain() {
        viewModelScope.launch {
            val jeton = session.jetonValide() ?: return@launch
            val avant = _etat.value as? EtatGainsLivreur.Pret ?: return@launch
            try {
                val etat = api.etat(jeton)
                val file = api.file(jeton)
                _etat.value = avant.copy(
                    gainAttenduGnf = gainAttenduGnf(etat, file),
                    enCours = courseEnCours(etat, file) != null,
                )
            } catch (_: ErreurReseau) {
                // Le gain déjà affiché reste affiché : une panne de réseau ne vide pas l'écran.
            }
        }
    }

    /** Charge la page suivante de l'historique et l'ajoute à la liste. */
    fun chargerSuite() {
        val courant = _etat.value as? EtatGainsLivreur.Pret ?: return
        if (!courant.suite || courant.chargementSuite) return
        _etat.value = courant.copy(chargementSuite = true)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatGainsLivreur.NonConnecte
                return@launch
            }
            try {
                val page = api.historique(jeton, courant.page + 1)
                val avant = _etat.value as? EtatGainsLivreur.Pret
                if (avant == null || page == null) {
                    _etat.value = avant?.copy(chargementSuite = false) ?: EtatGainsLivreur.Erreur("La suite de l'historique n'a pas pu être chargée.")
                    return@launch
                }
                _etat.value = avant.copy(
                    historique = avant.historique + page.courses,
                    page = page.page,
                    pages = page.pages,
                    suite = page.suite,
                    chargementSuite = false,
                )
            } catch (e: ErreurReseau) {
                val avant = _etat.value as? EtatGainsLivreur.Pret
                _etat.value = avant?.copy(chargementSuite = false, message = e.message ?: "La suite de l'historique n'a pas pu être chargée.")
                    ?: EtatGainsLivreur.Erreur(e.message ?: "Une erreur est survenue.")
            }
        }
    }
}
