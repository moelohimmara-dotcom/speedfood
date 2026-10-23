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
)

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

interface ReferencementsEquipeApi {
    suspend fun demandes(jetonAcces: String): List<DemandeReferencement>

    /** Renvoie null si le statut est enregistré, sinon le message d'erreur lisible. */
    suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutDemande): String?
}

class KtorReferencementsEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ReferencementsEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/referencements$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
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

    override suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutDemande): String? = appeler {
        val corps = JsonObject(mapOf("id" to JsonPrimitive(id), "statut" to JsonPrimitive(statut.code)))
        val reponse = client.post(url("/statut")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps.toString())
        }
        val lu = try {
            reponse.body<ReponseStatut>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Le statut n'a pas pu être changé. Réessayez dans un instant."
    }
}
