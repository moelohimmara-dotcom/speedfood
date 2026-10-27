package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Quartier proposé comme destination de livraison (la lecture est publique). */
@Serializable
data class QuartierChoix(val id: String, val nom: String)

/**
 * Estimation des frais de livraison, calculée par le serveur (distance, réglages de la console). Informative : à l'envoi, le serveur recalcule tout et refuse si
 * les frais vus à l'écran diffèrent.
 */
sealed interface EstimationLivraison {
    /** Le calcul est éteint côté serveur : les frais se conviennent avec le restaurant (comme avant). */
    data object NonCalculee : EstimationLivraison

    data class Ok(val fraisGnf: Int, val distanceKm: Double, val gratuite: Boolean, val dureeMinutes: Int, val libelle: String) : EstimationLivraison

    data class Erreur(val message: String) : EstimationLivraison
}

interface LivraisonApi {
    suspend fun estimer(restaurantId: String, quartierId: String, sousTotal: Int, jetonAcces: String): EstimationLivraison
}

@Serializable
private data class CorpsEstimation(val restaurantId: String, val destination: DestinationQuartier, val sousTotal: Int)

@Serializable
private data class DestinationQuartier(val quartierId: String)

@Serializable
private data class EstimationBrute(
    val statut: String = "",
    val fraisGnf: Int = 0,
    val distanceKm: Double = 0.0,
    val gratuite: Boolean = false,
    val dureeMinutes: Int = 0,
    val libelle: String = "",
    val message: String = "",
)

@Serializable
private data class ReponseEstimation(val ok: Boolean = false, val estimation: EstimationBrute? = null, val erreur: ErreurServeur? = null)

class KtorLivraisonApi(private val client: HttpClient, private val config: SpeedfoodConfig) : LivraisonApi {
    override suspend fun estimer(restaurantId: String, quartierId: String, sousTotal: Int, jetonAcces: String): EstimationLivraison {
        val reponse = try {
            client.post("${config.siteUrl.trimEnd('/')}/api/v1/livraison/estimation") {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                contentType(ContentType.Application.Json)
                setBody(Json.encodeToString(CorpsEstimation.serializer(), CorpsEstimation(restaurantId, DestinationQuartier(quartierId), sousTotal)))
            }
        } catch (e: Exception) {
            throw erreurTechnique(e)
        }
        val corps = try {
            reponse.body<ReponseEstimation>()
        } catch (e: Exception) {
            return EstimationLivraison.Erreur("Le calcul de la livraison est momentanément indisponible.")
        }
        val e = corps.estimation
        return when {
            !corps.ok || e == null -> EstimationLivraison.Erreur(corps.erreur?.message ?: "Le calcul de la livraison est momentanément indisponible.")
            e.statut == "ok" -> EstimationLivraison.Ok(e.fraisGnf, e.distanceKm, e.gratuite, e.dureeMinutes, e.libelle)
            e.statut == "non_calcule" -> EstimationLivraison.NonCalculee
            else -> EstimationLivraison.Erreur(e.message.ifBlank { "Le calcul de la livraison est momentanément indisponible." })
        }
    }
}
