package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.speedfood.app.data.Restaurant
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.EtatRestaurant
import com.speedfood.app.disponibilite.Ton
import com.speedfood.app.disponibilite.ancienneteLisible
import com.speedfood.app.disponibilite.estFraiche
import com.speedfood.app.disponibilite.etatRestaurant
import com.speedfood.app.disponibilite.libelleEtat
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantsScreen(onRetour: () -> Unit, viewModel: RestaurantsViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Restaurants", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatListe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                is EtatListe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatListe.Pret -> if (e.restaurants.isEmpty()) {
                    MessageEtat("Aucun restaurant n'est publié pour l'instant. Revenez bientôt.", null, null)
                } else {
                    ListeRestaurants(e.restaurants)
                }
            }
        }
    }
}

@Composable
private fun MessageEtat(message: String, libelleBouton: String?, action: (() -> Unit)?) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (libelleBouton != null && action != null) {
            Button(onClick = action, colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme)) {
                Text(libelleBouton, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

@Composable
internal fun ListeRestaurants(restaurants: List<Restaurant>) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(restaurants, key = { it.id }) { CarteRestaurant(it) }
    }
}

@Composable
private fun CarteRestaurant(restaurant: Restaurant) {
    val etat = etatRestaurant(restaurant.ouvert, restaurant.accepteCommandes)
    val libelle = libelleEtat(etat)
    val age = restaurant.ageStatutMillis()
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Vignette(restaurant)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(restaurant.nom, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val ligne = listOfNotNull(restaurant.nomQuartier, restaurant.horaires?.takeIf { it.isNotBlank() }).joinToString(" · ")
                if (ligne.isNotEmpty()) {
                    Text(ligne, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Pastille(libelle.texte, libelle.ton)
                    restaurant.noteMoyenne?.let { Text("★ $it (${restaurant.avisTotal})", style = MaterialTheme.typography.labelMedium) }
                }
                // Règle de produit : un état annoncé sans confirmation récente se lit « à confirmer », jamais comme une garantie.
                if (etat != EtatRestaurant.Ferme) {
                    val detail = when {
                        age == null -> "Statut à confirmer"
                        estFraiche(age) -> "Statut confirmé ${ancienneteLisible(age)}"
                        else -> "Statut à confirmer (dernière confirmation ${ancienneteLisible(age)})"
                    }
                    Text(detail, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun Vignette(restaurant: Restaurant) {
    val forme = RoundedCornerShape(14.dp)
    val image = restaurant.logoUrl?.takeIf { it.isNotBlank() } ?: restaurant.photoUrl?.takeIf { it.isNotBlank() }
    Box(Modifier.size(72.dp).clip(forme).background(Couleurs.Creme), contentAlignment = Alignment.Center) {
        if (image != null) {
            AsyncImage(model = image, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            Text(restaurant.nom.take(1).uppercase(), style = MaterialTheme.typography.headlineMedium, color = Couleurs.RougeFonce)
        }
    }
}

@Composable
private fun Pastille(texte: String, ton: Ton) {
    val (fond, encre) = when (ton) {
        Ton.Succes -> Couleurs.SuccesFond to Couleurs.Succes
        Ton.Danger -> Couleurs.DangerFond to Couleurs.Danger
        Ton.Neutre -> Couleurs.AvertissementFond to Couleurs.AvertissementTexte
    }
    Box(Modifier.clip(CircleShape).background(fond).padding(horizontal = 10.dp, vertical = 3.dp)) {
        Text(texte, style = MaterialTheme.typography.labelMedium, color = encre)
    }
}
