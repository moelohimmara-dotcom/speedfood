package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.DetailMenuEquipe
import com.speedfood.app.data.EquipeApi
import com.speedfood.app.data.ErreurAcces
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.BrouillonCandidature
import com.speedfood.app.data.MenuEquipeResume
import com.speedfood.app.data.MenuPhotoEquipeApi
import com.speedfood.app.data.ResultatPhoto
import com.speedfood.app.data.SelecteurPhoto
import com.speedfood.app.data.ajouterLignesCochees
import com.speedfood.app.data.lignesProposees
import com.speedfood.app.data.RetourEquipe
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface EtatMenusEquipe {
    data object Chargement : EtatMenusEquipe
    data object NonConnecte : EtatMenusEquipe
    data class Erreur(val message: String) : EtatMenusEquipe

    /** [detail] : plats d'un établissement ouvert ; [message] : retour de la dernière action ; [actionEnCours] : un envoi est en route. */
    data class Pret(
        val menus: List<MenuEquipeResume>,
        val fraicheurHeures: Int,
        val ouvert: String? = null,
        val detail: DetailMenuEquipe? = null,
        val message: String? = null,
        val actionEnCours: Boolean = false,
        /** Menu par photo (lot R5) : la lecture en attente de relecture, et l'appareil sait-il choisir une photo. */
        val lecture: LectureEnAttente? = null,
        val lectureEnCours: Boolean = false,
        val photoDisponible: Boolean = false,
    ) : EtatMenusEquipe
}

/**
 * Menus des établissements tenus par l'équipe : quels menus ont des plats à reconfirmer, reconfirmation de tout un menu ou d'un plat, plat épuisé ou remis en vente.
 * Le serveur revérifie tout (permission, établissement tenu par l'équipe) et journalise chaque action.
 */
