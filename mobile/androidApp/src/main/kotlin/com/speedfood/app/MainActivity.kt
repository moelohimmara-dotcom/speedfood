package com.speedfood.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : FragmentActivity() {
    // Réponse du système à la demande d'autorisations : l'espace livreur relit l'autorisation à son prochain rafraîchissement (toutes les 5 s).
    private val demandeAutorisations = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    // Sélecteur de photos du système (aucune autorisation d'accès aux photos n'est demandée) : la photo choisie est rendue à PhotoAndroid.
    private val choixPhoto = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> SpeedfoodApp.photo.recu(uri) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        SpeedfoodApp.photo.lier { choixPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
        SpeedfoodApp.position.lier(this) {
            // Position, puis (Android 13 et plus) notifications : sans elles, la notification du suivi et les alertes de course ne s'affichent pas.
            val autorisations = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) autorisations += Manifest.permission.POST_NOTIFICATIONS
            demandeAutorisations.launch(autorisations.toTypedArray())
        }
        SpeedfoodApp.google.lier(this)
        SpeedfoodApp.verrou.lier(this)
        SpeedfoodApp.notifications.lier { if (Build.VERSION.SDK_INT >= 33) demandeAutorisations.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS)) }
        SpeedfoodApp.alerte.lier(this) {
            if (Build.VERSION.SDK_INT >= 33) demandeAutorisations.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
        }
        setContent {
            App(SpeedfoodApp.config)
        }
    }

    override fun onDestroy() {
        SpeedfoodApp.position.delier(this)
        SpeedfoodApp.alerte.delier(this)
        SpeedfoodApp.google.delier(this)
        SpeedfoodApp.photo.delier()
        super.onDestroy()
    }
}
