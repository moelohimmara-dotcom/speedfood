package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.forms.formData
import io.ktor.client.request.forms.submitFormWithBinaryData
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.Headers
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
private data class ErreurMenuPhoto(val code: String = "", val message: String = "")

@Serializable
private data class ReponseLectureEquipe(val ok: Boolean = false, val lecture: LectureMenu? = null, val erreur: ErreurMenuPhoto? = null)

@Serializable
private data class ReponseImportEquipe(val ok: Boolean = false, val message: String = "", val ajoutes: Int = 0, val erreur: ErreurMenuPhoto? = null)

/**
 * Menu d'un établissement tenu par l'équipe, lu depuis une photo (lot R5) : le serveur lit la photo (rien n'est conservé) et rend la liste, que l'équipe relit ; seuls les plats
 * cochés sont ensuite ajoutés, après une revalidation complète côté serveur. Un plat déjà au menu n'est jamais ajouté en double.
 */
interface MenuPhotoEquipeApi {
    suspend fun lire(jetonAcces: String, restaurantId: String, photo: PhotoChoisie): LectureMenu

    /** Ajoute les plats relus ; rend le message de confirmation. */
    suspend fun importer(jetonAcces: String, restaurantId: String, plats: List<PlatCandidature>): String
}

class KtorMenuPhotoEquipeApi(private val client: HttpClient, private val config: SpeedfoodConfig) : MenuPhotoEquipeApi {
    private fun url(restaurantId: String, suite: String) = "${config.siteUrl.trimEnd('/')}/api/v1/equipe/menus/$restaurantId/$suite"

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    private fun refus(erreur: ErreurMenuPhoto?, defaut: String): Nothing {
        val message = erreur?.message ?: defaut
        if (erreur?.code == "NON_AUTHENTIFIE" || erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
        throw ErreurReseau(message)
    }

    override suspend fun lire(jetonAcces: String, restaurantId: String, photo: PhotoChoisie): LectureMenu = appeler {
        val reponse = client.submitFormWithBinaryData(
            url(restaurantId, "photo"),
            formData {
                append("fichier", photo.octets, Headers.build {
                    append(HttpHeaders.ContentType, photo.type)
                    append(HttpHeaders.ContentDisposition, "filename=\"menu.jpg\"")
                })
            },
        ) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }
        val r: ReponseLectureEquipe = try {
            reponse.body()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (r.ok && r.lecture != null) r.lecture else refus(r.erreur, "La photo n'a pas pu être lue. Saisissez les plats à la main.")
    }

    override suspend fun importer(jetonAcces: String, restaurantId: String, plats: List<PlatCandidature>): String = appeler {
        val reponse = client.post(url(restaurantId, "import")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("plats", JsonArray(plats.map { buildJsonObject { put("nom", it.nom); put("prix", it.prix) } })) }.toString())
        }
        val r: ReponseImportEquipe = try {
            reponse.body()
        } catch (e: Exception) {
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (r.ok) r.message else refus(r.erreur, "Les plats n'ont pas pu être ajoutés. Réessayez dans un instant.")
    }
}
