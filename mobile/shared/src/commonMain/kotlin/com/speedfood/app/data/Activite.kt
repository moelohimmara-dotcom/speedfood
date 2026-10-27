package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import kotlinx.serialization.Serializable

/** Activité du restaurant (onglet « Activité » de l'espace restaurateur) : commandes et chiffre d'aujourd'hui et des 7 derniers jours. Chiffre = plats des commandes terminées. */
@Serializable
data class JourRestaurant(val recues: Int = 0, val terminees: Int = 0, val chiffreGnf: Int = 0)

@Serializable
data class RepartitionCommandes(val recues: Int = 0, val terminees: Int = 0, val refusees: Int = 0, val annulees: Int = 0, val enCours: Int = 0)

@Serializable
data class CommandeRecente(val reference: String = "", val mode: String = "", val totalGnf: Int = 0, val creeLe: String = "")

@Serializable
data class ActiviteRestaurant(
    val aujourdhui: JourRestaurant = JourRestaurant(),
    val semaine: JourRestaurant = JourRestaurant(),
    val repartition: RepartitionCommandes = RepartitionCommandes(),
    val recentes: List<CommandeRecente> = emptyList(),
)

/** Courses du livreur (onglet « Gains »). Le montant est le frais de livraison de la course, pas une paie : la règle de rémunération n'existe pas encore. */
@Serializable
data class JourLivreur(val courses: Int = 0, val fraisGnf: Int = 0)

@Serializable
data class CourseLivree(val id: String = "", val reference: String = "", val restaurantNom: String = "", val fraisGnf: Int = 0, val livreeLe: String? = null)

@Serializable
data class GainsLivreur(val aujourdhui: JourLivreur = JourLivreur(), val semaine: JourLivreur = JourLivreur(), val recentes: List<CourseLivree> = emptyList())

@Serializable
private data class ErreurActivite(val code: String = "", val message: String = "")

@Serializable
private data class ReponseActiviteResto(
    val ok: Boolean = false,
    val aujourdhui: JourRestaurant = JourRestaurant(),
    val semaine: JourRestaurant = JourRestaurant(),
    val repartition: RepartitionCommandes = RepartitionCommandes(),
    val recentes: List<CommandeRecente> = emptyList(),
    val erreur: ErreurActivite? = null,
)

@Serializable
private data class ReponseGains(val ok: Boolean = false, val gains: GainsLivreur? = null, val erreur: ErreurActivite? = null)

interface ActiviteApi {
    suspend fun restaurant(jetonAcces: String): ActiviteRestaurant

    /** Null si ce compte n'est pas un compte livreur. */
    suspend fun livreur(jetonAcces: String): GainsLivreur?
}

class KtorActiviteApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ActiviteApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    private fun refus(erreur: ErreurActivite?, defaut: String): Nothing {
        val message = erreur?.message ?: defaut
        if (erreur?.code == "NON_AUTHENTIFIE" || erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
        throw ErreurReseau(message)
    }

    override suspend fun restaurant(jetonAcces: String): ActiviteRestaurant = appeler {
        val r = try {
            client.get(url("restaurant/activite")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseActiviteResto>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "L'activité n'a pas pu être chargée. Réessayez dans un instant.")
        ActiviteRestaurant(r.aujourdhui, r.semaine, r.repartition, r.recentes)
    }

    override suspend fun livreur(jetonAcces: String): GainsLivreur? = appeler {
        val r = try {
            client.get(url("livreur/gains")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseGains>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Vos courses n'ont pas pu être chargées. Réessayez dans un instant.")
        r.gains
    }
}
