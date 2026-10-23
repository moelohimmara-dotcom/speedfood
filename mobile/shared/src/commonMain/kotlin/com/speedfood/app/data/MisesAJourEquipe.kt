package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import io.ktor.serialization.JsonConvertException
import kotlinx.serialization.Serializable

/**
 * L'état des mises à jour : la version publiée, la dernière annonce envoyée aux téléphones, les interrupteurs pilotables et le journal
 * des nouveautés livrées. Lecture seule : basculer un interrupteur ou annoncer une version reste sur le site (effet immédiat sur le
 * public, et envoi de notifications).
 */
@Serializable
data class VersionEquipe(
    val code: Int = 0,
    val nom: String = "",
    val notes: String = "",
)

@Serializable
data class AnnonceVersionEquipe(
    val versionCode: Int = 0,
    val versionNom: String = "",
    val annonceeLe: String = "",
    val appareils: Int = 0,
    val envoyes: Int = 0,
)

/** Un interrupteur de fonctionnalité : ce que l'on peut couper à chaud sans redéploiement. */
@Serializable
data class FonctionnaliteEquipe(
    val cle: String = "",
    val libelle: String = "",
    val description: String = "",
    /** `public`, `commande`, `restaurant`… */
    val groupe: String = "",
    val active: Boolean = false,
    val miseAJourLe: String = "",
)

/** Une nouveauté livrée, reliée à son interrupteur (`null` quand elle n'en a pas). */
@Serializable
data class MiseAJourEquipe(
    val id: String = "",
    val date: String = "",
    val titre: String = "",
    val resume: String = "",
    val verification: String = "",
    val cle: String? = null,
    /** `null` = toujours active (pas d'interrupteur). */
    val active: Boolean? = null,
    val raisonSansInterrupteur: String? = null,
    val groupe: String? = null,
)

@Serializable
data class MisesAJourEquipe(
    val version: VersionEquipe = VersionEquipe(),
    val appareils: Int = 0,
    val annonce: AnnonceVersionEquipe? = null,
    val fonctionnalites: List<FonctionnaliteEquipe> = emptyList(),
    val misesAJour: List<MiseAJourEquipe> = emptyList(),
)

/** Libellé d'un groupe d'interrupteur ; un groupe inconnu est affiché tel quel. */
fun libelleGroupeFonctionnalite(groupe: String?): String = when (groupe) {
    null, "" -> "Autres"
    "public" -> "Site public"
    "commande" -> "Commande"
    "restaurant" -> "Console restaurant"
    else -> groupe
}

/** État d'une fonctionnalité : « Active » ou « Coupée ». */
fun libelleEtatFonctionnalite(active: Boolean): String = if (active) "Active" else "Coupée"

/**
 * Clé d'une ligne d'interrupteur dans la liste défilante de l'écran « Mises à jour ».
 *
 * Les interrupteurs et le journal des nouveautés sont affichés dans la MÊME liste : leurs clés doivent donc vivre dans
 * des espaces de noms séparés. Sans cela, une même chaîne des deux côtés (« animations », par exemple) fait planter
 * l'application au premier défilement : Compose refuse deux clés identiques dans une même liste.
 */
fun cleInterrupteurEquipe(cle: String): String = "interrupteur-$cle"

/** Clé d'une ligne du journal des nouveautés : espace de noms distinct de celui des interrupteurs. */
fun cleJournalEquipe(id: String): String = "journal-$id"

@Serializable
private data class ErreurMiseAJour(val code: String = "", val message: String = "")

@Serializable
private data class ReponseMisesAJourEquipe(
    val ok: Boolean = false,
    val version: VersionEquipe = VersionEquipe(),
    val appareils: Int = 0,
    val annonce: AnnonceVersionEquipe? = null,
    val fonctionnalites: List<FonctionnaliteEquipe> = emptyList(),
    val misesAJour: List<MiseAJourEquipe> = emptyList(),
    val erreur: ErreurMiseAJour? = null,
)

interface MisesAJourEquipeApi {
    /** Version publiée, dernière annonce, interrupteurs et journal des nouveautés. */
    suspend fun misesAJour(jetonAcces: String): MisesAJourEquipe
}

class KtorMisesAJourEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : MisesAJourEquipeApi {
    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun misesAJour(jetonAcces: String): MisesAJourEquipe = appeler {
        val r = try {
            client.get("${config.siteUrl.trimEnd('/')}/api/v1/equipe/mises-a-jour") {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            }.body<ReponseMisesAJourEquipe>()
        } catch (e: JsonConvertException) {
            // La réponse est arrivée mais n'est pas lisible : on le dit comme ça. Une connexion impossible remonte plus haut.
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les mises à jour n'ont pas pu être chargées. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        MisesAJourEquipe(r.version, r.appareils, r.annonce, r.fonctionnalites, r.misesAJour)
    }
}
