package com.speedfood.app

import android.app.Activity
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.speedfood.app.data.FournisseurGoogle
import com.speedfood.app.data.ResultatGoogle
import java.lang.ref.WeakReference
import java.security.MessageDigest
import java.util.UUID

/**
 * Connexion avec Google par le gestionnaire d'identifiants du système (fenêtre native de choix du compte Google du téléphone). [idClientWeb] est l'identifiant du client OAuth
 * « Web » du projet Google (valeur publique, `google.webClientId` dans `speedfood.properties`) : c'est lui qui désigne Speedfood comme destinataire du jeton. Sans lui, le
 * bouton n'apparaît pas. Un nonce aléatoire est joint : Google en signe l'empreinte dans le jeton, le service d'authentification la recalcule à partir de la valeur brute.
 */
class GoogleAndroid(private val idClientWeb: String) : FournisseurGoogle {
    private var activite: WeakReference<Activity>? = null

    fun lier(activite: Activity) {
        this.activite = WeakReference(activite)
    }

    fun delier(activite: Activity) {
        if (this.activite?.get() === activite) this.activite = null
    }

    override val disponible: Boolean get() = idClientWeb.isNotBlank()

    override suspend fun jetonIdentite(): ResultatGoogle {
        val fenetre = activite?.get() ?: return ResultatGoogle.Erreur("Réessayez dans un instant : l'écran n'est pas prêt.")
        val nonceBrut = UUID.randomUUID().toString()
        val empreinte = MessageDigest.getInstance("SHA-256").digest(nonceBrut.toByteArray()).joinToString("") { "%02x".format(it) }
        val option = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(idClientWeb)
            .setNonce(empreinte)
            .build()
        val demande = GetCredentialRequest.Builder().addCredentialOption(option).build()
        return try {
            val credential = CredentialManager.create(fenetre).getCredential(fenetre, demande).credential
            if (credential is CustomCredential && credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                ResultatGoogle.Jeton(GoogleIdTokenCredential.createFrom(credential.data).idToken, nonceBrut)
            } else {
                ResultatGoogle.Erreur("Le compte Google n'a pas pu être lu. Utilisez votre e-mail et votre mot de passe.")
            }
        } catch (_: GetCredentialCancellationException) {
            ResultatGoogle.Annule
        } catch (_: NoCredentialException) {
            ResultatGoogle.Erreur("Aucun compte Google n'est connecté sur ce téléphone. Ajoutez-en un dans les réglages du téléphone, ou utilisez votre e-mail.")
        } catch (_: GetCredentialException) {
            ResultatGoogle.Erreur("La connexion avec Google a échoué. Vérifiez votre connexion puis réessayez.")
        } catch (_: Exception) {
            ResultatGoogle.Erreur("La connexion avec Google n'est pas disponible sur ce téléphone.")
        }
    }
}
