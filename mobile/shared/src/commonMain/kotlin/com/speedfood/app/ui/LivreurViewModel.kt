package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.DossierLivreur
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.FileLivreur
import com.speedfood.app.data.FournisseurPosition
import com.speedfood.app.data.LivreurApi
import com.speedfood.app.data.PosteFixe
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.SuiviLivreur
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

    /**
     * [message] : retour de la dernière action (refus du serveur, par exemple « commande pas encore prête ») ou alerte réseau ; [actionEnCours] : un envoi est en route.
     * [suiviArrierePlan] : choix du livreur de continuer le suivi application fermée (null = pas encore demandé) ; [arrierePlanPossible] : la plateforme le permet.
     * [file] : la file des courses (la course en cours, puis les suivantes) ; [dossier] : l'état des pièces du dossier d'activation (jamais le document) ;
     * [posteFixe] : le livreur a choisi que l'écran reste allumé pendant la livraison.
     */
    data class Pret(
        val etat: EtatLivreur,
        val message: String? = null,
        val actionEnCours: Boolean = false,
        val positionAutorisee: Boolean = false,
        val positionDisponible: Boolean = false,
        val suiviArrierePlan: Boolean? = null,
        val arrierePlanPossible: Boolean = false,
        val file: FileLivreur? = null,
        val dossier: DossierLivreur? = null,
        val posteFixe: Boolean = false,
    ) : EtatEspaceLivreur

    data class Erreur(val message: String) : EtatEspaceLivreur
}

/** Le livreur doit être suivi (position envoyée) tant qu'il est en ligne ou en course. */
fun doitSuivreLaPosition(etat: EtatLivreur): Boolean = etat.doitEtreSuivi

/** Clé du stockage local : « oui » ou « non » à la poursuite du suivi application fermée. Absente tant que la question n'a pas été posée. */
const val CLE_SUIVI_ARRIERE_PLAN = "livreur_suivi_arriere_plan"

/**
 * Espace livreur : relit l'état toutes les 5 secondes (2,5 s tant qu'une offre attend une réponse), envoie la position toutes les 8 secondes tant que le livreur
 * est en ligne ou en course, et laisse le serveur décider de tout (machine à états, code de remise, commande prête).
 *
 * La file des courses est relue au même rythme (une course qui s'ajoute doit apparaître sans rechargement) ; l'état du dossier d'activation, lui, change
 * rarement : il est relu toutes les minutes.
 *
 * Suivi en arrière-plan : si le livreur l'a accepté ET que la plateforme le permet, c'est le service de la plateforme qui lit la position, l'envoie et signale
 * les offres, application ouverte ou non ; ce modèle s'efface alors devant lui (il ne lit ni n'envoie la position). Sinon, suivi application ouverte seulement.
 */
