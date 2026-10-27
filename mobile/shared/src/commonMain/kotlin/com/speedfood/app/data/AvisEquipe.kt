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

/** Un avis signalé, à examiner par l'équipe (même donnée que `/system/avis`). */
@Serializable
data class SignalementAvis(
    val id: String = "",
    val avisId: String = "",
    val motif: String = "",
    val date: String = "",
    val restaurantNom: String = "",
    val note: Int = 0,
    val commentaire: String? = null,
    val statutAvis: String = "",
)

/** Restaurant ou livreur à surveiller (moyenne sous 3,5 sur 5, ou trois mauvaises notes de suite). */
@Serializable
data class AlerteQualite(val type: String = "", val cible: String = "", val detail: String = "")

@Serializable
data class AvisAModerer(val signalements: List<SignalementAvis> = emptyList(), val alertes: List<AlerteQualite> = emptyList())

/** Décisions de modération : le code est celui du serveur. [motifExige] : le motif est obligatoire (retrait de contenu public). */
enum class DecisionAvis(val code: String, val libelle: String, val motifExige: Boolean) {
    MasquerCommentaire("masquer_commentaire", "Masquer le commentaire (garde la note)", true),
    AnnulerNote("annuler_note", "Annuler la note", true),
    Retablir("retablir", "Rétablir l'avis", false),
    ClasserSansSuite("classer_sans_suite", "Classer sans suite", false),
}

/** Décisions proposées selon l'état de l'avis : un avis publié peut être masqué ou annulé ; un avis déjà retiré peut être rétabli. */
fun decisionsPossibles(statutAvis: String): List<DecisionAvis> =
    if (statutAvis == "publie") listOf(DecisionAvis.MasquerCommentaire, DecisionAvis.AnnulerNote, DecisionAvis.ClasserSansSuite) else listOf(DecisionAvis.Retablir, DecisionAvis.ClasserSansSuite)

/** Message à afficher si la décision ne peut pas partir (motif trop court), sinon null ; le serveur revérifie. */
fun controleDecision(decision: DecisionAvis, motif: String): String? =
    if (decision.motifExige && motif.trim().length < 5) "Indiquez le motif (5 caractères au moins)." else null

@Serializable
private data class ErreurAvis(val code: String = "", val message: String = "")

@Serializable
private data class ReponseAvis(val ok: Boolean = false, val signalements: List<SignalementAvis> = emptyList(), val alertes: List<AlerteQualite> = emptyList(), val erreur: ErreurAvis? = null)

@Serializable
private data class ReponseDecision(val ok: Boolean = false, val message: String = "", val erreur: ErreurAvis? = null)

interface AvisEquipeApi {
    suspend fun avis(jetonAcces: String): AvisAModerer

    /** Renvoie null si la décision est enregistrée, sinon le message d'erreur lisible. */
    suspend fun moderer(jetonAcces: String, avisId: String, decision: DecisionAvis, motif: String): String?
}

class KtorAvisEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : AvisEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun avis(jetonAcces: String): AvisAModerer = appeler {
        val r = try {
            client.get(url("avis")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseAvis>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les avis n'ont pas pu être chargés. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        AvisAModerer(r.signalements, r.alertes)
    }

    override suspend fun moderer(jetonAcces: String, avisId: String, decision: DecisionAvis, motif: String): String? = appeler {
        val corps = JsonObject(mapOf("avisId" to JsonPrimitive(avisId), "action" to JsonPrimitive(decision.code), "motif" to JsonPrimitive(motif.trim())))
        val reponse = client.post(url("avis/moderation")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps.toString())
        }
        val lu = try {
            reponse.body<ReponseDecision>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel."
        }
        if (lu.ok) null else lu.erreur?.message ?: "La décision n'a pas pu être enregistrée. Réessayez dans un instant."
    }
}
