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

    suspend fun inscrire(nom: String, telephone: String, email: String, motDePasse: String) {
        auth.inscrire(nom, telephone, email, motDePasse)
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
            renouvelee.accessToken
        } catch (e: ErreurAuth) {
            // Réseau coupé ou service indisponible : on garde la session (elle servira au prochain essai). Refus définitif du serveur : la session est morte.
            if (e.temporaire) null else {
                poser(null)
                null
            }
        }
    }

    companion object {
        const val CLE = "session"
        const val MARGE_SECONDES = 60L
    }
}
