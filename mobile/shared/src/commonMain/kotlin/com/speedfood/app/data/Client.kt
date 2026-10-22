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
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Profil d'un compte client : un pseudo et un avatar (liste fermée, pas de photo), préférences de commande. */
@Serializable
data class ProfilClient(val pseudo: String = "", val avatar: String = "", val modePrefere: String? = null, val notificationsCommande: Boolean = true)

@Serializable
data class AdresseClient(val id: String, val libelle: String = "", val adresse: String = "", val parDefaut: Boolean = false)

@Serializable
data class FavoriClient(val restaurantId: String, val nom: String = "", val ouvert: Boolean = false)

@Serializable
data class AvisClient(
    val id: String,
    val restaurantNom: String = "",
    val note: Int = 0,
    val commentaire: String? = null,
    val statut: String = "",
    val reponse: String? = null,
    val creeLe: String = "",
)

@Serializable
data class EspaceClient(
    val profil: ProfilClient? = null,
    val adresses: List<AdresseClient> = emptyList(),
    val favoris: List<FavoriClient> = emptyList(),
    val avis: List<AvisClient> = emptyList(),
)

/** Avatars proposés (mêmes clés que la contrainte de la table `client_profils`). */
val AVATARS_CLIENT = listOf(
    "burger" to "🍔", "pizza" to "🍕", "riz" to "🍚", "poulet" to "🍗", "poisson" to "🐟",
    "cafe" to "☕", "pain" to "🥖", "salade" to "🥗", "brochette" to "🍢", "glace" to "🍦",
)

fun emojiAvatarClient(cle: String?): String = AVATARS_CLIENT.firstOrNull { it.first == cle }?.second ?: "🍽️"

val MODES_PREFERES_CLIENT = listOf(null to "Aucune préférence", "retrait" to "Retrait sur place", "livraison" to "Livraison", "sur_place" to "Sur place, à table")

/** Contrôle local d'un pseudo (le serveur revérifie) : 3 à 24 caractères, lettres, chiffres, espace, point, tiret, souligné. */
fun verifierPseudo(brut: String): String? {
    val p = brut.trim()
    return when {
        p.length < 3 || p.length > 24 -> "Le pseudo doit faire 3 à 24 caractères."
        !p.all { it.isLetterOrDigit() || it == ' ' || it == '_' || it == '.' || it == '-' } -> "Le pseudo ne peut contenir que des lettres, des chiffres, des espaces, des points, des tirets et des soulignés."
        else -> null
    }
}

/** Contrôle local d'une adresse enregistrée (le serveur revérifie) : un nom court et l'adresse comme on la dicterait à un livreur. */
fun verifierAdresse(libelle: String, adresse: String): String? = when {
    libelle.trim().length < 2 || libelle.trim().length > 30 -> "Donnez un nom court à cette adresse (2 à 30 caractères), par exemple « Maison »."
    adresse.trim().length < 5 || adresse.trim().length > 300 -> "Décrivez l'adresse pour le livreur (5 à 300 caractères) : quartier, rue, point de repère."
    else -> null
}

@Serializable
private data class ErreurServeurClient(val code: String = "", val message: String = "")

@Serializable
private data class ReponseEspace(val ok: Boolean = false, val profil: ProfilClient? = null, val adresses: List<AdresseClient> = emptyList(), val favoris: List<FavoriClient> = emptyList(), val avis: List<AvisClient> = emptyList(), val erreur: ErreurServeurClient? = null)

@Serializable
private data class ReponseEcriture(val ok: Boolean = false, val message: String = "", val favori: Boolean = false, val erreur: ErreurServeurClient? = null)

/** Retour d'une écriture : le message du serveur (succès ou refus) ; [favori] n'a de sens que pour la bascule d'un favori. */
data class RetourClient(val ok: Boolean, val message: String, val favori: Boolean = false)

interface ClientApi {
    /** Profil, adresses, favoris et avis du compte. Lève [ErreurAcces] si la session est refusée, [ErreurReseau] sinon. */
    suspend fun espace(jetonAcces: String): EspaceClient

    /** Modifie le profil : seuls les champs fournis changent. */
    suspend fun profil(jetonAcces: String, champs: Map<String, Any?>): RetourClient

    /** Carnet d'adresses : « ajouter » (libelle, adresse), « supprimer » ou « defaut » (adresseId). */
    suspend fun adresse(jetonAcces: String, action: String, champs: Map<String, String>): RetourClient

    suspend fun basculerFavori(jetonAcces: String, restaurantId: String): RetourClient

    /** Supprime le compte (droit à l'effacement) : [confirmation] est le mot « SUPPRIMER » écrit par la personne. Irréversible ; refusé pour un compte professionnel. */
    suspend fun supprimerCompte(jetonAcces: String, confirmation: String): RetourClient
}

class KtorClientApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ClientApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/client/$chemin"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw ErreurReseau("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", e)
    }

    override suspend fun espace(jetonAcces: String): EspaceClient = appeler {
        val r = try {
            client.get(url("espace")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseEspace>()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!r.ok) {
            val message = r.erreur?.message ?: "Votre espace n'a pas pu être chargé. Réessayez dans un instant."
            if (r.erreur?.code == "NON_AUTHENTIFIE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        EspaceClient(r.profil, r.adresses, r.favoris, r.avis)
    }

    private suspend fun ecrire(chemin: String, jetonAcces: String, corps: JsonObject): RetourClient = appeler {
        val reponse = client.post(url(chemin)) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps.toString())
        }
        val lu = try {
            reponse.body<ReponseEcriture>()
        } catch (e: Exception) {
            return@appeler RetourClient(false, "La réponse de Speedfood est illisible. Actualisez pour voir l'état réel.")
        }
        if (lu.ok) RetourClient(true, lu.message, lu.favori) else RetourClient(false, lu.erreur?.message ?: "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant.")
    }

    override suspend fun profil(jetonAcces: String, champs: Map<String, Any?>): RetourClient {
        val objet = JsonObject(
            champs.mapNotNull { (cle, valeur) ->
                val element: JsonElement? = when (valeur) {
                    null -> JsonPrimitive(null as String?)
                    is String -> JsonPrimitive(valeur)
                    is Boolean -> JsonPrimitive(valeur)
                    else -> null
                }
                element?.let { cle to it }
            }.toMap(),
        )
        return ecrire("profil", jetonAcces, objet)
    }

    override suspend fun adresse(jetonAcces: String, action: String, champs: Map<String, String>): RetourClient {
        val objet = JsonObject(buildMap<String, JsonElement> {
            put("action", JsonPrimitive(action))
            champs.forEach { (cle, valeur) -> put(cle, JsonPrimitive(valeur)) }
        })
        return ecrire("adresses", jetonAcces, objet)
    }

    override suspend fun basculerFavori(jetonAcces: String, restaurantId: String): RetourClient =
        ecrire("favoris", jetonAcces, JsonObject(mapOf("restaurantId" to JsonPrimitive(restaurantId))))

    override suspend fun supprimerCompte(jetonAcces: String, confirmation: String): RetourClient =
        ecrire("compte", jetonAcces, JsonObject(mapOf("confirmation" to JsonPrimitive(confirmation))))
}
