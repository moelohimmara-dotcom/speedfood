package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.BrouillonCandidature
import com.speedfood.app.data.BrouillonCandidatureStockage
import com.speedfood.app.data.CandidatureApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.NOMBRE_ETAPES_CANDIDATURE
import com.speedfood.app.data.PhotoChoisie
import com.speedfood.app.data.QuartierChoix
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.ResultatPhoto
import com.speedfood.app.data.SelecteurPhoto
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.VueCandidature
import com.speedfood.app.data.ajouterPlatCandidature
import com.speedfood.app.data.erreurEtapeCandidature
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class PhaseCandidature { Chargement, NonConnecte, Formulaire, Suivi, Erreur }

data class EcranCandidature(
    val phase: PhaseCandidature = PhaseCandidature.Chargement,
    val brouillon: BrouillonCandidature = BrouillonCandidature(),
    val vue: VueCandidature? = null,
    /** Erreur de l'étape en cours ou de l'envoi, affichée sous le formulaire. */
    val erreur: String? = null,
    val envoiEnCours: Boolean = false,
    val aLogo: Boolean = false,
    val aPhoto: Boolean = false,
    val quartiers: List<QuartierChoix> = emptyList(),
    /** Information qui n'empêche pas l'envoi (par exemple une image qui n'a pas pu partir). */
    val avertissement: String? = null,
)

/**
 * « J'ai un restaurant » : le formulaire de demande de référencement en 5 étapes, puis le suivi de la demande. Le brouillon est gardé sur le téléphone à chaque changement ;
 * les images choisies restent en mémoire jusqu'à l'envoi (elles partent après la demande, une par une, et leur échec n'annule pas la demande).
 */
class CandidatureViewModel(
    private val session: SessionService,
    private val api: CandidatureApi,
    private val stockage: StockageLocal,
    private val restaurants: RestaurantApi,
    private val selecteur: SelecteurPhoto,
) : ViewModel() {
    private val brouillons = BrouillonCandidatureStockage(stockage)
    private val _ecran = MutableStateFlow(EcranCandidature())
    val ecran: StateFlow<EcranCandidature> = _ecran.asStateFlow()
    private var logo: PhotoChoisie? = null
    private var photo: PhotoChoisie? = null

    init {
        charger()
    }

    fun charger() {
        _ecran.value = EcranCandidature(brouillon = brouillons.lire())
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _ecran.value = _ecran.value.copy(phase = PhaseCandidature.NonConnecte)
                return@launch
            }
            try {
                val existante = api.lire(jeton)
                _ecran.value = if (existante != null) _ecran.value.copy(phase = PhaseCandidature.Suivi, vue = existante) else _ecran.value.copy(phase = PhaseCandidature.Formulaire)
            } catch (e: ErreurAcces) {
                _ecran.value = _ecran.value.copy(phase = PhaseCandidature.NonConnecte)
            } catch (e: ErreurReseau) {
                _ecran.value = _ecran.value.copy(phase = PhaseCandidature.Erreur, erreur = e.message)
            }
        }
        viewModelScope.launch {
            try {
                // La lecture réseau se fait AVANT de lire l'état : sinon l'ancien état (par exemple « Chargement ») écraserait celui posé entre-temps.
                val liste = restaurants.quartiers()
                _ecran.value = _ecran.value.copy(quartiers = liste)
            } catch (_: ErreurReseau) {
                // Les quartiers se rechargent à l'ouverture du choix ; un échec ici n'empêche rien d'autre.
            }
        }
    }

    private fun modifier(transformation: (BrouillonCandidature) -> BrouillonCandidature) {
        val b = transformation(_ecran.value.brouillon)
        brouillons.ecrire(b)
        _ecran.value = _ecran.value.copy(brouillon = b, erreur = null)
    }

    fun changer(transformation: (BrouillonCandidature) -> BrouillonCandidature) = modifier(transformation)

    fun choisirQuartier(id: String) {
        val nom = _ecran.value.quartiers.firstOrNull { it.id == id }?.nom ?: return
        modifier { it.copy(quartierId = id, quartierNom = nom) }
    }

    fun basculer(liste: List<String>, valeur: String): List<String> = if (valeur in liste) liste - valeur else liste + valeur

    fun suivante() {
        val b = _ecran.value.brouillon
        val probleme = erreurEtapeCandidature(b.etape, b)
        if (probleme != null) {
            _ecran.value = _ecran.value.copy(erreur = probleme)
            return
        }
        if (b.etape < NOMBRE_ETAPES_CANDIDATURE - 1) modifier { it.copy(etape = it.etape + 1) }
    }

    fun precedente() {
        if (_ecran.value.brouillon.etape > 0) modifier { it.copy(etape = it.etape - 1) }
    }

    fun ajouterPlat(nom: String, prix: String): Boolean {
        val (b, probleme) = ajouterPlatCandidature(_ecran.value.brouillon, nom, prix)
        if (b == null) {
            _ecran.value = _ecran.value.copy(erreur = probleme)
            return false
        }
        modifier { b }
        return true
    }

    fun retirerPlat(index: Int) = modifier { it.copy(plats = it.plats.filterIndexed { i, _ -> i != index }) }

    fun choisirImage(type: String) {
        viewModelScope.launch {
            when (val r = selecteur.choisir()) {
                is ResultatPhoto.Choisie -> {
                    if (type == "logo") logo = r.photo else photo = r.photo
                    _ecran.value = _ecran.value.copy(aLogo = logo != null, aPhoto = photo != null, erreur = null)
                }
                ResultatPhoto.Annule -> Unit
                is ResultatPhoto.Erreur -> _ecran.value = _ecran.value.copy(erreur = r.message)
            }
        }
    }

    fun retirerImage(type: String) {
        if (type == "logo") logo = null else photo = null
        _ecran.value = _ecran.value.copy(aLogo = logo != null, aPhoto = photo != null)
    }

    fun envoyer() {
        if (_ecran.value.envoiEnCours) return
        val b = _ecran.value.brouillon
        val probleme = erreurEtapeCandidature(0, b) ?: erreurEtapeCandidature(1, b)
        if (probleme != null) {
            _ecran.value = _ecran.value.copy(erreur = probleme)
            return
        }
        _ecran.value = _ecran.value.copy(envoiEnCours = true, erreur = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _ecran.value = _ecran.value.copy(envoiEnCours = false, phase = PhaseCandidature.NonConnecte)
                return@launch
            }
            try {
                var vue = api.deposer(jeton, b)
                brouillons.effacer()
                var avertissement: String? = null
                for ((type, image) in listOf("logo" to logo, "photo" to photo)) {
                    if (image == null) continue
                    try {
                        vue = api.envoyerImage(jeton, type, image)
                    } catch (e: ErreurReseau) {
                        avertissement = "Votre demande est envoyée, mais ${if (type == "logo") "le logo" else "la photo"} n'a pas pu partir. L'équipe vous le demandera au besoin."
                    }
                }
                logo = null
                photo = null
                _ecran.value = _ecran.value.copy(phase = PhaseCandidature.Suivi, vue = vue, envoiEnCours = false, aLogo = false, aPhoto = false, avertissement = avertissement)
            } catch (e: ErreurAcces) {
                _ecran.value = _ecran.value.copy(envoiEnCours = false, phase = PhaseCandidature.NonConnecte)
            } catch (e: ErreurReseau) {
                _ecran.value = _ecran.value.copy(envoiEnCours = false, erreur = e.message)
            }
        }
    }
}
