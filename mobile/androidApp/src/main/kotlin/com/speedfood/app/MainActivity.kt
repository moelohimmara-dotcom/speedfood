package com.speedfood.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : ComponentActivity() {
    // Réponse du système à la demande d'autorisations : l'espace livreur relit l'autorisation à son prochain rafraîchissement (toutes les 5 s).
    private val demandeAutorisations = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        SpeedfoodApp.position.lier(this) {
            // Position, puis (Android 13 et plus) notifications : sans elles, la notification du suivi et les alertes de course ne s'affichent pas.
            val autorisations = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) autorisations += Manifest.permission.POST_NOTIFICATIONS
            demandeAutorisations.launch(autorisations.toTypedArray())
        }
        SpeedfoodApp.alerte.lier(this)
        setContent {
            App(SpeedfoodApp.config)
        }
    }

    override fun onDestroy() {
        SpeedfoodApp.position.delier(this)
        SpeedfoodApp.alerte.delier(this)
        super.onDestroy()
    }
}
