package com.speedfood.app

import android.Manifest
import android.os.Build
import android.os.Bundle
import android.content.Intent
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.speedfood.app.data.CHEMIN_RETOUR_FACEBOOK

class MainActivity : FragmentActivity() {
    // Réponse du système à la demande d'autorisations : l'espace livreur relit l'autorisation à son prochain rafraîchissement (toutes les 5 s).
    private val demandeAutorisations = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    // Sélecteur de photos du système (aucune autorisation d'accès aux photos n'est demandée) : la photo choisie est rendue à PhotoAndroid.
    private val choixPhoto = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> SpeedfoodApp.photo.recu(uri) }

    // Lien reçu (WhatsApp, navigateur) : le numéro change à chaque nouveau lien, même identique, pour que l'application l'ouvre à chaque fois.
    private var lien by mutableStateOf<String?>(null)
    private var numeroLien by mutableStateOf(0)

    private fun lienOuvrable(i: Intent?): String? = i?.dataString?.takeUnless { i.data?.path == CHEMIN_RETOUR_FACEBOOK }

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
        SpeedfoodApp.facebook.retour(intent?.data)
        lien = lienOuvrable(intent)
        setContent {
            App(SpeedfoodApp.config, lienInitial = lien, numeroLien = numeroLien)
        }
    }

    override fun onResume() {
        super.onResume()
        SpeedfoodApp.facebook.reprise()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        SpeedfoodApp.facebook.retour(intent.data)
        lienOuvrable(intent)?.let {
            lien = it
            numeroLien++
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
