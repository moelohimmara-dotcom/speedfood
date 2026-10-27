package com.speedfood.app.data

import com.speedfood.app.disponibilite.estFraiche
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlin.time.Clock
import kotlin.time.Instant

/** Fiche d'un restaurant (lecture publique, sous RLS : seuls les restaurants publiés et non suspendus sont visibles). */
@Serializable
data class RestaurantFiche(
    val id: String,
    val nom: String,
    val horaires: String? = null,
    val consignes: String? = null,
    val ouvert: Boolean = false,
    @SerialName("accepte_commandes") val accepteCommandes: Boolean = false,
    @SerialName("statut_mis_a_jour_le") val statutMisAJourLe: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("logo_url") val logoUrl: String? = null,
    @SerialName("moyens_paiement") val moyensPaiement: List<String> = emptyList(),
    @SerialName("accepte_sur_place") val accepteSurPlace: Boolean = false,
    @SerialName("livraison_mode") val livraisonMode: String? = null,
    @SerialName("avis_somme") val avisSomme: Int = 0,
    @SerialName("avis_total") val avisTotal: Int = 0,
    val quartier: QuartierRef? = null,
) {
    val nomQuartier: String? get() = quartier?.nom?.takeIf { it.isNotBlank() }

    val noteMoyenne: Double?
        get() = if (avisTotal > 0) (avisSomme * 10 / avisTotal) / 10.0 else null

    fun ageStatutMillis(maintenant: Instant = Clock.System.now()): Long? = ageDepuis(statutMisAJourLe, maintenant)
}

@Serializable
data class Section(val id: String, val nom: String, val position: Int = 0)

/** Supplément facultatif d'un plat (par exemple « Piment »). Le prix est un montant GNF entier. */
@Serializable
data class OptionPlat(val id: String, val nom: String, val prix: Int = 0, val disponible: Boolean = true)

@Serializable
data class Plat(
    val id: String,
    val nom: String,
    val description: String = "",
    val prix: Int,
    @SerialName("prix_promo") val prixPromo: Int? = null,
    val disponible: Boolean = true,
    @SerialName("disponibilite_confirmee_le") val confirmeLe: String? = null,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("section_id") val sectionId: String? = null,
    @SerialName("menu_item_options") val options: List<OptionPlat> = emptyList(),
) {
    /** Prix payé : le prix promo s'il existe et n'est pas supérieur au prix normal, sinon le prix normal. */
    val prixEffectif: Int get() = prixPromo?.takeIf { it in 0..prix } ?: prix
    val enPromo: Boolean get() = prixEffectif < prix

    fun ageConfirmationMillis(maintenant: Instant = Clock.System.now()): Long? = ageDepuis(confirmeLe, maintenant)
}

/** Menu d'un restaurant : sections dans l'ordre, plats groupés (les plats sans section vont dans « Autres plats », en dernier). */
data class Menu(val sections: List<Section>, val plats: List<Plat>) {
    fun groupes(): List<Pair<String, List<Plat>>> {
        val parSection = plats.groupBy { it.sectionId }
        val groupes = sections.sortedBy { it.position }.mapNotNull { s -> parSection[s.id]?.takeIf { it.isNotEmpty() }?.let { s.nom to it } }
        val orphelins = plats.filter { p -> p.sectionId == null || sections.none { it.id == p.sectionId } }
        // Sans aucune section nommée, « Autres plats » n'a pas de sens (autres que quoi ?) : le titre est simplement « Plats ».
        return if (orphelins.isEmpty()) groupes else groupes + ((if (groupes.isEmpty()) "Plats" else "Autres plats") to orphelins)
    }
}

enum class EtatPlat { Disponible, AConfirmer, Epuise }

/**
 * État d'un plat, même règle que le site (`src/lib/disponibilite/etat.ts`) : épuisé si le restaurant l'a retiré ; « à confirmer » s'il n'a jamais été confirmé
 * ou si la dernière confirmation dépasse le seuil de fraîcheur ; « disponible » seulement après une confirmation récente. Un état inconnu n'est jamais « disponible ».
 */
fun etatPlat(plat: Plat, ageConfirmationMillis: Long?, fraicheurHeures: Int = 6): EtatPlat = when {
    !plat.disponible -> EtatPlat.Epuise
    estFraiche(ageConfirmationMillis, fraicheurHeures) -> EtatPlat.Disponible
    else -> EtatPlat.AConfirmer
}

internal fun ageDepuis(iso: String?, maintenant: Instant): Long? {
    val brut = iso ?: return null
    val date = try {
        Instant.parse(brut)
    } catch (_: IllegalArgumentException) {
        return null
    }
    return (maintenant - date).inWholeMilliseconds
}
