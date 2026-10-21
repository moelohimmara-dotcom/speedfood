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
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
data class RestaurantResume(val id: String = "", val nom: String = "", val ouvert: Boolean = false, val accepteCommandes: Boolean = false)

@Serializable
data class LigneApercu(val nom: String, val prix: Int = 0, val quantite: Int = 1, val options: List<OptionSuivie> = emptyList())

@Serializable
data class PropositionApercu(
    val id: String = "",
    val nouveauSousTotal: Int = 0,
    val nouveauxFraisLivraison: Int = 0,
    val conditionsModifiees: String? = null,
    val statut: String = "",
    val expireLe: String? = null,
)

/** Une commande vue par le restaurateur : coordonnées du client incluses (nécessaires pour appeler et livrer). */
@Serializable
data class CommandeRestaurateur(
    val id: String,
    val reference: String,
    val statut: String,
    val etatDerive: String = statut,
    val mode: String = "retrait",
    val tableNumero: String? = null,
    val clientNom: String = "",
    val clientTelephone: String = "",
    val clientAdresse: String? = null,
    val sousTotal: Int = 0,
    val fraisLivraisonEstime: Int = 0,
    val creeLe: String = "",
    val estTest: Boolean = false,
    val lignes: List<LigneApercu> = emptyList(),
    val propositionActive: PropositionApercu? = null,
    /** Paiement : statut (non_demande, especes, declare, recu, non_recu), mode, référence donnée par le client ; libellé composé par le serveur. */
    val paiementStatut: String = "non_demande",
    val paiementMode: String? = null,
    val paiementReference: String? = null,
    val paiementVisible: Boolean = false,
    val paiementLibelle: String = "",
    val documents: DocumentsCommande = DocumentsCommande(),
    /** Liens WhatsApp composés par le serveur (texte prérempli, le restaurateur appuie lui-même sur « Envoyer »). */
    val lienRecuWhatsApp: String? = null,
    val lienFactureWhatsApp: String? = null,
) {
    val total: Int get() = sousTotal + fraisLivraisonEstime
}

@Serializable
data class DocumentsCommande(val recu: String? = null, val facture: String? = null)

/** Ce que le restaurateur peut faire sur le paiement ou les documents : [code] est la décision (« recu », « non_recu ») ou le type de document ; [confirmation] : message à confirmer avant l'envoi. */
data class ActionPaiement(val genre: Genre, val code: String, val libelle: String, val confirmation: String? = null) {
    enum class Genre { Paiement, Document, WhatsApp }
}

/**
 * Actions de paiement et de documents d'après l'état d'une commande : mêmes règles que la console du site (le serveur et la base revérifient). Le paiement ne
 * s'ouvre qu'une fois la commande acceptée ; un paiement en ligne Speedfood se confirme par le prestataire, jamais à la main.
 */
fun actionsPaiement(c: CommandeRestaurateur): List<ActionPaiement> {
    if (!c.paiementVisible) return emptyList()
    val liste = mutableListOf<ActionPaiement>()
    val enLigne = c.paiementMode == "speedfood"
    when {
        c.paiementStatut == "declare" -> {
            liste += ActionPaiement(ActionPaiement.Genre.Paiement, "recu", "Paiement reçu")
            liste += ActionPaiement(ActionPaiement.Genre.Paiement, "non_recu", "Pas reçu", "Le client sera prévenu que vous n'avez pas retrouvé son paiement. Continuer ?")
        }
        c.paiementStatut == "especes" -> liste += ActionPaiement(ActionPaiement.Genre.Paiement, "recu", "Espèces encaissées")
        (c.paiementStatut == "non_demande" || c.paiementStatut == "non_recu") && !enLigne ->
            liste += ActionPaiement(ActionPaiement.Genre.Paiement, "recu", "Marquer comme payée", "Marquer cette commande comme payée ?")
    }
    c.lienRecuWhatsApp?.let {
        liste += ActionPaiement(ActionPaiement.Genre.WhatsApp, it, if (c.paiementStatut == "recu") "Envoyer le reçu sur WhatsApp" else "Envoyer le récapitulatif sur WhatsApp")
    }
    if (c.paiementStatut == "recu" && c.documents.recu == null) liste += ActionPaiement(ActionPaiement.Genre.Document, "recu", "Établir le reçu numéroté")
    if (c.documents.facture == null) {
        liste += ActionPaiement(ActionPaiement.Genre.Document, "facture", "Établir une facture")
    } else {
        c.lienFactureWhatsApp?.let { liste += ActionPaiement(ActionPaiement.Genre.WhatsApp, it, "Envoyer la facture ${c.documents.facture} sur WhatsApp") }
    }
    return liste
}

