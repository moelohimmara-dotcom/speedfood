package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.EstimationLivraison
import com.speedfood.app.data.Panier
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.QuartierChoix
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.normaliser
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/**
 * Validation de la commande : retrait au restaurant ou livraison (quartier + adresse, frais calculés par le serveur). Aucun paiement dans l'application : le
 * règlement se fait directement avec le restaurant, qui confirme la commande ; la personne le reconnaît avant d'envoyer, comme sur le site.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CommandeScreen(
    onRetour: () -> Unit,
    onConnexion: () -> Unit,
    onEnvoyee: (String) -> Unit,
    viewModel: CommandeViewModel = koinViewModel(),
    panierService: PanierService = koinInject(),
    sessionService: SessionService = koinInject(),
) {
    val etat by viewModel.etat.collectAsState()
    val quartiers by viewModel.quartiers.collectAsState()
    val adresses by viewModel.adresses.collectAsState()
    val panier by panierService.panier.collectAsState()
    val session by sessionService.session.collectAsState()

    LaunchedEffect(etat.envoyee) { etat.envoyee?.let(onEnvoyee) }

    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Ma commande", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        if (panier.estVide) {
            Column(Modifier.fillMaxSize().padding(marges)) { MessageEtat("Votre panier est vide.", "Retour", onRetour) }
        } else {
            FormulaireCommande(
                modifier = Modifier.padding(marges),
                panier = panier,
                connecte = session != null,
                etat = etat,
                quartiers = quartiers,
                adressesEnregistrees = adresses,
                onConnexion = onConnexion,
                onMode = viewModel::choisirMode,
                onQuartier = viewModel::choisirQuartier,
                onEnvoyer = viewModel::envoyer,
            )
        }
    }
}

@Composable
internal fun FormulaireCommande(
    modifier: Modifier,
    panier: Panier,
    connecte: Boolean,
    etat: EtatCommande,
    quartiers: List<QuartierChoix>,
    onConnexion: () -> Unit,
    onMode: (Boolean) -> Unit,
    onQuartier: (String) -> Unit,
    onEnvoyer: (String, String, String, Boolean) -> Unit,
    adressesEnregistrees: List<com.speedfood.app.data.AdresseClient> = emptyList(),
) {
    // rememberSaveable : le brouillon survit à l'aller-retour vers l'écran de connexion (et à une rotation).
    var nom by rememberSaveable { mutableStateOf("") }
    var telephone by rememberSaveable { mutableStateOf("") }
    var adresse by rememberSaveable { mutableStateOf("") }
    var choixQuartier by remember { mutableStateOf(false) }
    var consentement by rememberSaveable { mutableStateOf(false) }

    Column(modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
            border = BorderStroke(1.dp, Couleurs.Bordure),
        ) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(panier.restaurantNom ?: "Restaurant", style = MaterialTheme.typography.titleMedium)
                panier.lignes.forEach { l ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${l.quantite} × ${l.plat.nom}" + if (l.options.isNotEmpty()) " (+ ${l.options.joinToString(", ") { it.nom }})" else "", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        Text(formaterGnf(l.total), style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total des plats", style = MaterialTheme.typography.titleMedium)
                    Text(formaterGnf(panier.sousTotal), style = MaterialTheme.typography.titleMedium)
                }
                val estimationOk = etat.estimation as? EstimationLivraison.Ok
                if (etat.livraison && estimationOk != null) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Livraison", style = MaterialTheme.typography.bodyMedium)
                        Text(if (estimationOk.gratuite) "Offerte" else formaterGnf(estimationOk.fraisGnf), style = MaterialTheme.typography.bodyMedium)
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Total à régler", style = MaterialTheme.typography.titleMedium)
                        Text(formaterGnf(panier.sousTotal + etat.fraisLivraison), style = MaterialTheme.typography.titleMedium)
                    }
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(false to "Retrait au restaurant", true to "Livraison").forEach { (livraison, texte) ->
                FilterChip(
                    selected = etat.livraison == livraison,
                    onClick = { onMode(livraison) },
                    label = { Text(texte, style = MaterialTheme.typography.labelMedium) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                )
            }
        }

        run {
            if (!connecte) {
                BlocMessage("Remplissez votre commande : un compte est demandé au moment de l'envoyer (il protège les restaurants des fausses commandes). Vos informations sont conservées.", erreur = false)
            }
            ChampTexte(nom, { nom = it }, "Votre nom")
            ChampTexte(telephone, { telephone = it }, "Votre téléphone", KeyboardType.Phone, aide = "Le restaurant vous appelle à ce numéro si besoin")
            if (etat.livraison) {
                val quartierNom = quartiers.firstOrNull { it.id == etat.quartierId }?.nom
                OutlinedButton(onClick = { choixQuartier = true }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Bordure)) {
                    Text(quartierNom?.let { "Quartier : $it" } ?: "Choisir mon quartier", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
                // Carnet d'adresses du compte : un appui remplit le champ (modifiable) ; l'adresse par défaut est proposée d'office si rien n'est saisi.
                LaunchedEffect(adressesEnregistrees) {
                    if (adresse.isBlank()) adressesEnregistrees.firstOrNull { it.parDefaut }?.let { adresse = it.adresse }
                }
                if (adressesEnregistrees.isNotEmpty()) {
                    @OptIn(ExperimentalLayoutApi::class)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        adressesEnregistrees.forEach { a ->
                            FilterChip(selected = adresse == a.adresse, onClick = { adresse = a.adresse }, label = { Text(a.libelle.ifBlank { "Adresse" }) })
                        }
                    }
                }
                ChampTexte(adresse, { adresse = it }, "Adresse de livraison", aide = "Rue, repère connu, bâtiment, étage")
                val estimation = etat.estimation
                when {
                    etat.estimationEnCours -> Text("Calcul de la livraison…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    estimation is EstimationLivraison.Ok -> Text(
                        (if (estimation.gratuite) "Livraison offerte" else "Livraison ${formaterGnf(estimation.fraisGnf)}") +
                            " · environ ${estimation.dureeMinutes} min · ${estimation.libelle}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    estimation is EstimationLivraison.NonCalculee -> Text(
                        "Les frais de livraison se conviennent avec le restaurant.",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    estimation is EstimationLivraison.Erreur -> BlocMessage(estimation.message, erreur = true)
                }
            }
            LigneACocher(consentement, { consentement = it }, Modifier.fillMaxWidth()) {
                Text(
                    "Je comprends que je règle directement le restaurant (Speedfood n'encaisse rien dans l'application) et que ma commande n'est ferme qu'une fois confirmée par le restaurant.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            etat.info?.let { BlocMessage(it, erreur = false) }
            etat.erreur?.let { BlocMessage(it, erreur = true) }
            BoutonPrincipal(
                texte = when {
                    etat.enCours -> "Envoi en cours…"
                    !connecte -> "Me connecter pour envoyer · ${formaterGnf(panier.sousTotal + etat.fraisLivraison)}"
                    else -> "Envoyer ma commande · ${formaterGnf(panier.sousTotal + etat.fraisLivraison)}"
                },
                actif = !etat.enCours,
            ) { if (connecte) onEnvoyer(nom, telephone, adresse, consentement) else { com.speedfood.app.data.BrouillonContact.garder(nom, telephone); onConnexion() } }
        }
    }

    if (choixQuartier) {
        ChoixQuartierDialogue(quartiers, surAnnuler = { choixQuartier = false }, surChoix = { choixQuartier = false; onQuartier(it) })
    }
}

/** Liste des quartiers avec recherche (sans casse ni accents). */
@Composable
internal fun ChoixQuartierDialogue(quartiers: List<QuartierChoix>, surAnnuler: () -> Unit, surChoix: (String) -> Unit) {
    var requete by remember { mutableStateOf("") }
    val visibles = quartiers.filter { normaliser(it.nom).contains(normaliser(requete.trim())) }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Votre quartier") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChampTexte(requete, { requete = it }, "Rechercher")
                when {
                    quartiers.isEmpty() -> Text("Chargement des quartiers…", style = MaterialTheme.typography.bodyMedium)
                    visibles.isEmpty() -> Text("Aucun quartier ne correspond.", style = MaterialTheme.typography.bodyMedium)
                    else -> LazyColumn(Modifier.heightIn(max = 320.dp)) {
                        items(visibles, key = { it.id }) { q ->
                            Text(q.nom, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.fillMaxWidth().clickable { surChoix(q.id) }.padding(vertical = 12.dp))
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = surAnnuler) { Text("Fermer", color = Couleurs.Encre) } },
    )
}
