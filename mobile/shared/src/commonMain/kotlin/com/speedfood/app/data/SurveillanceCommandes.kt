package com.speedfood.app.data

import kotlin.time.Clock
import kotlin.time.Instant

/**
 * Un tour de la surveillance des commandes, indépendant de l'écran : relit les commandes du restaurant et dit s'il faut alerter. Sur Android, un service au
 * premier plan répète ce tour tant que le restaurateur l'a demandé, application ouverte ou non ; la logique est ici pour être testée sans téléphone.
 *
 * Règles : une NOUVELLE commande à traiter déclenche une alerte ; tant qu'il en reste, un rappel revient toutes les [RAPPEL_MS] ; au démarrage, les commandes
 * déjà présentes ne sonnent pas (le restaurateur vient d'ouvrir l'application), sauf si l'une d'elles attend depuis plus de [RAPPEL_MS] (service relancé après une coupure).
 */
class SurveillanceCommandes(
    private val session: SessionService,
    private val api: RestaurateurApi,
    private val maintenantMillis: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    sealed interface Tour {
        /** Plus rien à surveiller : plus de session, accès refusé, ou restaurant fermé sans commande à traiter. Le service s'arrête. */
        data object Arret : Tour

        /** Réseau coupé ou service indisponible : on garde la surveillance et on réessaie au prochain tour. */
        data object Attente : Tour

        /** [aTraiter] : commandes qui attendent une réponse ; [nouvelles] : combien sont arrivées depuis le dernier tour ; [rappel] : l'alerte doit être répétée. */
        data class Suite(val aTraiter: List<CommandeRestaurateur>, val nouvelles: Int, val rappel: Boolean) : Tour {
            val alerter: Boolean get() = nouvelles > 0 || rappel
        }
    }

    private var connues: Set<String>? = null
    private var dernierSon = 0L

    suspend fun tour(): Tour {
        val jeton = session.jetonValide() ?: return Tour.Arret
        val etat = try {
            api.etat(jeton)
        } catch (_: ErreurAcces) {
            return Tour.Arret
        } catch (_: ErreurReseau) {
            return Tour.Attente
        }
        val aTraiter = classerCommandes(etat.commandes).aTraiter
        val r = etat.restaurant
        if (r != null && !r.ouvert && !r.accepteCommandes && aTraiter.isEmpty()) return Tour.Arret

        val maintenant = maintenantMillis()
        val ids = aTraiter.map { it.id }.toSet()
        val avant = connues
        connues = ids
        if (avant == null) {
            // Premier tour : on ne sonne que si une commande attend déjà depuis longtemps.
            val tropAncienne = aTraiter.any { attenteMillis(it, maintenant) >= RAPPEL_MS }
            dernierSon = if (tropAncienne) 0L else maintenant
            return if (tropAncienne) sonner(aTraiter, 0, maintenant) else Tour.Suite(aTraiter, 0, false)
        }
        val nouvelles = (ids - avant).size
        if (nouvelles > 0) return sonner(aTraiter, nouvelles, maintenant)
        if (ids.isNotEmpty() && maintenant - dernierSon >= RAPPEL_MS) return sonner(aTraiter, 0, maintenant)
        return Tour.Suite(aTraiter, 0, false)
    }

    private fun sonner(aTraiter: List<CommandeRestaurateur>, nouvelles: Int, maintenant: Long): Tour.Suite {
        dernierSon = maintenant
        return Tour.Suite(aTraiter, nouvelles, rappel = nouvelles == 0)
    }

    private fun attenteMillis(c: CommandeRestaurateur, maintenant: Long): Long = try {
        maintenant - Instant.parse(c.creeLe).toEpochMilliseconds()
    } catch (_: IllegalArgumentException) {
        0L
    }

    companion object {
        const val RAPPEL_MS = 60_000L
        const val DELAI_TOUR_MS = 10_000L
    }
}
