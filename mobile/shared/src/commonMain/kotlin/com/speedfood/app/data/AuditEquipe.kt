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
 * Le journal d'audit et les indicateurs d'activité, lus en lecture seule.
 *
 * Le journal est en écriture seule par le serveur : l'application le lit, le filtre et le renvoie vers le site, elle n'y
 * écrit jamais (aucune action, aucun interrupteur).
 */

/** Un indicateur d'activité : un chiffre, son libellé et sa définition écrite (un chiffre seul se prête à toutes les interprétations). */
@Serializable
data class IndicateurAuditEquipe(
    val cle: String = "",
    val libelle: String = "",
    val definition: String = "",
    val valeur: Int = 0,
)

/** Un type d'action proposé par le filtre. Le catalogue vit côté serveur : l'application n'invente aucun libellé. */
@Serializable
data class ActionAuditEquipe(
    val code: String = "",
    val libelle: String = "",
)

/** Une période proposée par le filtre : [valeur] nulle = tout l'historique. */
@Serializable
data class PeriodeAuditEquipe(
    val valeur: Int? = null,
    val libelle: String = "",
)

/** Une entrée du journal : ce qu'une action a changé, quand, par qui, sur quoi et pourquoi. */
@Serializable
data class EntreeJournalEquipe(
    val id: String = "",
    val horodatage: String = "",
    val action: String = "",
    val libelle: String = "",
    /** E-mail de l'auteur ; `null` si l'auteur n'est plus identifiable. */
    val acteurEmail: String? = null,
    /** Libellé de l'auteur, toujours lisible (« acteur inconnu » si l'auteur est inconnu). */
    val auteur: String = "",
    val cibleType: String = "",
    val cibleId: String = "",
    /** Cible affichée : « Restaurant a1b2c3d4 ». */
    val cible: String = "",
    /** Adresse de la cible sur le site ; `null` si le type de cible n'est pas connu (la cible reste alors un texte simple). */
    val cibleUrl: String? = null,
    /** Motif écrit par l'auteur ; `null` si l'action n'en demande pas. */
    val motif: String? = null,
)

/** Ce que l'application affiche : les indicateurs, les filtres proposés par le serveur, le journal filtré. */
@Serializable
data class AuditEquipe(
    val indicateurs: List<IndicateurAuditEquipe> = emptyList(),
    val actions: List<ActionAuditEquipe> = emptyList(),
    val periodes: List<PeriodeAuditEquipe> = emptyList(),
    val journal: List<EntreeJournalEquipe> = emptyList(),
    /** Vrai si le journal est plus long que la limite renvoyée : la liste affichée est alors incomplète. */
    val tronque: Boolean = false,
)

private val DATE_FRANCAISE = Regex("""^\d{2}/\d{2}/\d{4}$""")

/** Date et heure en clair : « 23/10/2026 à 08:15 ». Une date illisible est renvoyée telle quelle. */
fun dateHeureJournalAudit(iso: String): String {
    if (iso.isBlank()) return ""
    val date = iso.substringBefore('T')
    val heure = iso.substringAfter('T', "").take(5)
    val jour = dateCourteEquipe(date)
    if (!DATE_FRANCAISE.matches(jour)) return iso
    return if (heure.length == 5) "$jour à $heure" else jour
}

/** Libellé de la période choisie : celui du serveur ; une période absente de la liste retombe sur « Tout l'historique ». */
fun libellePeriodeAuditEquipe(valeur: Int?, periodes: List<PeriodeAuditEquipe> = emptyList()): String =
    periodes.firstOrNull { it.valeur == valeur }?.libelle?.takeIf { it.isNotBlank() }
        ?: if (valeur == null) "Tout l'historique" else "$valeur jours"

/** Libellé du bouton « Type d'action » : « Toutes les actions », ou le libellé de l'action choisie. */
fun libelleActionAuditEquipe(code: String?, actions: List<ActionAuditEquipe> = emptyList()): String {
    if (code == null) return "Toutes les actions"
    return actions.firstOrNull { it.code == code }?.libelle?.takeIf { it.isNotBlank() } ?: code
}

