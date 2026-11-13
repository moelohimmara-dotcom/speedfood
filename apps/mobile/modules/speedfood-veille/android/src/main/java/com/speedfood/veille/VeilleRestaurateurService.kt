package com.speedfood.veille

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

/**
 * Service de premier plan de la veille restaurateur (prototype C11/C12, compilation CI requise).
 * Il ne lit rien sur le réseau et ne voit aucun jeton : la session TypeScript garde les lectures et lui dit seulement d'alerter
 * (décision portée par la logique de surveillance testée côté TypeScript). Tant que le processus vit, l'écran ouvert sonne ;
 * application fermée, les notifications du serveur prennent le relais.
 */
class VeilleRestaurateurService : Service() {
  private var sonnerie: Ringtone? = null
  private var reveil: PowerManager.WakeLock? = null
  private val principal = Handler(Looper.getMainLooper())
  private val arretSonnerie = Runnable { arreterSonnerie() }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    canaux()
    startForeground(ID_VEILLE, notificationVeille("Surveillance des commandes active"))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_ALERTER) {
      val nombre = intent.getIntExtra(EXTRA_NOMBRE, 1)
      val reference = intent.getStringExtra(EXTRA_REFERENCE) ?: ""
      sonner(nombre, reference)
    }
    return START_STICKY
  }

  override fun onDestroy() {
    arreterSonnerie()
    super.onDestroy()
  }

  private fun sonner(nombre: Int, reference: String) {
    val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val texte = if (nombre <= 1) "Nouvelle commande à traiter : $reference" else "$nombre commandes à traiter"
    gestionnaire.notify(ID_ALERTE, notificationAlerte(texte))
    try {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      @Suppress("DEPRECATION")
      reveil = pm.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP,
        "speedfood:alerte-commande",
      ).apply { acquire(30_000L) }
    } catch (_: Exception) { /* l'écran reste éteint : la notification et la sonnerie suffisent */ }
    arreterSonnerieSansReveil()
    try {
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      sonnerie = RingtoneManager.getRingtone(this, uri)?.apply { play() }
    } catch (_: Exception) { /* pas de sonnerie disponible : la notification reste */ }
    principal.removeCallbacks(arretSonnerie)
    principal.postDelayed(arretSonnerie, 60_000L)
  }

  private fun arreterSonnerieSansReveil() {
    try { sonnerie?.stop() } catch (_: Exception) { /* déjà arrêtée */ }
    sonnerie = null
  }

  private fun arreterSonnerie() {
    arreterSonnerieSansReveil()
    try { if (reveil?.isHeld == true) reveil?.release() } catch (_: Exception) { /* déjà libéré */ }
    reveil = null
  }

  private fun canaux() {
    if (Build.VERSION.SDK_INT < 26) return
    val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    gestionnaire.createNotificationChannel(NotificationChannel(CANAL_VEILLE, "Veille des commandes", NotificationManager.IMPORTANCE_LOW))
    gestionnaire.createNotificationChannel(NotificationChannel(CANAL_ALERTE, "Alertes nouvelles commandes", NotificationManager.IMPORTANCE_HIGH))
  }

  private fun ouvrirApplication(): PendingIntent {
    val cible = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
    return PendingIntent.getActivity(this, 0, cible, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
  }

  private fun notificationVeille(texte: String): Notification {
    val constructeur = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CANAL_VEILLE) else @Suppress("DEPRECATION") Notification.Builder(this)
    return constructeur
      .setContentTitle("Speedfood — espace restaurateur")
      .setContentText(texte)
      .setSmallIcon(applicationInfo.icon)
      .setContentIntent(ouvrirApplication())
      .setOngoing(true)
      .build()
  }

  private fun notificationAlerte(texte: String): Notification {
    val constructeur = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CANAL_ALERTE) else @Suppress("DEPRECATION") Notification.Builder(this)
    return constructeur
      .setContentTitle("Nouvelle commande Speedfood")
      .setContentText(texte)
      .setSmallIcon(applicationInfo.icon)
      .setContentIntent(ouvrirApplication())
      .setFullScreenIntent(ouvrirApplication(), true)
      .setAutoCancel(true)
      .build()
  }

  companion object {
    const val ACTION_ALERTER = "com.speedfood.veille.ALERTER"
    private const val EXTRA_NOMBRE = "nombre"
    private const val EXTRA_REFERENCE = "reference"
    private const val ID_VEILLE = 4101
    private const val ID_ALERTE = 4102
    private const val CANAL_VEILLE = "veille_restaurateur"
    private const val CANAL_ALERTE = "alerte_commande"

    fun demarrer(context: Context) {
      val intention = Intent(context, VeilleRestaurateurService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intention) else context.startService(intention)
    }

    fun alerter(context: Context, nombre: Int, reference: String) {
      val intention = Intent(context, VeilleRestaurateurService::class.java).apply {
        action = ACTION_ALERTER
        putExtra(EXTRA_NOMBRE, nombre)
        putExtra(EXTRA_REFERENCE, reference)
      }
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intention) else context.startService(intention)
    }

    fun arreter(context: Context) {
      context.stopService(Intent(context, VeilleRestaurateurService::class.java))
    }
  }
}
