package com.speedfood.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json

/**
 * Session du compte connecté : conservée dans le stockage local, renouvelée automatiquement avant son expiration. Un renouvellement refusé (compte supprimé,
 * jeton révoqué) ferme la session : la personne se reconnecte, rien d'autre n'est perdu.
 */
class SessionService(
    private val auth: AuthApi,
    private val stockage: StockageLocal,
    private val maintenantSecondes: () -> Long,
) {
    private val _session = MutableStateFlow(lireStockee())
    val session: StateFlow<Session?> = _session.asStateFlow()
    private val verrou = Mutex()

    private fun lireStockee(): Session? =
        stockage.lire(CLE)?.let { brut ->
            try {
                Json.decodeFromString<Session>(brut)
            } catch (_: Exception) {
                stockage.effacer(CLE)
                null
            }
        }

    private fun poser(s: Session?) {
        if (s == null) stockage.effacer(CLE) else stockage.ecrire(CLE, Json.encodeToString(Session.serializer(), s))
        _session.value = s
    }

    suspend fun connecter(email: String, motDePasse: String) {
        poser(auth.connecter(email, motDePasse))
    }

    suspend fun connecterAvecGoogle(jetonIdentite: String, nonce: String?) {
        poser(auth.connecterAvecGoogle(jetonIdentite, nonce))
    }

    suspend fun connecterAvecCode(code: String, verificateur: String) {
        poser(auth.connecterAvecCode(code, verificateur))
    }

    /** Vrai si le compte est déjà connecté (pas de confirmation d'e-mail exigée) ; faux si un e-mail de confirmation a été envoyé. */
    suspend fun inscrire(nom: String, telephone: String, email: String, motDePasse: String): Boolean {
        val ouverte = auth.inscrire(nom, telephone, email, motDePasse) ?: return false
        poser(ouverte)
        return true
    }

    fun deconnecter() {
        poser(null)
    }

    /**
     * Jeton d'accès utilisable maintenant, ou null si personne n'est connecté ou si la session ne peut plus être renouvelée (elle est alors fermée).
     * Une marge de [MARGE_SECONDES] évite d'envoyer un jeton qui expire pendant la requête.
     */
    suspend fun jetonValide(): String? = verrou.withLock {
        val courante = _session.value ?: return null
        if (courante.expireLe - maintenantSecondes() > MARGE_SECONDES) return courante.accessToken
        try {
            val renouvelee = auth.rafraichir(courante.refreshToken)
            poser(renouvelee)
            renouveleLe = maintenantSecondes()
            renouvelee.accessToken
        } catch (e: ErreurAuth) {
            // Réseau coupé ou service indisponible : on garde la session (elle servira au prochain essai). Refus définitif du serveur : la session est morte.
            if (e.temporaire) null else {
                poser(null)
                null
            }
        }
    }

    private var renouveleLe = -1_000_000L

    /**
     * Un serveur a refusé [jeton] (401) alors qu'il semblait valable : la session a peut-être été révoquée (mot de passe changé, compte suspendu). On force un renouvellement ;
     * si le serveur refuse définitivement, la session est fermée et la fonction renvoie vrai. Un refus survenant juste après un renouvellement réussi (moins d'une minute)
     * ferme aussi la session : sinon on renouvellerait en boucle un jeton que le serveur rejette.
     */
    suspend fun jetonRefuse(jeton: String): Boolean = verrou.withLock {
        val courante = _session.value ?: return false
        if (courante.accessToken != jeton) return false
        if (maintenantSecondes() - renouveleLe < 60) {
            poser(null)
            return true
        }
        try {
            poser(auth.rafraichir(courante.refreshToken))
            renouveleLe = maintenantSecondes()
            false
        } catch (e: ErreurAuth) {
            if (e.temporaire) false else {
                poser(null)
                true
            }
        }
    }

    companion object {
        const val CLE = "session"
        const val MARGE_SECONDES = 60L
    }
}
