package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import kotlinx.serialization.Serializable

/** Dernière version de l'application publiée par le serveur (route publique `/api/v1/version`, même source que la page `/installer`). */
@Serializable
data class VersionPubliee(
    val code: Int,
    val nom: String,
    val notes: String = "",
    val obligatoire: Boolean = false,
    /** Empreinte SHA-256 (64 caractères hexadécimaux) de l'APK publiée : l'installation en un geste la vérifie avant d'installer. Vide : lien de téléchargement seulement. */
    val apkSha256: String = "",
    val apkTaille: Long = 0,
)

@Serializable
private data class ReponseVersion(val ok: Boolean = false, val version: VersionPubliee? = null)

interface VersionApi {
    /** Version publiée, ou null si le serveur n'a pas pu répondre (réseau) : jamais d'exception, la vérification est un confort. */
    suspend fun derniere(): VersionPubliee?
}

class KtorVersionApi(private val client: HttpClient, private val config: SpeedfoodConfig) : VersionApi {
    override suspend fun derniere(): VersionPubliee? = try {
        val r = client.get("${config.siteUrl.trimEnd('/')}/api/v1/version").body<ReponseVersion>()
        if (r.ok) r.version else null
    } catch (_: Exception) {
        null
    }
}

/** Affiche une notification du système (centre de notifications) pour une version disponible. Sans effet là où la plateforme ne sait pas. */
interface NotificateurMiseAJour {
    fun notifier(version: VersionPubliee, urlTelechargement: String)
}

class NotificateurIndisponible : NotificateurMiseAJour {
    override fun notifier(version: VersionPubliee, urlTelechargement: String) = Unit
}

/** Une mise à jour existe si la version publiée est strictement plus récente que celle installée. Numéro installé inconnu (0) : jamais d'invitation. */
fun miseAJourDisponible(codeInstalle: Int, publiee: VersionPubliee?): Boolean = codeInstalle > 0 && publiee != null && publiee.code > codeInstalle

/**
 * Vérifie au démarrage s'il existe une version plus récente. « Plus tard » masque le bandeau pour cette version seulement (une version encore plus récente le
 * fait revenir), sauf si la version est obligatoire. La notification du système n'est posée qu'une fois par version.
 */
class SuiviMiseAJour(
    private val api: VersionApi,
    private val stockage: StockageLocal,
    private val codeInstalle: Int,
    private val notificateur: NotificateurMiseAJour,
    private val config: SpeedfoodConfig,
    /** Faux sur iPhone : une application iPhone se met à jour par TestFlight ou l'App Store, jamais par un fichier APK téléchargé. */
    val actif: Boolean = true,
) {
    val urlTelechargement: String get() = "${config.siteUrl.trimEnd('/')}/installer"

    /** Version à proposer maintenant, ou null (à jour, hors ligne, ou reportée par la personne). */
    suspend fun verifier(): VersionPubliee? {
        if (!actif) return null
        val publiee = api.derniere()
        if (publiee == null || !miseAJourDisponible(codeInstalle, publiee)) return null
        if (stockage.lire(CLE_NOTIFIEE) != publiee.code.toString()) {
            stockage.ecrire(CLE_NOTIFIEE, publiee.code.toString())
            notificateur.notifier(publiee, urlTelechargement)
        }
        if (!publiee.obligatoire && stockage.lire(CLE_REPORTEE) == publiee.code.toString()) return null
        return publiee
    }

    /** Dernière version publiée (vérification demandée par la personne, dans Paramètres), ou null si le serveur ne répond pas. */
    suspend fun derniereVersion(): VersionPubliee? = api.derniere()

    fun reporter(version: VersionPubliee) {
        if (!version.obligatoire) stockage.ecrire(CLE_REPORTEE, version.code.toString())
    }

    private companion object {
        const val CLE_NOTIFIEE = "maj_notifiee"
        const val CLE_REPORTEE = "maj_reportee"
    }
}