/** Un plat du menu tel que le gère le restaurateur. */
@Serializable
data class PlatGere(
    val id: String,
    val nom: String,
    val description: String = "",
    val prix: Int,
    val prixPromo: Int? = null,
    val disponible: Boolean = true,
    val confirmeLe: String? = null,
    val sectionId: String? = null,
    val options: List<OptionGeree> = emptyList(),
) {
    /** Le même plat sous la forme du menu client : sert à calculer son état (disponible, à confirmer, épuisé) avec la règle commune. */
    fun commeMenuClient(): Plat = Plat(id = id, nom = nom, description = description, prix = prix, prixPromo = prixPromo, disponible = disponible, confirmeLe = confirmeLe, sectionId = sectionId)
}

@Serializable
data class OptionGeree(val id: String, val nom: String, val prix: Int = 0, val disponible: Boolean = true)

@Serializable
data class SectionGeree(val id: String, val nom: String)

@Serializable
data class MenuGere(val sections: List<SectionGeree> = emptyList(), val plats: List<PlatGere> = emptyList()) {
    /** Plats groupés par section (dans l'ordre des sections), les plats sans section à la fin sous « Autres plats ». */
    fun groupes(): List<Pair<String, List<PlatGere>>> {
        val parSection = plats.groupBy { it.sectionId }
        val groupes = sections.mapNotNull { s -> parSection[s.id]?.takeIf { it.isNotEmpty() }?.let { s.nom to it } }
        val orphelins = plats.filter { p -> p.sectionId == null || sections.none { it.id == p.sectionId } }
        return if (orphelins.isEmpty()) groupes else groupes + ("Autres plats" to orphelins)
    }
}

/** Pré-contrôle d'un plat saisi ; le serveur revérifie tout. Renvoie un message, ou null si tout est correct. */
fun verifierPlatSaisie(nom: String, description: String, prix: String, prixPromo: String): String? {
    val p = prix.trim().toIntOrNull()
    val promo = prixPromo.trim().takeIf { it.isNotEmpty() }?.toIntOrNull()
    return when {
        nom.trim().isEmpty() || nom.trim().length > 120 -> "Le nom du plat est obligatoire (120 caractères au plus)."
        description.trim().length > 500 -> "La description ne peut pas dépasser 500 caractères."
        p == null || p < 0 -> "Indiquez le prix en GNF (nombre entier)."
        prixPromo.isNotBlank() && (promo == null || promo < 0 || promo > p) -> "Le prix promo doit être un nombre entier entre 0 et le prix normal."
        else -> null
    }
}

@Serializable
data class EtatRestaurateur(val restaurant: RestaurantResume? = null, val commandes: List<CommandeRestaurateur> = emptyList())

/** Les commandes rangées par urgence, comme sur la console du site : ce qui attend une réponse d'abord. */
data class CommandesClassees(val aTraiter: List<CommandeRestaurateur>, val enCours: List<CommandeRestaurateur>, val historique: List<CommandeRestaurateur>)

/** « À traiter » : la plus ancienne en premier (c'est celle qui attend depuis le plus longtemps) ; « en cours » et historique : les plus récentes en premier. */
fun classerCommandes(commandes: List<CommandeRestaurateur>): CommandesClassees = CommandesClassees(
    aTraiter = commandes.filter { it.etatDerive == "en_attente" }.sortedBy { it.creeLe },
    enCours = commandes.filter { it.etatDerive in setOf("attente_confirmation_client", "acceptee", "prete") }.sortedByDescending { it.creeLe },
    historique = commandes.filter { it.etatDerive in setOf("terminee", "refusee", "annulee") }.sortedByDescending { it.creeLe },
)

