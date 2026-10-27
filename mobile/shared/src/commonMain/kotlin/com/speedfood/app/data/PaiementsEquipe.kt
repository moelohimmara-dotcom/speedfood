package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import kotlinx.serialization.Serializable

/**
 * Paiements en ligne vus par l'équipe, en LECTURE SEULE. Les décisions qui déplacent de l'argent (reprendre un versement, trancher un litige) ne sont pas dans l'application :
 * elles restent sur le site (`/system/paiements`).
 */
@Serializable
data class ReglagesPaiement(val actif: Boolean = false, val fournisseur: String = "simulation", val valeursValidees: Boolean = false)

@Serializable
data class CompteursPaiements(val enAttente: Int = 0, val versementsATraiter: Int = 0, val litigesAHumain: Int = 0)

@Serializable
data class VersementVu(val beneficiaire: String = "", val etat: String = "", val montantGnf: Int = 0, val erreurCode: String? = null)

@Serializable
data class LitigeVu(val situation: String = "", val etat: String = "", val regle: String? = null)

@Serializable
data class PaiementVu(
    val id: String = "",
    val commandeReference: String = "",
    val restaurantNom: String = "",
    val etat: String = "",
    val operateur: String = "",
    val fournisseur: String = "",
    val totalGnf: Int = 0,
    val restaurantGnf: Int = 0,
    val livreurGnf: Int = 0,
    val speedfoodBrutGnf: Int = 0,
    val fraisMobileGnf: Int = 0,
    val rembourseGnf: Int = 0,
    val creeLe: String = "",
    val versements: List<VersementVu> = emptyList(),
    val litiges: List<LitigeVu> = emptyList(),
)

@Serializable
data class PaiementsEquipe(val reglages: ReglagesPaiement = ReglagesPaiement(), val compteurs: CompteursPaiements = CompteursPaiements(), val paiements: List<PaiementVu> = emptyList())

fun libelleEtatPaiement(etat: String): String = when (etat) {
    "cree" -> "Créé"
    "en_attente" -> "En attente du client"
    "confirme" -> "Payé, à libérer"
    "libere" -> "Libéré"
    "echoue" -> "Échoué"
    "expire" -> "Expiré"
    "annule" -> "Annulé"
    "rembourse" -> "Remboursé"
    "en_litige" -> "En litige"
    else -> etat
}

fun libelleVersement(etat: String): String = when (etat) {
    "a_verser" -> "À verser"
    "envoye" -> "Envoyé"
    "confirme" -> "Versé"
    "echoue" -> "Échoué"
    else -> etat
}

/** Vrai si l'état demande l'attention de l'équipe (échec, litige). */
fun paiementEnAlerte(p: PaiementVu): Boolean = p.etat == "echoue" || p.etat == "en_litige" || p.litiges.any { it.etat == "a_humain" } || p.versements.any { it.etat == "echoue" }

@Serializable
private data class ErreurPaiements(val code: String = "", val message: String = "")

@Serializable
private data class ReponsePaiements(
    val ok: Boolean = false,
    val reglages: ReglagesPaiement = ReglagesPaiement(),
    val compteurs: CompteursPaiements = CompteursPaiements(),
    val paiements: List<PaiementVu> = emptyList(),
    val erreur: ErreurPaiements? = null,
)

interface PaiementsEquipeApi {
    suspend fun paiements(jetonAcces: String): PaiementsEquipe
}

class KtorPaiementsEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : PaiementsEquipeApi {
    override suspend fun paiements(jetonAcces: String): PaiementsEquipe = try {
        val r = try {
            client.get("${config.siteUrl.trimEnd('/')}/api/v1/equipe/paiements") { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponsePaiements>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les paiements n'ont pas pu être chargés. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        PaiementsEquipe(r.reglages, r.compteurs, r.paiements)
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }
}
