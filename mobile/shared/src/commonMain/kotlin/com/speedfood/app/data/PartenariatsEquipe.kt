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
 * Demandes de partenariat (équipe) : ce que le site « Devenir partenaire » a reçu. L'équipe contacte la personne hors Speedfood, puis fait
 * avancer le statut. La suppression d'une demande (irréversible) et l'export des contacts restent sur le site.
 */
@Serializable
data class DemandePartenariatEquipe(
    val id: String = "",
    /** Forme de la demande : investir, soutenir, moyens, contribuer. */
    val forme: String = "",
    val organisation: String = "",
    val nomContact: String = "",
    /** « email » ou « telephone ». */
    val contactType: String = "email",
    val contact: String = "",
    val message: String = "",
    val statut: String = "",
    val creeLe: String = "",
)

/** Statuts d'une demande de partenariat, dans l'ordre du parcours. */
enum class StatutPartenariatEquipe(val code: String, val libelle: String) {
    Nouvelle("nouvelle", "Nouvelle"),
    EnCours("en_cours", "En cours"),
    Traitee("traitee", "Traitée"),
    classee("classee", "Classée"),
}

fun libelleStatutPartenariatEquipe(code: String): String =
    StatutPartenariatEquipe.entries.firstOrNull { it.code == code }?.libelle ?: code.replace('_', ' ')

fun libelleFormePartenariatEquipe(code: String): String = when (code) {
    "investir" -> "Investir"
    "soutenir" -> "Soutenir la communauté"
    "moyens" -> "Apporter des moyens"
    "contribuer" -> "Contribuer"
    else -> code.replace('_', ' ')
}

/** Statuts proposés : tous sauf l'actuel. */
fun statutsProposesPartenariatEquipe(statut: String): List<StatutPartenariatEquipe> =
    StatutPartenariatEquipe.entries.filter { it.code != statut }

/** Une demande « nouvelle » n'a pas encore été lue : elle passe avant les autres. */
fun aTraiterPartenariatEquipe(statut: String): Boolean = statut == "nouvelle"

@Serializable
private data class ErreurPartenariat(val code: String = "", val message: String = "")

@Serializable
private data class ReponsePartenariats(val ok: Boolean = false, val partenariats: List<DemandePartenariatEquipe> = emptyList(), val erreur: ErreurPartenariat? = null)

@Serializable
private data class ReponseStatutPartenariat(val ok: Boolean = false, val erreur: ErreurPartenariat? = null)

interface PartenariatsEquipeApi {
    suspend fun partenariats(jetonAcces: String): List<DemandePartenariatEquipe>

    /** Renvoie null si le statut est enregistré, sinon le message d'erreur lisible. */
    suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutPartenariatEquipe): String?
}

class KtorPartenariatsEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : PartenariatsEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/partenariats$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun partenariats(jetonAcces: String): List<DemandePartenariatEquipe> = appeler {
        val r = try {
            client.get(url("")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponsePartenariats>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les demandes n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        r.partenariats
    }

    override suspend fun changerStatut(jetonAcces: String, id: String, statut: StatutPartenariatEquipe): String? = appeler {
        val corps = JsonObject(mapOf("id" to JsonPrimitive(id), "statut" to JsonPrimitive(statut.code)))
        val reponse = client.post(url("/statut")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps.toString())
        }
        val lu = try {
            reponse.body<ReponseStatutPartenariat>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Le statut n'a pas pu être changé. Réessayez dans un instant."
    }
}
