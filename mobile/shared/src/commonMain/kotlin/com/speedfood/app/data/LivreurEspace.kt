package com.speedfood.app.data

import kotlinx.serialization.Serializable

/**
 * L'espace livreur : la file des courses, l'historique paginé des courses livrées et l'état du dossier d'activation.
 *
 * Le dossier d'identité reste réservé au super administrateur, sur le site (`docs/LIVREURS.md`, `docs/CADRE-JURIDIQUE-LIVREURS.md`) :
 * l'application ne reçoit que l'état de chaque pièce — à jour ou manquante — et jamais le document, son numéro, ni le dossier.
 * Elle ne montre donc qu'un état et une explication, comme le veut la règle « conserver le résultat de la vérification plutôt que le numéro de pièce ».
 */

/** La file des courses du livreur : la course en cours d'abord, puis celles qui viennent. */
@Serializable
data class FileLivreur(val cours: List<CourseLivreur> = emptyList())

/** Une pièce du dossier d'activation : son état seulement, jamais son contenu. */
@Serializable
data class PieceDossierLivreur(
    /** « piece_identite », « urgence »… */
    val code: String = "",
    val libelle: String = "",
    /** « a_jour » ou « manquant ». */
    val statut: String = "",
    /** Une phrase d'explication : ce que le livreur doit faire, et où. */
    val explication: String = "",
)

/** L'état du dossier d'activation du livreur : ce qui manque, rien de plus. */
@Serializable
data class DossierLivreur(
    val pieces: List<PieceDossierLivreur> = emptyList(),
    val message: String? = null,
) {
    /** Les pièces qui manquent encore. */
    val manquantes: List<PieceDossierLivreur> get() = pieces.filter { it.statut != "a_jour" }

    /** Une phrase courte pour l'écran : ce qui manque, sans jamais montrer de document. */
    fun resume(): String = when {
        pieces.isEmpty() -> "Votre dossier est complet."
        manquantes.isEmpty() -> "Votre dossier est complet."
        manquantes.size == 1 -> "Il manque 1 pièce : ${manquantes.first().libelle}."
        else -> "Il manque ${manquantes.size} pièces : ${manquantes.joinToString(", ") { it.libelle }}."
    }
}

/** Une page de l'historique des courses livrées (page 1 = la plus récente). */
@Serializable
data class PageHistoriqueLivreur(
    val courses: List<CourseLivree> = emptyList(),
    val page: Int = 1,
    val pages: Int = 1,
) {
    /** Y a-t-il une page suivante à charger ? */
    val suite: Boolean get() = page < pages
}

/**
 * La course en cours : l'état du livreur d'abord, la file en repli (le serveur peut n'envoyer que l'une des deux).
 */
fun courseEnCours(etat: EtatLivreur?, file: FileLivreur?): CourseLivreur? = etat?.course ?: file?.cours?.firstOrNull()

/** Le gain attendu : les frais de la course en cours (0 quand le livreur n'a pas de course). */
fun gainAttenduGnf(etat: EtatLivreur?, file: FileLivreur?): Int = courseEnCours(etat, file)?.fraisGnf ?: 0

/** Les courses qui viennent après celle en cours. */
fun coursesSuivantes(etat: EtatLivreur?, file: FileLivreur?): List<CourseLivreur> {
    val enCours = courseEnCours(etat, file)
    return file?.cours.orEmpty().filter { enCours == null || it.livraisonId != enCours.livraisonId }
}

/** L'état du livreur en clair : la hors ligne se voit, elle ne se devine pas. */
fun libelleStatutLivreur(statut: String): String = when (statut) {
    "disponible" -> "En ligne"
    "en_course" -> "En course"
    else -> "Hors ligne"
}

/**
 * Clés de listes : un espace de noms par collection. L'index est toujours ajouté, donc deux courses sans identifiant ne
 * partagent jamais la même clé (un `LazyColumn` planterait sur une clé dupliquée).
 */
fun cleCourseFile(livraisonId: String, index: Int): String = "file-${livraisonId.ifBlank { "c$index" }}-$index"

fun clePieceDossier(code: String, index: Int): String = "piece-${code.ifBlank { "p$index" }}-$index"

fun cleHistoriqueLivreur(id: String, index: Int): String = "historique-${id.ifBlank { "h$index" }}-$index"
