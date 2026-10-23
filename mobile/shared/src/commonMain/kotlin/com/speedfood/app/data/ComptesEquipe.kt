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

/**
 * Annuaire global des comptes (équipe) : qui existe sur Speedfood, avec son rôle système et ses restaurants. Lecture seule : la suppression
 * d'un compte, la suppression groupée, la réinitialisation des questions de sécurité et l'attribution des rôles restent sur le site.
 */
@Serializable
data class AffiliationRestaurantEquipe(
    val restaurantId: String = "",
    val nom: String = "",
    /** `owner` (propriétaire) ou `manager` (équipier). */
    val role: String = "",
)

@Serializable
data class CompteEquipe(
    val utilisateurId: String = "",
    val email: String = "",
    val creeLe: String = "",
    /** Rôle système brut (`super_admin`, `operations`, …), `null` si le compte n'en a pas. */
    val roleSysteme: String? = null,
    val restaurants: List<AffiliationRestaurantEquipe> = emptyList(),
    /** Le compte ressemble à un compte de test (aide au nettoyage, jamais une décision automatique). */
    val test: Boolean = false,
)

/** Filtres de l'annuaire, dans l'ordre du site. */
enum class TypeCompteEquipe(val code: String, val libelle: String) {
    Tous("tous", "Tous"),
    Restaurateur("restaurateur", "Restaurateurs"),
    Systeme("systeme", "Rôles système"),
    SansAffiliation("sans_affiliation", "Sans affiliation"),
    Test("test", "Comptes de test"),
}

/** Un filtre inconnu retombe sur « Tous » : jamais de valeur devinée. */
fun typeCompteEquipeValide(code: String?): TypeCompteEquipe =
    TypeCompteEquipe.entries.firstOrNull { it.code == code } ?: TypeCompteEquipe.Tous

/** Libellé lisible d'un rôle système ; `null` si le compte n'en a pas. */
fun libelleRoleSystemeEquipe(role: String?): String? = when (role) {
    null -> null
    "super_admin" -> "Super administrateur"
    "operations" -> "Opérations"
    "content_editor" -> "Éditeur de contenu"
    "support" -> "Support"
    else -> role
}

/** Rôle du compte dans un restaurant : `owner` = propriétaire, sinon équipier. */
fun libelleAffiliationEquipe(role: String): String = if (role == "owner") "Propriétaire" else "Équipier"

/** Libellés d'affiliation : « Propriétaire de Chez Awa », « Équipier de Maquis du Port ». */
fun libellesAffiliationEquipe(restaurants: List<AffiliationRestaurantEquipe>): List<String> =
    restaurants.map { "${libelleAffiliationEquipe(it.role)} de ${it.nom}" }

/** Date de création en clair : « 22/10/2026 ». Une date illisible est renvoyée telle quelle. */
fun dateCourteEquipe(iso: String): String {
    val parties = iso.split("-")
    if (parties.size < 3) return iso
    val jour = parties[2].take(2)
    val mois = parties[1].take(2)
    val annee = parties[0].take(4)
    if (jour.length != 2 || mois.length != 2 || annee.length != 4) return iso
    return "$jour/$mois/$annee"
}

/** Résumé d'un compte pour la liste : « Opération · Propriétaire de Chez Awa · 22/10/2026 ». */
fun resumeCompteEquipe(compte: CompteEquipe): String = listOfNotNull(
    libelleRoleSystemeEquipe(compte.roleSysteme),
    libellesAffiliationEquipe(compte.restaurants).firstOrNull(),
    dateCourteEquipe(compte.creeLe).takeIf { it.isNotBlank() },
).joinToString(" · ")

@Serializable
private data class ErreurCompte(val code: String = "", val message: String = "")

@Serializable
private data class ReponseComptesEquipe(
    val ok: Boolean = false,
    val comptes: List<CompteEquipe> = emptyList(),
    val tronque: Boolean = false,
    val erreur: ErreurCompte? = null,
)

interface ComptesEquipeApi {
    /** Les comptes de l'annuaire, filtrés par e-mail (`q`) et par type. */
    suspend fun comptes(jetonAcces: String, recherche: String, type: TypeCompteEquipe): ResultatComptesEquipe
}

/** Ce que l'application affiche : les comptes retenus, et si la liste est complète. */
data class ResultatComptesEquipe(val comptes: List<CompteEquipe>, val tronque: Boolean)

class KtorComptesEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ComptesEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/comptes$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun comptes(jetonAcces: String, recherche: String, type: TypeCompteEquipe): ResultatComptesEquipe = appeler {
        val r = try {
            client.get(url("")) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                if (recherche.isNotBlank()) parameter("q", recherche.trim())
                parameter("type", type.code)
            }.body<ReponseComptesEquipe>()
        } catch (e: JsonConvertException) {
            // La réponse est arrivée mais n'est pas lisible : on le dit comme ça. Une connexion impossible remonte plus haut et devient « Impossible de joindre Speedfood ».
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les comptes n'ont pas pu être chargés. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        ResultatComptesEquipe(r.comptes, r.tronque)
    }
}
