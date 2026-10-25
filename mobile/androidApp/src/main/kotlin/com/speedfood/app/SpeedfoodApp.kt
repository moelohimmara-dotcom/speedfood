package com.speedfood.app

import android.app.Application
import android.content.Context
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.di.initKoin
import com.speedfood.app.di.lancerEnregistrementPush
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Stockage dans les préférences privées de l'application (illisibles par les autres applications). */
private class StockagePreferences(contexte: Context) : StockageLocal {
    private val prefs = contexte.getSharedPreferences("speedfood", Context.MODE_PRIVATE)
    override fun lire(cle: String): String? = prefs.getString(cle, null)
    override fun ecrire(cle: String, valeur: String) {
        prefs.edit().putString(cle, valeur).apply()
    }
    override fun effacer(cle: String) {
        prefs.edit().remove(cle).apply()
    }
}

class SpeedfoodApp : Application() {
    override fun onCreate() {
        super.onCreate()
        config = SpeedfoodConfig(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
            siteUrl = BuildConfig.SITE_URL,
        )
        position = PositionAndroid(this)
        alerte = AlerteAndroid(this)
        creerCanauxNotification(this)
        google = GoogleAndroid(BuildConfig.GOOGLE_WEB_CLIENT_ID)
        facebook = FacebookAndroid(this)
        photo = PhotoAndroid(this)
        notifications = NotificationsAndroid(this)
        verrou = VerrouAndroid(this)
        initKoin(config, StockagePreferences(this), position, alerte, JetonFirebase(this), "android", BuildConfig.VERSION_NAME, google, BuildConfig.VERSION_CODE, NotificateurMiseAJourAndroid(this), photo, InstallateurApkAndroid(this), notifications, verrou, facebook)
        // Lie l'appareil au compte connecté pour les notifications poussées (dès le démarrage si une session existe, puis à chaque connexion).
        lancerEnregistrementPush(CoroutineScope(SupervisorJob() + Dispatchers.IO))
    }

    companion object {
        lateinit var config: SpeedfoodConfig
            private set
        lateinit var position: PositionAndroid
            private set
        lateinit var alerte: AlerteAndroid
            private set
        lateinit var google: GoogleAndroid
            private set
        lateinit var facebook: FacebookAndroid
            private set
        lateinit var photo: PhotoAndroid
            private set
        lateinit var notifications: NotificationsAndroid
            private set
        lateinit var verrou: VerrouAndroid
            private set
    }
}
