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
 * Demandes de référencement (équipe) : un établissement demande à rejoindre Speedfood ; l'équipe rappelle, visite, fait signer l'accord. Dans l'application : lire, appeler,
 * changer le statut. La création de la fiche et la suppression restent sur le site.
 */
@Serializable
data class DemandeReferencement(
    val id: String = "",
    val type: String = "",
    val organisation: String = "",
    val commune: String = "",
    val quartier: String = "",
    val indications: String? = null,
    val categories: String? = null,
    val specialites: String? = null,
    val responsable: String = "",
    val telephone: String = "",
    val statut: String = "",
    val etablissementCree: Boolean = false,
    val creeLe: String = "",
    /** Dossier déposé depuis l'application (null pour une demande du site). */
    val candidature: DossierCandidatureEquipe? = null,
)

/** Ce que l'équipe voit d'une candidature de l'application : de quoi décider, jamais de chemin de fichier ni d'identifiant de compte. */
@Serializable
data class DossierCandidatureEquipe(
    val horaires: String? = null,
    val moyensPaiement: List<String> = emptyList(),
    val services: List<String> = emptyList(),
    val nombrePlats: Int = 0,
    val avecLogo: Boolean = false,
    val avecPhoto: Boolean = false,
    val motifRefus: String? = null,
    /** Le compte du candidat peut être rattaché à l'établissement créé (il ne l'est pas encore). */
    val compteRattachable: Boolean = false,
    val compteRattache: Boolean = false,
)

/** Un choix de liste officielle (catégorie ou quartier) pour créer l'établissement. */
@Serializable
data class ChoixCreation(val id: String = "", val nom: String = "", val commune: String = "")

@Serializable
data class OptionsCreation(val categories: List<ChoixCreation> = emptyList(), val quartiers: List<ChoixCreation> = emptyList())

/** On peut créer l'établissement tant qu'aucun n'existe et que la demande n'est pas refusée (règle du serveur, répétée ici pour n'offrir que ce qui peut réussir). */
fun peutCreerEtablissement(d: DemandeReferencement): Boolean = !d.etablissementCree && d.statut != "creee" && d.statut != "refusee"

/** Quartiers dont le nom ou la commune contient [recherche] (sans tenir compte de la casse), au plus [max] : la liste complète est trop longue pour un téléphone. */
fun quartiersCorrespondants(quartiers: List<ChoixCreation>, recherche: String, max: Int = 8): List<ChoixCreation> {
    val q = recherche.trim()
    if (q.length < 2) return emptyList()
    return quartiers.filter { it.nom.contains(q, ignoreCase = true) || it.commune.contains(q, ignoreCase = true) }.take(max)
}

/** Statuts qu'on peut poser à la main, dans l'ordre du parcours. « Établissement créé » ne se pose que depuis le site. */
enum class StatutDemande(val code: String, val libelle: String) {
    Nouvelle("nouvelle", "Nouvelle"),
    Rappelee("rappelee", "Rappelée"),
    VisitePrevue("visite_prevue", "Visite prévue"),
    Accord("accord", "Accord signé"),
    Refusee("refusee", "Refusée"),
}

fun libelleStatutDemande(code: String): String = StatutDemande.entries.firstOrNull { it.code == code }?.libelle ?: if (code == "creee") "Établissement créé" else code

fun libelleTypeEtablissement(code: String): String = when (code) {
    "restaurant" -> "Restaurant"
    "maquis" -> "Maquis"
    "boulangerie" -> "Boulangerie"
    "traiteur" -> "Traiteur"
    else -> code.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

/** Statuts proposés pour une demande : tous sauf l'actuel ; aucun si l'établissement est déjà créé (la demande ne change plus). */
fun statutsProposes(d: DemandeReferencement): List<StatutDemande> =
    if (d.etablissementCree || d.statut == "creee") emptyList() else StatutDemande.entries.filter { it.code != d.statut }

/** Une demande « nouvelle » doit être rappelée sous 48 heures (règle de l'équipe). */
fun aRappeler(d: DemandeReferencement): Boolean = d.statut == "nouvelle"

@Serializable
private data class ErreurReferencement(val code: String = "", val message: String = "")

@Serializable
private data class ReponseDemandes(val ok: Boolean = false, val demandes: List<DemandeReferencement> = emptyList(), val erreur: ErreurReferencement? = null)

@Serializable
private data class ReponseStatut(val ok: Boolean = false, val erreur: ErreurReferencement? = null)

@Serializable
private data class ReponseOptions(val ok: Boolean = false, val categories: List<ChoixCreation> = emptyList(), val quartiers: List<ChoixCreation> = emptyList(), val erreur: ErreurReferencement? = null)

interface ReferencementsEquipeApi {
    suspend fun demandes(jetonAcces: String): List<DemandeReferencement>

    /** Renvoie null si le statut est enregistré, sinon le message d'erreur lisible. [motif] n'a de sens que pour un refus : le candidat le lit dans l'application. */
    suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutDemande, motif: String? = null): String?

    /** Catégories et quartiers officiels pour créer l'établissement. */
    suspend fun options(jetonAcces: String): OptionsCreation

    /** Crée l'établissement (non publié). Renvoie null si c'est fait, sinon le message d'erreur lisible. */
    suspend fun creerEtablissement(jetonAcces: String, id: String, categorieId: String, quartierId: String): String?

    /** Rattache le compte du candidat à l'établissement créé. Renvoie null si c'est fait, sinon le message d'erreur lisible. */
    suspend fun rattacherCompte(jetonAcces: String, id: String): String?
}

class KtorReferencementsEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ReferencementsEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/referencements$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun demandes(jetonAcces: String): List<DemandeReferencement> = appeler {
        val r = try {
            client.get(url("")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseDemandes>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les demandes n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        r.demandes
    }

    /** POST JSON : null si le serveur répond « ok », sinon son message (ou [defaut]). Une réponse illisible n'est jamais prise pour un succès. */
    private suspend fun publier(jetonAcces: String, chemin: String, corps: Map<String, String>, defaut: String): String? = appeler {
        val reponse = client.post(url(chemin)) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(JsonObject(corps.mapValues { JsonPrimitive(it.value) }).toString())
        }
        val lu = try {
            reponse.body<ReponseStatut>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel."
        }
        if (lu.ok) null else lu.erreur?.message ?: defaut
    }

    override suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutDemande, motif: String?): String? =
        publier(
            jetonAcces, "/statut",
            buildMap { put("id", id); put("statut", statut.code); if (!motif.isNullOrBlank()) put("motif", motif.trim()) },
            "Le statut n'a pas pu être changé. Réessayez dans un instant.",
        )

    override suspend fun options(jetonAcces: String): OptionsCreation = appeler {
        val r = try {
            client.get(url("/options")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseOptions>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les listes n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        OptionsCreation(r.categories, r.quartiers)
    }

    override suspend fun creerEtablissement(jetonAcces: String, id: String, categorieId: String, quartierId: String): String? =
        publier(
            jetonAcces, "/creer-etablissement",
            mapOf("id" to id, "categorieId" to categorieId, "quartierId" to quartierId),
            "L'établissement n'a pas pu être créé. Réessayez dans un instant.",
        )

    override suspend fun rattacherCompte(jetonAcces: String, id: String): String? =
        publier(jetonAcces, "/rattacher", mapOf("id" to id), "Le compte n'a pas pu être rattaché. Réessayez dans un instant.")
}
