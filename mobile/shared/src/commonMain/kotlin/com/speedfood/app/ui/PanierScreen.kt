package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.LignePanier
import com.speedfood.app.data.Panier
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PanierScreen(onRetour: () -> Unit, onCommander: () -> Unit, onVoirRestaurant: (String) -> Unit, racine: Boolean = false, service: PanierService = koinInject()) {
    val panier by service.panier.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Mon panier", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { if (!racine) IconButton(onClick = onRetour) { Icon(IconesApp.Retour, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
        bottomBar = {
            if (!panier.estVide) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total des plats", style = MaterialTheme.typography.titleMedium)
                        Text(formaterGnf(panier.sousTotal), style = MaterialTheme.typography.titleMedium)
                    }
                    BoutonPrincipal("Commander", surClic = onCommander)
                }
            }
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            if (panier.estVide) {
                MessageEtat("Votre panier est vide. Choisissez un restaurant et ajoutez des plats.", "Voir les restaurants", onRetour)
            } else {
                ContenuPanier(panier, service, onVoirRestaurant)
            }
        }
    }
}

@Composable
internal fun ContenuPanier(panier: Panier, service: PanierService?, onVoirRestaurant: (String) -> Unit) {
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item(key = "resto") {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Commande chez", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(panier.restaurantNom ?: "Restaurant", style = MaterialTheme.typography.titleLarge)
                panier.restaurantId?.let { id ->
                    OutlinedButton(onClick = { onVoirRestaurant(id) }, border = BorderStroke(1.dp, Couleurs.Bordure)) {
                        Text("Ajouter d'autres plats", style = MaterialTheme.typography.labelMedium, color = Couleurs.Encre)
                    }
                }
            }
        }
        items(panier.lignes, key = { it.cle }) { LigneDuPanier(it, service) }
    }
}

@Composable
private fun LigneDuPanier(ligne: LignePanier, service: PanierService?) {
    CarteMarche(modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(ligne.plat.nom, style = MaterialTheme.typography.titleMedium)
                if (ligne.options.isNotEmpty()) {
                    Text("+ " + ligne.options.joinToString(", ") { it.nom }, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text("${formaterGnf(ligne.prixUnitaire)} l'unité", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(formaterGnf(ligne.total), style = MaterialTheme.typography.labelLarge)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    BoutonQuantite("−", "Retirer un exemplaire de ${ligne.plat.nom}", plein = false) { service?.definirQuantite(ligne.cle, ligne.quantite - 1) }
                    Text("${ligne.quantite}", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(horizontal = 8.dp).rebond(ligne.quantite))
                    BoutonQuantite("+", "Ajouter un exemplaire de ${ligne.plat.nom}", plein = true) { service?.definirQuantite(ligne.cle, ligne.quantite + 1) }
                }
            }
        }
    }
}
