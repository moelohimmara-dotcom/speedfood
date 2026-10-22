package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Jeton d'installation fourni par la plateforme pour les notifications poussées (Android : Firebase Cloud Messaging). Absent si la plateforme ne sait pas. */
interface FournisseurJetonPush {
    val disponible: Boolean

    /** Jeton actuel, ou null s'il n'est pas (encore) disponible (réseau, services Google absents). Ne lève jamais d'exception. */
    suspend fun jeton(): String?
}

class JetonPushIndisponible : FournisseurJetonPush {
    override val disponible = false
    override suspend fun jeton(): String? = null
}

@Serializable
private data class CorpsAppareil(val jeton: String, val plateforme: String, val versionApp: String? = null)

@Serializable
private data class CorpsRetraitAppareil(val jeton: String)

interface AppareilApi {
    /** Enregistre l'appareil du compte connecté. Renvoie vrai si le serveur l'a pris en compte. */
    suspend fun enregistrer(jetonAcces: String, jetonAppareil: String, plateforme: String, versionApp: String?): Boolean

    suspend fun retirer(jetonAcces: String, jetonAppareil: String): Boolean
}

class KtorAppareilApi(private val client: HttpClient, private val config: SpeedfoodConfig) : AppareilApi {
    private val json = Json { encodeDefaults = false; explicitNulls = false }

    private suspend fun poster(chemin: String, jetonAcces: String, corps: String): Boolean = try {
        val reponse = client.post("${config.siteUrl.trimEnd('/')}/api/v1/appareils$chemin") {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(corps)
        }
        reponse.body<ReponseSimpleAppareil>().ok
    } catch (_: Exception) {
        false
    }

    override suspend fun enregistrer(jetonAcces: String, jetonAppareil: String, plateforme: String, versionApp: String?) =
        poster("", jetonAcces, json.encodeToString(CorpsAppareil.serializer(), CorpsAppareil(jetonAppareil, plateforme, versionApp)))

    override suspend fun retirer(jetonAcces: String, jetonAppareil: String) =
        poster("/retirer", jetonAcces, json.encodeToString(CorpsRetraitAppareil.serializer(), CorpsRetraitAppareil(jetonAppareil)))
}

@Serializable
private data class ReponseSimpleAppareil(val ok: Boolean = false)

/**
 * Lien entre le compte connecté et l'appareil pour les notifications poussées : le serveur sait à quel téléphone envoyer les alertes de CE compte. L'enregistrement
 * se refait à chaque connexion et chaque changement de jeton, une seule fois par couple (compte, jeton) ; à la déconnexion, l'appareil est retiré pour ne plus
 * recevoir les alertes du compte quitté. Meilleur effort : un échec n'empêche jamais de se connecter ni de se déconnecter.
 */
class EnregistrementPush(
    private val session: SessionService,
    private val api: AppareilApi,
    private val fournisseur: FournisseurJetonPush,
    private val stockage: StockageLocal,
    private val plateforme: String,
    private val versionApp: String?,
) {
    /** Enregistre l'appareil si quelqu'un est connecté et si ce couple (compte, jeton) n'a pas déjà été enregistré. */
    suspend fun enregistrer() {
        if (!fournisseur.disponible) return
        val courante = session.session.value ?: return
        val jetonAppareil = fournisseur.jeton() ?: return
        val signature = "${courante.userId}:$jetonAppareil"
        if (stockage.lire(CLE) == signature) return
        val jetonAcces = session.jetonValide() ?: return
        if (api.enregistrer(jetonAcces, jetonAppareil, plateforme, versionApp)) stockage.ecrire(CLE, signature)
    }

    /** Retire l'appareil du compte connecté (à appeler AVANT la déconnexion : il faut encore une session valide). */
    suspend fun retirer() {
        if (!fournisseur.disponible) return
        val jetonAppareil = fournisseur.jeton()
        val jetonAcces = session.jetonValide()
        if (jetonAppareil != null && jetonAcces != null) api.retirer(jetonAcces, jetonAppareil)
        stockage.effacer(CLE)
    }

    companion object {
        const val CLE = "appareil_push"
    }
}
