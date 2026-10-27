package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.http.encodeURLParameter
import io.ktor.http.isSuccess
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Session d'un compte connecté. [expireLe] : secondes depuis 1970. Jamais de mot de passe ici. */
@Serializable
data class Session(val accessToken: String, val refreshToken: String, val expireLe: Long, val userId: String, val email: String?)

/**
 * Erreur d'authentification lisible par la personne (jamais de détail technique). [temporaire] : réseau coupé, service indisponible ou trop de demandes ;
 * la session existante reste alors valable pour un prochain essai (seul un refus définitif du serveur la ferme).
 */
class ErreurAuth(message: String, val temporaire: Boolean = false, cause: Throwable? = null) : Exception(message, cause)

interface AuthApi {
    suspend fun connecter(email: String, motDePasse: String): Session

    /** Crée le compte. Rend la session ouverte si le service n'exige pas de confirmation d'e-mail ; null si un e-mail de confirmation a été envoyé. */
    suspend fun inscrire(nom: String, telephone: String, email: String, motDePasse: String): Session?

    suspend fun rafraichir(refreshToken: String): Session

    /** Adresse de départ de la connexion Facebook (navigateur) : le retour se fait sur le site, qui rend la main à l'application avec un code à usage unique. */
    fun urlConnexionFacebook(codeChallenge: String): String

    /** Échange le code reçu au retour de Facebook (avec le secret PKCE) contre la session du compte, créé s'il n'existe pas. */
    suspend fun connecterAvecCode(code: String, verificateur: String): Session

    /**
     * Connexion avec un jeton d'identité Google obtenu sur le téléphone : le service d'authentification le vérifie (signature, destinataire, [nonce]) et ouvre la session
     * du compte Google, créé s'il n'existe pas ; une adresse déjà inscrite avec le même e-mail confirmé est rattachée au même compte.
     */
    suspend fun connecterAvecGoogle(jetonIdentite: String, nonce: String?): Session

    /** Méthodes de connexion activées côté serveur (par exemple « google »), lues sur le point public du service d'authentification ; vide si indisponible. */
    suspend fun fournisseursActifs(): Set<String>
}

@Serializable
private data class ReponseJeton(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Long = 3600,
    @SerialName("expires_at") val expiresAt: Long? = null,
    val user: UtilisateurJeton? = null,
)

@Serializable
private data class UtilisateurJeton(val id: String, val email: String? = null)

/**
 * Authentification par l'API REST du service d'authentification (GoTrue), avec la clé PUBLIQUE : mêmes comptes et mêmes règles que le site (mot de passe de
 * 12 caractères au moins, confirmation de l'adresse par e-mail). Le mot de passe n'est conservé nulle part ; seuls les jetons de session le sont.
 */
