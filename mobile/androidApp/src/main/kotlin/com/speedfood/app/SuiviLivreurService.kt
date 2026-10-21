package com.speedfood.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import com.speedfood.app.data.EtatLivreur
import com.speedfood.app.data.SuiviLivreur
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.di.suiviLivreurEnArrierePlan
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Suivi du livreur au premier plan : tant qu'il est en ligne ou en course, ce service lit la position du téléphone, l'envoie au serveur et prévient d'une
 * nouvelle offre par une notification, application ouverte ou non. Une notification permanente rappelle que le suivi est actif (obligatoire sous Android) ;
 * il s'arrête seul dès que le livreur est hors ligne, déconnecté ou que sa fiche n'est plus active. Démarré uniquement depuis l'application ouverte, après le
 * consentement explicite du livreur.
 */
class SuiviLivreurService : Service() {
    private val portee = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var boucle: Job? = null
    private var verrou: PowerManager.WakeLock? = null
    private var texteSuivi = ""
    private var offreNotifiee: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        creerCanaux()
        texteSuivi = "Vous êtes en ligne"
        val notification = notificationSuivi(texteSuivi)
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID_SUIVI, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION) else startForeground(ID_SUIVI, notification)
        SpeedfoodApp.position.serviceActif = true
        if (boucle == null) demarrer()
        // Relancé par le système s'il est arrêté : le tour suivant décide s'il y a encore quelque chose à suivre.
        return START_STICKY
    }

    private fun demarrer() {
        val suivi = suiviLivreurEnArrierePlan()
        SpeedfoodApp.position.demarrer { lat, lon -> suivi.positionMesuree(lat, lon) }
        // Le processeur reste éveillé écran éteint, pour que les tours de suivi ne soient pas suspendus ; relâché à l'arrêt, plafonné à 12 h.
        verrou = (getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "speedfood:suivi-livreur").apply { acquire(12 * 3_600_000L) }
        boucle = portee.launch {
            while (isActive) {
                when (val tour = suivi.tour()) {
                    SuiviLivreur.Tour.Arret -> {
                        arreter()
                        return@launch
                    }
                    SuiviLivreur.Tour.Attente -> Unit
                    is SuiviLivreur.Tour.Suite -> miseAJour(tour.etat)
                }
                delay(SuiviLivreur.DELAI_TOUR_MS)
            }
        }
    }

    private fun miseAJour(etat: EtatLivreur) {
        val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val texte = etat.course?.let { "Course ${it.commandeReference} · ${it.libelle}" } ?: "En ligne · en attente d'une course"
        if (texte != texteSuivi) {
            texteSuivi = texte
            gestionnaire.notify(ID_SUIVI, notificationSuivi(texte))
        }
        val offre = etat.offre
        if (offre == null) {
            if (offreNotifiee != null) gestionnaire.cancel(ID_OFFRE)
            offreNotifiee = null
        } else if (offre.offreId != offreNotifiee) {
            offreNotifiee = offre.offreId
            val reste = offre.secondesRestantes(System.currentTimeMillis())
            if (reste > 0) gestionnaire.notify(ID_OFFRE, notificationOffre("Nouvelle course · ${offre.restaurantNom}", "Gain ${formaterGnf(offre.fraisGnf)} · répondez dans $reste s", reste))
        }
    }

    private fun arreter() {
        boucle?.cancel()
        boucle = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID_OFFRE)
        stopSelf()
    }

    override fun onDestroy() {
        boucle?.cancel()
        portee.cancel()
        SpeedfoodApp.position.finArrierePlan()
        verrou?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    private fun ouvrirApplication(): PendingIntent =
        PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun constructeur(canal: String): Notification.Builder =
        if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, canal) else @Suppress("DEPRECATION") Notification.Builder(this)

    private fun notificationSuivi(texte: String): Notification =
        constructeur(CANAL_SUIVI)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle("Speedfood · suivi livreur actif")
            .setContentText(texte)
            .setOngoing(true)
            .setContentIntent(ouvrirApplication())
            .build()

    private fun notificationOffre(titre: String, texte: String, secondes: Long): Notification =
        constructeur(CANAL_OFFRE)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(titre)
            .setContentText(texte)
            .setAutoCancel(true)
            .setContentIntent(ouvrirApplication())
            .apply {
                if (Build.VERSION.SDK_INT >= 26) setTimeoutAfter(secondes * 1000L) else @Suppress("DEPRECATION") setPriority(Notification.PRIORITY_HIGH)
                setCategory(Notification.CATEGORY_MESSAGE)
            }
            .build()

    private fun creerCanaux() {
        if (Build.VERSION.SDK_INT < 26) return
        val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        gestionnaire.createNotificationChannel(NotificationChannel(CANAL_SUIVI, "Suivi livreur", NotificationManager.IMPORTANCE_LOW).apply { description = "Rappel que votre position est suivie pendant que vous êtes en ligne." })
        gestionnaire.createNotificationChannel(NotificationChannel(CANAL_OFFRE, "Nouvelles courses", NotificationManager.IMPORTANCE_HIGH).apply { description = "Alerte quand une course vous est proposée." })
    }

    companion object {
        private const val CANAL_SUIVI = "suivi_livreur"
        private const val CANAL_OFFRE = "offre_course"
        private const val ID_SUIVI = 4101
        private const val ID_OFFRE = 4102
    }
}
