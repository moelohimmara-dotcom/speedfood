package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

@Serializable
data class ClientCommande(val nom: String, val telephone: String, val adresse: String? = null)

@Serializable
data class LigneEnvoyee(val menuItemId: String, val quantite: Int, val optionIds: List<String> = emptyList())

/**
 * Commande envoyée au serveur (`POST /api/v1/commandes`). Aucun prix n'est envoyé comme prix : seuls l'identifiant du plat, la quantité et les suppléments
 * choisis comptent ; `sousTotalAffiche` n'est que le total vu à l'écran, comparé au total recalculé par le serveur (écart = commande refusée, rien n'est créé).
 */
@Serializable
data class DestinationEnvoyee(val quartierId: String)

@Serializable
data class CreationCommande(
    val cleIdempotence: String,
    val restaurantId: String,
    val client: ClientCommande,
    val mode: String,
    val lignes: List<LigneEnvoyee>,
    val sousTotalAffiche: Int,
    val consentementReglement: Boolean,
    /** Livraison seulement : le quartier choisi (le serveur en déduit distance et frais). */
    val destination: DestinationEnvoyee? = null,
    /** Livraison seulement : frais vus à l'écran, comparés au calcul du serveur (jamais utilisés comme prix). */
    val fraisAffiches: Int? = null,
)

@Serializable
data class ErreurServeur(val code: String = "ERREUR_SERVEUR", val message: String = "Une erreur est survenue.", val champs: Map<String, String>? = null)

@Serializable
private data class ReponseCreation(val ok: Boolean = false, val reference: String? = null, val jeton: String? = null, val idempotent: Boolean = false, val erreur: ErreurServeur? = null)

/** Résultat d'une commande : créée (référence et jeton de suivi) ou refusée avec un message lisible. */
sealed interface ResultatCommande {
    data class Creee(val reference: String, val jeton: String, val dejaEnvoyee: Boolean) : ResultatCommande
    data class Refusee(val message: String, val code: String) : ResultatCommande
}

@Serializable
data class OptionSuivie(val nom: String, val prix: Int = 0)

@Serializable
data class LigneSuivie(val nom: String, val prix: Int = 0, val quantite: Int = 1, val options: List<OptionSuivie> = emptyList())

@Serializable
data class RestaurantSuivi(val id: String = "", val nom: String = "", val horaires: String = "", val consignes: String? = null, val ouvert: Boolean = false)

@Serializable
data class PropositionSuivie(
    val id: String = "",
    val nouveauSousTotal: Int = 0,
    val nouveauxFraisLivraison: Int = 0,
    val conditionsModifiees: String? = null,
    val expireLe: String? = null,
)

@Serializable
data class EvenementSuivi(val statutSuivant: String = "", val horodatage: String = "")

/** Suivi d'une commande : volontairement sans téléphone ni adresse (le serveur n'en envoie pas). */
@Serializable
data class SuiviCommande(
    val reference: String,
    val statut: String,
    val etatDerive: String = statut,
    val mode: String = "retrait",
    val creeLe: String = "",
    val restaurant: RestaurantSuivi = RestaurantSuivi(),
    val lignes: List<LigneSuivie> = emptyList(),
    val sousTotal: Int = 0,
    val fraisLivraisonEstime: Int = 0,
    val propositionActive: PropositionSuivie? = null,
    val historiqueStatuts: List<EvenementSuivi> = emptyList(),
) {
    val total: Int get() = sousTotal + fraisLivraisonEstime
}

@Serializable
private data class ReponseSuivi(val ok: Boolean = false, val suivi: SuiviCommande? = null, val erreur: ErreurServeur? = null)

/** Commande passée depuis cet appareil : la référence et le jeton de suivi reçus à la création (seul moyen d'ouvrir le suivi). */
@Serializable
data class CommandeLocale(
    val reference: String,
    val jeton: String,
    val restaurantNom: String,
    val creeLe: Long,
    val total: Int,
    /** Pour « commander à nouveau » : le restaurant et les lignes envoyées (absents des commandes enregistrées avant cette version). */
    val restaurantId: String = "",
    val lignes: List<LigneEnvoyee> = emptyList(),
    val mode: String = "retrait",
)

/** Commande du compte lue sur le serveur (historique, même après une réinstallation) ; le jeton ouvre son suivi. */
@Serializable
data class CommandeServeur(
    val reference: String,
    val jeton: String = "",
    val restaurantId: String = "",
    val restaurantNom: String = "Restaurant",
    val mode: String = "retrait",
    val statut: String = "",
    val totalGnf: Int = 0,
    val creeLe: String = "",
)

@Serializable
private data class ReponseListe(val ok: Boolean = false, val commandes: List<CommandeServeur> = emptyList(), val erreur: ErreurServeur? = null)

interface CommandeApi {
    suspend fun creer(commande: CreationCommande, jetonAcces: String): ResultatCommande
    suspend fun suivi(jeton: String): SuiviCommande?

