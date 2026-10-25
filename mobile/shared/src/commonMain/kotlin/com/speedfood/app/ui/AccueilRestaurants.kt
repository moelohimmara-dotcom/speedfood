package com.speedfood.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.CLE_ZONE_ACCUEIL
import com.speedfood.app.data.Restaurant
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.TOUTES_ZONES
import com.speedfood.app.data.ZoneLivraison
import com.speedfood.app.data.nombreParZone
import com.speedfood.app.data.restaurantsDansZone
import com.speedfood.app.data.zoneEffective
import com.speedfood.app.data.zonesDisponibles
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject

/**
 * Accueil des restaurants avec choix de zone en un geste : une pastille « Zone : Kipé · Changer » au-dessus de la recherche ouvre la liste des zones (celles où il y a des
 * restaurants, avec leur nombre) et « Toutes les zones ». Aucune position n'est demandée. Le choix est mémorisé ; avec une seule zone, rien n'est affiché.
 */
@Composable
internal fun AccueilRestaurants(restaurants: List<Restaurant>, onOuvrir: (String) -> Unit, stockage: StockageLocal = koinInject()) {
    val zones = remember(restaurants) { zonesDisponibles(restaurants) }
    var choix by remember { mutableStateOf(stockage.lire(CLE_ZONE_ACCUEIL)) }
    var ouvert by remember { mutableStateOf(false) }
    val zone = zoneEffective(zones, choix)
    val visibles = restaurantsDansZone(restaurants, zone)

    Column {
        if (zones.size >= 2) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                AssistChip(onClick = { ouvert = true }, label = { Text("Zone : ${zone?.nom ?: "toutes"} · Changer") })
            }
        }
        RechercheEtListe(visibles, onOuvrir, avecSections = true)
    }
    if (ouvert) {
        ChoixZone(
            zones = zones,
            nombres = nombreParZone(restaurants, zones),
            total = restaurants.size,
            courante = zone,
            surChoix = { id ->
                choix = id
                stockage.ecrire(CLE_ZONE_ACCUEIL, id)
                ouvert = false
            },
            surFermer = { ouvert = false },
        )
    }
}

@Composable
private fun ChoixZone(zones: List<ZoneLivraison>, nombres: Map<String, Int>, total: Int, courante: ZoneLivraison?, surChoix: (String) -> Unit, surFermer: () -> Unit) {
    AlertDialog(
        onDismissRequest = surFermer,
        title = { Text("Où voulez-vous commander ?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                LigneZone("Toutes les zones", total, courante == null) { surChoix(TOUTES_ZONES) }
                zones.forEach { z -> LigneZone(z.nom, nombres[z.id] ?: 0, courante?.id == z.id) { surChoix(z.id) } }
                Text("Aucune position n'est demandée : vous choisissez la zone vous-même.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
            }
        },
        confirmButton = { TextButton(onClick = surFermer) { Text("Fermer", color = Couleurs.Encre) } },
    )
}

@Composable
private fun LigneZone(nom: String, nombre: Int, choisie: Boolean, surClic: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = surClic).padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        RadioButton(selected = choisie, onClick = surClic)
        Text("$nom ($nombre)", style = MaterialTheme.typography.bodyLarge)
    }
}
