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

/** Relevé d'équipe L3, en lecture seule. Les montants sont des GNF entiers. */
@Serializable
data class ParametresFinancesEquipe(
    val tauxDefaut: Double = 0.10,
    val rythme: String = "hebdomadaire",
    val devise: String = "GNF",
)

@Serializable
data class ContratFinanceEquipe(
    val etablissementId: String = "",
    val etablissementNom: String = "",
    val taux: Double = 0.10,
    val effectifLe: String = "",
)

@Serializable
data class VersementFinanceEquipe(
    val statut: String = "a_verser",
    val reference: String? = null,
    val dateVersement: String? = null,
)

@Serializable
data class LigneFinanceEquipe(
    val etablissementId: String = "",
    val etablissementNom: String = "",
    val ventesGnf: Int = 0,
    val commissionGnf: Int = 0,
    val fraisLivraisonGnf: Int = 0,
    val remboursementsGnf: Int = 0,
    val netAReverserGnf: Int = 0,
    val taux: Double = 0.10,
    val effectifLe: String = "",
    val versement: VersementFinanceEquipe = VersementFinanceEquipe(),
)

@Serializable
data class FinancesEquipe(
    val parametres: ParametresFinancesEquipe = ParametresFinancesEquipe(),
    val contrats: List<ContratFinanceEquipe> = emptyList(),
    val releve: List<LigneFinanceEquipe> = emptyList(),
)

fun cleLigneFinanceEquipe(etablissementId: String): String = "releve-$etablissementId"

fun libelleStatutVersementFinance(statut: String): String = when (statut) {
    "a_verser" -> "À verser"
    "verse" -> "Versé"
    else -> statut.replace('_', ' ')
}

fun tauxFinanceAffiche(taux: Double): String = "${(taux * 100).toInt()} % (développement)"

@Serializable
private data class ErreurFinancesEquipe(val code: String = "", val message: String = "")

@Serializable
private data class ReponseFinancesEquipe(
    val ok: Boolean = false,
    val parametres: ParametresFinancesEquipe = ParametresFinancesEquipe(),
    val contrats: List<ContratFinanceEquipe> = emptyList(),
    val releve: List<LigneFinanceEquipe> = emptyList(),
    val erreur: ErreurFinancesEquipe? = null,
)

interface FinancesEquipeApi {
    /** Lecture du relevé demandé ; aucune écriture, versement ou modification de taux. */
    suspend fun finances(jetonAcces: String, debut: String = "2026-10-01", fin: String = "2026-11-01"): FinancesEquipe
}

class KtorFinancesEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : FinancesEquipeApi {
    private fun url() = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/finances"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun finances(jetonAcces: String, debut: String, fin: String): FinancesEquipe = appeler {
        val r = try {
            client.get(url()) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                parameter("debut", debut)
                parameter("fin", fin)
            }.body<ReponseFinancesEquipe>()
        } catch (e: JsonConvertException) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les finances n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        FinancesEquipe(r.parametres, r.contrats, r.releve)
    }
}
