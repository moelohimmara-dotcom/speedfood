package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
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

/** Une commande vue par le support : coordonnées TOUJOURS masquées par la base tant qu'elles ne sont pas révélées (motif + audit). */
@Serializable
data class CommandeSupport(
    val id: String,
    val reference: String = "",
    val restaurantNom: String = "",
    val restaurantId: String? = null,
    val statut: String = "",
    val mode: String = "",
    val clientNom: String = "",
    val telephoneAffiche: String = "",
    val adresseAffichee: String = "",
    val sousTotal: Int = 0,
    val fraisLivraisonEstime: Int = 0,
    val creeLe: String = "",
    val historique: List<EvenementSupport> = emptyList(),
    val propositions: List<PropositionSupport> = emptyList(),
) {
    val total: Int get() = sousTotal + fraisLivraisonEstime
}

@Serializable
data class EvenementSupport(val statutPrecedent: String? = null, val statutSuivant: String = "", val acteur: String = "", val horodatage: String = "")

@Serializable
data class PropositionSupport(
    val version: Int = 0,
    val sousTotalPrecedent: Int = 0,
    val nouveauSousTotal: Int = 0,
    val fraisLivraisonPrecedent: Int? = null,
    val nouveauxFraisLivraison: Int = 0,
    val conditionsModifiees: String? = null,
    val statut: String = "",
    val expireLe: String? = null,
    val creeLe: String = "",
    val reponduLe: String? = null,
)

/** Détail d'une commande pour le support : [transitions] = statuts possibles (règle du serveur, vide si le compte ne peut pas agir) ; [peutReveler] : droit de voir les coordonnées. */
@Serializable
data class DetailSupport(val commande: CommandeSupport, val transitions: List<String> = emptyList(), val peutReveler: Boolean = false)

@Serializable
data class CoordonneesClient(val telephone: String = "", val adresse: String = "", val devoilees: Boolean = false)

/** Libellé lisible d'un statut de commande (mêmes mots que le site). */
fun libelleStatutCommande(statut: String): String = when (statut) {
    "en_attente" -> "En attente"
    "acceptee" -> "Acceptée"
    "refusee" -> "Refusée"
    "prete" -> "Prête"
    "terminee" -> "Terminée"
    "annulee" -> "Annulée"
    "expiree" -> "Expirée"
    else -> statut
}

/** Filtres de statut proposés dans la recherche (« tous » en premier). */
val STATUTS_RECHERCHE = listOf("tous", "en_attente", "acceptee", "prete", "terminee", "refusee", "annulee")

@Serializable
private data class ReponseCommandesSupport(val ok: Boolean = false, val commandes: List<CommandeSupport> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseDetailSupport(val ok: Boolean = false, val commande: CommandeSupport? = null, val transitions: List<String> = emptyList(), val peutReveler: Boolean = false, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseCoordonnees(val ok: Boolean = false, val coordonnees: CoordonneesClient? = null, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class CorpsStatutSupport(val vers: String, val motif: String)

@Serializable
private data class CorpsMotif(val motif: String)

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

    /** Recherche de commandes (support). [statut] vaut « tous » ou un statut ; [reference] : début ou totalité de la référence. */
    suspend fun commandes(jetonAcces: String, reference: String, statut: String, jour: Boolean): List<CommandeSupport>

    /** Détail d'une commande (support), avec les statuts possibles et le droit de révéler les coordonnées. */
    suspend fun commande(jetonAcces: String, commandeId: String): DetailSupport

    /** Action de support sur le statut : motif obligatoire. Renvoie un message d'erreur lisible, ou null si c'est enregistré (et tracé). */
    suspend fun changerStatut(jetonAcces: String, commandeId: String, vers: String, motif: String): String?

    /** Révèle téléphone et adresse (motif obligatoire, tracé avant affichage). Lève [ErreurReseau]/[ErreurAcces] avec le message du serveur en cas de refus. */
    suspend fun reveler(jetonAcces: String, commandeId: String, motif: String): CoordonneesClient
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

    override suspend fun commandes(jetonAcces: String, reference: String, statut: String, jour: Boolean): List<CommandeSupport> = appeler {
        val r = try {
            client.get(url("commandes")) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                parameter("statut", statut)
                if (reference.isNotBlank()) parameter("reference", reference.trim())
                if (jour) parameter("jour", "1")
            }.body<ReponseCommandesSupport>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Les commandes n'ont pas pu être chargées. Réessayez dans un instant.")
        r.commandes
    }

    override suspend fun commande(jetonAcces: String, commandeId: String): DetailSupport = appeler {
        val r = try {
            client.get(url("commandes/$commandeId")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseDetailSupport>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        val commande = r.commande
        if (!r.ok || commande == null) refus(r.erreur, "Cette commande n'a pas pu être chargée. Réessayez dans un instant.")
        DetailSupport(commande, r.transitions, r.peutReveler)
    }

    override suspend fun changerStatut(jetonAcces: String, commandeId: String, vers: String, motif: String): String? = appeler {
        val reponse = client.post(url("commandes/$commandeId/statut")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsStatutSupport.serializer(), CorpsStatutSupport(vers, motif)))
        }
        val lu = try {
            reponse.body<ReponseActionEquipe>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état de la commande."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun reveler(jetonAcces: String, commandeId: String, motif: String): CoordonneesClient = appeler {
        val reponse = client.post(url("commandes/$commandeId/coordonnees")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsMotif.serializer(), CorpsMotif(motif)))
        }
        val r = try {
            reponse.body<ReponseCoordonnees>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        val coordonnees = r.coordonnees
        if (!r.ok || coordonnees == null) refus(r.erreur, "Les coordonnées n'ont pas pu être révélées.")
        coordonnees
    }
}