/** Recherche dans le catalogue des actions : libellé ou code, sans casse ni accents (comme la recherche du catalogue public). */
fun actionsAuditEquipeFiltrees(actions: List<ActionAuditEquipe>, recherche: String): List<ActionAuditEquipe> {
    val mots = normaliser(recherche).split(" ").filter { it.isNotEmpty() }
    if (mots.isEmpty()) return actions
    return actions.filter { a ->
        val cible = normaliser("${a.libelle} ${a.code}")
        mots.all { cible.contains(it) }
    }
}

/** Nombre d'entrées du journal affichées. */
fun nombreEntreesAudit(journal: List<EntreeJournalEquipe>): Int = journal.size

/** Résumé lisible du journal affiché : « 1 entrée », « 12 entrées ». */
fun resumeJournalAudit(nombre: Int): String = if (nombre == 1) "1 entrée" else "$nombre entrées"

/** Une entrée du journal, prête à afficher. */
data class EntreeAuditAffichee(
    val auteur: String,
    val cible: String,
    /** Adresse de la cible sur le site ; `null` quand la cible n'a pas d'adresse (elle reste alors un texte simple). */
    val cibleUrl: String?,
    /** Motif de l'action ; `null` quand l'action n'en a pas (aucune ligne de motif). */
    val motif: String?,
)

/**
 * Mise en forme d'une entrée du journal : un auteur inconnu reste affiché comme tel, un motif absent ne fait pas de ligne
 * vide, et une cible sans adresse sur le site n'est jamais présentée comme un lien.
 */
fun miseEnFormeEntreeAudit(entree: EntreeJournalEquipe): EntreeAuditAffichee = EntreeAuditAffichee(
    auteur = entree.auteur.ifBlank { entree.acteurEmail?.takeIf { it.isNotBlank() } ?: "acteur inconnu" },
    cible = entree.cible.ifBlank { entree.cibleType },
    cibleUrl = entree.cibleUrl?.takeIf { it.isNotBlank() },
    motif = entree.motif?.takeIf { it.isNotBlank() },
)

/**
 * Clés des lignes de l'écran « Journal d'audit ».
 *
 * Les indicateurs, les actions et les entrées partagent la lecture : leurs clés doivent donc vivre dans des espaces de noms
 * séparés. Sans cela, une même chaîne des deux côtés fait planter l'application au premier défilement : Compose refuse deux
 * clés identiques dans une même liste.
 */
fun cleIndicateurAuditEquipe(cle: String): String = "indicateur-$cle"

/** Clé d'une action proposée par le filtre : espace de noms distinct de celui des indicateurs et du journal. */
fun cleActionAuditEquipe(code: String): String = "action-$code"

/** Clé d'une entrée du journal : espace de noms distinct de celui des indicateurs et des actions. */
fun cleEntreeAuditEquipe(id: String): String = "journal-$id"

@Serializable
private data class ErreurAudit(val code: String = "", val message: String = "")

@Serializable
private data class ReponseAuditEquipe(
    val ok: Boolean = false,
    val indicateurs: List<IndicateurAuditEquipe> = emptyList(),
    val actions: List<ActionAuditEquipe> = emptyList(),
    val periodes: List<PeriodeAuditEquipe> = emptyList(),
    val journal: List<EntreeJournalEquipe> = emptyList(),
    val tronque: Boolean = false,
    val erreur: ErreurAudit? = null,
)

interface AuditEquipeApi {
    /** Le journal d'audit filtré : le serveur applique le type d'action et la période. */
    suspend fun audit(jetonAcces: String, action: String?, depuis: Int?): AuditEquipe
}

class KtorAuditEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : AuditEquipeApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun audit(jetonAcces: String, action: String?, depuis: Int?): AuditEquipe = appeler {
        val r = try {
            client.get(url("audit")) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                // Filtres absents = pas de filtre : toutes les actions, tout l'historique.
                if (!action.isNullOrBlank()) parameter("action", action)
                if (depuis != null) parameter("depuis", depuis)
            }.body<ReponseAuditEquipe>()
        } catch (e: JsonConvertException) {
            // La réponse est arrivée mais n'est pas lisible : on le dit comme ça. Une connexion impossible remonte plus haut et devient « Impossible de joindre Speedfood ».
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Le journal d'audit n'a pas pu être chargé. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        AuditEquipe(r.indicateurs, r.actions, r.periodes, r.journal, r.tronque)
    }
}
