package com.speedfood.app

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.view.WindowManager
import com.speedfood.app.data.AlerteCommande
import java.lang.ref.WeakReference

/**
 * Alerte de nouvelle commande du restaurateur : sonnerie de notification du téléphone (jouée au volume « notifications » choisi par la personne) tant que la
 * console est ouverte, et écran gardé allumé. Application fermée : [SurveillanceRestaurateurService], à la demande du restaurateur (les notifications poussées
 * du lot N5 viendront le doubler).
 */
class AlerteAndroid(private val contexte: Context) : AlerteCommande {
    private var activite: WeakReference<Activity>? = null
    private var sonnerie: Ringtone? = null

    /** Vrai tant que le service de surveillance tourne (posé par le service). */
    @Volatile
    var serviceActif: Boolean = false

    override val arrierePlanPossible: Boolean get() = true
    override val arrierePlanActif: Boolean get() = serviceActif

    /** Démarre le service (sans effet s'il tourne déjà). Refusé par le système si l'application n'est plus visible : on ignore, le tour suivant réessaiera. */
    override fun demarrerArrierePlan() {
        if (serviceActif) return
        // Android 13 et plus : sans l'autorisation des notifications, ni la notification du service ni les alertes ne s'affichent. On la demande une fois, puis on réessaie au tour suivant.
        if (Build.VERSION.SDK_INT >= 33 && contexte.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            if (!autorisationDemandee) {
                autorisationDemandee = true
                demandeur?.invoke()
            }
            return
        }
        try {
            val intention = Intent(contexte, SurveillanceRestaurateurService::class.java)
            if (Build.VERSION.SDK_INT >= 26) contexte.startForegroundService(intention) else contexte.startService(intention)
        } catch (_: Exception) {
            // Démarrage refusé (application passée en arrière-plan entre-temps) : sans conséquence, on réessaiera à l'ouverture suivante.
        }
    }

    override fun arreterArrierePlan() {
        contexte.stopService(Intent(contexte, SurveillanceRestaurateurService::class.java))
    }

    private var demandeur: (() -> Unit)? = null
    private var autorisationDemandee = false

    fun lier(activite: Activity, demandeurNotifications: () -> Unit) {
        this.activite = WeakReference(activite)
        this.demandeur = demandeurNotifications
    }

    fun delier(activite: Activity) {
        if (this.activite?.get() === activite) {
            this.activite = null
            this.demandeur = null
            sonnerie?.stop()
            sonnerie = null
        }
    }

    override fun sonner() {
        try {
            sonnerie?.stop()
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            sonnerie = RingtoneManager.getRingtone(contexte, uri)?.apply {
                audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
                play()
            }
        } catch (_: Exception) {
            // Pas de sonnerie disponible : la commande reste visible à l'écran, rien d'autre à faire.
        }
    }

    override fun garderEcranAllume(actif: Boolean) {
        val fenetre = activite?.get()?.window ?: return
        fenetre.decorView.post {
            if (actif) fenetre.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else fenetre.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
}