class MenusEquipeViewModel(
    private val session: SessionService,
    private val api: EquipeApi,
    private val photoApi: MenuPhotoEquipeApi,
    private val selecteur: SelecteurPhoto,
) : ViewModel() {
    private val _etat = MutableStateFlow<EtatMenusEquipe>(EtatMenusEquipe.Chargement)
    val etat: StateFlow<EtatMenusEquipe> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        viewModelScope.launch { lire() }
    }

    private suspend fun lire() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _etat.value = EtatMenusEquipe.NonConnecte
            return
        }
        try {
            val (menus, fraicheur) = api.menus(jeton)
            val avant = _etat.value as? EtatMenusEquipe.Pret
            val detail = avant?.ouvert?.let { id -> try { api.menu(jeton, id) } catch (_: ErreurReseau) { avant.detail } }
            _etat.value = avant?.copy(menus = menus, fraicheurHeures = fraicheur, detail = detail) ?: EtatMenusEquipe.Pret(menus, fraicheur, null, null, null, false, photoDisponible = selecteur.disponible)
        } catch (e: ErreurAcces) {
            _etat.value = EtatMenusEquipe.Erreur(e.message ?: "Accès refusé.")
        } catch (e: ErreurReseau) {
            val avant = _etat.value as? EtatMenusEquipe.Pret
            _etat.value = if (avant != null) avant.copy(message = e.message) else EtatMenusEquipe.Erreur(e.message ?: "Une erreur est survenue.")
        }
    }

    fun ouvrir(restaurantId: String?) {
        val courant = _etat.value as? EtatMenusEquipe.Pret ?: return
        if (restaurantId == null) {
            _etat.value = courant.copy(ouvert = null, detail = null)
            return
        }
        _etat.value = courant.copy(ouvert = restaurantId, detail = null, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide() ?: return@launch
            try {
                val detail = api.menu(jeton, restaurantId)
                (_etat.value as? EtatMenusEquipe.Pret)?.let { if (it.ouvert == restaurantId) _etat.value = it.copy(detail = detail) }
            } catch (e: ErreurReseau) {
                (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(message = e.message) }
            }
        }
    }

    private fun agir(envoi: suspend (String) -> RetourEquipe) {
        val courant = _etat.value as? EtatMenusEquipe.Pret ?: return
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
            (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message) }
        }
    }

    /** « Ajouter depuis une photo » : la photo est lue par le serveur, puis la liste est montrée pour relecture. Rien n'est ajouté sans accord. */
    fun photographier(restaurantId: String) {
        val courant = _etat.value as? EtatMenusEquipe.Pret ?: return
        if (courant.lectureEnCours || courant.actionEnCours) return
        viewModelScope.launch {
            val choisie = when (val r = selecteur.choisir()) {
                is ResultatPhoto.Choisie -> r.photo
                ResultatPhoto.Annule -> return@launch
                is ResultatPhoto.Erreur -> {
                    (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(message = r.message) }
                    return@launch
                }
            }
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = EtatMenusEquipe.NonConnecte
                return@launch
            }
            (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(lectureEnCours = true, message = null) }
            try {
                val lue = photoApi.lire(jeton, restaurantId, choisie)
                val trouve = lue.plats.isNotEmpty() || lue.refuses.isNotEmpty()
                (_etat.value as? EtatMenusEquipe.Pret)?.let {
                    _etat.value = it.copy(
                        lectureEnCours = false,
                        lecture = if (trouve) LectureEnAttente(lignesProposees(lue), lue.refuses, lue.etat) else null,
                        message = if (trouve) null else "Aucun plat lisible sur cette photo : plus de lumière, ou saisissez-les à la main.",
                    )
                }
            } catch (e: ErreurAcces) {
                _etat.value = EtatMenusEquipe.Erreur(e.message ?: "Accès refusé.")
            } catch (e: ErreurReseau) {
                (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(lectureEnCours = false, message = e.message) }
            }
        }
    }

    fun modifierLigne(index: Int, nom: String? = null, prix: String? = null, coche: Boolean? = null) {
        val courant = _etat.value as? EtatMenusEquipe.Pret ?: return
        val l = courant.lecture ?: return
        val lignes = l.lignes.mapIndexed { i, ligne -> if (i == index) ligne.copy(nom = nom ?: ligne.nom, prix = prix ?: ligne.prix, coche = coche ?: ligne.coche) else ligne }
        _etat.value = courant.copy(lecture = l.copy(lignes = lignes), message = null)
    }

    fun annulerLecture() {
        (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(lecture = null, message = null) }
    }

    /** Ajoute au menu les lignes cochées, relues : mêmes contrôles qu'une saisie, puis revalidation complète par le serveur. Un doublon ou une ligne invalide : rien n'est ajouté. */
    fun ajouterLecture(restaurantId: String) {
        val courant = _etat.value as? EtatMenusEquipe.Pret ?: return
        val l = courant.lecture ?: return
        if (courant.actionEnCours) return
        val (b, probleme) = ajouterLignesCochees(BrouillonCandidature(), l.lignes)
        if (b == null) {
            _etat.value = courant.copy(message = probleme)
            return
        }
        if (b.plats.isEmpty()) {
            _etat.value = courant.copy(message = "Cochez au moins un plat.")
            return
        }
        _etat.value = courant.copy(actionEnCours = true, message = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            val message = if (jeton == null) {
                "Connectez-vous avec votre compte."
            } else {
                try {
                    photoApi.importer(jeton, restaurantId, b.plats)
                } catch (e: ErreurReseau) {
                    e.message
                }
            }
            val reussi = message?.contains("ajouté") == true
            lire()
            (_etat.value as? EtatMenusEquipe.Pret)?.let { _etat.value = it.copy(actionEnCours = false, message = message, lecture = if (reussi) null else it.lecture) }
        }
    }

    fun reconfirmerTout(restaurantId: String) = agir { api.reconfirmer(it, restaurantId, null) }

    fun reconfirmerPlat(restaurantId: String, platId: String) = agir { api.reconfirmer(it, restaurantId, platId) }

    fun definirDisponibilite(restaurantId: String, platId: String, disponible: Boolean) = agir { api.definirDisponibilite(it, restaurantId, platId, disponible) }
}
