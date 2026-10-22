package com.speedfood.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK
import androidx.biometric.BiometricManager.Authenticators.DEVICE_CREDENTIAL
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.speedfood.app.data.DemandeNotifications
import com.speedfood.app.data.VerrouAppareil
import java.lang.ref.WeakReference

/** Autorisation des notifications (Android 13 et plus) : la demande du système est lancée par l'activité, après l'explication affichée par l'application. */
class NotificationsAndroid(private val contexte: Context) : DemandeNotifications {
    private var lanceur: (() -> Unit)? = null

    fun lier(lanceur: () -> Unit) {
        this.lanceur = lanceur
    }

    override val disponible: Boolean get() = Build.VERSION.SDK_INT >= 33

    override fun autorisee(): Boolean = Build.VERSION.SDK_INT < 33 || contexte.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    override fun demander() {
        lanceur?.invoke()
    }
}

/** Empreinte, visage ou code du téléphone (verrouillage d'écran du système) via la fenêtre standard d'Android. */
class VerrouAndroid(private val contexte: Context) : VerrouAppareil {
    private var activite: WeakReference<FragmentActivity>? = null
    private val methodes = BIOMETRIC_WEAK or DEVICE_CREDENTIAL

    fun lier(activite: FragmentActivity) {
        this.activite = WeakReference(activite)
    }

    override fun utilisable(): Boolean = BiometricManager.from(contexte).canAuthenticate(methodes) == BiometricManager.BIOMETRIC_SUCCESS

    override fun authentifier(titre: String, surResultat: (Boolean) -> Unit) {
        val hote = activite?.get()
        if (hote == null || !utilisable()) {
            // Rien ne peut être demandé : on ne bloque jamais la personne (voir VerrouEspacesPro).
            surResultat(true)
            return
        }
        val prompt = BiometricPrompt(
            hote,
            ContextCompat.getMainExecutor(contexte),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) = surResultat(true)
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) = surResultat(false)
            },
        )
        prompt.authenticate(BiometricPrompt.PromptInfo.Builder().setTitle(titre).setAllowedAuthenticators(methodes).build())
    }
}
