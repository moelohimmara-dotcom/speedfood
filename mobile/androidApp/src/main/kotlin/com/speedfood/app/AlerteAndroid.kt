package com.speedfood.app

import android.app.Activity
import android.content.Context
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.view.WindowManager
import com.speedfood.app.data.AlerteCommande
import java.lang.ref.WeakReference

/**
 * Alerte de nouvelle commande du restaurateur : sonnerie de notification du téléphone (jouée au volume « notifications » choisi par la personne) tant que la
 * console est ouverte, et écran gardé allumé. L'alerte application fermée viendra avec les notifications poussées (lot N5).
 */
class AlerteAndroid(private val contexte: Context) : AlerteCommande {
    private var activite: WeakReference<Activity>? = null
    private var sonnerie: Ringtone? = null

    fun lier(activite: Activity) {
        this.activite = WeakReference(activite)
    }

    fun delier(activite: Activity) {
        if (this.activite?.get() === activite) {
            this.activite = null
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
