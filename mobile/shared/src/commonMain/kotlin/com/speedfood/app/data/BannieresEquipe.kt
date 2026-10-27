package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.http.HttpHeaders
import io.ktor.serialization.JsonConvertException
import kotlinx.serialization.Serializable

/**
 * Les bannières diffusées sur les écrans publics, et la bibliothèque de médias (les images utilisées par ces bannières). Lecture seule :
 * créer, publier ou supprimer une bannière reste sur le site, parce qu'une bannière publiée change ce que voit le public.
 */
@Serializable
data class BanniereEquipe(
    val id: String = "",
    val titre: String = "",
    val texte: String = "",
    val lien: String? = null,
    /** `publie` ou `brouillon`. */
    val statut: String = "",
    /** Ordre d'affichage sur les écrans publics. */
    val ordre: Int = 0,
    val imageUrl: String? = null,
    val creeLe: String = "",
    val misAJourLe: String = "",
)

/** Filtre de statut des bannières, dans l'ordre du site. */
enum class StatutBanniereEquipe(val code: String, val libelle: String) {
    Toutes("tous", "Toutes"),
    Publiees("publie", "Publiées"),
    Brouillons("brouillon", "Brouillons"),
}

/** Un filtre inconnu retombe sur « Toutes » : jamais de valeur devinée. */
fun statutBanniereEquipeValide(code: String?): StatutBanniereEquipe =
    StatutBanniereEquipe.entries.firstOrNull { it.code == code } ?: StatutBanniereEquipe.Toutes

/** Libellé lisible du statut d'une bannière (la bannière elle-même, pas le filtre). */
fun libelleStatutBanniereEquipe(statut: String): String = when (statut) {
    "publie" -> "Publiée"
    "brouillon" -> "Brouillon"
    else -> statut
}

@Serializable
private data class ErreurBanniere(val code: String = "", val message: String = "")

@Serializable
private data class ReponseBannieresEquipe(
    val ok: Boolean = false,
    val bannieres: List<BanniereEquipe> = emptyList(),
    val tronque: Boolean = false,
    val erreur: ErreurBanniere? = null,
)

interface BannieresEquipeApi {
    /** Les bannières, filtrées par statut. */
    suspend fun bannieres(jetonAcces: String, statut: StatutBanniereEquipe): ResultatBannieresEquipe

    /** La bibliothèque de médias : les bannières qui ont une image. */
    suspend fun medias(jetonAcces: String): ResultatBannieresEquipe
}

/** Ce que l'application affiche : les bannières retenues, et si la liste est complète. */
data class ResultatBannieresEquipe(val bannieres: List<BanniereEquipe>, val tronque: Boolean)

class KtorBannieresEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : BannieresEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    private suspend fun lire(jetonAcces: String, chemin: String, statut: StatutBanniereEquipe?): ResultatBannieresEquipe = appeler {
        val r = try {
            client.get(url(chemin)) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                if (statut != null) parameter("statut", statut.code)
            }.body<ReponseBannieresEquipe>()
        } catch (e: JsonConvertException) {
            // La réponse est arrivée mais n'est pas lisible : on le dit comme ça. Une connexion impossible remonte plus haut et devient « Impossible de joindre Speedfood ».
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les bannières n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        ResultatBannieresEquipe(r.bannieres, r.tronque)
    }

    override suspend fun bannieres(jetonAcces: String, statut: StatutBanniereEquipe): ResultatBannieresEquipe =
        lire(jetonAcces, "bannieres", statut)

    override suspend fun medias(jetonAcces: String): ResultatBannieresEquipe = lire(jetonAcces, "medias", null)
}
