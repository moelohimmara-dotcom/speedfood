package com.speedfood.app

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : ComponentActivity() {
    // Réponse du système à la demande d'autorisation de position : l'espace livreur relit l'autorisation à son prochain rafraîchissement (toutes les 5 s).
    private val demandePosition = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        SpeedfoodApp.position.lier(this) { demandePosition.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
        setContent {
            App(SpeedfoodApp.config)
        }
    }

    override fun onDestroy() {
        SpeedfoodApp.position.delier(this)
        super.onDestroy()
    }
}