class LivreurViewModel(
    private val session: SessionService,
    private val api: LivreurApi,
    private val position: FournisseurPosition,
    private val stockage: StockageLocal,
    private val posteFixe: PosteFixe,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatEspaceLivreur>(EtatEspaceLivreur.Chargement)
    val etat: StateFlow<EtatEspaceLivreur> = _etat.asStateFlow()

    private var derniere: Pair<Double, Double>? = null
    private var dernierEnvoi = 0L
    private var suivi = false
    private var enArrierePlan = false
    private var enCourse = false
    private var tours = 0

    private fun choixArrierePlan(): Boolean? = when (stockage.lire(CLE_SUIVI_ARRIERE_PLAN)) {
        "oui" -> true
        "non" -> false
        else -> null
    }

    init {
        viewModelScope.launch {
            while (true) {
                rafraichir()
                val courant = _etat.value
                delay(if (courant is EtatEspaceLivreur.Pret && courant.etat.offre != null) DELAI_OFFRE_MS else SuiviLivreur.DELAI_TOUR_MS)
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
            val file = lireFile(jeton, avant?.file)
            val dossier = lireDossier(jeton, avant?.dossier)
            enCourse = etat.course != null || etat.livreur.statut == "en_course"
            _etat.value = EtatEspaceLivreur.Pret(
                etat = etat,
                file = file,
                dossier = dossier,
                posteFixe = posteFixe.actif.value,
                message = avant?.message,
                actionEnCours = avant?.actionEnCours ?: false,
                positionAutorisee = position.autorisee(),
                positionDisponible = position.disponible,
                suiviArrierePlan = choixArrierePlan(),
                arrierePlanPossible = position.arrierePlanPossible,
            )
            ajusterSuivi(etat)
            envoyerPositionSiBesoin(jeton, etat)
            tours++
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatEspaceLivreur.Pret
            _etat.value = if (avant != null) avant.copy(message = "Connexion perdue : nouvelle tentative en cours.") else EtatEspaceLivreur.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    /**
     * La file des courses. Une panne ici n'efface pas la file déjà affichée : on garde la dernière connue, l'écran reste utile.
     */
    private suspend fun lireFile(jeton: String, avant: FileLivreur?): FileLivreur? = try {
        api.file(jeton)
    } catch (_: ErreurReseau) {
        avant
    }

    /**
     * L'état du dossier d'activation. Relu toutes les minutes (le dossier change peu) ; une panne garde le dernier état connu.
     */
    private suspend fun lireDossier(jeton: String, avant: DossierLivreur?): DossierLivreur? {
        if (avant != null && tours % TOURS_ENTRE_DOSSIERS != 0) return avant
        return try {
            api.dossier(jeton)
        } catch (_: ErreurReseau) {
            avant
        }
    }

    private fun ajusterSuivi(etat: EtatLivreur) {
        val doitSuivre = doitSuivreLaPosition(etat) && position.disponible && position.autorisee()
        if (!doitSuivre) {
            arreterSuivi()
            return
        }
        val arrierePlan = choixArrierePlan() == true && position.arrierePlanPossible
        if (arrierePlan) {
            // Le service de la plateforme prend le relais : on libère la lecture au premier plan pour ne pas mesurer deux fois.
            if (suivi) {
                suivi = false
                position.arreter()
            }
            enArrierePlan = true
            position.demarrerArrierePlan()
        } else {
            if (enArrierePlan) {
                enArrierePlan = false
                position.arreterArrierePlan()
            }
            if (!suivi) {
                suivi = true
                position.demarrer { lat, lon -> derniere = lat to lon }
            }
        }
        // Le mode poste fixe et le suivi partagent le même drapeau « écran allumé » : c'est le service poste fixe qui l'applique.
        posteFixe.majuter(suivi, enCourse)
    }

    private fun arreterSuivi() {
        if (suivi) {
            suivi = false
            position.arreter()
        }
        if (enArrierePlan) {
            enArrierePlan = false
            position.arreterArrierePlan()
        }
        posteFixe.majuter(false, enCourse)
    }

    private suspend fun envoyerPositionSiBesoin(jeton: String, etat: EtatLivreur) {
        val p = derniere ?: return
        val maintenant = Clock.System.now().toEpochMilliseconds()
        if (!suivi || !doitSuivreLaPosition(etat) || maintenant - dernierEnvoi < SuiviLivreur.INTERVALLE_POSITION_MS) return
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

    /** Enregistre le choix du livreur (suivi application fermée : oui ou non) ; appliqué dès le prochain tour. */
    fun choisirSuiviArrierePlan(oui: Boolean) {
        stockage.ecrire(CLE_SUIVI_ARRIERE_PLAN, if (oui) "oui" else "non")
        (_etat.value as? EtatEspaceLivreur.Pret)?.let { _etat.value = it.copy(suiviArrierePlan = oui) }
        if (!oui && enArrierePlan) {
            enArrierePlan = false
            position.arreterArrierePlan()
        }
    }

    /** Le livreur active ou coupe le mode poste fixe : l'écran reste allumé pendant la livraison. */
    fun definirPosteFixe(actif: Boolean) {
        posteFixe.definir(actif)
        (_etat.value as? EtatEspaceLivreur.Pret)?.let { _etat.value = it.copy(posteFixe = actif) }
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
        // Le suivi en arrière-plan, lui, continue : c'est son but. Seule la lecture au premier plan s'arrête avec l'écran.
        if (suivi) {
            suivi = false
            position.arreter()
        }
        posteFixe.majuter(false, false)
        super.onCleared()
    }

    companion object {
        const val DELAI_OFFRE_MS = 2_500L

        /** Nombre de tours entre deux relis de l'état du dossier (5 s par tour : environ une minute). */
        const val TOURS_ENTRE_DOSSIERS = 12
    }
}
