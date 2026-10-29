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
import io.ktor.serialization.JsonConvertException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Les réglages du poste de travail du restaurateur : ses horaires d'ouverture, l'état du service (ouvert ou en pause), les plats à
 * reconfirmer, et les deux préférences du téléphone (son des nouvelles commandes, mode « poste fixe »).
 *
 * La règle « plat à reconfirmer » est celle du serveur : l'application reçoit la liste et l'affiche, elle ne la recalcule pas.
 */

/** Un plat dont la disponibilité doit être reconfirmée : c'est le serveur qui décide de la règle et de la liste. */
@Serializable
data class PlatAReconfirmer(val id: String = "", val nom: String = "", val confirmeLe: String? = null)

/** Ce que le serveur sait du restaurant : horaires déclarés, service ouvert ou en pause, plats à reconfirmer. */
@Serializable
data class ReglagesRestaurateur(
    val horaires: String = "",
    val ouvert: Boolean = false,
    val accepteCommandes: Boolean = false,
    val platsAReconfirmer: List<PlatAReconfirmer> = emptyList(),
)

/** Les sept jours, du lundi au dimanche : c'est l'ordre d'affichage des horaires. */
val JOURS_SEMAINE = listOf("Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche")

/** Un jour d'ouverture : [index] va de 0 (lundi) à 6 (dimanche). Un jour fermé n'a pas d'heure. */
data class JourHoraire(val index: Int, val ouvert: Boolean = true, val ouverture: String = "11:00", val fermeture: String = "22:00")

/** Les horaires d'une semaine. */
data class HorairesSemaine(val jours: List<JourHoraire> = (0..6).map { JourHoraire(it) })

private val HEURE = Regex("""^([01]?\d|2[0-3]):([0-5]\d)$""")
private val HEURE_SIMPLE = Regex("""^(\d{1,2}):(\d{2})$""")

/**
 * Les horaires sont gardés par le serveur comme un texte libre (colonne `restaurants.horaires`, que la console du site affiche tel quel).
 * L'application écrit un format canonique, une ligne par jour : « Mardi : 11:00 - 22:00 », « Dimanche : fermé ». Un texte écrit ailleurs
 * (sur le site) qui n'est pas dans ce format n'est jamais réécrit sans que le restaurateur le demande.
 */
fun formaterHoraires(semaine: HorairesSemaine): String = semaine.jours.sortedBy { it.index }.joinToString("\n") { jour ->
    val nom = JOURS_SEMAINE.getOrElse(jour.index) { "Jour ${jour.index + 1}" }
    if (jour.ouvert) "$nom : ${normaliserHeure(jour.ouverture)} - ${normaliserHeure(jour.fermeture)}" else "$nom : fermé"
}

/**
 * Relit le texte des horaires du serveur. Renvoie null quand le texte n'est pas dans le format de l'application (écrit sur le site) : dans ce
 * cas l'application l'affiche tel quel et ne propose pas de l'écraser.
 */
fun parseHoraires(texte: String): HorairesSemaine? {
    val lignes = texte.lines().map { it.trim() }.filter { it.isNotEmpty() }
    if (lignes.isEmpty()) return null
    val jours = mutableListOf<JourHoraire>()
    for (ligne in lignes) {
        val separateur = ligne.indexOf(':')
        if (separateur <= 0) return null
        val nom = ligne.substring(0, separateur).trim().lowercase()
        val index = JOURS_SEMAINE.indexOfFirst { it.lowercase() == nom }
        if (index < 0) return null
        val reste = ligne.substring(separateur + 1).trim()
        if (reste.equals("fermé", ignoreCase = true) || reste.equals("ferme", ignoreCase = true)) {
            jours += JourHoraire(index, ouvert = false)
            continue
        }
        val bornes = reste.split("-")
        if (bornes.size != 2) return null
        val ouverture = normaliserHeure(bornes[0])
        val fermeture = normaliserHeure(bornes[1])
        if (!HEURE.matches(ouverture) || !HEURE.matches(fermeture)) return null
        jours += JourHoraire(index, ouvert = true, ouverture = ouverture, fermeture = fermeture)
    }
    if (jours.size != 7) return null
    return HorairesSemaine(jours.sortedBy { it.index })
}

/** « 9:30 » devient « 09:30 » ; un texte qui n'est pas une heure est renvoyé tel quel (la validation le signalera). */
fun normaliserHeure(texte: String): String {
    val t = texte.trim()
    val m = HEURE_SIMPLE.matchEntire(t) ?: return t
    val h = m.groupValues[1].toIntOrNull() ?: return t
    if (h > 23) return t
    // padStart plutôt que String.format : format n'existe pas dans le code commun compilé pour l'iPhone.
    return h.toString().padStart(2, '0') + ":" + m.groupValues[2]
}

/** Contrôle d'un jour d'ouverture : renvoie un message lisible, ou null si tout va bien. */
fun verifierJourHoraire(jour: JourHoraire): String? {
    val nom = JOURS_SEMAINE.getOrElse(jour.index) { "ce jour" }
    if (!jour.ouvert) return null
    val ouverture = normaliserHeure(jour.ouverture)
    val fermeture = normaliserHeure(jour.fermeture)
    if (!HEURE.matches(ouverture)) return "Indiquez l'heure d'ouverture du $nom (format 11:00)."
    if (!HEURE.matches(fermeture)) return "Indiquez l'heure de fermeture du $nom (format 22:00)."
    if (ouverture >= fermeture) return "Le $nom doit fermer après son ouverture."
    return null
}

