package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.AlertDialog
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
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.EtatPlat
import com.speedfood.app.data.MenuGere
import com.speedfood.app.data.PlatGere
import com.speedfood.app.data.SectionGeree
import com.speedfood.app.data.etatPlat
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.verifierPlatSaisie
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import com.speedfood.app.disponibilite.ancienneteLisible
import org.koin.compose.viewmodel.koinViewModel

/** Menu du restaurateur : disponibilité des plats (en vente, épuisé, reconfirmer), prix, plats, suppléments. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuRestaurateurScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: MenuRestaurateurViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Mon menu", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatMenuGere.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatMenuGere.NonConnecte -> MessageEtat("Connectez-vous avec le compte de votre restaurant.", "Me connecter", onConnexion)
                is EtatMenuGere.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatMenuGere.Pret -> ContenuMenuGere(
                    e,
                    surDisponibilite = viewModel::definirDisponibilite,
                    surConfirmer = viewModel::confirmer,
                    surToutConfirmer = viewModel::toutConfirmer,
                    surArchiver = viewModel::archiver,
                    surCreer = viewModel::creer,
                    surModifier = viewModel::modifier,
                    surAjoutOption = viewModel::ajouterOption,
                    surRetraitOption = viewModel::retirerOption,
                )
            }
        }
    }
}

@Composable
internal fun ContenuMenuGere(
    e: EtatMenuGere.Pret,
    surDisponibilite: (String, Boolean) -> Unit,
    surConfirmer: (String) -> Unit,
    surToutConfirmer: () -> Unit,
    surArchiver: (String) -> Unit,
    surCreer: (String, String, Int, Int?, String?) -> Unit,
    surModifier: (String, String, String, Int, Int?, String?) -> Unit,
    surAjoutOption: (String, String, Int) -> Unit,
    surRetraitOption: (String) -> Unit,
) {
    var creation by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Un plat sans confirmation récente s'affiche « à confirmer » chez les clients. Confirmez vos plats en début de service ; retirez ceux qui sont épuisés.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        e.message?.let { BlocMessage(it, erreur = false) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = surToutConfirmer, enabled = !e.actionEnCours, border = BorderStroke(2.dp, Couleurs.Encre)) {
                Text("Tout confirmer", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
            OutlinedButton(onClick = { creation = true }, enabled = !e.actionEnCours, border = BorderStroke(2.dp, Couleurs.Encre)) {
                Text("Ajouter un plat", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
        }
        if (e.menu.plats.isEmpty()) Text("Votre menu est vide : ajoutez votre premier plat.", style = MaterialTheme.typography.bodyLarge)
        e.menu.groupes().forEach { (titre, plats) ->
            Text(titre, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            plats.forEach { CartePlatGere(it, e.menu, e.actionEnCours, surDisponibilite, surConfirmer, surArchiver, surModifier, surAjoutOption, surRetraitOption) }
        }
    }
    if (creation) {
        DialoguePlat(null, e.menu.sections, surAnnuler = { creation = false }) { nom, description, prix, promo, section ->
            creation = false
            surCreer(nom, description, prix, promo, section)
        }
    }
}

@Composable
internal fun CartePlatGere(
    plat: PlatGere,
    menu: MenuGere,
    occupe: Boolean,
    surDisponibilite: (String, Boolean) -> Unit,
    surConfirmer: (String) -> Unit,
    surArchiver: (String) -> Unit,
    surModifier: (String, String, String, Int, Int?, String?) -> Unit,
    surAjoutOption: (String, String, Int) -> Unit,
    surRetraitOption: (String) -> Unit,
) {
    var edition by remember { mutableStateOf(false) }
    var archivage by remember { mutableStateOf(false) }
    var ajoutOption by remember { mutableStateOf(false) }
    val vue = plat.commeMenuClient()
    val age = vue.ageConfirmationMillis()
    val etat = etatPlat(vue, age)
    val (texteEtat, ton) = when (etat) {
        EtatPlat.Disponible -> "En vente · confirmé" to Ton.Succes
        EtatPlat.AConfirmer -> "À confirmer" to Ton.Neutre
        EtatPlat.Epuise -> "Épuisé" to Ton.Danger
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(plat.nom, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                Switch(
                    checked = plat.disponible,
                    onCheckedChange = { surDisponibilite(plat.id, it) },
                    enabled = !occupe,
                    colors = SwitchDefaults.colors(checkedTrackColor = Couleurs.Succes, checkedThumbColor = Couleurs.Surface),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(formaterGnf(vue.prixEffectif), style = MaterialTheme.typography.labelLarge, color = if (vue.enPromo) Couleurs.RougeFonce else Couleurs.Encre)
                if (vue.enPromo) Text(formaterGnf(plat.prix), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textDecoration = TextDecoration.LineThrough)
            }
            if (plat.description.isNotBlank()) Text(plat.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Pastille(texteEtat, ton)
                val detail = when (etat) {
                    EtatPlat.Disponible -> age?.let { "confirmé ${ancienneteLisible(it)}" }
                    EtatPlat.AConfirmer -> age?.let { "dernière confirmation ${ancienneteLisible(it)}" } ?: "jamais confirmé"
                    EtatPlat.Epuise -> null
                }
                detail?.let { Text(it, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            plat.options.forEach { o ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("+ ${o.nom}" + if (o.prix > 0) " (${formaterGnf(o.prix)})" else "", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    TextButton(onClick = { surRetraitOption(o.id) }, enabled = !occupe) { Text("Retirer", color = Couleurs.Danger) }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (plat.disponible && etat == EtatPlat.AConfirmer) {
                    TextButton(onClick = { surConfirmer(plat.id) }, enabled = !occupe) { Text("Confirmer", color = Couleurs.RougeFonce) }
                }
                TextButton(onClick = { edition = true }, enabled = !occupe) { Text("Modifier", color = Couleurs.Encre) }
                TextButton(onClick = { ajoutOption = true }, enabled = !occupe) { Text("+ Supplément", color = Couleurs.Encre) }
            }
            // Sur sa propre ligne : quatre boutons de front ne tiennent pas sur un téléphone étroit.
            TextButton(onClick = { archivage = true }, enabled = !occupe) { Text("Archiver ce plat", color = Couleurs.Danger) }
        }
    }
    if (edition) {
        DialoguePlat(plat, menu.sections, surAnnuler = { edition = false }) { nom, description, prix, promo, section ->
            edition = false
            surModifier(plat.id, nom, description, prix, promo, section)
        }
    }
    if (archivage) {
        AlertDialog(
            onDismissRequest = { archivage = false },
            title = { Text("Archiver « ${plat.nom} » ?") },
            text = { Text("Le plat disparaît du menu et des nouvelles commandes. Les commandes déjà passées le gardent.") },
            confirmButton = { TextButton(onClick = { archivage = false; surArchiver(plat.id) }) { Text("Archiver", color = Couleurs.Danger) } },
            dismissButton = { TextButton(onClick = { archivage = false }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
    if (ajoutOption) {
        DialogueSupplement(surAnnuler = { ajoutOption = false }) { nom, prix ->
            ajoutOption = false
            surAjoutOption(plat.id, nom, prix)
        }
    }
}

/** Création ou modification d'un plat : nom, description, prix, prix promo facultatif, section. Les photos se gèrent sur le site. */
@Composable
private fun DialoguePlat(plat: PlatGere?, sections: List<SectionGeree>, surAnnuler: () -> Unit, surEnvoi: (String, String, Int, Int?, String?) -> Unit) {
    var nom by remember { mutableStateOf(plat?.nom ?: "") }
    var description by remember { mutableStateOf(plat?.description ?: "") }
    var prix by remember { mutableStateOf(plat?.prix?.toString() ?: "") }
    var promo by remember { mutableStateOf(plat?.prixPromo?.toString() ?: "") }
    var section by remember { mutableStateOf(plat?.sectionId) }
    var erreur by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text(if (plat == null) "Ajouter un plat" else "Modifier le plat") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChampTexte(nom, { nom = it.take(120) }, "Nom du plat")
                ChampTexte(description, { description = it.take(500) }, "Description (facultatif)")
                ChampTexte(prix, { prix = it.filter(Char::isDigit) }, "Prix (GNF)", KeyboardType.Number)
                ChampTexte(promo, { promo = it.filter(Char::isDigit) }, "Prix promo (GNF, facultatif)", KeyboardType.Number, aide = "Jamais au-dessus du prix normal")
                if (sections.isNotEmpty()) {
                    Text("Section", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        FilterChip(
                            selected = section == null,
                            onClick = { section = null },
                            label = { Text("Aucune", style = MaterialTheme.typography.labelMedium) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                        )
                        sections.forEach { s ->
                            FilterChip(
                                selected = section == s.id,
                                onClick = { section = s.id },
                                label = { Text(s.nom, style = MaterialTheme.typography.labelMedium) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                            )
                        }
                    }
                }
                erreur?.let { BlocMessage(it, erreur = true) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val probleme = verifierPlatSaisie(nom, description, prix, promo)
                if (probleme != null) erreur = probleme else surEnvoi(nom, description, prix.trim().toInt(), promo.trim().toIntOrNull(), section)
            }) { Text("Enregistrer", color = Couleurs.RougeFonce) }
        },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Annuler", color = Couleurs.Encre) } },
    )
}

@Composable
private fun DialogueSupplement(surAnnuler: () -> Unit, surEnvoi: (String, Int) -> Unit) {
    var nom by remember { mutableStateOf("") }
    var prix by remember { mutableStateOf("0") }
    var erreur by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Ajouter un supplément") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChampTexte(nom, { nom = it.take(80) }, "Nom (par exemple Piment)")
                ChampTexte(prix, { prix = it.filter(Char::isDigit) }, "Prix (GNF, 0 si gratuit)", KeyboardType.Number)
                erreur?.let { BlocMessage(it, erreur = true) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val p = prix.trim().toIntOrNull()
                if (nom.isBlank()) erreur = "Indiquez le nom du supplément." else if (p == null) erreur = "Indiquez le prix en GNF." else surEnvoi(nom, p)
            }) { Text("Ajouter", color = Couleurs.RougeFonce) }
        },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Annuler", color = Couleurs.Encre) } },
    )
}
