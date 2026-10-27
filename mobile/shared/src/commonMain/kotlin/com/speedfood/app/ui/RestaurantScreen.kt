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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.TextButton
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.EtatPlat
import com.speedfood.app.data.LIGNES_MAX_PANIER
import com.speedfood.app.data.Menu
import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.Plat
import com.speedfood.app.data.QUANTITE_MAX_LIGNE
import com.speedfood.app.data.ResultatAjout
import com.speedfood.app.data.RestaurantFiche
import com.speedfood.app.data.etatPlat
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.EtatRestaurant
import com.speedfood.app.disponibilite.Ton
import com.speedfood.app.disponibilite.ancienneteLisible
import com.speedfood.app.disponibilite.estFraiche
import com.speedfood.app.disponibilite.etatRestaurant
import com.speedfood.app.disponibilite.libelleEtat
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel
import org.koin.core.parameter.parametersOf

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantScreen(
    restaurantId: String,
    onRetour: () -> Unit,
    onPanier: () -> Unit,
    onConnexion: () -> Unit = {},
    viewModel: RestaurantViewModel = koinViewModel(parameters = { parametersOf(restaurantId) }),
    panierService: PanierService = koinInject(),
) {
    val etat by viewModel.etat.collectAsState()
    val panier by panierService.panier.collectAsState()
    var platEnChoix by remember { mutableStateOf<Plat?>(null) }
    var enAttenteRemplacement by remember { mutableStateOf<Pair<Plat, List<OptionPlat>>?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    val pret = etat as? EtatFiche.Pret

    fun ajouter(plat: Plat, options: List<OptionPlat>) {
        val fiche = pret?.fiche ?: return
        when (panierService.ajouter(fiche.id, fiche.nom, plat, options)) {
            ResultatAjout.Ajoute -> message = "« ${plat.nom} » ajouté au panier."
            ResultatAjout.AutreRestaurant -> enAttenteRemplacement = plat to options
            ResultatAjout.QuantiteMax -> message = "Vous ne pouvez pas commander plus de $QUANTITE_MAX_LIGNE fois le même plat."
            ResultatAjout.PanierPlein -> message = "Votre panier est plein ($LIGNES_MAX_PANIER plats différents au plus)."
        }
    }

    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (pret != null && panier.restaurantId == pret.fiche.id && !panier.estVide) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    message?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    BoutonPrincipal("Voir mon panier · ${libelleArticles(panier.nombreArticles)} · ${formaterGnf(panier.sousTotal)}", surClic = onPanier)
                }
            } else if (message != null) {
                Text(message ?: "", Modifier.padding(16.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        topBar = {
            TopAppBar(
                title = {
                    val titre = (etat as? EtatFiche.Pret)?.fiche?.nom ?: "Restaurant"
                    Text(titre, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                },
                navigationIcon = {
                    IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") }
                },
                actions = {
                    BoutonFavoriFiche(restaurantId, onConnexion)
                    BoutonPanier(panier.nombreArticles, onPanier)
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatFiche.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatFiche.Introuvable -> MessageEtat("Ce restaurant n'est plus disponible.", "Retour", onRetour)
                is EtatFiche.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatFiche.Pret -> {
                    val commandable = etatRestaurant(e.fiche.ouvert, e.fiche.accepteCommandes) == EtatRestaurant.Ouvert
                    ContenuRestaurant(
                        e.fiche,
                        e.menu,
                        surPlat = if (commandable) { plat -> if (plat.options.any { it.disponible }) platEnChoix = plat else ajouter(plat, emptyList()) } else null,
                        surAutresRestaurants = onRetour,
                    )
                }
            }
        }
    }

    platEnChoix?.let { plat ->
        ChoixOptionsDialogue(
            plat = plat,
            surAnnuler = { platEnChoix = null },
            surConfirmer = { options ->
                platEnChoix = null
                ajouter(plat, options)
            },
        )
    }

    enAttenteRemplacement?.let { (plat, options) ->
        AlertDialog(
            onDismissRequest = { enAttenteRemplacement = null },
            title = { Text("Changer de restaurant ?") },
            text = { Text("Votre panier contient des plats de ${panier.restaurantNom ?: "un autre restaurant"}. Une commande concerne un seul restaurant : voulez-vous vider le panier et commencer ici ?") },
            confirmButton = {
                TextButton(onClick = {
                    val fiche = pret?.fiche
                    enAttenteRemplacement = null
                    if (fiche != null) {
                        panierService.remplacerEtAjouter(fiche.id, fiche.nom, plat, options)
                        message = "« ${plat.nom} » ajouté au panier."
                    }
                }) { Text("Vider et ajouter", color = Couleurs.RougeFonce) }
            },
            dismissButton = { TextButton(onClick = { enAttenteRemplacement = null }) { Text("Garder mon panier", color = Couleurs.Encre) } },
        )
    }
}

/** Choix des suppléments d'un plat avant l'ajout au panier (les suppléments indisponibles ne sont pas proposés). */
@Composable
internal fun ChoixOptionsDialogue(plat: Plat, surAnnuler: () -> Unit, surConfirmer: (List<OptionPlat>) -> Unit) {
    val disponibles = plat.options.filter { it.disponible }
    var choisis by remember { mutableStateOf(setOf<String>()) }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text(plat.nom) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Suppléments (facultatifs)", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                disponibles.forEach { o ->
                    LigneACocher(o.id in choisis, { coche -> choisis = if (coche) choisis + o.id else choisis - o.id }, Modifier.fillMaxWidth()) {
                        Text(if (o.prix > 0) "${o.nom} (+${formaterGnf(o.prix)})" else o.nom, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        },
        confirmButton = {
            val supplement = disponibles.filter { it.id in choisis }.sumOf { it.prix }
            TextButton(onClick = { surConfirmer(disponibles.filter { it.id in choisis }) }) {
                Text("Ajouter · ${formaterGnf(plat.prixEffectif + supplement)}", color = Couleurs.RougeFonce)
            }
        },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Annuler", color = Couleurs.Encre) } },
    )
}

@Composable
internal fun ContenuRestaurant(fiche: RestaurantFiche, menu: Menu, surPlat: ((Plat) -> Unit)? = null, surAutresRestaurants: (() -> Unit)? = null) {
    val groupes = menu.groupes()
    LazyColumn(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(key = "entete") { EnteteRestaurant(fiche) }
        if (groupes.isEmpty()) {
            item(key = "vide") {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Le menu de ce restaurant n'est pas encore disponible. Revenez bientôt, ou choisissez un autre restaurant.", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    surAutresRestaurants?.let { OutlinedButton(onClick = it, border = BorderStroke(2.dp, Couleurs.Encre)) { Text("Voir d'autres restaurants", color = Couleurs.Encre) } }
                }
            }
        }
        groupes.forEach { (titre, plats) ->
            item(key = "section-$titre") { Text(titre, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp)) }
            items(plats, key = { it.id }) { CartePlat(it, surPlat) }
        }
    }
}

@Composable
private fun EnteteRestaurant(fiche: RestaurantFiche) {
    val etat = etatRestaurant(fiche.ouvert, fiche.accepteCommandes)
    val libelle = libelleEtat(etat)
    val age = fiche.ageStatutMillis()
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.Top) {
            Vignette(fiche.logoUrl?.takeIf { it.isNotBlank() } ?: fiche.photoUrl, fiche.nom, taille = 84.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(fiche.nom, style = MaterialTheme.typography.titleLarge)
                fiche.nomQuartier?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Pastille(libelle.texte, libelle.ton)
                    fiche.noteMoyenne?.let { Text("★ $it (${fiche.avisTotal})", style = MaterialTheme.typography.labelMedium) }
                }
                val statut = when {
                    etat == com.speedfood.app.disponibilite.EtatRestaurant.Ferme -> null
                    age == null -> "Statut à confirmer"
                    estFraiche(age) -> "Statut confirmé ${ancienneteLisible(age)}"
                    else -> "Statut à confirmer (dernière confirmation ${ancienneteLisible(age)})"
                }
                statut?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                fiche.horaires?.takeIf { it.isNotBlank() }?.let { Text("Horaires : $it", style = MaterialTheme.typography.bodyMedium) }
                fiche.consignes?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                if (fiche.moyensPaiement.isNotEmpty()) {
                    Text("Paiement accepté : ${fiche.moyensPaiement.joinToString(", ")}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun CartePlat(plat: Plat, surPlat: ((Plat) -> Unit)?) {
    val etat = etatPlat(plat, plat.ageConfirmationMillis())
    val age = plat.ageConfirmationMillis()
    val (texteEtat, ton) = when (etat) {
        EtatPlat.Disponible -> "Disponible" to Ton.Succes
        EtatPlat.AConfirmer -> "À confirmer" to Ton.Neutre
        EtatPlat.Epuise -> "Épuisé" to Ton.Neutre
    }
    val detailEtat = when (etat) {
        EtatPlat.Disponible -> age?.let { "confirmé ${ancienneteLisible(it)}" }
        EtatPlat.AConfirmer -> age?.let { "dernière confirmation ${ancienneteLisible(it)}" } ?: "pas encore confirmé"
        EtatPlat.Epuise -> null
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Vignette(plat.photoUrl, plat.nom, taille = 64.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(plat.nom, style = MaterialTheme.typography.titleMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (plat.description.isNotBlank()) {
                    Text(plat.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(formaterGnf(plat.prixEffectif), style = MaterialTheme.typography.labelLarge, color = if (plat.enPromo) Couleurs.RougeFonce else Couleurs.Encre)
                    if (plat.enPromo) {
                        Text(formaterGnf(plat.prix), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textDecoration = TextDecoration.LineThrough)
                    }
                }
                val options = plat.options.filter { it.disponible }
                if (options.isNotEmpty()) {
                    Text(
                        "En supplément : " + options.joinToString(", ") { if (it.prix > 0) "${it.nom} (+${formaterGnf(it.prix)})" else it.nom },
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Pastille(texteEtat, ton)
                    detailEtat?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                }
                if (surPlat != null && etat != EtatPlat.Epuise) {
                    OutlinedButton(onClick = { surPlat(plat) }, border = BorderStroke(2.dp, Couleurs.Encre)) {
                        Text("Ajouter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                    }
                }
            }
        }
    }
}
