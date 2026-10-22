package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.FiltreRestaurants
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.filtrerRestaurants
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.EtatRestaurant
import com.speedfood.app.disponibilite.ancienneteLisible
import com.speedfood.app.disponibilite.estFraiche
import com.speedfood.app.disponibilite.etatRestaurant
import com.speedfood.app.disponibilite.libelleEtat
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantsScreen(
    onRetour: () -> Unit,
    onOuvrir: (String) -> Unit,
    onPanier: () -> Unit,
    onCompte: () -> Unit,
    racine: Boolean = false,
    viewModel: RestaurantsViewModel = koinViewModel(),
    panierService: PanierService = koinInject(),
) {
    val etat by viewModel.etat.collectAsState()
    val panier by panierService.panier.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Restaurants", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    if (!racine) IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") }
                },
                actions = {
                    if (!racine) {
                        IconButton(onClick = onCompte) { Icon(Icons.Default.Person, contentDescription = "Mon compte et mes commandes") }
                        BoutonPanier(panier.nombreArticles, onPanier)
                    }
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
                    RechercheEtListe(e.restaurants, onOuvrir)
                }
            }
        }
    }
}

/** Icône du panier avec le nombre d'articles (rien si le panier est vide). */
@Composable
internal fun BoutonPanier(nombreArticles: Int, onPanier: () -> Unit) {
    IconButton(onClick = onPanier) {
        BadgedBox(badge = { if (nombreArticles > 0) Badge(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme) { Text("$nombreArticles") } }) {
            Icon(Icons.Default.ShoppingCart, contentDescription = if (nombreArticles > 0) "Mon panier, $nombreArticles article(s)" else "Mon panier")
        }
    }
}

@Composable
internal fun MessageEtat(message: String, libelleBouton: String?, action: (() -> Unit)?) {
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

/** Recherche (nom, quartier, catégorie, sans casse ni accents) et filtre, sur la liste déjà chargée. */
@Composable
internal fun RechercheEtListe(restaurants: List<Restaurant>, onOuvrir: (String) -> Unit, requeteInitiale: String = "", filtreInitial: FiltreRestaurants = FiltreRestaurants.Tous) {
    var requete by remember { mutableStateOf(requeteInitiale) }
    var filtre by remember { mutableStateOf(filtreInitial) }
    val visibles = filtrerRestaurants(restaurants, requete, filtre)

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = requete,
            onValueChange = { requete = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            singleLine = true,
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            placeholder = { Text("Un restaurant, un quartier, un plat…") },
            shape = MaterialTheme.shapes.large,
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FiltreRestaurants.entries.forEach { f ->
                FilterChip(
                    selected = filtre == f,
                    onClick = { filtre = f },
                    label = { Text(f.libelle, style = MaterialTheme.typography.labelMedium) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                )
            }
        }
        if (visibles.isEmpty()) {
            MessageEtat("Aucun restaurant ne correspond à votre recherche.", null, null)
        } else {
            ListeRestaurants(visibles, onOuvrir)
        }
    }
}

@Composable
internal fun ListeRestaurants(restaurants: List<Restaurant>, onOuvrir: (String) -> Unit = {}) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(restaurants, key = { it.id }) { CarteRestaurant(it, onOuvrir) }
    }
}

@Composable
private fun CarteRestaurant(restaurant: Restaurant, onOuvrir: (String) -> Unit) {
    val etat = etatRestaurant(restaurant.ouvert, restaurant.accepteCommandes)
    val libelle = libelleEtat(etat)
    val age = restaurant.ageStatutMillis()
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onOuvrir(restaurant.id) },
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Vignette(restaurant.logoUrl?.takeIf { it.isNotBlank() } ?: restaurant.photoUrl, restaurant.nom)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(restaurant.nom, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val ligne = listOfNotNull(restaurant.nomQuartier, restaurant.nomCategorie, restaurant.horaires?.takeIf { it.isNotBlank() }).joinToString(" · ")
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
