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
    /** Restaurants publiés (hors données de démonstration), du plus proche de A à Z. Au plus [LIMITE] lignes. */
    suspend fun lister(): List<Restaurant>

    companion object {
        const val LIMITE = 100
    }
}

/**
 * Lecture anonyme de l'API REST de la base (PostgREST), comme le fait le site avec `creerClientPublic` : la visibilité des lignes est
 * entièrement décidée par la RLS (« lecture_publique_restaurants_publies »), pas par ce code.
 */
class KtorRestaurantApi(
    private val client: HttpClient,
    private val config: SpeedfoodConfig,
) : RestaurantApi {

    override suspend fun lister(): List<Restaurant> {
        if (!config.estComplete) throw ErreurReseau("L'application n'est pas configurée (adresse ou clé publique manquante).")
        val reponse: HttpResponse = try {
            client.get("${config.supabaseUrl.trimEnd('/')}/rest/v1/restaurants") {
                header("apikey", config.supabaseAnonKey)
                header(HttpHeaders.Authorization, "Bearer ${config.supabaseAnonKey}")
                parameter(
                    "select",
                    "id,nom,horaires,ouvert,accepte_commandes,statut_mis_a_jour_le,photo_url,logo_url,couleur_accent,code_court,avis_somme,avis_total," +
                        "quartier:neighborhoods!quartier_id(nom)",
                )
                parameter("donnees_demo", "eq.false")
                parameter("order", "nom.asc")
                parameter("limit", RestaurantApi.LIMITE)
            }
        } catch (e: Exception) {
            throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
        }
        if (!reponse.status.isSuccess()) {
            throw ErreurReseau("Speedfood ne répond pas comme prévu (code ${reponse.status.value}). Réessayez dans un instant.")
        }
        return try {
            reponse.body<List<Restaurant>>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
    }
}