/** Action du restaurateur sur une commande : [code] est celui du serveur ; [destructive] demande une confirmation avant l'envoi. */
data class ActionCommande(val code: String, val libelle: String, val destructive: Boolean = false)

/**
 * Actions proposées d'après l'état d'une commande (même enchaînement que le serveur, qui revérifie toujours) : en attente → accepter / refuser / proposer ;
 * acceptée → prête ; prête → terminée ; toute commande non terminée peut être annulée. Pendant une proposition au client, seule l'annulation reste possible.
 */
fun actionsPossibles(c: CommandeRestaurateur): List<ActionCommande> = when (c.etatDerive) {
    "en_attente" -> listOf(ActionCommande("accepter", "Accepter"), ActionCommande("refuser", "Refuser", destructive = true))
    "acceptee" -> listOf(ActionCommande("prete", "Elle est prête"), ActionCommande("annuler", "Annuler", destructive = true))
    "prete" -> listOf(ActionCommande("terminee", "Remise au client"), ActionCommande("annuler", "Annuler", destructive = true))
    "attente_confirmation_client" -> listOf(ActionCommande("annuler", "Annuler", destructive = true))
    else -> emptyList()
}

fun peutProposer(c: CommandeRestaurateur): Boolean = c.etatDerive == "en_attente"

@Serializable
private data class ReponseCommandesResto(val ok: Boolean = false, val restaurant: RestaurantResume? = null, val commandes: List<CommandeRestaurateur> = emptyList(), val erreur: ErreurServeur? = null)

@Serializable
private data class ReponseMenuResto(val ok: Boolean = false, val sections: List<SectionGeree> = emptyList(), val plats: List<PlatGere> = emptyList(), val erreur: ErreurServeur? = null)

@Serializable
private data class CorpsPaiementResto(val commandeId: String, val decision: String)

@Serializable
private data class CorpsDocumentResto(val commandeId: String, val type: String)

@Serializable
private data class ReponseActionResto(val ok: Boolean = false, val erreur: ErreurServeur? = null)

@Serializable
private data class CorpsActionResto(val commandeId: String, val action: String)

@Serializable
private data class CorpsPropositionResto(val commandeId: String, val nouveauSousTotal: Int, val nouveauxFraisLivraison: Int, val conditionsModifiees: String? = null)

@Serializable
private data class CorpsStatutResto(val champ: String, val valeur: Boolean)

interface RestaurateurApi {
    /** Commandes du restaurant du compte. Lève [ErreurReseau] avec le message du serveur si l'accès est refusé (compte non restaurateur, double authentification...). */
    suspend fun etat(jetonAcces: String): EtatRestaurateur

    /** Chaque action renvoie un message d'erreur lisible, ou null si elle est enregistrée. */
    suspend fun agir(jetonAcces: String, commandeId: String, action: String): String?
    suspend fun proposer(jetonAcces: String, commandeId: String, nouveauSousTotal: Int, nouveauxFraisLivraison: Int, conditions: String?): String?
    suspend fun definirStatut(jetonAcces: String, champ: String, valeur: Boolean): String?

    /** Confirme (« recu ») ou conteste (« non_recu ») le paiement d'une commande. */
    suspend fun confirmerPaiement(jetonAcces: String, commandeId: String, decision: String): String?

    /** Établit le reçu numéroté (« recu ») ou la facture (« facture ») d'une commande. */
    suspend fun emettreDocument(jetonAcces: String, commandeId: String, type: String): String?

    /** Menu du restaurant du compte. Lève [ErreurReseau] avec le message du serveur si l'accès est refusé. */
    suspend fun menu(jetonAcces: String): MenuGere

    /**
     * Modification du menu : [action] vaut « disponibilite », « confirmer », « confirmer_tout », « creer », « modifier », « archiver », « option_ajouter » ou
     * « option_retirer » ; [champs] porte ses paramètres (texte, nombres ou booléens). Renvoie un message d'erreur lisible, ou null si c'est enregistré.
     */
    suspend fun modifierMenu(jetonAcces: String, action: String, champs: Map<String, Any?>): String?
}

