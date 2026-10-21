package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpHeaders
import io.ktor.http.isSuccess

/** Erreur lisible par l'utilisateur ; jamais de détail technique ni de clé dans le message. */
class ErreurReseau(message: String, cause: Throwable? = null) : Exception(message, cause)

interface RestaurantApi {
    /** Restaurants publiés (hors données de démonstration), de A à Z. Au plus [LIMITE] lignes. */
    suspend fun lister(): List<Restaurant>

    /** Fiche d'un restaurant publié, ou null s'il n'existe pas (ou n'est pas visible : la RLS décide). */
    suspend fun fiche(id: String): RestaurantFiche?

    /** Quartiers proposés pour la livraison, dans l'ordre d'affichage. Au plus [LIMITE_QUARTIERS] lignes. */
    suspend fun quartiers(): List<QuartierChoix>

    /** Menu d'un restaurant publié : sections, plats non archivés (avec leurs suppléments). */
    suspend fun menu(id: String): Menu

    companion object {
        const val LIMITE = 100
        const val LIMITE_PLATS = 500
        const val LIMITE_SECTIONS = 50
        const val LIMITE_QUARTIERS = 500
    }
}

/**
 * Lecture anonyme de l'API REST de la base (PostgREST), comme le fait le site avec `creerClientPublic` : la visibilité des lignes est
 * entièrement décidée par la RLS (« lecture_publique_restaurants_publies » et policies voisines), pas par ce code.
 */
class KtorRestaurantApi(
    private val client: HttpClient,
    private val config: SpeedfoodConfig,
) : RestaurantApi {

    private suspend fun lire(table: String, parametres: Map<String, Any>): HttpResponse {
        if (!config.estComplete) throw ErreurReseau("L'application n'est pas configurée (adresse ou clé publique manquante).")
        val reponse: HttpResponse = try {
            client.get("${config.supabaseUrl.trimEnd('/')}/rest/v1/$table") {
                header("apikey", config.supabaseAnonKey)
                header(HttpHeaders.Authorization, "Bearer ${config.supabaseAnonKey}")
                parametres.forEach { (cle, valeur) -> parameter(cle, valeur) }
            }
        } catch (e: Exception) {
            throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
        }
        if (!reponse.status.isSuccess()) {
            throw ErreurReseau("Speedfood ne répond pas comme prévu (code ${reponse.status.value}). Réessayez dans un instant.")
        }
        return reponse
    }

    private suspend inline fun <reified T> corps(reponse: HttpResponse): T = try {
        reponse.body<T>()
    } catch (e: Exception) {
        throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
    }

    override suspend fun lister(): List<Restaurant> = corps(
        lire(
            "restaurants",
            mapOf(
                "select" to "id,nom,horaires,ouvert,accepte_commandes,statut_mis_a_jour_le,photo_url,logo_url,couleur_accent,code_court,avis_somme,avis_total," +
                    "quartier:neighborhoods!quartier_id(nom),categorie:menu_categories!categorie_id(nom)",
                "donnees_demo" to "eq.false",
                "order" to "nom.asc",
                "limit" to RestaurantApi.LIMITE,
            ),
        )
    )

    override suspend fun fiche(id: String): RestaurantFiche? {
        if (!estIdentifiant(id)) return null
        val liste: List<RestaurantFiche> = corps(
            lire(
                "restaurants",
                mapOf(
                    "select" to "id,nom,horaires,consignes,ouvert,accepte_commandes,statut_mis_a_jour_le,photo_url,logo_url,moyens_paiement,accepte_sur_place," +
                        "livraison_mode,avis_somme,avis_total,quartier:neighborhoods!quartier_id(nom)",
                    "id" to "eq.$id",
                    "limit" to 1,
                ),
            )
        )
        return liste.firstOrNull()
    }

    override suspend fun quartiers(): List<QuartierChoix> =
        corps(lire("neighborhoods", mapOf("select" to "id,nom", "order" to "ordre.asc,nom.asc", "limit" to RestaurantApi.LIMITE_QUARTIERS)))

    override suspend fun menu(id: String): Menu {
        if (!estIdentifiant(id)) return Menu(emptyList(), emptyList())
        val sections: List<Section> = corps(
            lire(
                "menu_sections",
                mapOf("select" to "id,nom,position", "restaurant_id" to "eq.$id", "order" to "position.asc", "limit" to RestaurantApi.LIMITE_SECTIONS),
            )
        )
        val plats: List<Plat> = corps(
            lire(
                "menu_items",
                mapOf(
                    "select" to "id,nom,description,prix,prix_promo,disponible,disponibilite_confirmee_le,photo_url,section_id,menu_item_options(id,nom,prix,disponible)",
                    "restaurant_id" to "eq.$id",
                    "archive_le" to "is.null",
                    "order" to "cree_le.asc",
                    "limit" to RestaurantApi.LIMITE_PLATS,
                ),
            )
        )
        return Menu(sections, plats)
    }
}

/** Un identifiant de ligne est un UUID : tout autre texte n'est jamais envoyé au serveur (pas d'injection dans le filtre). */
internal fun estIdentifiant(valeur: String): Boolean =
    Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$").matches(valeur)
