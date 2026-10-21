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
import com.speedfood.app.data.SurveillanceCommandes
import com.speedfood.app.di.surveillanceCommandesEnArrierePlan
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Alerte de nouvelle commande, application fermée : tant que le restaurateur l'a demandé, ce service relit ses commandes toutes les 10 secondes et fait sonner le
 * téléphone (notification sonore) à chaque nouvelle commande à traiter, avec un rappel chaque minute tant qu'il en reste. Une notification permanente rappelle que la
 * surveillance est active. Il s'arrête seul si le restaurateur est déconnecté, si l'accès est refusé, ou si le restaurant est fermé sans commande à traiter.
 *
 * Sans Firebase : c'est du sondage depuis le téléphone, donc il dépend d'un téléphone qui garde le service actif (branché, optimisation de batterie désactivée pour
 * Speedfood). Les notifications poussées (lot N5) viendront le doubler sans le remplacer.
 */
class SurveillanceRestaurateurService : Service() {
    private val portee = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var boucle: Job? = null
    private var verrou: PowerManager.WakeLock? = null
    private var texteSuivi = ""

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        creerCanaux()
        texteSuivi = "Surveillance des commandes"
        val notification = notificationSuivi(texteSuivi)
        if (Build.VERSION.SDK_INT >= 34) startForeground(ID_SUIVI, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE) else startForeground(ID_SUIVI, notification)
        SpeedfoodApp.alerte.serviceActif = true
        if (boucle == null) demarrer()
        return START_STICKY
    }

    private fun demarrer() {
        val surveillance = surveillanceCommandesEnArrierePlan()
        // Le processeur reste éveillé écran éteint, pour que les tours ne soient pas suspendus ; relâché à l'arrêt, plafonné à 12 h (renouvelé par le redémarrage du service).
        verrou = (getSystemService(Context.POWER_SERVICE) as PowerManager).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "speedfood:surveillance-commandes").apply { acquire(12 * 3_600_000L) }
        boucle = portee.launch {
            while (isActive) {
                when (val tour = surveillance.tour()) {
                    SurveillanceCommandes.Tour.Arret -> {
                        arreter()
                        return@launch
                    }
                    SurveillanceCommandes.Tour.Attente -> Unit
                    is SurveillanceCommandes.Tour.Suite -> miseAJour(tour)
                }
                delay(SurveillanceCommandes.DELAI_TOUR_MS)
            }
        }
    }

    private fun miseAJour(tour: SurveillanceCommandes.Tour.Suite) {
        val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val n = tour.aTraiter.size
        val texte = if (n == 0) "Surveillance des commandes · rien à traiter" else "$n commande(s) à traiter"
        if (texte != texteSuivi) {
            texteSuivi = texte
            gestionnaire.notify(ID_SUIVI, notificationSuivi(texte))
        }
        if (n == 0) {
            gestionnaire.cancel(ID_ALERTE)
        } else if (tour.alerter) {
            val titre = if (tour.nouvelles > 0) "Nouvelle commande" else "Commande en attente"
            val detail = tour.aTraiter.first().let { "${it.reference} · ${it.clientNom}" } + if (n > 1) " et ${n - 1} autre(s)" else ""
            gestionnaire.notify(ID_ALERTE, notificationAlerte(titre, detail))
        }
    }

    private fun arreter() {
        boucle?.cancel()
        boucle = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID_ALERTE)
        stopSelf()
    }

    override fun onDestroy() {
        boucle?.cancel()
        portee.cancel()
        SpeedfoodApp.alerte.serviceActif = false
        verrou?.takeIf { it.isHeld }?.release()
        super.onDestroy()
    }

    private fun ouvrirApplication(): PendingIntent =
        PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    private fun constructeur(canal: String): Notification.Builder =
        if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, canal) else @Suppress("DEPRECATION") Notification.Builder(this)

    private fun notificationSuivi(texte: String): Notification =
        constructeur(CANAL_SUIVI)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("Speedfood · alerte des commandes active")
            .setContentText(texte)
            .setOngoing(true)
            .setContentIntent(ouvrirApplication())
            .build()

    private fun notificationAlerte(titre: String, texte: String): Notification =
        constructeur(CANAL_ALERTE)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(titre)
            .setContentText(texte)
            .setAutoCancel(true)
            .setContentIntent(ouvrirApplication())
            .apply {
                if (Build.VERSION.SDK_INT < 26) @Suppress("DEPRECATION") setPriority(Notification.PRIORITY_HIGH)
                setCategory(Notification.CATEGORY_MESSAGE)
            }
            .build()

    private fun creerCanaux() {
        if (Build.VERSION.SDK_INT < 26) return
        val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        gestionnaire.createNotificationChannel(NotificationChannel(CANAL_SUIVI, "Surveillance des commandes", NotificationManager.IMPORTANCE_LOW).apply { description = "Rappel que Speedfood surveille vos commandes pour vous alerter." })
        gestionnaire.createNotificationChannel(NotificationChannel(CANAL_ALERTE, "Nouvelles commandes", NotificationManager.IMPORTANCE_HIGH).apply { description = "Alerte sonore quand une commande attend votre réponse." })
    }

    companion object {
        private const val CANAL_SUIVI = "surveillance_commandes"
        private const val CANAL_ALERTE = "alerte_commande"
        private const val ID_SUIVI = 4201
        private const val ID_ALERTE = 4202
    }
}
