package com.speedfood.app.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.foundation.lazy.itemsIndexed
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
import com.speedfood.app.data.AccueilSections
import com.speedfood.app.data.FiltreRestaurants
import com.speedfood.app.data.cleCarteAccueil
import com.speedfood.app.data.construireAccueil
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
            // À la racine, l'en-tête de l'accueil (marque, question, zone) tient lieu de barre de titre.
            if (!racine) TopAppBar(
                title = { Text("Restaurants", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    if (!racine) IconButton(onClick = onRetour) { Icon(IconesApp.Retour, contentDescription = "Retour") }
                },
                actions = {
                    if (!racine) {
                        IconButton(onClick = onCompte) { Icon(IconesApp.Compte, contentDescription = "Mon compte et mes commandes") }
                        BoutonPanier(panier.nombreArticles, onPanier)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatListe.Chargement -> SquelettesCartes()
                is EtatListe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatListe.Pret -> if (e.restaurants.isEmpty()) {
                    MessageEtat("Aucun restaurant n'est publié pour l'instant. Revenez bientôt.", null, null)
                } else {
                    Column {
                        e.horsLigneDepuisMs?.let { age ->
                            Box(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                            BlocMessage("Hors ligne : liste enregistrée ${ancienneteLisible(age)}. Les commandes demandent une connexion.", erreur = false)
                            }
                        }
                        AccueilRestaurants(e.restaurants, onOuvrir, avecEntete = racine)
                    }
                }
            }
        }
    }
}

/** Icône du panier avec le nombre d'articles (rien si le panier est vide). */
@Composable
internal fun BoutonPanier(nombreArticles: Int, onPanier: () -> Unit) {
    IconButton(onClick = onPanier) {
        BadgedBox(badge = { if (nombreArticles > 0) Badge(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme, modifier = Modifier.rebond(nombreArticles)) { Text("$nombreArticles") } }) {
            Icon(IconesApp.Panier, contentDescription = if (nombreArticles > 0) "Mon panier, ${libelleArticles(nombreArticles)}" else "Mon panier")
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
        Illustration(genreIllustration(message, libelleBouton))
        Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        if (libelleBouton != null && action != null) {
            Button(onClick = action, colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme)) {
                Text(libelleBouton, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

/** Recherche (nom, quartier, catégorie, sans casse ni accents) et filtre, sur la liste déjà chargée. */
@Composable
internal fun RechercheEtListe(restaurants: List<Restaurant>, onOuvrir: (String) -> Unit, requeteInitiale: String = "", filtreInitial: FiltreRestaurants = FiltreRestaurants.Tous, avecSections: Boolean = false) {
    var requete by remember { mutableStateOf(requeteInitiale) }
    var filtre by remember { mutableStateOf(filtreInitial) }
    val visibles = filtrerRestaurants(restaurants, requete, filtre)

    Column(Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = requete,
            onValueChange = { requete = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
            singleLine = true,
            leadingIcon = { Icon(IconesApp.Recherche, contentDescription = null, tint = Couleurs.Encre) },
            placeholder = { Text("Un restaurant, un quartier, un plat…") },
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Couleurs.Surface,
                unfocusedContainerColor = Couleurs.Surface,
                focusedBorderColor = Couleurs.RougeFonce,
                unfocusedBorderColor = Couleurs.Encre,
                cursorColor = Couleurs.RougeFonce,
            ),
        )
        Row(Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FiltreRestaurants.entries.forEach { f ->
                FilterChip(
                    selected = filtre == f,
                    onClick = { filtre = f },
                    label = { Text(f.libelle, style = MaterialTheme.typography.labelMedium) },
                    colors = FilterChipDefaults.filterChipColors(containerColor = Couleurs.Surface, selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                    border = FilterChipDefaults.filterChipBorder(
                        enabled = true, selected = filtre == f,
                        borderColor = Couleurs.Encre, selectedBorderColor = Couleurs.Encre, borderWidth = 1.5.dp, selectedBorderWidth = 2.dp,
                    ),
                )
            }
        }
        if (visibles.isEmpty()) {
            MessageEtat("Aucun restaurant ne correspond à votre recherche.", null, null)
        } else {
            // Les sections n'apparaissent que sans recherche ni filtre, et quand la liste est assez longue pour qu'elles aident à choisir.
            val sections = if (avecSections && requete.isBlank() && filtre == FiltreRestaurants.Tous && visibles.size >= SEUIL_SECTIONS) construireAccueil(visibles, null) else null
            ListeRestaurants(visibles, onOuvrir, sections)
        }
    }
}

/** En dessous de ce nombre de restaurants, une liste simple vaut mieux que des sections qui répéteraient les mêmes cartes. */
private const val SEUIL_SECTIONS = 4

@Composable
internal fun ListeRestaurants(restaurants: List<Restaurant>, onOuvrir: (String) -> Unit = {}, sections: AccueilSections? = null) {
    LazyColumn(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        if (sections == null) {
            itemsIndexed(restaurants, key = { _, r -> r.id }) { i, r -> CarteRestaurant(r, onOuvrir, i) }
        } else {
            val ouverts = sections.ouverts
            val notes = sections.mieuxNotes.filter { it.noteMoyenne != null }.take(3)
            if (ouverts.isNotEmpty()) {
                item(key = "titre-ouverts") { TitreSection("Ouverts maintenant") }
                items(ouverts, key = { cleCarteAccueil("ouverts", it.id) }) { CarteRestaurant(it, onOuvrir) }
            }
            if (notes.isNotEmpty()) {
                item(key = "titre-notes") { TitreSection("Les mieux notés") }
                items(notes, key = { cleCarteAccueil("notes", it.id) }) { CarteRestaurant(it, onOuvrir) }
            }
            item(key = "titre-tous") { TitreSection("Tous les restaurants") }
            items(restaurants, key = { cleCarteAccueil("tous", it.id) }) { CarteRestaurant(it, onOuvrir) }
        }
    }
}

@Composable
private fun TitreSection(titre: String) {
    Text(titre, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 6.dp))
}

@Composable
private fun CarteRestaurant(restaurant: Restaurant, onOuvrir: (String) -> Unit, rang: Int = 99) {
    val etat = etatRestaurant(restaurant.ouvert, restaurant.accepteCommandes)
    val libelle = libelleEtat(etat)
    val age = restaurant.ageStatutMillis()
    CarteMarche(modifier = Modifier.fillMaxWidth().apparition(rang), surClic = { onOuvrir(restaurant.id) }) {
        Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Vignette(restaurant.logoUrl?.takeIf { it.isNotBlank() } ?: restaurant.photoUrl, restaurant.nom, categorie = restaurant.nomCategorie)
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
