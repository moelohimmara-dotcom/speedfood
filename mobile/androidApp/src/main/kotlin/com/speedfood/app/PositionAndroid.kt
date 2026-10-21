package com.speedfood.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.view.WindowManager
import com.speedfood.app.data.FournisseurPosition
import java.lang.ref.WeakReference

/**
 * Position du téléphone du livreur par le service de localisation du système (GPS et réseau), sans service Google en plus. Au premier plan, lue pendant que
 * l'application est ouverte ; en arrière-plan, par [SuiviLivreurService] (service au premier plan avec notification permanente). L'activité s'enregistre ici
 * pour ouvrir la demande d'autorisation et garder l'écran allumé.
 */
class PositionAndroid(private val contexte: Context) : FournisseurPosition {
    private val gestionnaire = contexte.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var activite: WeakReference<Activity>? = null
    private var demandeur: (() -> Unit)? = null
    private var ecouteur: LocationListener? = null

    /** Vrai tant que le service d'arrière-plan tourne : l'activité qui se ferme ne coupe alors pas la lecture. */
    @Volatile
    var serviceActif: Boolean = false

    /** Appelé par l'activité (création) : ouvre la demande d'autorisation et reçoit les drapeaux de fenêtre. */
    fun lier(activite: Activity, demandeur: () -> Unit) {
        this.activite = WeakReference(activite)
        this.demandeur = demandeur
    }

    fun delier(activite: Activity) {
        if (this.activite?.get() === activite) {
            this.activite = null
            this.demandeur = null
            if (!serviceActif) arreter()
        }
    }

    override val disponible: Boolean get() = gestionnaire.getProviders(true).isNotEmpty() || gestionnaire.allProviders.isNotEmpty()

    override fun autorisee(): Boolean = contexte.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    override fun demanderAutorisation() {
        demandeur?.invoke()
    }

    @SuppressLint("MissingPermission")
    override fun demarrer(surPosition: (Double, Double) -> Unit) {
        if (!autorisee() || ecouteur != null) return
        val ecoute = object : LocationListener {
            override fun onLocationChanged(position: Location) {
                surPosition(position.latitude, position.longitude)
            }

            @Deprecated("Ancienne méthode, sans effet")
            override fun onStatusChanged(fournisseur: String?, statut: Int, extras: Bundle?) = Unit
            override fun onProviderEnabled(fournisseur: String) = Unit
            override fun onProviderDisabled(fournisseur: String) = Unit
        }
        ecouteur = ecoute
        for (fournisseur in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            if (gestionnaire.isProviderEnabled(fournisseur)) {
                // Une mesure toutes les 5 secondes au plus, ou tous les 15 mètres : assez pour un suivi de course sans vider la batterie.
                gestionnaire.requestLocationUpdates(fournisseur, 5_000L, 15f, ecoute, Looper.getMainLooper())
                gestionnaire.getLastKnownLocation(fournisseur)?.let { surPosition(it.latitude, it.longitude) }
            }
        }
    }

    override fun arreter() {
        ecouteur?.let { gestionnaire.removeUpdates(it) }
        ecouteur = null
    }

    override fun garderEcranAllume(actif: Boolean) {
        val fenetre = activite?.get()?.window ?: return
        fenetre.decorView.post {
            if (actif) fenetre.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else fenetre.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    override val arrierePlanPossible: Boolean get() = true

    /** Démarre le service (sans effet s'il tourne déjà). Refusé par le système si l'application n'est plus visible : on ignore, le tour suivant réessaiera. */
    override fun demarrerArrierePlan() {
        if (serviceActif || !autorisee()) return
        try {
            val intention = Intent(contexte, SuiviLivreurService::class.java)
            if (Build.VERSION.SDK_INT >= 26) contexte.startForegroundService(intention) else contexte.startService(intention)
        } catch (_: Exception) {
            // Démarrage refusé (application passée en arrière-plan entre-temps) : sans conséquence, on réessaiera à l'ouverture suivante.
        }
    }

    override fun arreterArrierePlan() {
        contexte.stopService(Intent(contexte, SuiviLivreurService::class.java))
    }

    /** Appelé par le service quand il s'arrête : la lecture de position qu'il pilotait s'arrête avec lui. */
    fun finArrierePlan() {
        serviceActif = false
        arreter()
    }
}
