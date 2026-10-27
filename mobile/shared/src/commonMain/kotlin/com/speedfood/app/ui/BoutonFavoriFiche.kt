package com.speedfood.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import com.speedfood.app.design.Couleurs
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

/** Cœur de la fiche restaurant : plein (rouge) si le restaurant est dans les favoris du compte, vide (gris) sinon ; sans compte, un appui propose la connexion. */
@Composable
internal fun BoutonFavoriFiche(restaurantId: String, onConnexion: () -> Unit) {
    val viewModel: FavoriRestaurantViewModel = koinViewModel(key = "favori-$restaurantId", parameters = { parametersOf(restaurantId) })
    val favori by viewModel.favori.collectAsState()
    val portee = rememberCoroutineScope()
    val plein = favori == true
    IconButton(onClick = { portee.launch { if (!viewModel.basculer()) onConnexion() } }) {
        Icon(
            if (plein) IconesApp.Coeur else IconesApp.CoeurTrait,
            contentDescription = if (plein) "Retirer des favoris" else "Ajouter aux favoris",
            tint = if (plein) Couleurs.RougeFonce else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
