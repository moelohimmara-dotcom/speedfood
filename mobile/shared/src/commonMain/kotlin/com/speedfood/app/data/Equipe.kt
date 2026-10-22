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
import kotlinx.serialization.json.Json

/** Une section de l'espace admin (même chemin que sur le site) ; [natif] : elle a son écran dans l'application, sinon elle s'ouvre sur le site. */
@Serializable
data class EntreeMenuEquipe(val chemin: String, val libelle: String, val natif: Boolean = false)

@Serializable
data class GroupeMenuEquipe(val libelle: String, val entrees: List<EntreeMenuEquipe> = emptyList())

/** Rôle et menu de la personne connectée dans l'équipe Speedfood : déjà filtrés par permission côté serveur. */
@Serializable
data class AccesEquipe(val role: String = "", val permissions: List<String> = emptyList(), val groupes: List<GroupeMenuEquipe> = emptyList())

@Serializable
data class LigneEquipe(val nom: String = "", val quantite: Int = 1)

/** Une commande d'un établissement tenu par l'équipe, à faire avancer depuis le poste de répartition. */
@Serializable
data class CommandeEquipe(
    val id: String,
    val reference: String = "",
    val statut: String = "",
    val mode: String = "",
    val sousTotal: Int = 0,
    val fraisLivraison: Int = 0,
    val creeLe: String = "",
    val estTest: Boolean = false,
    val restaurantId: String = "",
    val restaurantNom: String = "",
    val telephoneRestaurant: String? = null,
    val lignes: List<LigneEquipe> = emptyList(),
) {
    val total: Int get() = sousTotal + fraisLivraison
}

/** Une action possible sur une commande : [code] est celui du serveur, [libelle] ce qui s'affiche, [destructive] pour les confirmer d'un cran de plus. */
data class ActionEquipe(val code: String, val libelle: String, val destructive: Boolean = false)

/** Les mêmes actions que le poste de répartition du site, selon le statut. */
fun actionsEquipe(statut: String): List<ActionEquipe> = when (statut) {
    "en_attente" -> listOf(
        ActionEquipe("accepter", "Confirmée par le restaurant"),
        ActionEquipe("refuser", "Refusée par le restaurant", destructive = true),
        ActionEquipe("annuler", "Annuler", destructive = true),
    )
    "acceptee" -> listOf(ActionEquipe("prete", "Prête"), ActionEquipe("annuler", "Annuler", destructive = true))
    "prete" -> listOf(ActionEquipe("terminee", "Remise au client"))
    else -> emptyList()
}

/** Numéro composable (chiffres et « + » seulement) ; null s'il n'y a rien à appeler. */
fun numeroAppel(brut: String?): String? = brut?.filter { it.isDigit() || it == '+' }?.takeIf { it.length >= 6 }

@Serializable
private data class ErreurServeurEquipe(val code: String = "", val message: String = "")

@Serializable
private data class ReponseMoi(val ok: Boolean = false, val role: String = "", val permissions: List<String> = emptyList(), val groupes: List<GroupeMenuEquipe> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseRepartition(val ok: Boolean = false, val commandes: List<CommandeEquipe> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseActionEquipe(val ok: Boolean = false, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class CorpsActionEquipe(val commandeId: String, val action: String)

interface EquipeApi {
    /** Rôle et menu du compte. Lève [ErreurAcces] si le compte n'a aucun rôle dans l'équipe (ou si son accès est refusé), [ErreurReseau] sinon. */
    suspend fun moi(jetonAcces: String): AccesEquipe

    /** Commandes actives des établissements tenus par l'équipe (poste de répartition). */
    suspend fun repartition(jetonAcces: String): List<CommandeEquipe>

    /** Fait avancer une commande. Renvoie un message d'erreur lisible, ou null si c'est enregistré. */
    suspend fun agir(jetonAcces: String, commandeId: String, action: String): String?
}

class KtorEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : EquipeApi {
    private val json = Json { encodeDefaults = true; explicitNulls = false }
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    private fun refus(erreur: ErreurServeurEquipe?, defaut: String): Nothing {
        val message = erreur?.message ?: defaut
        if (erreur?.code == "NON_AUTHENTIFIE" || erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
        throw ErreurReseau(message)
    }

    override suspend fun moi(jetonAcces: String): AccesEquipe = appeler {
        val r = try {
            client.get(url("moi")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseMoi>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Votre accès n'a pas pu être vérifié. Réessayez dans un instant.")
        AccesEquipe(r.role, r.permissions, r.groupes)
    }

    override suspend fun repartition(jetonAcces: String): List<CommandeEquipe> = appeler {
        val r = try {
            client.get(url("repartition")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseRepartition>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Les commandes n'ont pas pu être chargées. Réessayez dans un instant.")
        r.commandes
    }

    override suspend fun agir(jetonAcces: String, commandeId: String, action: String): String? = appeler {
        val reponse = client.post(url("repartition/action")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsActionEquipe.serializer(), CorpsActionEquipe(commandeId, action)))
        }
        val lu = try {
            reponse.body<ReponseActionEquipe>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état de la commande."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }
}
