package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import kotlinx.serialization.Serializable

/** Version de l'application installée (affichée dans Paramètres et À propos). */
data class InfosApplication(val versionNom: String, val codeVersion: Int)

@Serializable
private data class ReponseAide(val ok: Boolean = false, val whatsapp: String? = null)

interface AideApi {
    /** Numéro WhatsApp de l'assistance renseigné par l'administration (chiffres seuls, indicatif inclus), ou null s'il n'y en a pas ou si le serveur ne répond pas. */
    suspend fun whatsapp(): String?
}

class KtorAideApi(private val client: HttpClient, private val config: SpeedfoodConfig) : AideApi {
    override suspend fun whatsapp(): String? = try {
        val r = client.get("${config.siteUrl.trimEnd('/')}/api/v1/aide").body<ReponseAide>()
        r.whatsapp?.filter { it.isDigit() }?.takeIf { it.length in 8..15 }
    } catch (_: Exception) {
        null
    }
}

/** Une question fréquente : texte court, en français courant, fidèle au fonctionnement réel de l'application. */
data class QuestionAide(val question: String, val reponse: String)

val QUESTIONS_AIDE = listOf(
    QuestionAide(
        "Comment passer une commande ?",
        "Choisissez un restaurant, ajoutez des plats au panier, puis touchez « Commander ». Il faut un compte (e-mail ou Google). Le restaurant confirme ensuite votre commande : elle n'est ferme qu'à ce moment-là.",
    ),
    QuestionAide(
        "Comment payer ?",
        "Vous réglez directement le restaurant (espèces ou moyen de paiement mobile qu'il accepte, indiqué sur sa fiche). Speedfood n'encaisse rien dans l'application pour l'instant.",
    ),
    QuestionAide(
        "Le restaurant me propose un changement, que faire ?",
        "Ouvrez la commande dans l'onglet Commandes : vous pouvez accepter ou refuser la proposition. Rien n'est préparé tant que vous n'avez pas répondu.",
    ),
    QuestionAide(
        "Où suivre ma commande ?",
        "Dans l'onglet Commandes. L'écran de suivi se met à jour tout seul et vous recevez une notification à chaque étape si vous les avez autorisées.",
    ),
    QuestionAide(
        "Je ne reçois pas les notifications.",
        "Dans Compte > Paramètres, touchez « Tester les notifications ». Si rien n'arrive, vérifiez dans les réglages du téléphone que les notifications de Speedfood sont autorisées.",
    ),
    QuestionAide(
        "Comment supprimer mon compte et mes données ?",
        "Depuis le site de Speedfood, page « Mon compte ». Les règles de conservation des données sont expliquées dans la page Confidentialité.",
    ),
)

/** Questions du restaurateur qui n'a pas encore d'espace : sa demande d'inscription, pas la commande d'un repas. */
val QUESTIONS_AIDE_RESTAURATEUR = listOf(
    QuestionAide(
        "Combien de temps pour avoir une réponse ?",
        "L'équipe Speedfood répond sous 48 heures. Vous êtes prévenu par une notification dans l'application dès que la demande est acceptée, refusée ou que votre restaurant est créé.",
    ),
    QuestionAide(
        "Que se passe-t-il si ma demande est refusée ?",
        "Le motif s'affiche dans « Ma demande ». Vous pouvez corriger ce qui manque et déposer une nouvelle demande. Les images et le menu envoyés sont effacés 30 jours après un refus.",
    ),
    QuestionAide(
        "Comment ajouter mon menu ?",
        "Pendant la demande, photographiez votre carte : Speedfood lit les plats et les prix, et vous relisez chaque ligne avant de valider. Vous pouvez aussi les saisir à la main. L'équipe vérifie avant la mise en ligne.",
    ),
    QuestionAide(
        "Quand mon restaurant apparaît-il pour les clients ?",
        "Une fois la demande acceptée, l'équipe crée votre établissement, le vérifie puis le publie. Votre compte est alors rattaché à votre restaurant et vous y accédez depuis cette application.",
    ),
    QuestionAide(
        "Mon numéro de téléphone est refusé : pourquoi ?",
        "Un numéro ne peut appartenir qu'à un seul compte. S'il est déjà utilisé, connectez-vous avec ce compte, ou contactez l'équipe : elle vous appellera pour vérifier, puis vous l'attribuera si c'est bien le vôtre.",
    ),
    QuestionAide(
        "Comment supprimer mon compte et mes données ?",
        "Ouvrez l'onglet Compte, puis « Supprimer mon compte », et confirmez. Vos données personnelles et votre demande sont effacées.",
    ),
)
