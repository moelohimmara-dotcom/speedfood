package com.speedfood.app.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Télécharge la nouvelle version, vérifie son empreinte SHA-256 puis la remet au système pour installation. Android ne permet pas à une application installée hors
 * Google Play de se remplacer sans que la personne confirme : cette interface fait tout le reste (téléchargement, vérification, ouverture de la confirmation).
 */
interface InstallateurApk {
    /** Faux là où la plateforme ne sait pas installer (le bandeau retombe alors sur la page de téléchargement). */
    val actif: Boolean

    /** La personne a-t-elle autorisé Speedfood à installer des applications (réglage « Sources inconnues » d'Android) ? */
    fun autorise(): Boolean

    /** Ouvre le réglage du système où la personne autorise Speedfood à installer des mises à jour. */
    fun ouvrirAutorisation()

    /** Télécharge [url] et vérifie son empreinte. Renvoie null si tout est bon, sinon le message à afficher. [progres] reçoit 0 à 100. */
    suspend fun telecharger(url: String, sha256: String, progres: (Int) -> Unit): String?

    /** Remet l'APK téléchargée au système, qui demande la confirmation de la personne puis remplace l'application. */
    fun installer()
}

class InstallateurIndisponible : InstallateurApk {
    override val actif = false
    override fun autorise() = false
    override fun ouvrirAutorisation() = Unit
    override suspend fun telecharger(url: String, sha256: String, progres: (Int) -> Unit): String? = "Installation indisponible."
    override fun installer() = Unit
}

sealed interface EtatInstallation {
    data object Repos : EtatInstallation
    data class Telechargement(val pourcent: Int) : EtatInstallation

    /** Le système doit d'abord autoriser Speedfood à installer des applications ; la personne revient ensuite et reprend. */
    data object AutorisationRequise : EtatInstallation
    data object Installation : EtatInstallation
    data class Echec(val message: String) : EtatInstallation
}

/** Pilote une installation : un seul téléchargement à la fois, l'état est lu par le bandeau et par la page Compte. */
class InstallationMiseAJour(private val installateur: InstallateurApk, private val portee: CoroutineScope, private val siteUrl: String) {
    private val _etat = MutableStateFlow<EtatInstallation>(EtatInstallation.Repos)
    val etat: StateFlow<EtatInstallation> = _etat.asStateFlow()
    private var travail: Job? = null

    /** L'installation en un geste n'est possible que si la plateforme sait installer ET que le serveur a publié l'empreinte de l'APK. */
    fun possible(version: VersionPubliee): Boolean = installateur.actif && version.apkSha256.length == 64

    fun lancer(version: VersionPubliee) {
        if (!possible(version) || travail?.isActive == true) return
        if (!installateur.autorise()) {
            _etat.value = EtatInstallation.AutorisationRequise
            installateur.ouvrirAutorisation()
            return
        }
        _etat.value = EtatInstallation.Telechargement(0)
        travail = portee.launch {
            val url = "${siteUrl.trimEnd('/')}/speedfood.apk"
            val erreur = try {
                installateur.telecharger(url, version.apkSha256) { _etat.value = EtatInstallation.Telechargement(it.coerceIn(0, 100)) }
            } catch (e: Exception) {
                "Le téléchargement a échoué. Vérifiez votre connexion et réessayez."
            }
            if (erreur != null) {
                _etat.value = EtatInstallation.Echec(erreur)
            } else {
                _etat.value = EtatInstallation.Installation
                installateur.installer()
            }
        }
    }

    fun reinitialiser() {
        if (travail?.isActive != true) _etat.value = EtatInstallation.Repos
    }
}
