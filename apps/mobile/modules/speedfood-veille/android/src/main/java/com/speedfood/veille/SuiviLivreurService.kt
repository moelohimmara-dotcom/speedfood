package com.speedfood.veille

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder

/**
 * Service de premier plan du suivi livreur (prototype D9, compilation CI requise).
 * Il remonte les positions au TypeScript (`onPosition`), qui les envoie par la session (seule détentrice du jeton) tant qu'une course
 * est active. Aucun appel réseau et aucun jeton ici ; sans permission de localisation, le service s'arrête sans rien casser.
 */
class SuiviLivreurService : Service() {
  private var gestionnairePosition: LocationManager? = null

  private val ecoute = object : LocationListener {
    override fun onLocationChanged(position: Location) {
      emetteur?.invoke(position.latitude, position.longitude)
    }
    override fun onStatusChanged(fournisseur: String?, statut: Int, extras: Bundle?) { /* rien à signaler */ }
    override fun onProviderEnabled(fournisseur: String) { /* reprise automatique par le système */ }
    override fun onProviderDisabled(fournisseur: String) { /* le TypeScript le verra à l'absence de positions */ }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    if (Build.VERSION.SDK_INT >= 26) {
      val gestionnaire = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      gestionnaire.createNotificationChannel(NotificationChannel(CANAL_SUIVI, "Suivi de livraison", NotificationManager.IMPORTANCE_LOW))
    }
    val notification = notificationSuivi()
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(ID_SUIVI, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      @Suppress("DEPRECATION")
      startForeground(ID_SUIVI, notification)
    }
    demarrerPositions()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

  override fun onDestroy() {
    try { gestionnairePosition?.removeUpdates(ecoute) } catch (_: Exception) { /* déjà retiré */ }
    super.onDestroy()
  }

  private fun demarrerPositions() {
    if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      stopSelf()
      return
    }
    try {
      val gestionnaire = getSystemService(Context.LOCATION_SERVICE) as LocationManager
      gestionnairePosition = gestionnaire
      if (gestionnaire.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
        gestionnaire.requestLocationUpdates(LocationManager.GPS_PROVIDER, 5_000L, 10f, ecoute)
      }
      if (gestionnaire.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
        gestionnaire.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 5_000L, 10f, ecoute)
      }
    } catch (_: Exception) {
      stopSelf()
    }
  }

  private fun notificationSuivi(): Notification {
    val cible = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
    val ouverture = PendingIntent.getActivity(this, 0, cible, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val constructeur = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CANAL_SUIVI) else @Suppress("DEPRECATION") Notification.Builder(this)
    return constructeur
      .setContentTitle("Speedfood — suivi livreur actif")
      .setContentText("Votre position est partagée pendant vos courses.")
      .setSmallIcon(applicationInfo.icon)
      .setContentIntent(ouverture)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val ID_SUIVI = 4201
    private const val CANAL_SUIVI = "suivi_livreur"
    /** Branché par le module Expo : remonte chaque position au TypeScript. */
    var emetteur: ((Double, Double) -> Unit)? = null

    fun demarrer(context: Context) {
      val intention = Intent(context, SuiviLivreurService::class.java)
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intention) else context.startService(intention)
    }

    fun arreter(context: Context) {
      context.stopService(Intent(context, SuiviLivreurService::class.java))
    }
  }
}