class KtorAuthApi(
    private val client: HttpClient,
    private val config: SpeedfoodConfig,
    private val maintenantSecondes: () -> Long,
) : AuthApi {

    private fun base() = "${config.supabaseUrl.trimEnd('/')}/auth/v1"

    private suspend fun poster(chemin: String, parametres: Map<String, String>, corps: JsonObject): HttpResponse {
        if (!config.estComplete) throw ErreurAuth("L'application n'est pas configurée (adresse ou clé publique manquante).")
        return try {
            client.post("${base()}/$chemin") {
                header("apikey", config.supabaseAnonKey)
                contentType(ContentType.Application.Json)
                parametres.forEach { (cle, valeur) -> parameter(cle, valeur) }
                setBody(corps.toString())
            }
        } catch (e: Exception) {
            throw ErreurAuth("Impossible de joindre Speedfood. Vérifiez votre connexion puis réessayez.", temporaire = true, cause = e)
        }
    }

    private suspend fun erreurDe(reponse: HttpResponse): ErreurAuth {
        val texte = try {
            reponse.bodyAsText()
        } catch (_: Exception) {
            ""
        }
        val statut = reponse.status.value
        return ErreurAuth(traduireErreurAuth(statut, texte), temporaire = statut == 429 || statut >= 500)
    }

    private suspend fun sessionDe(reponse: HttpResponse): Session {
        val jeton = try {
            reponse.body<ReponseJeton>()
        } catch (e: Exception) {
            throw ErreurAuth("La réponse de Speedfood est illisible. Réessayez dans un instant.", temporaire = true, cause = e)
        }
        val user = jeton.user ?: throw ErreurAuth("La réponse de Speedfood est incomplète. Réessayez dans un instant.", temporaire = true)
        return Session(jeton.accessToken, jeton.refreshToken, jeton.expiresAt ?: (maintenantSecondes() + jeton.expiresIn), user.id, user.email)
    }

    override suspend fun connecter(email: String, motDePasse: String): Session {
        val reponse = poster("token", mapOf("grant_type" to "password"), buildJsonObject {
            put("email", email.trim())
            put("password", motDePasse)
        })
        if (!reponse.status.isSuccess()) throw erreurDe(reponse)
        return sessionDe(reponse)
    }

    override suspend fun inscrire(nom: String, telephone: String, email: String, motDePasse: String): Session? {
        val reponse = poster(
            "signup",
            // Le lien reçu par e-mail ouvre la confirmation du site, puis le compte client (même chemin que l'inscription web).
            mapOf("redirect_to" to "${config.siteUrl.trimEnd('/')}/auth/confirmation?suite=%2Fcompte"),
            buildJsonObject {
                put("email", email.trim())
                put("password", motDePasse)
                put("data", buildJsonObject {
                    if (nom.isNotBlank()) put("nom_commande", JsonPrimitive(nom.trim()))
                    if (telephone.isNotBlank()) put("telephone", JsonPrimitive(telephone))
                })
            },
        )
        // Une adresse déjà inscrite reçoit la même réponse qu'une nouvelle : on ne révèle pas qui a un compte (comme le site).
        if (!reponse.status.isSuccess()) throw erreurDe(reponse)
        // Sans confirmation d'e-mail, le service renvoie tout de suite une session ; avec, la réponse n'en contient pas.
        return try { sessionDe(reponse) } catch (_: ErreurAuth) { null }
    }

    override fun urlConnexionFacebook(codeChallenge: String): String =
        "${base()}/authorize?provider=facebook&scopes=email%20public_profile&code_challenge=$codeChallenge&code_challenge_method=s256" +
            "&redirect_to=${(config.siteUrl.trimEnd('/') + CHEMIN_RETOUR_FACEBOOK).encodeURLParameter()}"

    override suspend fun connecterAvecCode(code: String, verificateur: String): Session {
        val reponse = poster("token", mapOf("grant_type" to "pkce"), buildJsonObject {
            put("auth_code", code)
            put("code_verifier", verificateur)
        })
        if (!reponse.status.isSuccess()) throw erreurDe(reponse)
        return sessionDe(reponse)
    }

    override suspend fun connecterAvecGoogle(jetonIdentite: String, nonce: String?): Session {
        val reponse = poster("token", mapOf("grant_type" to "id_token"), buildJsonObject {
            put("provider", "google")
            put("id_token", jetonIdentite)
            if (nonce != null) put("nonce", nonce)
        })
        if (!reponse.status.isSuccess()) throw erreurDe(reponse)
        return sessionDe(reponse)
    }

    override suspend fun fournisseursActifs(): Set<String> = try {
        if (!config.estComplete) emptySet()
        else {
            val texte = client.get("${base()}/settings") { header("apikey", config.supabaseAnonKey) }.bodyAsText()
            val actifs = (Json.parseToJsonElement(texte).jsonObject["external"]?.jsonObject ?: JsonObject(emptyMap()))
                .filter { (_, v) -> (v as? JsonPrimitive)?.booleanOrNull == true }
                .keys
            // Facebook demande en plus l'accord de l'équipe (interrupteur de /system/parametres) : l'application Meta peut ne pas être encore publique.
            if ("facebook" in actifs && !facebookOuvertParLEquipe()) actifs - "facebook" else actifs
        }
    } catch (_: Exception) {
        emptySet()
    }

    private suspend fun facebookOuvertParLEquipe(): Boolean = try {
        val texte = client.get("${config.siteUrl.trimEnd('/')}/api/v1/connexion/fournisseurs").bodyAsText()
        (Json.parseToJsonElement(texte).jsonObject["facebook"] as? JsonPrimitive)?.booleanOrNull == true
    } catch (_: Exception) {
        false
    }

    override suspend fun rafraichir(refreshToken: String): Session {
        val reponse = poster("token", mapOf("grant_type" to "refresh_token"), buildJsonObject { put("refresh_token", refreshToken) })
        if (!reponse.status.isSuccess()) throw erreurDe(reponse)
        return sessionDe(reponse)
    }
}

/** Messages en français pour les réponses du service d'authentification, sans jargon ni détail technique. */
internal fun traduireErreurAuth(statut: Int, corps: String): String {
    val t = corps.lowercase()
    return when {
        statut == 429 || "rate limit" in t || "too many" in t -> "Trop de tentatives. Patientez quelques minutes puis réessayez."
        // Compte suspendu (inscription dont l'adresse ressemble à celle d'un compte existant) : l'équipe l'examine ; ce n'est ni un mauvais mot de passe ni une panne.
        "user_banned" in t || "user is banned" in t || "banned" in t -> "Votre inscription est en cours de vérification par l'équipe Speedfood (adresse proche d'un compte existant). Connectez-vous avec votre première adresse, ou attendez la réponse sous 48 h."
        "invalid login credentials" in t -> "E-mail ou mot de passe incorrect."
        "email not confirmed" in t -> "Confirmez d'abord votre adresse : ouvrez le lien reçu par e-mail (regardez aussi les courriers indésirables)."
        "pwned" in t || "compromised" in t || "weak" in t -> "Ce mot de passe est trop faible ou connu dans des fuites de données. Choisissez-en un autre."
        "at least" in t && "password" in t -> "Le mot de passe doit contenir au moins 12 caractères."
        "already registered" in t || "already exists" in t -> "Un compte existe déjà avec cet e-mail."
        "provider is not enabled" in t || "unsupported provider" in t -> "La connexion avec Google n'est pas encore activée."
        "nonce" in t || "id token" in t || "id_token" in t -> "La connexion avec Google a échoué : recommencez. Si cela se répète, utilisez votre e-mail et votre mot de passe."
        statut in 500..599 -> "Speedfood est momentanément indisponible. Réessayez dans un instant."
        else -> "Une erreur est survenue. Réessayez dans un instant."
    }
}
