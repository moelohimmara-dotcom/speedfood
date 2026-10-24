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
import io.ktor.serialization.JsonConvertException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * L'historique des commandes du restaurant, page par page.
 *
 * Une commande terminée est un fait passé : l'application la lit, elle ne la modifie pas. Le serveur ne renvoie ni le nom ni le téléphone du
 * client : un historique n'a pas besoin des coordonnées, et une commande vieille d'une semaine ne doit pas laisser traîner un numéro.
 */

/** Une commande de l'historique : ce qu'un restaurateur veut retrouver, sans les coordonnées du client. */
@Serializable
data class CommandeHistorique(
    val id: String = "",
    val reference: String = "",
    val statut: String = "",
    val mode: String = "retrait",
    val sousTotal: Int = 0,
    val fraisLivraisonEstime: Int = 0,
    val creeLe: String = "",
    val nbLignes: Int = 0,
) {
    val total: Int get() = sousTotal + fraisLivraisonEstime
}

/** Une page d'historique : les commandes de la page, le nombre total de commandes et la page suivante (null = dernière page). */
@Serializable
data class PageHistorique(
    val commandes: List<CommandeHistorique> = emptyList(),
    val page: Int = 1,
    val total: Int = 0,
    val pageSuivante: Int? = null,
)

/** Clé d'une commande de l'historique : espace de noms propre à cette liste. */
fun cleCommandeHistorique(id: String): String = "commande-$id"

/** Date et heure en clair : « 23/10/2026 à 18:20 ». Une date illisible est renvoyée telle quelle. */
fun dateHeureCommande(iso: String): String {
    if (iso.isBlank()) return ""
    val date = iso.substringBefore('T')
    val heure = iso.substringAfter('T', "").take(5)
    if (date.length != 10) return iso
    val jour = "${date.substring(8, 10)}/${date.substring(5, 7)}/${date.substring(0, 4)}"
    return if (heure.length == 5) "$jour à $heure" else jour
}

/** Résumé de l'historique affiché : « 12 commandes sur 87 ». */
fun resumeHistorique(chargees: Int, total: Int): String = "$chargees commandes sur $total"

/** Mode de retrait ou de livraison, en clair. */
fun libelleMode(mode: String): String = if (mode == "livraison") "Livraison" else "Retrait"

@Serializable
private data class ReponseHistorique(
    val ok: Boolean = false,
    val commandes: List<CommandeHistorique> = emptyList(),
    val page: Int = 1,
    val total: Int = 0,
    val pageSuivante: Int? = null,
    val erreur: ErreurServeur? = null,
)

@Serializable
private data class CorpsHistorique(val page: Int, val taille: Int)

interface HistoriqueRestaurateurApi {
    /** Une page de l'historique, la plus récente d'abord. [page] commence à 1. */
    suspend fun historique(jetonAcces: String, page: Int, taille: Int): PageHistorique
}

class KtorHistoriqueRestaurateurApi(private val client: HttpClient, private val config: SpeedfoodConfig) : HistoriqueRestaurateurApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/restaurant/$chemin"
    private val json = Json { encodeDefaults = true; explicitNulls = false }

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun historique(jetonAcces: String, page: Int, taille: Int): PageHistorique = appeler {
        val reponse = try {
            client.post(url("historique")) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                contentType(ContentType.Application.Json)
                // La page demandée est dans le corps de la requête : le serveur ne dépend d'aucun état de session pour la fenêtre demandée.
                setBody(json.encodeToString(CorpsHistorique.serializer(), CorpsHistorique(page, taille)))
            }.body<ReponseHistorique>()
        } catch (e: JsonConvertException) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!reponse.ok) {
            val message = reponse.erreur?.message ?: "Votre historique n'a pas pu être chargé. Réessayez dans un instant."
            if (reponse.erreur?.code == "NON_AUTHENTIFIE" || reponse.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        PageHistorique(reponse.commandes, reponse.page, reponse.total, reponse.pageSuivante)
    }
}
