package com.speedfood.app.data

import kotlin.time.Clock

/**
 * Un tour du suivi du livreur, indépendant de l'écran : relit l'état auprès du serveur (ce qui fait aussi avancer les offres côté serveur) et envoie la dernière
 * position mesurée au plus toutes les [INTERVALLE_POSITION_MS]. Sur Android, un service au premier plan répète ce tour tant que le livreur est en ligne ou en
 * course, application ouverte ou non ; la logique est ici pour être testée sans téléphone.
 */
class SuiviLivreur(
    private val session: SessionService,
    private val api: LivreurApi,
    private val maintenantMillis: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    sealed interface Tour {
        /** Rien à suivre : plus de session, compte non livreur, fiche inactive ou livreur hors ligne. Le service s'arrête. */
        data object Arret : Tour

        /** Réseau coupé ou service indisponible : on garde le suivi et on réessaie au prochain tour. */
        data object Attente : Tour

        data class Suite(val etat: EtatLivreur) : Tour
    }

    private var position: Pair<Double, Double>? = null
    private var dernierEnvoi = 0L

    /** Appelé à chaque nouvelle mesure de position du téléphone. */
    fun positionMesuree(latitude: Double, longitude: Double) {
        position = latitude to longitude
    }

    suspend fun tour(): Tour {
        val jeton = session.jetonValide() ?: return Tour.Arret
        val etat = try {
            api.etat(jeton)
        } catch (_: ErreurReseau) {
            return Tour.Attente
        } ?: return Tour.Arret
        if (!etat.doitEtreSuivi) return Tour.Arret

        val p = position
        val maintenant = maintenantMillis()
        if (p != null && maintenant - dernierEnvoi >= INTERVALLE_POSITION_MS) {
            dernierEnvoi = maintenant
            try {
                api.position(jeton, p.first, p.second)
            } catch (_: ErreurReseau) {
                // Un envoi manqué n'est pas grave : le tour suivant renvoie la position.
            }
        }
        return Tour.Suite(etat)
    }

    companion object {
        const val INTERVALLE_POSITION_MS = 8_000L
        const val DELAI_TOUR_MS = 5_000L
    }
}
