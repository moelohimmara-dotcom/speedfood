package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AideApi
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.EnregistrementPush
import com.speedfood.app.data.InfosApplication
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.SuiviMiseAJour
import com.speedfood.app.data.miseAJourDisponible
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Compte, Paramètres et Aide : session, test des notifications, vérification de version, oubli des données de l'appareil, contact d'assistance. Chaque action reste en
 * meilleur effort et se termine par un message lisible (jamais de détail technique).
 */
class CompteViewModel(
    private val session: SessionService,
    private val enregistrementPush: EnregistrementPush,
    private val locales: CommandesLocales,
    private val deconnexion: com.speedfood.app.data.DeconnexionService,
    private val clientApi: com.speedfood.app.data.ClientApi,
    private val miseAJour: SuiviMiseAJour,
    val installation: com.speedfood.app.data.InstallationMiseAJour,
    private val aide: AideApi,
    val infos: InfosApplication,
) : ViewModel() {
    val connexion = session.session

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    private val _versionDisponible = MutableStateFlow<String?>(null)

    /** Adresse de téléchargement quand une version plus récente existe, sinon null. */
    val versionDisponible: StateFlow<String?> = _versionDisponible.asStateFlow()

    private val _whatsapp = MutableStateFlow<String?>(null)
    val whatsapp: StateFlow<String?> = _whatsapp.asStateFlow()

    private val _versionPubliee = MutableStateFlow<com.speedfood.app.data.VersionPubliee?>(null)

    /** Version plus récente publiée par le serveur (pour l'installation en un geste), sinon null. */
    val versionPubliee: StateFlow<com.speedfood.app.data.VersionPubliee?> = _versionPubliee.asStateFlow()

    val urlTelechargement: String get() = miseAJour.urlTelechargement

    fun chargerContact() {
        viewModelScope.launch { _whatsapp.value = aide.whatsapp() }
    }

    fun essaiNotification() {
        _message.value = "Essai en cours…"
        viewModelScope.launch {
            _message.value = try {
                enregistrementPush.essai()
            } catch (_: Exception) {
                "L'essai n'a pas pu être lancé. Réessayez dans un instant."
            }
        }
    }

    fun verifierMiseAJour() {
        _message.value = "Vérification en cours…"
        _versionDisponible.value = null
        _versionPubliee.value = null
        installation.reinitialiser()
        viewModelScope.launch {
            val publiee = miseAJour.derniereVersion()
            _message.value = when {
                publiee == null -> "Impossible de vérifier pour l'instant. Vérifiez votre connexion puis réessayez."
                miseAJourDisponible(infos.codeVersion, publiee) -> {
                    _versionDisponible.value = miseAJour.urlTelechargement
                    _versionPubliee.value = publiee
                    "La version ${publiee.nom} est disponible."
                }
                else -> "Vous avez la dernière version (${infos.versionNom})."
            }
        }
    }

    /** Supprime le compte (irréversible) ; en cas de refus, le message du serveur s'affiche et rien n'est effacé. */
    fun supprimerCompte(confirmation: String) {
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _message.value = "Connectez-vous pour supprimer votre compte."
                return@launch
            }
            val retour = try {
                clientApi.supprimerCompte(jeton, confirmation)
            } catch (e: com.speedfood.app.data.ErreurReseau) {
                com.speedfood.app.data.RetourClient(false, e.message ?: "Impossible de joindre Speedfood. Réessayez.")
            }
            if (retour.ok) deconnexion.apresSuppression() else _message.value = retour.message
        }
    }

    /** Déconnexion volontaire (voir [DeconnexionService]) : les commandes en cours restent suivies sur l'appareil sauf si [effacerCommandes]. */
    fun deconnecter(effacerCommandes: Boolean) = deconnexion.deconnecter(effacerCommandes)

    fun oublierCommandesDeCetAppareil() {
        locales.oublier()
        _message.value = "Les commandes enregistrées sur cet appareil ont été oubliées."
    }
}
