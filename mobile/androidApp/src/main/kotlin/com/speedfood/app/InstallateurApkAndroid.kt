package com.speedfood.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.speedfood.app.data.InstallateurApk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Installation d'une mise à jour sans passer par le navigateur : l'APK est téléchargée dans le dossier privé de l'application, son empreinte SHA-256 est comparée à celle
 * publiée par le serveur (une APK altérée ou tronquée est refusée), puis remise au programme d'installation du système. Le système vérifie en plus que la signature est
 * celle de l'application installée : une APK signée par quelqu'un d'autre ne peut pas la remplacer. La confirmation de la personne reste demandée par Android, sauf
 * quand le système l'autorise à s'en passer (Android 12 et plus, mises à jour d'une application que Speedfood a déjà installée).
 */
class InstallateurApkAndroid(private val contexte: Context) : InstallateurApk {
    override val actif: Boolean get() = Build.VERSION.SDK_INT >= 26

    override fun autorise(): Boolean = contexte.packageManager.canRequestPackageInstalls()

    override fun ouvrirAutorisation() {
        val ouverture = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${contexte.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            contexte.startActivity(ouverture)
        } catch (_: Exception) {
            // Réglage introuvable sur certains appareils : la personne peut l'ouvrir elle-même, le message du bandeau l'y invite.
        }
    }

    private val fichier: File get() = File(File(contexte.cacheDir, "maj").apply { mkdirs() }, "speedfood.apk")

    override suspend fun telecharger(url: String, sha256: String, progres: (Int) -> Unit): String? = withContext(Dispatchers.IO) {
        val cible = fichier
        cible.delete()
        try {
            val connexion = (URL(url).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 30_000
                instanceFollowRedirects = true
            }
            if (connexion.responseCode != 200) return@withContext "Le serveur n'a pas pu fournir la mise à jour (code ${connexion.responseCode}). Réessayez dans quelques minutes."
            val total = connexion.contentLengthLong
            val empreinte = MessageDigest.getInstance("SHA-256")
            var recus = 0L
            var dernier = -1
            connexion.inputStream.use { entree ->
                cible.outputStream().use { sortie ->
                    val tampon = ByteArray(64 * 1024)
                    while (true) {
                        val lus = entree.read(tampon)
                        if (lus < 0) break
                        sortie.write(tampon, 0, lus)
                        empreinte.update(tampon, 0, lus)
                        recus += lus
                        if (total > 0) {
                            val pourcent = (recus * 100 / total).toInt()
                            if (pourcent != dernier) {
                                dernier = pourcent
                                progres(pourcent)
                            }
                        }
                    }
                }
            }
            val obtenu = empreinte.digest().joinToString("") { "%02x".format(it) }
            if (!obtenu.equals(sha256, ignoreCase = true)) {
                cible.delete()
                // Cas courant juste après une publication : un relais du réseau garde encore l'ancienne APK quelques minutes.
                return@withContext "Le fichier reçu ne correspond pas à la version annoncée. Réessayez dans quelques minutes."
            }
            null
        } catch (e: Exception) {
            cible.delete()
            "Le téléchargement a échoué. Vérifiez votre connexion et réessayez."
        }
    }

    override fun installer() {
        val installeur = contexte.packageManager.packageInstaller
        val parametres = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        parametres.setAppPackageName(contexte.packageName)
        if (Build.VERSION.SDK_INT >= 31) parametres.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        val session = installeur.openSession(installeur.createSession(parametres))
        session.use { s ->
            fichier.inputStream().use { entree ->
                s.openWrite("speedfood.apk", 0, fichier.length()).use { sortie ->
                    entree.copyTo(sortie)
                    s.fsync(sortie)
                }
            }
            val retour = PendingIntent.getBroadcast(
                contexte,
                0,
                Intent(contexte, RetourInstallation::class.java).setPackage(contexte.packageName),
                // Modifiable : le système y ajoute l'état de l'installation.
                PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0),
            )
            s.commit(retour.intentSender)
        }
    }
}

/** Réponse du programme d'installation : ouvre la fenêtre de confirmation du système quand elle est demandée, puis supprime l'APK téléchargée. */
class RetourInstallation : BroadcastReceiver() {
    override fun onReceive(contexte: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirmation = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else intent.getParcelableExtra(Intent.EXTRA_INTENT)
                confirmation?.let { contexte.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
            else -> File(File(contexte.cacheDir, "maj"), "speedfood.apk").delete()
        }
    }
}
