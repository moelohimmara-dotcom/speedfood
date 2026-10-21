package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.Panier
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/**
 * Validation de la commande : retrait au restaurant (la livraison dans l'application arrive dans un lot suivant). Aucun paiement dans l'application : le
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
                onConnexion = onConnexion,
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
    onConnexion: () -> Unit,
    onEnvoyer: (String, String, Boolean) -> Unit,
) {
    var nom by remember { mutableStateOf("") }
    var telephone by remember { mutableStateOf("") }
    var consentement by remember { mutableStateOf(false) }

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
                Text("Retrait au restaurant · la livraison dans l'application arrive bientôt.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        if (!connecte) {
            BlocMessage("Connectez-vous (ou créez un compte) pour envoyer votre commande.", erreur = false)
            BoutonPrincipal("Me connecter", surClic = onConnexion)
        } else {
            ChampTexte(nom, { nom = it }, "Votre nom")
            ChampTexte(telephone, { telephone = it }, "Votre téléphone", KeyboardType.Phone, aide = "Le restaurant vous appelle à ce numéro si besoin")
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Checkbox(
                    checked = consentement,
                    onCheckedChange = { consentement = it },
                    colors = CheckboxDefaults.colors(checkedColor = Couleurs.RougeFonce),
                )
                Text(
                    "Je comprends que je règle directement le restaurant (Speedfood n'encaisse rien dans l'application) et que ma commande n'est ferme qu'une fois confirmée par le restaurant.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 12.dp),
                )
            }
            etat.info?.let { BlocMessage(it, erreur = false) }
            etat.erreur?.let { BlocMessage(it, erreur = true) }
            BoutonPrincipal(
                texte = if (etat.enCours) "Envoi en cours…" else "Envoyer ma commande · ${formaterGnf(panier.sousTotal)}",
                actif = !etat.enCours,
            ) { onEnvoyer(nom, telephone, consentement) }
        }
    }
}
