package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.BrouillonCandidature
import com.speedfood.app.data.MOYENS_PAIEMENT_CANDIDATURE
import com.speedfood.app.data.NOMBRE_ETAPES_CANDIDATURE
import com.speedfood.app.data.SERVICES_CANDIDATURE
import com.speedfood.app.data.VueCandidature
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/**
 * « Inscrire mon restaurant » : formulaire de demande de référencement en 5 étapes (restaurant, cuisine et paiements, logo et photo, menu, relecture), puis suivi de la demande.
 * L'équipe Speedfood répond sous 48 h. Rien ne part avant « Envoyer ma demande » ; le brouillon est gardé si l'application est fermée.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CandidatureScreen(onRetour: () -> Unit, onConnexion: () -> Unit, onAide: () -> Unit, viewModel: CandidatureViewModel = koinViewModel()) {
    val ecran by viewModel.ecran.collectAsState()
    var choixQuartier by remember { mutableStateOf(false) }

    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(if (ecran.phase == PhaseCandidature.Suivi) "Ma demande" else "Inscrire mon restaurant", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = { if (ecran.phase == PhaseCandidature.Formulaire && ecran.brouillon.etape > 0) viewModel.precedente() else onRetour() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (ecran.phase) {
                PhaseCandidature.Chargement -> Box(Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Couleurs.RougeFonce) }
                PhaseCandidature.NonConnecte -> {
                    BlocMessage("Connectez-vous ou créez votre compte pour inscrire votre restaurant.", erreur = false)
                    BoutonPrincipal("Me connecter", surClic = onConnexion)
                }
                PhaseCandidature.Erreur -> {
                    BlocMessage(ecran.erreur ?: "Une erreur est survenue. Réessayez dans un instant.", erreur = true)
                    BoutonPrincipal("Réessayer", surClic = viewModel::charger)
                }
                PhaseCandidature.Suivi -> ecran.vue?.let { SuiviDemande(it, ecran.avertissement, onAide) }
                PhaseCandidature.Formulaire -> Formulaire(ecran, viewModel, surChoixQuartier = { choixQuartier = true })
            }
        }
    }

    if (choixQuartier) {
        ChoixQuartierDialogue(ecran.quartiers, surAnnuler = { choixQuartier = false }, surChoix = { id ->
            viewModel.choisirQuartier(id)
            choixQuartier = false
        })
    }
}

@Composable
private fun Formulaire(ecran: EcranCandidature, vm: CandidatureViewModel, surChoixQuartier: () -> Unit) {
    val b = ecran.brouillon
    Barre(b.etape)
    when (b.etape) {
        0 -> EtapeRestaurant(b, vm, surChoixQuartier)
        1 -> EtapeCuisine(b, vm)
        2 -> EtapeImages(ecran, vm)
        3 -> EtapeMenu(b, vm)
        else -> EtapeRelecture(ecran)
    }
    ecran.erreur?.let { BlocMessage(it, erreur = true) }
    if (b.etape == NOMBRE_ETAPES_CANDIDATURE - 1) {
        BoutonPrincipal(if (ecran.envoiEnCours) "Envoi en cours…" else "Envoyer ma demande", actif = !ecran.envoiEnCours, surClic = vm::envoyer)
    } else {
        BoutonPrincipal("Continuer", surClic = vm::suivante)
    }
}

@Composable
private fun Barre(etape: Int) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(NOMBRE_ETAPES_CANDIDATURE) { i ->
            Box(Modifier.weight(1f).height(5.dp).background(if (i <= etape) Couleurs.RougeFonce else Couleurs.Bordure, RoundedCornerShape(3.dp)))
        }
    }
    Text("Étape ${etape + 1} sur $NOMBRE_ETAPES_CANDIDATURE : ${TITRES[etape]}", style = MaterialTheme.typography.titleMedium, color = Couleurs.Encre)
}

private val TITRES = listOf("votre restaurant", "cuisine et paiement", "logo et photo", "votre menu", "relire et envoyer")

@Composable
private fun EtapeRestaurant(b: BrouillonCandidature, vm: CandidatureViewModel, surChoixQuartier: () -> Unit) {
    ChampTexte(b.nom, { v -> vm.changer { it.copy(nom = v) } }, "Nom du restaurant")
    OutlinedButton(onClick = surChoixQuartier, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Bordure)) {
        Text(if (b.quartierNom.isBlank()) "Choisir le quartier" else "Quartier : ${b.quartierNom}", color = Couleurs.Encre)
    }
    ChampTexte(b.indications, { v -> vm.changer { it.copy(indications = v) } }, "Adresse précise ou repère (facultatif)", aide = "Par exemple : face à la pharmacie, route du Niger")
    ChampTexte(b.telephone, { v -> vm.changer { it.copy(telephone = v) } }, "Téléphone pour les commandes", KeyboardType.Phone, aide = "Numéro guinéen, par exemple 622 12 34 56")
    ChampTexte(b.prenom, { v -> vm.changer { it.copy(prenom = v) } }, "Votre prénom")
    ChampTexte(b.nomResponsable, { v -> vm.changer { it.copy(nomResponsable = v) } }, "Votre nom")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EtapeCuisine(b: BrouillonCandidature, vm: CandidatureViewModel) {
    ChampTexte(b.categories, { v -> vm.changer { it.copy(categories = v) } }, "Type de cuisine (facultatif)", aide = "Par exemple : grillades, cuisine guinéenne, pizzas")
    ChampTexte(b.horaires, { v -> vm.changer { it.copy(horaires = v) } }, "Horaires", aide = "Par exemple : tous les jours, 9h à 22h")
    Text("Moyens de paiement acceptés", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
    Choix(MOYENS_PAIEMENT_CANDIDATURE, b.moyensPaiement) { valeur -> vm.changer { it.copy(moyensPaiement = vm.basculer(it.moyensPaiement, valeur)) } }
    Text("Services", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
    Choix(SERVICES_CANDIDATURE, b.services) { valeur -> vm.changer { it.copy(services = vm.basculer(it.services, valeur)) } }
}

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
private fun Choix(options: List<Pair<String, String>>, choisis: List<String>, surBascule: (String) -> Unit) {
    androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (valeur, libelle) ->
            FilterChip(
                selected = valeur in choisis,
                onClick = { surBascule(valeur) },
                label = { Text(libelle, style = MaterialTheme.typography.labelMedium) },
                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
            )
        }
    }
}

@Composable
private fun EtapeImages(ecran: EcranCandidature, vm: CandidatureViewModel) {
    Text("Facultatif : l'équipe peut les ajouter plus tard. Une photo choisie ici n'est jamais publique avant l'accord de l'équipe.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    LigneImage("Logo (carré)", ecran.aLogo, surChoix = { vm.choisirImage("logo") }, surRetrait = { vm.retirerImage("logo") })
    LigneImage("Photo du restaurant ou d'un plat", ecran.aPhoto, surChoix = { vm.choisirImage("photo") }, surRetrait = { vm.retirerImage("photo") })
    Text("Les images restent sur votre téléphone jusqu'à l'envoi. Si vous fermez l'application avant, il faudra les rechoisir.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun LigneImage(libelle: String, choisie: Boolean, surChoix: () -> Unit, surRetrait: () -> Unit) {
    Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, colors = CardDefaults.cardColors(containerColor = Couleurs.Surface), border = BorderStroke(1.dp, Couleurs.Bordure)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(if (choisie) "$libelle : choisie" else libelle, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
            if (choisie) TextButton(onClick = surRetrait) { Text("Retirer", color = Couleurs.Danger) } else TextButton(onClick = surChoix) { Text("Choisir", color = Couleurs.RougeFonce) }
        }
    }
}

@Composable
private fun EtapeMenu(b: BrouillonCandidature, vm: CandidatureViewModel) {
    var nom by remember { mutableStateOf("") }
    var prix by remember { mutableStateOf("") }
    Text("Ajoutez vos plats avec leur prix. L'équipe relit le menu avec vous avant de le mettre en ligne : rien n'est publié tel quel.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    ChampTexte(nom, { nom = it }, "Nom du plat")
    ChampTexte(prix, { prix = it }, "Prix en GNF", KeyboardType.Number, aide = "Par exemple : 25 000")
    OutlinedButton(onClick = { if (vm.ajouterPlat(nom, prix)) { nom = ""; prix = "" } }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(2.dp, Couleurs.Encre)) {
        Text("Ajouter ce plat", color = Couleurs.Encre)
    }
    b.plats.forEachIndexed { i, p ->
        Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, colors = CardDefaults.cardColors(containerColor = Couleurs.Surface), border = BorderStroke(1.dp, Couleurs.Bordure)) {
            Row(Modifier.padding(start = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).padding(vertical = 8.dp)) {
                    Text(p.nom, style = MaterialTheme.typography.bodyLarge)
                    Text(formaterGnf(p.prix), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                TextButton(onClick = { vm.retirerPlat(i) }) { Text("Retirer", color = Couleurs.Danger) }
            }
        }
    }
    if (b.plats.isEmpty()) Text("Vous pouvez aussi passer cette étape : l'équipe saisira votre menu avec vous.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun EtapeRelecture(ecran: EcranCandidature) {
    val b = ecran.brouillon
    Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.medium, colors = CardDefaults.cardColors(containerColor = Couleurs.Surface), border = BorderStroke(1.dp, Couleurs.Bordure)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(b.nom, style = MaterialTheme.typography.titleMedium)
            Text(listOfNotNull(b.quartierNom.ifBlank { null }, b.categories.ifBlank { null }).joinToString(" · "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(b.horaires, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(b.telephone, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val paiements = MOYENS_PAIEMENT_CANDIDATURE.filter { it.first in b.moyensPaiement }.joinToString(", ") { it.second }
            if (paiements.isNotBlank()) Text("Paiement : $paiements", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val resume = listOfNotNull(if (ecran.aLogo) "logo" else null, if (ecran.aPhoto) "1 photo" else null, if (b.plats.isNotEmpty()) "${b.plats.size} plat(s)" else null)
            if (resume.isNotEmpty()) Text(resume.joinToString(", "), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
    Text("L'équipe Speedfood vous répond sous 48 h par téléphone. Vous suivez l'avancement dans l'application.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun SuiviDemande(v: VueCandidature, avertissement: String?, onAide: () -> Unit) {
    Text(v.nom, style = MaterialTheme.typography.headlineSmall, color = Couleurs.Encre)
    avertissement?.let { BlocMessage(it, erreur = false) }
    val rang = when (v.etat) {
        "recue" -> 0
        "en_cours" -> 1
        else -> 2
    }
    Etape("Demande reçue", "Votre demande est enregistrée.", rang >= 0, rang == 0)
    Etape("En cours de traitement", "L'équipe vous appelle sous ${v.delaiHeures} h.", rang >= 1, rang == 1)
    val derniere = when (v.etat) {
        "acceptee" -> "Demande acceptée" to "L'équipe prépare la mise en ligne de votre restaurant."
        "creee" -> "Votre restaurant est en ligne" to "Vous pouvez gérer votre espace restaurateur."
        "refusee" -> "Demande refusée" to (v.motifRefus ?: "L'équipe vous a expliqué la raison par téléphone.")
        else -> "Acceptée ou refusée" to "Vous serez prévenu dès que l'équipe a décidé."
    }
    Etape(derniere.first, derniere.second, rang >= 2, rang == 2)
    OutlinedButton(onClick = onAide, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Bordure)) { Text("Contacter l'équipe", color = Couleurs.Encre) }
}

@Composable
private fun Etape(titre: String, texte: String, atteinte: Boolean, courante: Boolean) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Box(Modifier.padding(top = 4.dp).height(14.dp).background(if (courante) Couleurs.Mangue else if (atteinte) Couleurs.RougeFonce else Couleurs.Bordure, RoundedCornerShape(7.dp)).padding(horizontal = 7.dp))
        Column {
            Text(titre, style = MaterialTheme.typography.titleMedium, color = if (atteinte) Couleurs.Encre else MaterialTheme.colorScheme.onSurfaceVariant)
            Text(texte, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
