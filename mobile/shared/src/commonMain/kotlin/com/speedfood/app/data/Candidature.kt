package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Moyens de paiement et services proposés dans le formulaire (mêmes valeurs que la base et que la fiche d'un restaurant). */
val MOYENS_PAIEMENT_CANDIDATURE = listOf("especes" to "Espèces", "orange_money" to "Orange Money", "mtn_momo" to "MTN MoMo")
val SERVICES_CANDIDATURE = listOf("livraison" to "Livraison", "retrait" to "Retrait", "sur_place" to "Sur place")

const val NOMBRE_ETAPES_CANDIDATURE = 5
const val PRIX_PLAT_MIN_GNF = 100
const val PRIX_PLAT_MAX_GNF = 1_000_000
const val MAX_PLATS_CANDIDATURE = 80

@Serializable
data class PlatCandidature(val nom: String, val prix: Int)

/** Ce que la personne a saisi, gardé sur le téléphone (jamais envoyé avant « Envoyer ma demande »). Les photos restent en mémoire : à rechoisir si l'application est fermée. */
@Serializable
data class BrouillonCandidature(
    val etape: Int = 0,
    val nom: String = "",
    val quartierId: String = "",
    val quartierNom: String = "",
    val indications: String = "",
    val telephone: String = "",
    val prenom: String = "",
    val nomResponsable: String = "",
    val categories: String = "",
    val horaires: String = "",
    val moyensPaiement: List<String> = emptyList(),
    val services: List<String> = listOf("livraison", "retrait"),
    val plats: List<PlatCandidature> = emptyList(),
)

/** Le message d'erreur d'une étape, ou null si elle est complète. Même règles que le serveur, pour répondre tout de suite ; le serveur revérifie toujours. */
fun erreurEtapeCandidature(etape: Int, b: BrouillonCandidature): String? = when (etape) {
    0 -> when {
        b.nom.trim().length < 2 -> "Indiquez le nom de votre restaurant."
        b.quartierId.isBlank() -> "Choisissez le quartier de votre restaurant."
        b.prenom.isBlank() || b.nomResponsable.isBlank() -> "Indiquez votre prénom et votre nom."
        normaliserTelephone(b.telephone) == null -> "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56)."
        else -> null
    }
    1 -> when {
        b.horaires.trim().length < 3 -> "Indiquez vos horaires (par exemple : tous les jours, 9h à 22h)."
        b.services.isEmpty() -> "Choisissez au moins un service : livraison, retrait ou sur place."
        else -> null
    }
    else -> null
}

/** Prix saisi (« 25 000 », « 25000 ») en GNF entier, ou null s'il est invalide. Jamais de décimale. */
fun lirePrixPlat(texte: String): Int? {
    val chiffres = texte.filter { !it.isWhitespace() }
    if (chiffres.isEmpty() || !chiffres.all { it.isDigit() } || chiffres.length > 9) return null
    return chiffres.toInt().takeIf { it in PRIX_PLAT_MIN_GNF..PRIX_PLAT_MAX_GNF }
}

/** Ajoute un plat au brouillon, ou dit pourquoi pas. */
fun ajouterPlatCandidature(b: BrouillonCandidature, nom: String, prixTexte: String): Pair<BrouillonCandidature?, String?> {
    val n = nom.trim()
    val prix = lirePrixPlat(prixTexte)
    return when {
        n.length < 2 -> null to "Indiquez le nom du plat (2 caractères au moins)."
        prix == null -> null to "Indiquez un prix en GNF, entier, entre $PRIX_PLAT_MIN_GNF et $PRIX_PLAT_MAX_GNF."
        b.plats.size >= MAX_PLATS_CANDIDATURE -> null to "Vous pouvez ajouter $MAX_PLATS_CANDIDATURE plats ici : l'équipe complétera le reste avec vous."
        else -> b.copy(plats = b.plats + PlatCandidature(n, prix)) to null
    }
}

/** Une ligne lue sur la photo du menu, que la personne relit avant de l'ajouter (le prix reste un texte tant qu'elle peut le corriger). */
data class LignePropose(val nom: String, val prix: String, val coche: Boolean = true)

@Serializable
data class PlatRefuseLu(val brut: String = "", val raison: String = "")

/** Ce que le serveur a lu sur la photo : les plats valides, les lignes écartées avec leur raison, et `etat` (`plats`, `vide` ou `indetermine`). */
@Serializable
data class LectureMenu(val plats: List<PlatCandidature> = emptyList(), val refuses: List<PlatRefuseLu> = emptyList(), val etat: String = "plats")

fun lignesProposees(lecture: LectureMenu): List<LignePropose> = lecture.plats.map { LignePropose(it.nom, it.prix.toString()) }

/** Ajoute au brouillon les lignes cochées, après les mêmes contrôles qu'une saisie à la main. Une seule ligne invalide : rien n'est ajouté et la ligne est nommée. */
fun ajouterLignesCochees(b: BrouillonCandidature, lignes: List<LignePropose>): Pair<BrouillonCandidature?, String?> {
    var courant = b
    lignes.filter { it.coche }.forEachIndexed { i, l ->
        val (suivant, erreur) = ajouterPlatCandidature(courant, l.nom, l.prix)
        if (suivant == null) return null to "Ligne ${i + 1} (${l.nom.ifBlank { "sans nom" }}) : $erreur"
        courant = suivant
    }
    return courant to null
}

/** Corps envoyé au serveur : jamais l'e-mail, la commune ni le nom du quartier (le serveur les retrouve par l'identifiant). */
fun corpsCandidature(b: BrouillonCandidature): JsonObject = buildJsonObject {
    put("nom", b.nom.trim())
    put("quartierId", b.quartierId)
    put("indications", b.indications.trim())
    put("categories", b.categories.trim())
    put("horaires", b.horaires.trim())
    put("telephone", normaliserTelephone(b.telephone) ?: b.telephone)
    put("responsable", buildJsonObject {
        put("prenom", b.prenom.trim())
        put("nom", b.nomResponsable.trim())
    })
    put("moyensPaiement", JsonArray(b.moyensPaiement.map { JsonPrimitive(it) }))
    put("services", JsonArray(b.services.map { JsonPrimitive(it) }))
    put("plats", JsonArray(b.plats.map { buildJsonObject { put("nom", it.nom); put("prix", it.prix) } }))
}

/** La demande du compte, vue par le candidat (cinq états simples : `recue`, `en_cours`, `acceptee`, `creee`, `refusee`). */
@Serializable
data class VueCandidature(
    val id: String = "",
    val etat: String = "recue",
    val libelleEtat: String = "Demande reçue",
    val nom: String = "",
    val deposeeLe: String = "",
    val delaiHeures: Int = 48,
    val reponseAttendueLe: String? = null,
    val motifRefus: String? = null,
    val aLogo: Boolean = false,
    val aPhoto: Boolean = false,
    val nombrePlats: Int = 0,
)

@Serializable
private data class ErreurCandidature(val code: String = "", val message: String = "")

@Serializable
private data class ReponseLecture(val ok: Boolean = false, val lecture: LectureMenu? = null, val erreur: ErreurCandidature? = null)

@Serializable
private data class ReponseCandidature(val ok: Boolean = false, val candidature: VueCandidature? = null, val erreur: ErreurCandidature? = null)

interface CandidatureApi {
    /** La demande la plus récente du compte, ou null s'il n'en a pas. */
    suspend fun lire(jetonAcces: String): VueCandidature?

    suspend fun deposer(jetonAcces: String, brouillon: BrouillonCandidature): VueCandidature

    suspend fun envoyerImage(jetonAcces: String, type: String, photo: PhotoChoisie): VueCandidature

    /** Fait lire une photo de menu par le serveur (rien n'est conservé) ; la liste revient pour relecture. */
    suspend fun lireMenu(jetonAcces: String, photo: PhotoChoisie): LectureMenu
}

class KtorCandidatureApi(private val client: HttpClient, private val config: SpeedfoodConfig) : CandidatureApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    private fun lu(r: ReponseCandidature, defaut: String): VueCandidature {
        if (r.ok && r.candidature != null) return r.candidature
        val message = r.erreur?.message ?: defaut
        if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
        throw ErreurReseau(message)
    }

    private suspend fun corps(reponse: io.ktor.client.statement.HttpResponse): ReponseCandidature = try {
        reponse.body()
    } catch (e: Exception) {
        throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
    }

    override suspend fun lire(jetonAcces: String): VueCandidature? = appeler {
        val r = corps(client.get(url("candidature")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") })
        if (r.ok) r.candidature else lu(r, "Votre demande n'a pas pu être chargée.")
    }

    override suspend fun deposer(jetonAcces: String, brouillon: BrouillonCandidature): VueCandidature = appeler {
        val r = corps(
            client.post(url("candidature")) {
                header(HttpHeaders.Authorization, "Bearer $jetonAcces")
                contentType(ContentType.Application.Json)
                setBody(corpsCandidature(brouillon).toString())
            },
        )
        lu(r, "Votre demande n'a pas pu être envoyée. Réessayez dans un instant.")
    }

    override suspend fun envoyerImage(jetonAcces: String, type: String, photo: PhotoChoisie): VueCandidature = appeler {
        val reponse = client.submitFormWithBinaryData(
            url("candidature/image"),
            formData {
                append("type", type)
                append("fichier", photo.octets, Headers.build {
                    append(HttpHeaders.ContentType, photo.type)
                    append(HttpHeaders.ContentDisposition, "filename=\"$type.jpg\"")
                })
            },
        ) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        lu(corps(reponse), "L'image n'a pas pu être envoyée. Réessayez dans un instant.")
    }

    override suspend fun lireMenu(jetonAcces: String, photo: PhotoChoisie): LectureMenu = appeler {
        val reponse = client.submitFormWithBinaryData(
            url("candidature/menu-photo"),
            formData {
                append("fichier", photo.octets, Headers.build {
                    append(HttpHeaders.ContentType, photo.type)
                    append(HttpHeaders.ContentDisposition, "filename=\"menu.jpg\"")
                })
            },
        ) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val r: ReponseLecture = try {
            reponse.body()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (r.ok && r.lecture != null) return@appeler r.lecture
        val message = r.erreur?.message ?: "La photo n'a pas pu être lue. Saisissez les plats à la main."
        if (r.erreur?.code == "NON_AUTHENTIFIE" || r.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
        throw ErreurReseau(message)
    }
}

/** Brouillon gardé sur le téléphone entre deux ouvertures : la personne reprend où elle s'est arrêtée. Effacé après l'envoi. */
class BrouillonCandidatureStockage(private val stockage: StockageLocal) {
    fun lire(): BrouillonCandidature = stockage.lire(CLE)?.let { runCatching { Json.decodeFromString<BrouillonCandidature>(it) }.getOrNull() } ?: BrouillonCandidature()

    fun ecrire(b: BrouillonCandidature) = stockage.ecrire(CLE, Json.encodeToString(b))

    fun effacer() = stockage.effacer(CLE)

    private companion object {
        const val CLE = "candidature_brouillon"
    }
}