    /** Commandes du compte connecté, les plus récentes d'abord (50 au plus). */
    suspend fun lister(jetonAcces: String): List<CommandeServeur>

    /** Réponse à la proposition révisée du restaurant (accepter ou refuser). Renvoie un message d'erreur lisible, ou null si la réponse est enregistrée. */
    suspend fun repondreProposition(jeton: String, propositionId: String, accepter: Boolean): String?

    /**
     * Annule la commande (possible seulement tant que le restaurant n'a pas répondu ; le serveur refuse sinon, avec un message à afficher tel quel). Renvoie un message d'erreur
     * lisible, ou null si la commande est annulée (une commande déjà annulée répond aussi « ok »).
     */
    suspend fun annuler(jeton: String): String?
}

/** Les champs absents (adresse, destination, frais en retrait) ne sont pas envoyés : le serveur refuse un `null` là où il attend un nombre. */
private val jsonEnvoi = Json { encodeDefaults = true; explicitNulls = false }

/** Clé d'idempotence d'une soumission : un identifiant aléatoire (UUID v4) ; la renvoyer ne crée jamais une seconde commande. */
@OptIn(ExperimentalUuidApi::class)
fun nouvelleCleIdempotence(): String = Uuid.random().toString()

class KtorCommandeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : CommandeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun creer(commande: CreationCommande, jetonAcces: String): ResultatCommande = appeler {
        val reponse: HttpResponse = client.post(url("commandes")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(jsonEnvoi.encodeToString(CreationCommande.serializer(), commande))
        }
        val corps = try {
            reponse.body<ReponseCreation>()
        } catch (e: Exception) {
            return@appeler ResultatCommande.Refusee("La réponse de Speedfood est illisible. Votre commande n'est peut-être pas partie : consultez « Mes commandes » avant de réessayer.", "ERREUR_SERVEUR")
        }
        if (corps.ok && corps.reference != null && corps.jeton != null) ResultatCommande.Creee(corps.reference, corps.jeton, corps.idempotent)
        else ResultatCommande.Refusee(corps.erreur?.message ?: "Votre commande n'a pas pu être envoyée. Réessayez dans un instant.", corps.erreur?.code ?: "ERREUR_SERVEUR")
    }

    override suspend fun lister(jetonAcces: String): List<CommandeServeur> = appeler {
        val reponse = client.get(url("commandes")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseListe>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "Vos commandes n'ont pas pu être chargées. Réessayez dans un instant.")
        corps.commandes
    }

    override suspend fun suivi(jeton: String): SuiviCommande? = appeler {
        val reponse = client.post(url("suivi")) {
            contentType(ContentType.Application.Json)
            setBody("""{"jeton":"$jeton"}""")
        }
        val corps = try {
            reponse.body<ReponseSuivi>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        corps.suivi
    }

    override suspend fun repondreProposition(jeton: String, propositionId: String, accepter: Boolean): String? = appeler {
        val reponse = client.post(url("suivi/proposition")) {
            contentType(ContentType.Application.Json)
            setBody(Json.encodeToString(CorpsProposition.serializer(), CorpsProposition(jeton, propositionId, if (accepter) "acceptee" else "refusee")))
        }
        val corps = try {
            reponse.body<ReponseSimple>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Réessayez dans un instant."
        }
        if (corps.ok) null else corps.erreur?.message ?: "Votre réponse n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun annuler(jeton: String): String? = appeler {
        val reponse = client.post(url("suivi/annuler")) {
            contentType(ContentType.Application.Json)
            setBody(Json.encodeToString(CorpsAnnulation.serializer(), CorpsAnnulation(jeton)))
        }
        val corps = try {
            reponse.body<ReponseSimple>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Réessayez dans un instant."
        }
        if (corps.ok) null else corps.erreur?.message ?: "L'annulation n'a pas pu être enregistrée. Réessayez dans un instant."
    }
}

@Serializable
private data class CorpsAnnulation(val jeton: String)

@Serializable
private data class CorpsProposition(val jeton: String, val propositionId: String, val reponse: String)

@Serializable
private data class ReponseSimple(val ok: Boolean = false, val erreur: ErreurServeur? = null)

/** Commandes passées depuis cet appareil, les plus récentes d'abord ; 50 au plus. Conservées dans le stockage local. */
class CommandesLocales(private val stockage: StockageLocal) {
    fun lister(): List<CommandeLocale> =
        stockage.lire(CLE)?.let {
            try {
                Json.decodeFromString<List<CommandeLocale>>(it)
            } catch (_: Exception) {
                emptyList()
            }
        } ?: emptyList()

    fun ajouter(commande: CommandeLocale) {
        val liste = (listOf(commande) + lister().filterNot { it.reference == commande.reference }).take(MAX)
        stockage.ecrire(CLE, Json.encodeToString(liste))
    }

    fun oublier() = stockage.effacer(CLE)

    companion object {
        const val CLE = "commandes"
        const val MAX = 50
    }
}