class KtorRestaurateurApi(private val client: HttpClient, private val config: SpeedfoodConfig) : RestaurateurApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/restaurant/$chemin"
    private val json = Json { encodeDefaults = true; explicitNulls = false }

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun etat(jetonAcces: String): EtatRestaurateur = appeler {
        val reponse = client.get(url("commandes")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseCommandesResto>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) {
            val message = corps.erreur?.message ?: "Vos commandes n'ont pas pu être chargées. Réessayez dans un instant."
            // Accès refusé (session, compte, double authentification) : distinct d'une coupure réseau, inutile de réessayer tel quel.
            if (corps.erreur?.code == "NON_AUTHENTIFIE" || corps.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        EtatRestaurateur(corps.restaurant, corps.commandes)
    }

    private suspend fun action(chemin: String, jetonAcces: String, corps: String): String? = appeler {
        val reponse = client.post(url(chemin)) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps)
        }
        val lu = try {
            reponse.body<ReponseActionResto>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Vérifiez l'état de la commande puis réessayez."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun agir(jetonAcces: String, commandeId: String, action: String) =
        action("commandes/action", jetonAcces, json.encodeToString(CorpsActionResto.serializer(), CorpsActionResto(commandeId, action)))

    override suspend fun proposer(jetonAcces: String, commandeId: String, nouveauSousTotal: Int, nouveauxFraisLivraison: Int, conditions: String?) =
        action("commandes/proposition", jetonAcces, json.encodeToString(CorpsPropositionResto.serializer(), CorpsPropositionResto(commandeId, nouveauSousTotal, nouveauxFraisLivraison, conditions?.takeIf { it.isNotBlank() })))

    override suspend fun definirStatut(jetonAcces: String, champ: String, valeur: Boolean) =
        action("statut", jetonAcces, json.encodeToString(CorpsStatutResto.serializer(), CorpsStatutResto(champ, valeur)))

    override suspend fun confirmerPaiement(jetonAcces: String, commandeId: String, decision: String) =
        action("commandes/paiement", jetonAcces, json.encodeToString(CorpsPaiementResto.serializer(), CorpsPaiementResto(commandeId, decision)))

    override suspend fun emettreDocument(jetonAcces: String, commandeId: String, type: String) =
        action("commandes/document", jetonAcces, json.encodeToString(CorpsDocumentResto.serializer(), CorpsDocumentResto(commandeId, type)))

    override suspend fun menu(jetonAcces: String): MenuGere = appeler {
        val reponse = client.get(url("menu")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseMenuResto>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "Votre menu n'a pas pu être chargé. Réessayez dans un instant.")
        MenuGere(corps.sections, corps.plats)
    }

    override suspend fun modifierMenu(jetonAcces: String, action: String, champs: Map<String, Any?>): String? {
        val objet = buildJsonObject {
            put("action", action)
            champs.forEach { (cle, valeur) ->
                when (valeur) {
                    null -> Unit
                    is String -> put(cle, valeur)
                    is Boolean -> put(cle, valeur)
                    is Int -> put(cle, valeur)
                    else -> error("type non géré pour $cle")
                }
            }
        }
        return action("menu/action", jetonAcces, objet.toString())
    }
}

/** Alerte de nouvelle commande : sonnerie du téléphone tant que la console est ouverte (alerte application fermée : lot N5, notifications poussées). */
interface AlerteCommande {
    fun sonner()

    /** Garde l'écran allumé pendant que la console est ouverte : un restaurateur ne doit pas rater une commande parce que l'écran s'est éteint. */
    fun garderEcranAllume(actif: Boolean)

    /** La plateforme sait alerter application fermée (Android : service au premier plan avec notification visible, sans Firebase). */
    val arrierePlanPossible: Boolean get() = false

    /** Vrai tant que le service d'arrière-plan tourne : l'application n'ajoute alors pas sa propre sonnerie (le service alerte déjà). */
    val arrierePlanActif: Boolean get() = false

    /** Démarre la surveillance en arrière-plan ; sans effet si elle tourne déjà. À appeler depuis l'application ouverte, après le consentement du restaurateur. */
    fun demarrerArrierePlan() = Unit

    fun arreterArrierePlan() = Unit
}

class AlerteIndisponible : AlerteCommande {
    override fun sonner() = Unit
    override fun garderEcranAllume(actif: Boolean) = Unit
}
