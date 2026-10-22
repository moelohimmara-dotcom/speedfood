package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Une section de l'espace admin (même chemin que sur le site) ; [natif] : elle a son écran dans l'application, sinon elle s'ouvre sur le site. */
@Serializable
data class EntreeMenuEquipe(val chemin: String, val libelle: String, val natif: Boolean = false)

@Serializable
data class GroupeMenuEquipe(val libelle: String, val entrees: List<EntreeMenuEquipe> = emptyList())

/** Rôle et menu de la personne connectée dans l'équipe Speedfood : déjà filtrés par permission côté serveur. */
@Serializable
data class AccesEquipe(val role: String = "", val permissions: List<String> = emptyList(), val groupes: List<GroupeMenuEquipe> = emptyList())

@Serializable
data class LigneEquipe(val nom: String = "", val quantite: Int = 1)

/** Une commande d'un établissement tenu par l'équipe, à faire avancer depuis le poste de répartition. */
@Serializable
data class CommandeEquipe(
    val id: String,
    val reference: String = "",
    val statut: String = "",
    val mode: String = "",
    val sousTotal: Int = 0,
    val fraisLivraison: Int = 0,
    val creeLe: String = "",
    val estTest: Boolean = false,
    val restaurantId: String = "",
    val restaurantNom: String = "",
    val telephoneRestaurant: String? = null,
    val lignes: List<LigneEquipe> = emptyList(),
) {
    val total: Int get() = sousTotal + fraisLivraison
}

/** Une action possible sur une commande : [code] est celui du serveur, [libelle] ce qui s'affiche, [destructive] pour les confirmer d'un cran de plus. */
data class ActionEquipe(val code: String, val libelle: String, val destructive: Boolean = false)

/** Les mêmes actions que le poste de répartition du site, selon le statut. */
fun actionsEquipe(statut: String): List<ActionEquipe> = when (statut) {
    "en_attente" -> listOf(
        ActionEquipe("accepter", "Confirmée par le restaurant"),
        ActionEquipe("refuser", "Refusée par le restaurant", destructive = true),
        ActionEquipe("annuler", "Annuler", destructive = true),
    )
    "acceptee" -> listOf(ActionEquipe("prete", "Prête"), ActionEquipe("annuler", "Annuler", destructive = true))
    "prete" -> listOf(ActionEquipe("terminee", "Remise au client"))
    else -> emptyList()
}

/** Numéro composable (chiffres et « + » seulement) ; null s'il n'y a rien à appeler. */
fun numeroAppel(brut: String?): String? = brut?.filter { it.isDigit() || it == '+' }?.takeIf { it.length >= 6 }

/** Une commande vue par le support : coordonnées TOUJOURS masquées par la base tant qu'elles ne sont pas révélées (motif + audit). */
@Serializable
data class CommandeSupport(
    val id: String,
    val reference: String = "",
    val restaurantNom: String = "",
    val restaurantId: String? = null,
    val statut: String = "",
    val mode: String = "",
    val clientNom: String = "",
    val telephoneAffiche: String = "",
    val adresseAffichee: String = "",
    val sousTotal: Int = 0,
    val fraisLivraisonEstime: Int = 0,
    val creeLe: String = "",
    val historique: List<EvenementSupport> = emptyList(),
    val propositions: List<PropositionSupport> = emptyList(),
) {
    val total: Int get() = sousTotal + fraisLivraisonEstime
}

@Serializable
data class EvenementSupport(val statutPrecedent: String? = null, val statutSuivant: String = "", val acteur: String = "", val horodatage: String = "")

@Serializable
data class PropositionSupport(
    val version: Int = 0,
    val sousTotalPrecedent: Int = 0,
    val nouveauSousTotal: Int = 0,
    val fraisLivraisonPrecedent: Int? = null,
    val nouveauxFraisLivraison: Int = 0,
    val conditionsModifiees: String? = null,
    val statut: String = "",
    val expireLe: String? = null,
    val creeLe: String = "",
    val reponduLe: String? = null,
)

/** Détail d'une commande pour le support : [transitions] = statuts possibles (règle du serveur, vide si le compte ne peut pas agir) ; [peutReveler] : droit de voir les coordonnées. */
@Serializable
data class DetailSupport(val commande: CommandeSupport, val transitions: List<String> = emptyList(), val peutReveler: Boolean = false)

@Serializable
data class CoordonneesClient(val telephone: String = "", val adresse: String = "", val devoilees: Boolean = false)

