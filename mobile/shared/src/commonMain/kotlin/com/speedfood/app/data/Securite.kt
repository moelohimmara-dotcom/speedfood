package com.speedfood.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.time.Clock

/** Autorisation d'afficher des notifications (Android 13 et plus : à demander). Là où la plateforme n'en a pas besoin, [autorisee] est vraie. */
interface DemandeNotifications {
    /** La plateforme sait demander l'autorisation (sinon l'invitation n'est jamais affichée). */
    val disponible: Boolean

    fun autorisee(): Boolean

    /** Ouvre la demande du système. À appeler seulement après avoir expliqué pourquoi, au moment où la personne en a besoin. */
    fun demander()
}

class NotificationsIndisponibles : DemandeNotifications {
    override val disponible = false
    override fun autorisee() = true
    override fun demander() = Unit
}

/** Verrouillage de l'appareil (empreinte, visage ou code du téléphone) pour protéger un espace professionnel laissé sur un téléphone partagé. */
interface VerrouAppareil {
    /** Un verrouillage d'écran est configuré sur le téléphone (sans lui, rien ne peut être demandé : l'espace n'est alors jamais bloqué). */
    fun utilisable(): Boolean

    /** Demande la vérification au système ; [surResultat] reçoit vrai si la personne s'est identifiée. */
    fun authentifier(titre: String, surResultat: (Boolean) -> Unit)
}

class VerrouIndisponible : VerrouAppareil {
    override fun utilisable() = false
    override fun authentifier(titre: String, surResultat: (Boolean) -> Unit) = surResultat(true)
}

/**
 * Verrou optionnel des espaces professionnels (réglage dans Paramètres, désactivé par défaut). Quand il est actif, l'espace pro demande le déverrouillage à l'ouverture de
 * l'application et après [DELAI_MS] passé en arrière-plan. Règle de sûreté : un verrou qui ne peut pas s'exécuter (plus de verrouillage d'écran sur le téléphone) ne bloque
 * JAMAIS un restaurateur devant une commande à traiter.
 */
class VerrouEspacesPro(
    private val stockage: StockageLocal,
    private val verrou: VerrouAppareil,
    private val maintenantMs: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    private val _actif = MutableStateFlow(stockage.lire(CLE) == "1")

    /** Réglage choisi par la personne. */
    val actif: StateFlow<Boolean> = _actif.asStateFlow()

    private val _deverrouille = MutableStateFlow(false)

    /** Vrai tant que l'espace pro peut s'afficher sans nouvelle vérification. */
    val deverrouille: StateFlow<Boolean> = _deverrouille.asStateFlow()

    private var quitteLe = 0L

    /** Faux : on affiche l'écran de verrouillage. */
    fun peutAfficher(): Boolean = !_actif.value || _deverrouille.value || !verrou.utilisable()

    fun disponible(): Boolean = verrou.utilisable()

    /** Active ou désactive le réglage ; l'activation demande d'abord une vérification (on ne s'enferme pas dehors par erreur). */
    fun regler(actif: Boolean, surFin: (Boolean) -> Unit = {}) {
        if (!actif) {
            stockage.effacer(CLE)
            _actif.value = false
            surFin(true)
            return
        }
        if (!verrou.utilisable()) {
            surFin(false)
            return
        }
        verrou.authentifier("Activer le verrouillage de mes espaces professionnels") { ok ->
            if (ok) {
                stockage.ecrire(CLE, "1")
                _actif.value = true
                _deverrouille.value = true
            }
            surFin(ok)
        }
    }

    fun deverrouiller(surFin: (Boolean) -> Unit = {}) {
        verrou.authentifier("Déverrouiller votre espace professionnel") { ok ->
            if (ok) _deverrouille.value = true
            surFin(ok)
        }
    }

    /** L'application passe en arrière-plan. */
    fun quitte() {
        quitteLe = maintenantMs()
    }

    /** L'application revient au premier plan : au-delà du délai, un nouveau déverrouillage est demandé. */
    fun reprise() {
        if (quitteLe != 0L && maintenantMs() - quitteLe > DELAI_MS) _deverrouille.value = false
        quitteLe = 0L
    }

    companion object {
        const val CLE = "verrou_pro"
        const val DELAI_MS = 2L * 60 * 1000
    }
}
