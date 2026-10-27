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
import kotlin.time.Instant

@Serializable
data class FicheLivreur(
    val id: String = "",
    val nom: String = "",
    /** hors_ligne, disponible ou en_course. */
    val statut: String = "hors_ligne",
    val vehicule: String = "",
    /** Cycle de vie de la fiche : seul « actif » permet de travailler. */
    val cycle: String = "candidat",
    val motifCycle: String? = null,
    /** Livreur d'un restaurant : son nom (il ne voit que ses courses) ; null pour le groupe Speedfood. */
    val restaurantNom: String? = null,
)

@Serializable
data class OffreLivreur(
    val offreId: String,
    val expireLe: String,
    val restaurantNom: String = "Restaurant",
    val distanceCourseKm: Double? = null,
    val fraisGnf: Int = 0,
    val distanceRestaurantKm: Double? = null,
) {
    /** Secondes restantes pour répondre (0 si l'offre est expirée ou illisible). */
    fun secondesRestantes(maintenantMillis: Long): Long {
        val fin = try {
            Instant.parse(expireLe).toEpochMilliseconds()
        } catch (_: IllegalArgumentException) {
            return 0L
        }
        return ((fin - maintenantMillis) / 1000).coerceAtLeast(0L)
    }
}

@Serializable
data class ClientCourse(val nom: String = "", val telephone: String = "", val adresse: String? = null)

@Serializable
data class PointCourse(val latitude: Double, val longitude: Double)

@Serializable
data class CourseLivreur(
    val livraisonId: String,
    val statut: String,
    /** « propre » : le personnel du restaurant livre ; « speedfood » : répartition du groupe. */
    val mode: String = "speedfood",
    val libelle: String = "",
    val commandeReference: String = "",
    val commandeStatut: String = "",
    val restaurantNom: String = "Restaurant",
    val restaurantPoint: PointCourse? = null,
    val arriveePoint: PointCourse? = null,
    val fraisGnf: Int = 0,
    /** Seulement après la récupération de la commande : avant, le livreur n'a besoin que du restaurant. */
    val client: ClientCourse? = null,
    /** Quartier de la course (aide à la lecture de la file, sans adresse du client). */
    val quartier: String = "",
    /** Heure de passage prévue, quand le restaurant ou le client en a une. */
    val heurePrevue: String? = null,
)

@Serializable
data class EtatLivreur(
    val livreur: FicheLivreur,
    val offre: OffreLivreur? = null,
    val course: CourseLivreur? = null,
    val positionConnue: Boolean = false,
) {
    /** Le livreur doit être suivi (position envoyée) tant qu'il est en ligne ou en course, avec une fiche active. */
    val doitEtreSuivi: Boolean get() = livreur.cycle == "actif" && livreur.statut != "hors_ligne"
}

/** Étape suivante d'une course, avec le texte du bouton ; [demandeCode] : la remise exige le code à 4 chiffres du client. */
data class EtapeCourse(val vers: String, val libelle: String, val demandeCode: Boolean = false)

/**
 * Étape suivante d'une course d'après son statut et son mode, même chaîne que le serveur (`src/lib/livraison/statuts.ts`) : le serveur revérifie toujours.
 * Groupe Speedfood : assignee → vers_restaurant → recuperee → vers_client → livree. Restaurant qui livre lui-même : assignee → vers_client → livree.
 */
fun etapeSuivante(statut: String, mode: String): EtapeCourse? = when (statut) {
    "assignee" -> if (mode == "propre") EtapeCourse("vers_client", "Je pars chez le client") else EtapeCourse("vers_restaurant", "Je pars au restaurant")
    "vers_restaurant" -> EtapeCourse("recuperee", "J'ai récupéré la commande")
    "recuperee" -> EtapeCourse("vers_client", "Je pars chez le client")
    "vers_client" -> EtapeCourse("livree", "Remettre la commande", demandeCode = true)
    else -> null
}

/** La livraison peut être déclarée non aboutie une fois la commande en main (récupérée ou en route). */
fun peutDeclarerEchec(statut: String): Boolean = statut == "recuperee" || statut == "vers_client"

@Serializable
private data class ReponseEtat(val ok: Boolean = false, val etat: EtatLivreur? = null, val erreur: ErreurServeur? = null)

@Serializable
private data class ReponseAction(val ok: Boolean = false, val erreur: ErreurServeur? = null)

@Serializable
private data class CorpsEnLigne(val enLigne: Boolean)

@Serializable
private data class CorpsPosition(val latitude: Double, val longitude: Double)

@Serializable
private data class CorpsOffre(val offreId: String, val reponse: String)

@Serializable
private data class CorpsCourse(val vers: String, val code: String? = null, val raison: String? = null)

@Serializable
private data class ReponseFile(val ok: Boolean = false, val file: FileLivreur? = null, val erreur: ErreurServeur? = null)

@Serializable
private data class ReponseDossier(val ok: Boolean = false, val dossier: DossierLivreur? = null, val erreur: ErreurServeur? = null)

@Serializable
private data class ReponseHistorique(val ok: Boolean = false, val historique: PageHistoriqueLivreur? = null, val erreur: ErreurServeur? = null)

@Serializable
private data class CorpsHistorique(val page: Int)

interface LivreurApi {
    /** État du livreur ; null si ce compte n'est pas un compte livreur. */
    suspend fun etat(jetonAcces: String): EtatLivreur?