/** Libellé lisible d'un statut de commande (mêmes mots que le site). */
fun libelleStatutCommande(statut: String): String = when (statut) {
    "en_attente" -> "En attente"
    "acceptee" -> "Acceptée"
    "refusee" -> "Refusée"
    "prete" -> "Prête"
    "terminee" -> "Terminée"
    "annulee" -> "Annulée"
    "expiree" -> "Expirée"
    else -> statut
}

/** Filtres de statut proposés dans la recherche (« tous » en premier). */
val STATUTS_RECHERCHE = listOf("tous", "en_attente", "acceptee", "prete", "terminee", "refusee", "annulee")

@Serializable
private data class ReponseCommandesSupport(val ok: Boolean = false, val commandes: List<CommandeSupport> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseDetailSupport(val ok: Boolean = false, val commande: CommandeSupport? = null, val transitions: List<String> = emptyList(), val peutReveler: Boolean = false, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseCoordonnees(val ok: Boolean = false, val coordonnees: CoordonneesClient? = null, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class CorpsStatutSupport(val vers: String, val motif: String)

@Serializable
private data class CorpsMotif(val motif: String)

@Serializable
data class OffreEquipe(val livreurNom: String = "", val expireLe: String = "")

/** Une livraison vue par l'exploitation : course en cours, livreur sollicité ou affecté. */
@Serializable
data class LivraisonEquipe(
    val id: String,
    val commandeReference: String = "",
    val restaurantNom: String = "",
    val mode: String = "",
    val statut: String = "",
    val libelle: String = "",
    val livreurId: String? = null,
    val livreurNom: String? = null,
    val fraisGnf: Int = 0,
    val distanceKm: Double? = null,
    val creeLe: String = "",
    val offreEnCours: OffreEquipe? = null,
    val raison: String? = null,
)

/** Fiche d'un livreur (jamais son dossier d'identité : il reste réservé au super administrateur, sur le site). */
@Serializable
data class LivreurEquipe(
    val id: String,
    val nom: String = "",
    val telephone: String? = null,
    val cycle: String = "",
    val motifCycle: String? = null,
    val vehicule: String = "",
    val statut: String = "",
    val simule: Boolean = false,
    val aPosition: Boolean = false,
)

@Serializable
data class ExploitationLivraison(val livraisons: List<LivraisonEquipe> = emptyList(), val livreurs: List<LivreurEquipe> = emptyList())

/** Retour d'une action d'exploitation : le message du serveur (succès ou refus). */
data class RetourEquipe(val ok: Boolean, val message: String)

private val STATUTS_LIVRAISON_FINAUX = setOf("livree", "echec", "annulee")

/** Prochaine étape d'une livraison (mêmes libellés que le site), ou null si elle est terminée ou sans étape manuelle. */
fun etapeSuivanteLivraison(l: LivraisonEquipe): Pair<String, String>? = when {
    l.statut in STATUTS_LIVRAISON_FINAUX -> null
    l.mode == "speedfood" -> when (l.statut) {
        "assignee" -> "vers_restaurant" to "Le livreur part au restaurant"
        "vers_restaurant" -> "recuperee" to "Commande récupérée"
        "recuperee" -> "vers_client" to "Parti chez le client"
        "vers_client" -> "livree" to "Marquer livrée"
        else -> null
    }
    else -> when (l.statut) {
        "assignee" -> "vers_client" to "Parti livrer"
        "vers_client" -> "livree" to "Marquer livrée"
        else -> null
    }
}

/** Une course est « en recherche de livreur » quand c'est un livreur Speedfood et qu'aucun n'est encore affecté. */
fun enRechercheDeLivreur(l: LivraisonEquipe): Boolean = l.mode == "speedfood" && (l.statut == "a_assigner" || l.statut == "offre_envoyee")

fun livraisonTerminee(l: LivraisonEquipe): Boolean = l.statut in STATUTS_LIVRAISON_FINAUX

/** Actions possibles sur un livreur selon son cycle de vie : (code, libellé, motif obligatoire). */
fun actionsLivreur(l: LivreurEquipe): List<Triple<String, String, Boolean>> = when (l.cycle) {
    "candidat" -> listOf(Triple("approuver", "Approuver", false), Triple("refuser", "Refuser la candidature", true))
    "actif" -> buildList {
        if (l.statut != "en_course") add(if (l.statut == "disponible") Triple("hors_ligne", "Mettre hors ligne", false) else Triple("en_ligne", "Mettre en ligne", false))
        add(Triple("suspendre", "Suspendre", true))
        add(Triple("archiver", "Archiver", true))
    }
    "suspendu" -> listOf(Triple("reactiver", "Réactiver", false), Triple("archiver", "Archiver", true))
    "cree", "invite" -> listOf(Triple("archiver", "Archiver", true))
    else -> emptyList()
}

@Serializable
private data class ReponseExploitation(val ok: Boolean = false, val livraisons: List<LivraisonEquipe> = emptyList(), val livreurs: List<LivreurEquipe> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseMessage(val ok: Boolean = false, val message: String = "", val erreur: ErreurServeurEquipe? = null)

/** Chiffres du tableau de bord de l'équipe : un bloc par domaine, présent seulement si le rôle y a droit (null = pas concerné, jamais « 0 » par défaut). */
@Serializable
data class TableauEquipe(
    val commandes: BlocCommandes? = null,
    val exploitation: BlocExploitation? = null,
    val catalogue: BlocCatalogue? = null,
)

@Serializable
data class BlocCommandes(val activesDuJour: Int = 0, val enAttente: Int = 0, val propositionsEnAttente: Int = 0)

@Serializable
data class BlocExploitation(
    val aConfirmer: Int = 0,
    val etablissementsSansTelephone: Int = 0,
    val coursesSansLivreur: Int = 0,
    val livreursEnLigne: Int = 0,
    val candidatsLivreurs: Int = 0,
)

@Serializable
data class BlocCatalogue(val enAttenteValidation: Int = 0, val publies: Int = 0, val suspendus: Int = 0, val aCorriger: Int = 0, val platsAReconfirmer: Int = 0)

/** Fraîcheur du menu d'un établissement tenu par l'équipe. */
@Serializable
data class MenuEquipeResume(val restaurantId: String, val nom: String = "", val plats: Int = 0, val aReconfirmer: Int = 0, val epuises: Int = 0, val derniereConfirmation: String? = null)

@Serializable
data class PlatMenuEquipe(val id: String, val nom: String = "", val prix: Int = 0, val disponible: Boolean = true, val confirmeLe: String? = null, val etat: String = "")

@Serializable
data class DetailMenuEquipe(val nom: String = "", val plats: List<PlatMenuEquipe> = emptyList())

/** Nombre de points qui demandent une action de l'équipe maintenant (sert d'indicateur d'alerte en tête de tableau). */
fun alertesEquipe(t: TableauEquipe): Int =
    (t.exploitation?.let { it.aConfirmer + it.coursesSansLivreur + it.etablissementsSansTelephone + it.candidatsLivreurs } ?: 0) +
        (t.commandes?.propositionsEnAttente ?: 0) + (t.catalogue?.let { it.enAttenteValidation + it.aCorriger + (if (it.platsAReconfirmer > 0) 1 else 0) } ?: 0)

@Serializable
private data class ReponseTableau(val ok: Boolean = false, val commandes: BlocCommandes? = null, val exploitation: BlocExploitation? = null, val catalogue: BlocCatalogue? = null, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseMenus(val ok: Boolean = false, val menus: List<MenuEquipeResume> = emptyList(), val fraicheurHeures: Int = 6, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseMenuDetail(val ok: Boolean = false, val nom: String = "", val plats: List<PlatMenuEquipe> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ErreurServeurEquipe(val code: String = "", val message: String = "")

@Serializable
private data class ReponseMoi(val ok: Boolean = false, val role: String = "", val permissions: List<String> = emptyList(), val groupes: List<GroupeMenuEquipe> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseRepartition(val ok: Boolean = false, val commandes: List<CommandeEquipe> = emptyList(), val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class ReponseActionEquipe(val ok: Boolean = false, val erreur: ErreurServeurEquipe? = null)

@Serializable
private data class CorpsActionEquipe(val commandeId: String, val action: String)

interface EquipeApi {
    /** Rôle et menu du compte. Lève [ErreurAcces] si le compte n'a aucun rôle dans l'équipe (ou si son accès est refusé), [ErreurReseau] sinon. */
    suspend fun moi(jetonAcces: String): AccesEquipe

    /** Commandes actives des établissements tenus par l'équipe (poste de répartition). */
    suspend fun repartition(jetonAcces: String): List<CommandeEquipe>

    /** Fait avancer une commande. Renvoie un message d'erreur lisible, ou null si c'est enregistré. */
    suspend fun agir(jetonAcces: String, commandeId: String, action: String): String?

    /** Recherche de commandes (support). [statut] vaut « tous » ou un statut ; [reference] : début ou totalité de la référence. */
    suspend fun commandes(jetonAcces: String, reference: String, statut: String, jour: Boolean): List<CommandeSupport>

    /** Détail d'une commande (support), avec les statuts possibles et le droit de révéler les coordonnées. */
    suspend fun commande(jetonAcces: String, commandeId: String): DetailSupport

    /** Action de support sur le statut : motif obligatoire. Renvoie un message d'erreur lisible, ou null si c'est enregistré (et tracé). */
    suspend fun changerStatut(jetonAcces: String, commandeId: String, vers: String, motif: String): String?

    /** Révèle téléphone et adresse (motif obligatoire, tracé avant affichage). Lève [ErreurReseau]/[ErreurAcces] avec le message du serveur en cas de refus. */
    suspend fun reveler(jetonAcces: String, commandeId: String, motif: String): CoordonneesClient

    /** Tableau de bord de l'équipe (chiffres du jour, alertes). Lève [ErreurAcces]/[ErreurReseau] avec le message du serveur. */
    suspend fun tableau(jetonAcces: String): TableauEquipe

    /** Fraîcheur des menus des établissements tenus par l'équipe, et la durée de fraîcheur (heures). */
    suspend fun menus(jetonAcces: String): Pair<List<MenuEquipeResume>, Int>

    suspend fun menu(jetonAcces: String, restaurantId: String): DetailMenuEquipe

    /** Reconfirme un plat ([platId]) ou tout le menu (null). */
    suspend fun reconfirmer(jetonAcces: String, restaurantId: String, platId: String?): RetourEquipe

    /** Plat épuisé (false) ou remis en vente (true). */
    suspend fun definirDisponibilite(jetonAcces: String, restaurantId: String, platId: String, disponible: Boolean): RetourEquipe

    /** Livraisons récentes et fiches des livreurs (exploitation). */
    suspend fun exploitation(jetonAcces: String): ExploitationLivraison

    /** Action sur une livraison : « assigner » (+ livreurId), « relancer », « avancer » (+ vers), « annuler » (+ raison). */
    suspend fun actionLivraison(jetonAcces: String, livraisonId: String, action: String, parametres: Map<String, String>): RetourEquipe

    /** Action sur un livreur : « en_ligne », « hors_ligne », « approuver », « refuser », « suspendre », « reactiver », « archiver » (+ motif). */
    suspend fun actionLivreur(jetonAcces: String, livreurId: String, action: String, motif: String?): RetourEquipe
}

class KtorEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : EquipeApi {
    private val json = Json { encodeDefaults = true; explicitNulls = false }
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    private fun refus(erreur: ErreurServeurEquipe?, defaut: String): Nothing {
        val message = erreur?.message ?: defaut
        if (erreur?.code == "NON_AUTHENTIFIE" || erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
        throw ErreurReseau(message)
    }

    override suspend fun moi(jetonAcces: String): AccesEquipe = appeler {
        val r = try {
            client.get(url("moi")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseMoi>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Votre accès n'a pas pu être vérifié. Réessayez dans un instant.")
        AccesEquipe(r.role, r.permissions, r.groupes)
    }

    override suspend fun repartition(jetonAcces: String): List<CommandeEquipe> = appeler {
        val r = try {
            client.get(url("repartition")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseRepartition>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Les commandes n'ont pas pu être chargées. Réessayez dans un instant.")
        r.commandes
    }

    override suspend fun agir(jetonAcces: String, commandeId: String, action: String): String? = appeler {
        val reponse = client.post(url("repartition/action")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsActionEquipe.serializer(), CorpsActionEquipe(commandeId, action)))
        }
        val lu = try {
            reponse.body<ReponseActionEquipe>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état de la commande."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun commandes(jetonAcces: String, reference: String, statut: String, jour: Boolean): List<CommandeSupport> = appeler {
        val r = try {
            client.get(url("commandes")) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                parameter("statut", statut)
                if (reference.isNotBlank()) parameter("reference", reference.trim())
                if (jour) parameter("jour", "1")
            }.body<ReponseCommandesSupport>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Les commandes n'ont pas pu être chargées. Réessayez dans un instant.")
        r.commandes
    }

    override suspend fun commande(jetonAcces: String, commandeId: String): DetailSupport = appeler {
        val r = try {
            client.get(url("commandes/$commandeId")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseDetailSupport>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        val commande = r.commande
        if (!r.ok || commande == null) refus(r.erreur, "Cette commande n'a pas pu être chargée. Réessayez dans un instant.")
        DetailSupport(commande, r.transitions, r.peutReveler)
    }

    override suspend fun changerStatut(jetonAcces: String, commandeId: String, vers: String, motif: String): String? = appeler {
        val reponse = client.post(url("commandes/$commandeId/statut")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsStatutSupport.serializer(), CorpsStatutSupport(vers, motif)))
        }
        val lu = try {
            reponse.body<ReponseActionEquipe>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Actualisez pour voir l'état de la commande."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun menus(jetonAcces: String): Pair<List<MenuEquipeResume>, Int> = appeler {
        val r = try {
            client.get(url("menus")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseMenus>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Les menus n'ont pas pu être chargés. Réessayez dans un instant.")
        r.menus to r.fraicheurHeures
    }

    override suspend fun menu(jetonAcces: String, restaurantId: String): DetailMenuEquipe = appeler {
        val r = try {
            client.get(url("menus/$restaurantId")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseMenuDetail>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Ce menu n'a pas pu être chargé. Réessayez dans un instant.")
        DetailMenuEquipe(r.nom, r.plats)
    }

    override suspend fun reconfirmer(jetonAcces: String, restaurantId: String, platId: String?): RetourEquipe {
        val corps = buildJsonObject {
            put("restaurantId", restaurantId)
            if (platId != null) put("platId", platId)
        }
        return envoyerAction("menus/confirmer", jetonAcces, corps.toString())
    }

    override suspend fun definirDisponibilite(jetonAcces: String, restaurantId: String, platId: String, disponible: Boolean): RetourEquipe {
        val corps = buildJsonObject {
            put("restaurantId", restaurantId)
            put("platId", platId)
            put("disponible", disponible)
        }
        return envoyerAction("menus/disponibilite", jetonAcces, corps.toString())
    }

    override suspend fun tableau(jetonAcces: String): TableauEquipe = appeler {
        val r = try {
            client.get(url("tableau")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseTableau>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Le tableau de bord n'a pas pu être chargé. Réessayez dans un instant.")
        TableauEquipe(r.commandes, r.exploitation, r.catalogue)
    }

    override suspend fun exploitation(jetonAcces: String): ExploitationLivraison = appeler {
        val r = try {
            client.get(url("livraisons")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseExploitation>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) refus(r.erreur, "Les livraisons n'ont pas pu être chargées. Réessayez dans un instant.")
        ExploitationLivraison(r.livraisons, r.livreurs)
    }

    private suspend fun envoyerAction(chemin: String, jetonAcces: String, corps: String): RetourEquipe = appeler {
        val reponse = client.post(url(chemin)) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps)
        }
        val lu = try {
            reponse.body<ReponseMessage>()
        } catch (e: Exception) {
            return@appeler RetourEquipe(false, "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel.")
        }
        if (lu.ok) RetourEquipe(true, lu.message) else RetourEquipe(false, lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant.")
    }

    override suspend fun actionLivraison(jetonAcces: String, livraisonId: String, action: String, parametres: Map<String, String>): RetourEquipe {
        val corps = buildJsonObject {
            put("action", action)
            put("livraisonId", livraisonId)
            parametres.forEach { (cle, valeur) -> put(cle, valeur) }
        }
        return envoyerAction("livraisons/action", jetonAcces, corps.toString())
    }

    override suspend fun actionLivreur(jetonAcces: String, livreurId: String, action: String, motif: String?): RetourEquipe {
        val corps = buildJsonObject {
            put("action", action)
            put("livreurId", livreurId)
            if (motif != null) put("motif", motif)
        }
        return envoyerAction("livreurs/action", jetonAcces, corps.toString())
    }

    override suspend fun reveler(jetonAcces: String, commandeId: String, motif: String): CoordonneesClient = appeler {
        val reponse = client.post(url("commandes/$commandeId/coordonnees")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsMotif.serializer(), CorpsMotif(motif)))
        }
        val r = try {
            reponse.body<ReponseCoordonnees>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        val coordonnees = r.coordonnees
        if (!r.ok || coordonnees == null) refus(r.erreur, "Les coordonnées n'ont pas pu être révélées.")
        coordonnees
    }
}
