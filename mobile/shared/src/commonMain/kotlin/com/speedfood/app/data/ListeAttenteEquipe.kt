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
 * Liste d'attente (équipe) : les zones où des personnes attendent un restaurant (« prévenez-moi »). L'application n'affiche que des NOMBRES ;
 * aucun contact n'y passe. L'export CSV et la suppression des contacts (données personnelles, irréversibles) restent sur le site.
 */
@Serializable
data class ZoneAttenteEquipe(
    /** « region », « prefecture », « commune » ou « quartier ». */
    val niveau: String = "",
    val id: String = "",
    val nom: String = "",
    /** Où se trouve la zone (région, préfecture ou commune). */
    val contexte: String = "",
    val personnes: Int = 0,
    val prevenues: Int = 0,
    val derniere: String = "",
)

fun libelleNiveauAttenteEquipe(niveau: String): String = when (niveau) {
    "region" -> "Région"
    "prefecture" -> "Préfecture"
    "commune" -> "Commune"
    "quartier" -> "Quartier"
    else -> niveau
}

/** Combien de personnes de la zone n'ont pas encore été prévenues. */
fun nonPrevenuesEquipe(personnes: Int, prevenues: Int): Int = maxOf(0, personnes - prevenues)

/** La zone peut-elle encore être marquée comme prévenue ? */
fun zoneAMarquerPrevenueEquipe(personnes: Int, prevenues: Int): Boolean = nonPrevenuesEquipe(personnes, prevenues) > 0

/**
 * Ce qu'il reste à faire pour une zone : combien de personnes n'ont pas encore été prévenues, ou la confirmation que tout le monde l'a été.
 * Une zone entièrement prévenue n'a plus d'action possible : le bouton est alors inactif, et le texte l'explique.
 */
fun resumeZoneAttenteEquipe(personnes: Int, prevenues: Int): String {
    val restantes = nonPrevenuesEquipe(personnes, prevenues)
    return when {
        restantes > 0 -> "$restantes personne(s) pas encore prévenue(s)."
        personnes > 0 -> "Toutes les personnes de cette zone ont été prévenues."
        else -> "Personne n'attend dans cette zone."
    }
}

@Serializable
private data class ErreurAttente(val code: String = "", val message: String = "")

@Serializable
private data class ReponseZones(val ok: Boolean = false, val zones: List<ZoneAttenteEquipe> = emptyList(), val erreur: ErreurAttente? = null)

@Serializable
private data class ReponsePrevenue(val ok: Boolean = false, val erreur: ErreurAttente? = null)

interface ListeAttenteEquipeApi {
    suspend fun zones(jetonAcces: String): List<ZoneAttenteEquipe>

    /** Renvoie null si la zone est marquée comme prévenue, sinon le message d'erreur lisible. */
    suspend fun marquerPrevenue(jetonAcces: String, niveau: String, id: String): String?
}

class KtorListeAttenteEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ListeAttenteEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/liste-attente$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun zones(jetonAcces: String): List<ZoneAttenteEquipe> = appeler {
        val r = try {
            client.get(url("")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseZones>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les zones n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        r.zones
    }

    override suspend fun marquerPrevenue(jetonAcces: String, niveau: String, id: String): String? = appeler {
        val corps = JsonObject(mapOf("niveau" to JsonPrimitive(niveau), "id" to JsonPrimitive(id)))
        val reponse = client.post(url("/prevenue")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps.toString())
        }
        val lu = try {
            reponse.body<ReponsePrevenue>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel."
        }
        if (lu.ok) null else lu.erreur?.message ?: "La zone n'a pas pu être marquée. Réessayez dans un instant."
    }
}
