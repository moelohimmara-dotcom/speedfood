package com.speedfood.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.speedfood.app.data.FournisseurJetonPush
import com.speedfood.app.di.enregistrerAppareilPush
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

/**
 * Notifications poussées (Firebase Cloud Messaging). Firebase n'est actif que si `google-services.json` était présent à la construction : sans lui, ou sur un
 * téléphone sans services Google, rien n'est enregistré et les services d'arrière-plan de Speedfood prennent le relais (voir `docs/NATIF-PLAN.md`).
 */
class JetonFirebase(private val contexte: Context) : FournisseurJetonPush {
    override val disponible: Boolean
        get() = try {
            FirebaseApp.getApps(contexte).isNotEmpty()
        } catch (_: Exception) {
            false
        }

    override suspend fun jeton(): String? {
        if (!disponible) return null
        return try {
            suspendCancellableCoroutine { suite ->
                FirebaseMessaging.getInstance().token
                    .addOnSuccessListener { if (suite.isActive) suite.resume(it) }
                    .addOnFailureListener { if (suite.isActive) suite.resume(null) }
                    .addOnCanceledListener { if (suite.isActive) suite.resume(null) }
            }
        } catch (_: Exception) {
            null
        }
    }
}

/** Reçoit les événements Firebase. Le texte des notifications est affiché par le système (message de type « notification ») : rien à dessiner ici. */
class SpeedfoodMessagingService : FirebaseMessagingService() {
    private val portee = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Nouveau jeton (réinstallation, restauration, rotation par Firebase) : l'appareil est ré-enregistré pour le compte connecté. */
    override fun onNewToken(token: String) {
        portee.launch {
            try {
                enregistrerAppareilPush()
            } catch (_: Exception) {
                // Meilleur effort : il sera rejoué au prochain démarrage de l'application.
            }
        }
    }

    /** Application au premier plan : la console ou l'écran de suivi se met déjà à jour tout seul ; aucune seconde alerte n'est affichée. */
    override fun onMessageReceived(message: RemoteMessage) = Unit
}

/**
 * Canaux de notification, créés au démarrage : Firebase y route les messages par identifiant (`channel_id` posé par le serveur, voir `src/lib/push/fcm.ts`). Les
 * services d'arrière-plan réutilisent les mêmes identifiants pour « alerte_commande » et « offre_course ».
 */
fun creerCanauxNotification(contexte: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val gestionnaire = contexte.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    gestionnaire.createNotificationChannel(NotificationChannel("alerte_commande", "Nouvelles commandes", NotificationManager.IMPORTANCE_HIGH).apply { description = "Alerte sonore quand une commande attend votre réponse." })
    gestionnaire.createNotificationChannel(NotificationChannel("offre_course", "Nouvelles courses", NotificationManager.IMPORTANCE_HIGH).apply { description = "Alerte quand une course vous est proposée." })
    gestionnaire.createNotificationChannel(NotificationChannel("suivi_commande", "Suivi de commande", NotificationManager.IMPORTANCE_DEFAULT).apply { description = "Avancement de votre commande : acceptée, prête, terminée." })
}
