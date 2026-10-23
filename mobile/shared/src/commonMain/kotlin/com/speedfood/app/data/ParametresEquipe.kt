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
 * Les réglages globaux de l'application, en lecture seule. Utile en assistance (quel délai de proposition ? quel plafond de prix ? quel
 * numéro d'assistance ?) ; les modifier reste sur le site, où le formulaire est validé, tracé et borné par la base.
 */
@Serializable
data class ParametresEquipe(
    val commandePropositionDelaiMinutes: Int = 30,
    val prixPlatMaxGnf: Long = 5_000_000,
    val disponibiliteFraicheurHeures: Int = 6,
    val conservationCoordonneesJours: Int = 90,
    val conservationNonClotureeJours: Int = 30,
    val conservationAuditMois: Int = 12,
    val whatsappAssistance: String = "",
    val delaiValidationHeures: Int? = null,
    val positionCarteActive: Boolean = false,
    val promesseSignature: String = "",
    val promesseSousTitre: String = "",
    val promessePartage: String = "",
    val connexionFacebookActive: Boolean = false,
    val connexionGoogleActive: Boolean = false,
)

/** Un réglage affiché, avec son libellé et sa valeur en clair. */
data class ReglageEquipe(val libelle: String, val valeur: String)

/**
 * Les réglages en clair pour l'écran : les valeurs par défaut de la base sont reprises ici, donc une valeur absente ne fait jamais croire
 * à un réglage « zéro ».
 */
fun reglagesEquipe(p: ParametresEquipe): List<ReglageEquipe> = listOf(
    ReglageEquipe("Délai de proposition d'une commande", dureeMinutes(p.commandePropositionDelaiMinutes)),
    ReglageEquipe("Plafond de prix d'un plat", formaterGnf(p.prixPlatMaxGnf)),
    ReglageEquipe("Durée de fraîcheur de la disponibilité", dureeHeures(p.disponibiliteFraicheurHeures)),
    ReglageEquipe("Conservation des coordonnées", dureeJours(p.conservationCoordonneesJours)),
    ReglageEquipe("Conservation d'une commande non clôturée", dureeJours(p.conservationNonClotureeJours)),
    ReglageEquipe("Conservation du journal d'audit", dureeMois(p.conservationAuditMois)),
    ReglageEquipe("WhatsApp d'assistance", p.whatsappAssistance.ifBlank { "Désactivé" }),
    ReglageEquipe("Délai de validation annoncé", p.delaiValidationHeures?.let { dureeHeures(it) } ?: "Aucun"),
    ReglageEquipe("Bouton « Utiliser ma position »", ouNon(p.positionCarteActive)),
    ReglageEquipe("Connexion Facebook", ouNon(p.connexionFacebookActive)),
    ReglageEquipe("Connexion Google", ouNon(p.connexionGoogleActive)),
    ReglageEquipe("Signature d'accueil", p.promesseSignature.ifBlank { "Texte par défaut" }),
    ReglageEquipe("Sous-titre d'accueil", p.promesseSousTitre.ifBlank { "Texte par défaut" }),
    ReglageEquipe("Texte de partage", p.promessePartage.ifBlank { "Texte par défaut" }),
)

/** Une durée en minutes : « 30 minutes », « 90 minutes ». */
fun dureeMinutes(valeur: Int): String = if (valeur >= 60) {
    val heures = valeur / 60
    val reste = valeur % 60
    if (reste == 0) "$heures heures" else "$heures h $reste min"
} else {
    "$valeur minutes"
}

/** Une durée en heures : « 6 heures », « 72 heures ». */
fun dureeHeures(valeur: Int): String = if (valeur >= 24) {
    val jours = valeur / 24
    val reste = valeur % 24
    if (reste == 0) "$jours jours" else "$jours j $reste h"
} else {
    "$valeur heures"
}

/** Une durée en jours : « 90 jours », « 24 mois ». */
fun dureeJours(valeur: Int): String = if (valeur >= 365) {
    val mois = valeur / 30
    "$mois mois"
} else {
    "$valeur jours"
}

/** Une durée en mois : « 12 mois », « 18 mois ». */
fun dureeMois(valeur: Int): String = "$valeur mois"

/** Un interrupteur : « Activé » ou « Désactivé ». */
fun ouNon(actif: Boolean): String = if (actif) "Activé" else "Désactivé"

@Serializable
private data class ErreurParametres(val code: String = "", val message: String = "")

@Serializable
private data class ReponseParametresEquipe(
    val ok: Boolean = false,
    val parametres: ParametresEquipe = ParametresEquipe(),
    val erreur: ErreurParametres? = null,
)

interface ParametresEquipeApi {
    /** Les réglages globaux de l'application. */
    suspend fun parametres(jetonAcces: String): ParametresEquipe
}

class KtorParametresEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ParametresEquipeApi {
    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun parametres(jetonAcces: String): ParametresEquipe = appeler {
        val r = try {
            client.get("${config.siteUrl.trimEnd('/')}/api/v1/equipe/parametres") {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            }.body<ReponseParametresEquipe>()
        } catch (e: JsonConvertException) {
            // La réponse est arrivée mais n'est pas lisible : on le dit comme ça. Une connexion impossible remonte plus haut.
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Les paramètres n'ont pas pu être chargés. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        r.parametres
    }
}
