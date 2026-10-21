package com.speedfood.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.time.Clock
import kotlin.time.Instant

@Serializable
data class QuartierRef(val nom: String? = null)

@Serializable
data class CategorieRef(val nom: String? = null)

/**
 * Restaurant tel que la liste publique le montre (lecture anonyme sous RLS : seuls les restaurants publiés et non suspendus sont visibles).
 * Les noms de champs suivent la base ; les accesseurs en français sont ceux que l'interface utilise.
 */
@Serializable
data class Restaurant(
    val id: String,
    val nom: String,
    val horaires: String? = null,
    val ouvert: Boolean = false,
    @SerialName("accepte_commandes") val accepteCommandes: Boolean = false,
    @SerialName("statut_mis_a_jour_le") val statutMisAJourLe: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("couleur_accent") val couleurAccent: String? = null,
    @SerialName("code_court") val codeCourt: String? = null,
    @SerialName("avis_somme") val avisSomme: Int = 0,
    @SerialName("avis_total") val avisTotal: Int = 0,
    val quartier: QuartierRef? = null,
    val categorie: CategorieRef? = null,
) {
    val nomQuartier: String? get() = quartier?.nom?.takeIf { it.isNotBlank() }
    val nomCategorie: String? get() = categorie?.nom?.takeIf { it.isNotBlank() }

    /** Note moyenne sur 5 (arrondie au dixième), ou null tant qu'aucun avis n'existe : jamais de note inventée. */
    val noteMoyenne: Double?
        get() = if (avisTotal > 0) (avisSomme * 10 / avisTotal) / 10.0 else null

    /** Âge de la dernière confirmation du statut, en millisecondes ; null si absente ou illisible. */
    fun ageStatutMillis(maintenant: Instant = Clock.System.now()): Long? {
        val brut = statutMisAJourLe ?: return null
        val confirme = try {
            Instant.parse(brut)
        } catch (_: IllegalArgumentException) {
            return null
        }
        return (maintenant - confirme).inWholeMilliseconds
    }
}
