package com.speedfood.app.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.nullable
import kotlinx.serialization.json.Json
import kotlin.time.Clock

@Serializable
private data class EntreeCache<T>(val le: Long, val donnees: T)

@Serializable
private data class MenuEnCache(val sections: List<Section>, val plats: List<Plat>)

/**
 * Cache hors ligne des restaurants, fiches, menus et quartiers : chaque lecture réussie est gardée sur le téléphone ; quand le réseau est coupé, la dernière
 * lecture est rendue à la place d'une erreur, avec son ancienneté ([ageCache]) pour que l'écran dise « hors ligne ». Rien n'est gardé de personnel (que des données
 * publiques) et rien n'est envoyé : les commandes, elles, exigent toujours le réseau. Un cache de plus de [VALIDITE_MS] n'est plus servi.
 */
class RestaurantApiAvecCache(
    private val api: RestaurantApi,
    private val stockage: StockageLocal,
    private val maintenant: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) : RestaurantApi {
    private val json = Json { ignoreUnknownKeys = true }

    @kotlin.concurrent.Volatile
    private var age: Long? = null

    /** Ancienneté (en millisecondes) des données servies par la DERNIÈRE lecture si elles viennent du cache, sinon null (données fraîches). */
    override val ageCache: Long? get() = age

    private suspend fun <T> avecCache(cle: String, serializer: KSerializer<T>, lecture: suspend () -> T): T {
        val entree = EntreeCache.serializer(serializer)
        try {
            val frais = lecture()
            age = null
            try {
                stockage.ecrire(cle, json.encodeToString(entree, EntreeCache(maintenant(), frais)))
            } catch (_: Exception) {
                // Le cache est un confort : un échec d'écriture n'empêche jamais d'afficher les données fraîches.
            }
            return frais
        } catch (e: ErreurReseau) {
            val garde = stockage.lire(cle)?.let { runCatching { json.decodeFromString(entree, it) }.getOrNull() }
            if (garde == null || maintenant() - garde.le > VALIDITE_MS) throw e
            age = (maintenant() - garde.le).coerceAtLeast(0L)
            return garde.donnees
        }
    }

    override suspend fun lister(): List<Restaurant> = avecCache("cache_restaurants", ListSerializer(Restaurant.serializer())) { api.lister() }

    override suspend fun fiche(id: String): RestaurantFiche? {
        // Une fiche absente (null) est une réponse valable : elle n'est pas gardée, seul un échec réseau retombe sur le cache.
        val recue = RecueFiche(api, id)
        return avecCache("cache_fiche_$id", RestaurantFiche.serializer().nullable, recue::lire)
    }

    override suspend fun quartiers(): List<QuartierChoix> = avecCache("cache_quartiers", ListSerializer(QuartierChoix.serializer())) { api.quartiers() }

    override suspend fun menu(id: String): Menu {
        val garde = avecCache("cache_menu_$id", MenuEnCache.serializer()) { api.menu(id).let { MenuEnCache(it.sections, it.plats) } }
        return Menu(garde.sections, garde.plats)
    }

    private class RecueFiche(private val api: RestaurantApi, private val id: String) {
        suspend fun lire(): RestaurantFiche? = api.fiche(id)
    }

    companion object {
        /** Sept jours : au-delà, mieux vaut une erreur honnête qu'un menu d'il y a longtemps. */
        const val VALIDITE_MS = 7L * 24 * 3600 * 1000
    }
}