/** Contrôle de la semaine entière : renvoie le premier message d'erreur, ou null si les horaires sont utilisables. */
fun verifierHoraires(semaine: HorairesSemaine): String? = semaine.jours.sortedBy { it.index }.firstNotNullOfOrNull { verifierJourHoraire(it) }

/** Résumé lisible des horaires affichés : « ouvert 7 jours sur 7 », « ouvert 5 jours sur 7 ». */
fun resumeHoraires(semaine: HorairesSemaine): String {
    val ouverts = semaine.jours.count { it.ouvert }
    return if (ouverts == 7) "ouvert 7 jours sur 7" else "ouvert $ouverts jours sur 7"
}

/**
 * Les deux préférences du téléphone : elles ne dépendent pas du serveur, seulement de cet appareil. Tant que le restaurateur n'a pas choisi,
 * les deux restent actives (comme avant l'arrivée de ces réglages).
 */
object PreferencesRestaurateur {
    /** Clé du stockage local : « oui » ou « non » pour le son des nouvelles commandes. */
    const val CLE_SON = "restaurateur_son_commandes"

    /** Clé du stockage local : « oui » ou « non » pour le mode « poste fixe » (écran allumé, alerte continue). */
    const val CLE_POSTE_FIXE = "restaurateur_poste_fixe"

    /** Le son des nouvelles commandes est actif tant que le restaurateur ne l'a pas coupé. */
    fun sonActif(stockage: StockageLocal): Boolean = stockage.lire(CLE_SON) != "non"

    /** Le poste fixe (écran allumé, alerte continue) est actif tant que le restaurateur ne l'a pas coupé. */
    fun posteFixe(stockage: StockageLocal): Boolean = stockage.lire(CLE_POSTE_FIXE) != "non"

    fun ecrireSon(stockage: StockageLocal, actif: Boolean) = stockage.ecrire(CLE_SON, if (actif) "oui" else "non")

    fun ecrirePosteFixe(stockage: StockageLocal, actif: Boolean) = stockage.ecrire(CLE_POSTE_FIXE, if (actif) "oui" else "non")
}

/**
 * Clés des listes de l'écran « Réglages » : un espace de noms par collection. Sans cela, une même chaîne des deux côtés fait planter
 * l'application au premier défilement : Compose refuse deux clés identiques dans une même liste.
 */
fun cleJourHoraire(index: Int): String = "jour-$index"

/** Clé d'un plat à reconfirmer : espace de noms distinct de celui des jours. */
fun clePlatAReconfirmer(id: String): String = "plat-$id"

@Serializable
private data class ReponseReglages(
    val ok: Boolean = false,
    val horaires: String = "",
    val ouvert: Boolean = false,
    val accepteCommandes: Boolean = false,
    val platsAReconfirmer: List<PlatAReconfirmer> = emptyList(),
    val erreur: ErreurServeur? = null,
)

@Serializable
private data class CorpsHoraires(val horaires: String)

interface ReglagesRestaurateurApi {
    /** Les réglages du restaurant : horaires, service ouvert ou en pause, plats à reconfirmer. */
    suspend fun charger(jetonAcces: String): ReglagesRestaurateur

    /** Enregistre les horaires déclarés. Renvoie un message d'erreur lisible, ou null si c'est enregistré. */
    suspend fun enregistrerHoraires(jetonAcces: String, horaires: String): String?
}

class KtorReglagesRestaurateurApi(private val client: HttpClient, private val config: SpeedfoodConfig) : ReglagesRestaurateurApi {
    private fun url(chemin: String) = "${config.siteUrl.trimEnd('/')}/api/v1/restaurant/$chemin"
    private val json = Json { encodeDefaults = true; explicitNulls = false }

    private suspend fun <T> appeler(bloc: suspend () -> T): T = try {
        bloc()
    } catch (e: ErreurReseau) {
        throw e
    } catch (e: Exception) {
        throw erreurTechnique(e)
    }

    override suspend fun charger(jetonAcces: String): ReglagesRestaurateur = appeler {
        val reponse = try {
            client.get(url("reglages")) { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseReglages>()
        } catch (e: JsonConvertException) {
            // La réponse est arrivée mais n'est pas lisible : on le dit comme ça. Une coupure remonte plus haut et devient « Impossible de joindre Speedfood ».
            throw ErreurReseau("La réponse de Speedfood est illisible. Réessayez dans un instant.", e)
        }
        if (!reponse.ok) {
            val message = reponse.erreur?.message ?: "Vos réglages n'ont pas pu être chargés. Réessayez dans un instant."
            if (reponse.erreur?.code == "NON_AUTHENTIFIE" || reponse.erreur?.code == "NON_AUTORISE") throw ErreurAcces(message)
            throw ErreurReseau(message)
        }
        ReglagesRestaurateur(reponse.horaires, reponse.ouvert, reponse.accepteCommandes, reponse.platsAReconfirmer)
    }

    override suspend fun enregistrerHoraires(jetonAcces: String, horaires: String): String? = appeler {
        val reponse = client.post(url("reglages")) {
            header(HttpHeaders.Authorization, "Bearer $jetonAcces")
            contentType(ContentType.Application.Json)
            setBody(json.encodeToString(CorpsHoraires.serializer(), CorpsHoraires(horaires)))
        }
        val lu = try {
            reponse.body<ReponseReglages>()
        } catch (e: Exception) {
            return@appeler "La réponse de Speedfood est illisible. Réessayez dans un instant."
        }
        if (lu.ok) null else lu.erreur?.message ?: "Vos horaires n'ont pas pu être enregistrés. Réessayez dans un instant."
    }
}