    /** Chaque action renvoie un message d'erreur lisible, ou null si elle est enregistrée. */
    suspend fun enLigne(jetonAcces: String, enLigne: Boolean): String?
    suspend fun position(jetonAcces: String, latitude: Double, longitude: Double): String?
    suspend fun repondreOffre(jetonAcces: String, offreId: String, accepter: Boolean): String?
    suspend fun avancer(jetonAcces: String, vers: String, code: String? = null, raison: String? = null): String?

    /** La file des courses : la course en cours, puis celles qui viennent. Null si ce compte n'est pas un compte livreur. */
    suspend fun file(jetonAcces: String): FileLivreur?

    /** Une page de courses livrées (1 = la plus récente). */
    suspend fun historique(jetonAcces: String, page: Int): PageHistoriqueLivreur?

    /**
     * L'état des pièces du dossier d'activation : à jour ou manquante. Jamais le document, son numéro ni le dossier — le dossier
     * d'identité reste réservé au super administrateur, sur le site.
     */
    suspend fun dossier(jetonAcces: String): DossierLivreur?
}

class KtorLivreurApi(private val client: HttpClient, private val config: SpeedfoodConfig) : LivreurApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/livreur/$chemin"
    private val json = Json { encodeDefaults = false; explicitNulls = false }

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun etat(jetonAcces: String): EtatLivreur? = appeler {
        val reponse = client.get(url("etat")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseEtat>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "Votre espace livreur n'a pas pu être chargé. Réessayez dans un instant.")
        corps.etat
    }

    private suspend fun action(chemin: String, jetonAcces: String, corps: String): String? = appeler {
        val reponse = client.post(url(chemin)) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps)
        }
        val lu = try {
            reponse.body<ReponseAction>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Vérifiez l'état de votre course puis réessayez."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant."
    }

    override suspend fun enLigne(jetonAcces: String, enLigne: Boolean) = action("en-ligne", jetonAcces, json.encodeToString(CorpsEnLigne.serializer(), CorpsEnLigne(enLigne)))

    override suspend fun position(jetonAcces: String, latitude: Double, longitude: Double) =
        action("position", jetonAcces, json.encodeToString(CorpsPosition.serializer(), CorpsPosition(latitude, longitude)))

    override suspend fun repondreOffre(jetonAcces: String, offreId: String, accepter: Boolean) =
        action("offre", jetonAcces, json.encodeToString(CorpsOffre.serializer(), CorpsOffre(offreId, if (accepter) "acceptee" else "refusee")))

    override suspend fun avancer(jetonAcces: String, vers: String, code: String?, raison: String?) =
        action("course", jetonAcces, json.encodeToString(CorpsCourse.serializer(), CorpsCourse(vers, code, raison)))

    override suspend fun file(jetonAcces: String): FileLivreur? = appeler {
        val reponse = client.get(url("file")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseFile>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "Votre file de courses n'a pas pu être chargée. Réessayez dans un instant.")
        corps.file
    }

    override suspend fun historique(jetonAcces: String, page: Int): PageHistoriqueLivreur? = appeler {
        val reponse = client.post(url("historique")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsHistorique.serializer(), CorpsHistorique(page.coerceAtLeast(1))))
        }
        val corps = try {
            reponse.body<ReponseHistorique>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "Votre historique n'a pas pu être chargé. Réessayez dans un instant.")
        corps.historique
    }

    override suspend fun dossier(jetonAcces: String): DossierLivreur? = appeler {
        val reponse = client.get(url("dossier")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val corps = try {
            reponse.body<ReponseDossier>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!corps.ok) throw ErreurReseau(corps.erreur?.message ?: "L'état de votre dossier n'a pas pu être vérifié. Réessayez dans un instant.")
        corps.dossier
    }
}

/**
 * Position du téléphone du livreur. Chaque plateforme fournit la sienne ; ailleurs, [PositionIndisponible]. Lot N4a : la position n'est lue que pendant
 * que l'application est ouverte (écran gardé allumé) ; la lecture en arrière-plan, avec consentement, est le lot N4b.
 */
interface FournisseurPosition {
    /** La plateforme sait lire la position. */
    val disponible: Boolean

    /** La personne a autorisé la lecture de la position. */
    fun autorisee(): Boolean

    /** Ouvre la demande d'autorisation du système (réponse asynchrone : relire [autorisee]). */
    fun demanderAutorisation()

    /** Commence à lire la position ; [surPosition] reçoit (latitude, longitude) à chaque nouvelle mesure. */
    fun demarrer(surPosition: (Double, Double) -> Unit)

    fun arreter()

    /** Garde l'écran allumé tant que le livreur travaille (sans cela, le système coupe la lecture). */
    fun garderEcranAllume(actif: Boolean)

    /** La plateforme sait poursuivre le suivi application fermée ou écran éteint (Android : service au premier plan avec notification visible). */
    val arrierePlanPossible: Boolean get() = false

    /** Démarre le suivi en arrière-plan ; sans effet s'il est déjà actif. À appeler depuis l'application ouverte, après le consentement du livreur. */
    fun demarrerArrierePlan() = Unit

    fun arreterArrierePlan() = Unit
}

class PositionIndisponible : FournisseurPosition {
    override val disponible = false
    override fun autorisee() = false
    override fun demanderAutorisation() = Unit
    override fun demarrer(surPosition: (Double, Double) -> Unit) = Unit
    override fun arreter() = Unit
    override fun garderEcranAllume(actif: Boolean) = Unit
}
