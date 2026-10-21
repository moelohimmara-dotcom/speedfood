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

@Serializable
data class RestaurantResume(val id: String = "", val nom: String = "", val ouvert: Boolean = false, val accepteCommandes: Boolean = false)

@Serializable
data class LigneApercu(val nom: String, val prix: Int = 0, val quantite: Int = 1, val options: List<OptionSuivie> = emptyList())

@Serializable
data class PropositionApercu(
    val id: String = "",
    val nouveauSousTotal: Int = 0,
    val nouveauxFraisLivraison: Int = 0,
    val conditionsModifiees: String? = null,
    val statut: String = "",
    val expireLe: String? = null,
)

/** Une commande vue par le restaurateur : coordonnées du client incluses (nécessaires pour appeler et livrer). */
@Serializable
data class CommandeRestaurateur(
    val id: String,
    val reference: String,
    val statut: String,
    val etatDerive: String = statut,
    val mode: String = "retrait",
    val tableNumero: String? = null,
    val clientNom: String = "",
    val clientTelephone: String = "",
    val clientAdresse: String? = null,
    val sousTotal: Int = 0,
    val fraisLivraisonEstime: Int = 0,
    val creeLe: String = "",
    val estTest: Boolean = false,
    val lignes: List<LigneApercu> = emptyList(),
    val propositionActive: PropositionApercu? = null,
) {
    val total: Int get() = sousTotal + fraisLivraisonEstime
}

@Serializable
data class EtatRestaurateur(val restaurant: RestaurantResume? = null, val commandes: List<CommandeRestaurateur> = emptyList())

/** Les commandes rangées par urgence, comme sur la console du site : ce qui attend une réponse d'abord. */
data class CommandesClassees(val aTraiter: List<CommandeRestaurateur>, val enCours: List<CommandeRestaurateur>, val historique: List<CommandeRestaurateur>)

/** « À traiter » : la plus ancienne en premier (c'est celle qui attend depuis le plus longtemps) ; « en cours » et historique : les plus récentes en premier. */
fun classerCommandes(commandes: List<CommandeRestaurateur>): CommandesClassees = CommandesClassees(
    aTraiter = commandes.filter { it.etatDerive == "en_attente" }.sortedBy { it.creeLe },
    enCours = commandes.filter { it.etatDerive in setOf("attente_confirmation_client", "acceptee", "prete") }.sortedByDescending { it.creeLe },
    historique = commandes.filter { it.etatDerive in setOf("terminee", "refusee", "annulee") }.sortedByDescending { it.creeLe },
)

/** Action du restaurateur sur une commande : [code] est celui du serveur ; [destructive] demande une confirmation avant l'envoi. */
data class ActionCommande(val code: String, val libelle: String, val destructive: Boolean = false)

/**
 * Actions proposées d'après l'état d'une commande (même enchaînement que le serveur, qui revérifie toujours) : en attente → accepter / refuser / proposer ;
 * acceptée → prête ; prête → terminée ; toute commande non terminée peut être annulée. Pendant une proposition au client, seule l'annulation reste possible.
 */
fun actionsPossibles(c: CommandeRestaurateur): List<ActionCommande> = when (c.etatDerive) {
    "en_attente" -> listOf(ActionCommande("accepter", "Accepter"), ActionCommande("refuser", "Refuser", destructive = true))
    "acceptee" -> listOf(ActionCommande("prete", "Elle est prête"), ActionCommande("annuler", "Annuler", destructive = true))
    "prete" -> listOf(ActionCommande("terminee", "Remise au client"), ActionCommande("annuler", "Annuler", destructive = true))
    "attente_confirmation_client" -> listOf(ActionCommande("annuler", "Annuler", destructive = true))
    else -> emptyList()
}

fun peutProposer(c: CommandeRestaurateur): Boolean = c.etatDerive == "en_attente"

@Serializable
private data class ReponseCommandesResto(val ok: Boolean = false, val restaurant: RestaurantResume? = null, val commandes: List<CommandeRestaurateur> = emptyList(), val erreur: ErreurServeur? = null)

@Serializable
private data class ReponseActionResto(val ok: Boolean = false, val erreur: ErreurServeur? = null)

@Serializable
private data class CorpsActionResto(val commandeId: String, val action: String)

@Serializable
private data class CorpsPropositionResto(val commandeId: String, val nouveauSousTotal: Int, val nouveauxFraisLivraison: Int, val conditionsModifiees: String? = null)

@Serializable
private data class CorpsStatutResto(val champ: String, val valeur: Boolean)

interface RestaurateurApi {
    /** Commandes du restaurant du compte. Lève [ErreurReseau] avec le message du serveur si l'accès est refusé (compte non restaurateur, double authentification...). */
    suspend fun etat(jetonAcces: String): EtatRestaurateur

    /** Chaque action renvoie un message d'erreur lisible, ou null si elle est enregistrée. */
    suspend fun agir(jetonAcces: String, commandeId: String, action: String): String?
    suspend fun proposer(jetonAcces: String, commandeId: String, nouveauSousTotal: Int, nouveauxFraisLivraison: Int, conditions: String?): String?
    suspend fun definirStatut(jetonAcces: String, champ: String, valeur: Boolean): String?
}

class KtorRestaurateurApi(private val client: HttpClient, private val config: SpeedfoodConfig) : RestaurateurApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/restaurant/$chemin"
    private val json = Json { encodeDefaults = true; explicitNulls = false }

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun etat(jetonAcces: String): EtatRestaurateur = appeler {
        val reponse = client.get(url("commandes")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseCommandesResto>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "Vos commandes n'ont pas pu être chargées. Réessayez dans un instant.")
        EtatRestaurateur(corps.restaurant, corps.commandes)
    }

    private suspend fun action(chemin: String, jetonAcces: String, corps: String): String? = appeler {
        val reponse = client.post(url(chemin)) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps)
        }
        val lu = try {
            reponse.body<ReponseActionResto>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Vérifiez l'état de la commande puis réessayez."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun agir(jetonAcces: String, commandeId: String, action: String) =
        action("commandes/action", jetonAcces, json.encodeToString(CorpsActionResto.serializer(), CorpsActionResto(commandeId, action)))

    override suspend fun proposer(jetonAcces: String, commandeId: String, nouveauSousTotal: Int, nouveauxFraisLivraison: Int, conditions: String?) =
        action("commandes/proposition", jetonAcces, json.encodeToString(CorpsPropositionResto.serializer(), CorpsPropositionResto(commandeId, nouveauSousTotal, nouveauxFraisLivraison, conditions?.takeIf { it.isNotBlank() })))

    override suspend fun definirStatut(jetonAcces: String, champ: String, valeur: Boolean) =
        action("statut", jetonAcces, json.encodeToString(CorpsStatutResto.serializer(), CorpsStatutResto(champ, valeur)))
}

/** Alerte de nouvelle commande : sonnerie du téléphone tant que la console est ouverte (alerte application fermée : lot N5, notifications poussées). */
interface AlerteCommande {
    fun sonner()

    /** Garde l'écran allumé pendant que la console est ouverte : un restaurateur ne doit pas rater une commande parce que l'écran s'est éteint. */
    fun garderEcranAllume(actif: Boolean)
}

class AlerteIndisponible : AlerteCommande {
    override fun sonner() = Unit
    override fun garderEcranAllume(actif: Boolean) = Unit
}
