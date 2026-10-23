package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Établissements (équipe) : l'équipe voit la fiche d'un restaurant, son état de publication, son menu et modifie seulement ce qui est sans
 * risque (horaires d'ouverture et numéro interne à joindre). Publier, suspendre, corriger, créer ou supprimer un établissement reste sur le
 * site : ces décisions changent ce que voient les clients.
 */
@Serializable
data class PlatEquipe(
    val id: String = "",
    val nom: String = "",
    /** Prix en francs guinéens : le franc n'a pas de décimale, le montant est toujours entier. */
    val prix: Int = 0,
    val disponible: Boolean = false,
    val etat: String = "",
)

@Serializable
data class RestaurantEquipe(
    val id: String = "",
    val nom: String = "",
    val categorie: String = "",
    val quartier: String = "",
    /** L'établissement est-il visible par les clients ? (lecture seule : la publication reste sur le site) */
    val publie: Boolean = false,
    /** L'établissement accepte-t-il des commandes ? */
    val ouvert: Boolean = false,
    val suspendu: Boolean = false,
    val motifCorrection: String? = null,
    /** « autonome » (le restaurateur tient sa page) ou « speedfood » (l'équipe tient le catalogue) */
    val modeVente: String = "autonome",
    val horaires: String = "",
    val consignes: String = "",
    /** Numéro interne à joindre pour confirmer les commandes (jamais public). */
    val telephoneCommandes: String? = null,
    val plats: Int = 0,
    val platsDisponibles: Int = 0,
    /** Détail du menu : uniquement renvoyé par la fiche. */
    val platsDetail: List<PlatEquipe> = emptyList(),
)

/** États possibles d'un plat, tels que renvoyés par le serveur. */
enum class EtatPlatEquipe(val code: String, val libelle: String) {
    Disponible("disponible", "Disponible"),
    AConfirmer("a_confirmer", "À confirmer"),
    Epuise("epuise", "Épuisé"),
}

fun libelleEtatPlat(code: String): String = EtatPlatEquipe.entries.firstOrNull { it.code == code }?.libelle ?: code.replace('_', ' ')

/** Un établissement est visible par les clients quand il est publié et non suspendu. */
fun visibleParLesClients(r: RestaurantEquipe): Boolean = r.publie && !r.suspendu

/** Le restaurant a un numéro interne à joindre pour confirmer les commandes. */
fun aNumeroAJoindre(r: RestaurantEquipe): Boolean = !r.telephoneCommandes.isNullOrBlank()

@Serializable
private data class ErreurRestaurant(val code: String = "", val message: String = "")

@Serializable
private data class ReponseRestaurantsEquipe(val ok: Boolean = false, val restaurants: List<RestaurantEquipe> = emptyList(), val erreur: ErreurRestaurant? = null)

@Serializable
private data class ReponseFiche(val ok: Boolean = false, val restaurant: RestaurantEquipe? = null, val erreur: ErreurRestaurant? = null)

@Serializable
private data class ReponseProfil(val ok: Boolean = false, val message: String = "", val erreur: ErreurRestaurant? = null)

interface RestaurantsEquipeApi {
    suspend fun restaurants(jetonAcces: String): List<RestaurantEquipe>

    suspend fun fiche(jetonAcces: String, id: String): RestaurantEquipe

    /** Renvoie null si l'enregistrement passe, sinon le message d'erreur lisible. */
    suspend fun enregistrerProfil(jetonAcces: String, id: String, horaires: String, telephone: String): String?
}

class KtorRestaurantsEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : RestaurantsEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/restaurants$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun restaurants(jetonAcces: String): List<RestaurantEquipe> = appeler {
        val r = try {
            client.get(url("")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseRestaurantsEquipe>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les établissements n'ont pas pu être chargés. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        r.restaurants
    }

    override suspend fun fiche(jetonAcces: String, id: String): RestaurantEquipe = appeler {
        val r = try {
            client.get(url("/$id")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseFiche>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "La fiche n'a pas pu être chargée. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        r.restaurant ?: throw ErreurReseau("Établissement introuvable.")
    }

    override suspend fun enregistrerProfil(jetonAcces: String, id: String, horaires: String, telephone: String): String? = appeler {
        val corps = JsonObject(mapOf("horaires" to JsonPrimitive(horaires), "telephone" to JsonPrimitive(telephone)))
        val reponse = client.post(url("/$id/profil")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps.toString())
        }
        val lu = try {
            reponse.body<ReponseProfil>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel."
        }
        if (lu.ok) null else lu.erreur?.message ?: "La modification n'a pas pu être enregistrée. Réessayez dans un instant."
    }
}
