package com.speedfood.app

import android.Manifest
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.speedfood.app.data.NotificateurMiseAJour
import com.speedfood.app.data.VersionPubliee

/**
 * Notification « Mise à jour disponible » dans le centre de notifications du téléphone, posée par l'application elle-même quand elle découvre une version plus
 * récente. Toucher la notification ouvre la page de téléchargement. Sans l'autorisation des notifications (Android 13 et plus), rien n'est affiché : le bandeau
 * dans l'application reste le moyen principal.
 */
class NotificateurMiseAJourAndroid(private val contexte: Context) : NotificateurMiseAJour {
    override fun notifier(version: VersionPubliee, urlTelechargement: String) {
        if (Build.VERSION.SDK_INT >= 33 && contexte.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        try {
            val ouverture = PendingIntent.getActivity(
                contexte,
                IDENTIFIANT,
                Intent(Intent.ACTION_VIEW, Uri.parse(urlTelechargement)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            val notification = NotificationCompat.Builder(contexte, "mise_a_jour")
                .setSmallIcon(android.R.drawable.stat_sys_download_done)
                .setContentTitle("Mise à jour disponible")
                .setContentText("Speedfood ${version.nom} est disponible. Touchez pour la télécharger.")
                .setStyle(NotificationCompat.BigTextStyle().bigText(version.notes.ifBlank { "Une nouvelle version de Speedfood est disponible." }))
                .setContentIntent(ouverture)
                .setAutoCancel(true)
                .build()
            (contexte.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(IDENTIFIANT, notification)
        } catch (_: Exception) {
            // Confort uniquement : un refus du système ne doit jamais gêner l'application.
        }
    }

    private companion object {
        const val IDENTIFIANT = 7301
    }
}
