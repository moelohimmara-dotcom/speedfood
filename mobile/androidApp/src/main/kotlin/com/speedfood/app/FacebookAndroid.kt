package com.speedfood.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import com.speedfood.app.data.CHEMIN_RETOUR_FACEBOOK
import com.speedfood.app.data.FournisseurFacebook
import com.speedfood.app.data.ResultatFacebook
import kotlinx.coroutines.CompletableDeferred
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Connexion avec Facebook dans le navigateur du téléphone, avec PKCE : l'application génère un secret ([verificateur]) dont seule l'empreinte part dans l'adresse ; au retour,
 * le lien d'application `/auth/application?code=…` rend la main à l'application, qui échange le code contre la session AVEC le secret. Un code intercepté ne sert donc à rien.
 * Si la personne revient sans avoir terminé (navigateur fermé), la demande est abandonnée peu après le retour à l'application.
 */
class FacebookAndroid(private val contexte: Context) : FournisseurFacebook {
    private var attente: CompletableDeferred<ResultatFacebook>? = null
    private var verificateur: String? = null
    private val poignee = Handler(Looper.getMainLooper())

    override val disponible: Boolean = true

    override suspend fun obtenirCode(urlDepart: (codeChallenge: String) -> String): ResultatFacebook {
        attente?.complete(ResultatFacebook.Annule)
        val secret = ByteArray(48).also { SecureRandom().nextBytes(it) }
        val v = Base64.encodeToString(secret, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        val empreinte = Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(v.toByteArray()), Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        val demande = CompletableDeferred<ResultatFacebook>()
        attente = demande
        verificateur = v
        return try {
            contexte.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(urlDepart(empreinte))).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            demande.await()
        } catch (_: Exception) {
            ResultatFacebook.Erreur("Impossible d'ouvrir Facebook sur ce téléphone. Utilisez votre e-mail.")
        } finally {
            if (attente === demande) {
                attente = null
                verificateur = null
            }
        }
    }

    /** Appelé par l'écran principal à chaque lien reçu : rend le code à la demande en attente si c'est le retour de Facebook. */
    fun retour(lien: Uri?) {
        if (lien == null || lien.path != CHEMIN_RETOUR_FACEBOOK) return
        val demande = attente ?: return
        val code = lien.getQueryParameter("code")
        val v = verificateur
        demande.complete(if (code.isNullOrBlank() || v == null) ResultatFacebook.Annule else ResultatFacebook.Code(code, v))
    }

    /** Appelé quand l'application revient au premier plan : si le retour de Facebook n'arrive pas, la demande est abandonnée. */
    fun reprise() {
        val demande = attente ?: return
        poignee.postDelayed({ if (attente === demande) demande.complete(ResultatFacebook.Annule) }, 2500)
    }
}
