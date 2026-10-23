package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.RestaurantEquipe
import com.speedfood.app.data.aNumeroAJoindre
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleEtatPlat
import com.speedfood.app.data.numeroAppel
import com.speedfood.app.data.visibleParLesClients
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/**
 * Établissements (équipe) : la liste des restaurants, leur état de publication et leur menu ; on ouvre la fiche pour modifier les horaires et le
 * numéro à joindre. Publier, suspendre ou supprimer un établissement se fait sur le site : ici on montre l'état, pour décider.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurantsEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: RestaurantsEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    val fiche = (etat as? EtatRestaurantsEquipe.Pret)?.fiche
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(if (fiche == null) "Restaurants" else fiche.nom, style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = {
                    if (fiche != null) {
                        TextButton(onClick = viewModel::fermerFiche) { Text("Liste", color = Couleurs.Encre) }
                    } else {
                        TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatRestaurantsEquipe.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatRestaurantsEquipe.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatRestaurantsEquipe.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatRestaurantsEquipe.Pret -> if (e.fiche != null) {
                    ContenuFiche(e, siteUrl, viewModel::enregistrerProfil)
                } else {
                    ContenuListe(e, siteUrl, viewModel::ouvrirFiche)
                }
            }
        }
    }
}

@Composable
private fun ContenuListe(e: EtatRestaurantsEquipe.Pret, siteUrl: String, surOuverture: (String) -> Unit) {
    val ouvreur = LocalUriHandler.current
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text("${e.restaurants.size} établissement(s)", style = MaterialTheme.typography.titleMedium)
        Text(
            "La publication, la suspension et la suppression se font sur le site : elles rendent l'établissement visible par les clients ou sont irréversibles.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedButton(
            onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/catalogue/restaurants") },
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, Couleurs.Encre),
        ) { Text("Gérer la publication sur le site", color = Couleurs.Encre) }
        if (e.restaurants.isEmpty()) {
            Text("Aucun établissement. Ils apparaissent ici dès qu'une fiche est créée sur le site.", style = MaterialTheme.typography.bodyMedium)
        }
        e.restaurants.forEach { r -> CarteRestaurant(r, e.actionEnCours, surOuverture) }
    }
}

@Composable
private fun CarteRestaurant(r: RestaurantEquipe, occupe: Boolean, surOuverture: (String) -> Unit) {
    val visible = visibleParLesClients(r)
    Card(
        modifier = Modifier.fillMaxWidth().clickable { surOuverture(r.id) },
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(r.nom, style = MaterialTheme.typography.titleMedium)
            Text(
                listOf(r.categorie, r.quartier).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Sans catégorie" },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(etatPublication(r), style = MaterialTheme.typography.labelLarge, color = if (visible) Couleurs.Succes else Couleurs.Danger)
            Text("${r.platsDisponibles} plat(s) disponible(s) sur ${r.plats}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (r.suspendu || !r.publie) {
                Text("L'établissement n'est pas visible par les clients.", style = MaterialTheme.typography.bodySmall, color = Couleurs.Danger)
            }
            if (occupe) Text("Chargement de la fiche…", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun ContenuFiche(e: EtatRestaurantsEquipe.Pret, siteUrl: String, surEnregistrement: (String, String) -> Unit) {
    val r = e.fiche ?: return
    val ouvreur = LocalUriHandler.current
    var horaires by remember(r.id, r.horaires) { mutableStateOf(r.horaires) }
    var telephone by remember(r.id, r.telephoneCommandes) { mutableStateOf(r.telephoneCommandes ?: "") }
    var erreur by remember(r.id) { mutableStateOf<String?>(null) }
    val visible = visibleParLesClients(r)

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        erreur?.let { BlocMessage(it, erreur = true) }

        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
            border = BorderStroke(1.dp, Couleurs.Bordure),
        ) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(r.nom, style = MaterialTheme.typography.titleLarge)
                Text(
                    listOf(r.categorie, r.quartier).filter { it.isNotBlank() }.joinToString(" · ").ifBlank { "Sans catégorie" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(etatPublication(r), style = MaterialTheme.typography.labelLarge, color = if (visible) Couleurs.Succes else Couleurs.Danger)
                Text(
                    if (r.modeVente == "speedfood") "Catalogue tenu par Speedfood" else "Page tenue par le restaurateur",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (r.suspendu) Text("Établissement suspendu.", style = MaterialTheme.typography.bodySmall, color = Couleurs.Danger)
                r.motifCorrection?.takeIf { it.isNotBlank() }?.let {
                    Text("Correction demandée : $it", style = MaterialTheme.typography.bodySmall, color = Couleurs.AvertissementTexte)
                }
                OutlinedButton(
                    onClick = { ouvreur.openUri("${siteUrl.trimEnd('/')}/system/catalogue/restaurants") },
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.dp, Couleurs.Encre),
                ) { Text("Publication sur le site", color = Couleurs.Encre) }
            }
        }

        CarteSectionTitre("Horaires d'ouverture")
        Text(r.horaires.ifBlank { "Non renseignés." }, style = MaterialTheme.typography.bodyMedium)

        if (r.consignes.isNotBlank()) {
            CarteSectionTitre("Consignes")
            Text(r.consignes, style = MaterialTheme.typography.bodyMedium)
        }

        CarteSectionTitre("Numéro à joindre")
        if (aNumeroAJoindre(r)) {
            Text(r.telephoneCommandes ?: "", style = MaterialTheme.typography.bodyMedium)
            numeroAppel(r.telephoneCommandes)?.let { numero ->
                OutlinedButton(onClick = { ouvreur.openUri("tel:$numero") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                    Text("Appeler ${r.telephoneCommandes}", color = Couleurs.Encre)
                }
            }
        } else {
            Text("Aucun numéro interne renseigné.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        CarteSectionTitre("Menu (${r.platsDetail.size})")
        if (r.platsDetail.isEmpty()) {
            Text("Aucun plat à la carte.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        } else {
            r.platsDetail.forEach { p ->
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(p.nom, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Text(
                        "${formaterGnf(p.prix)} · ${libelleEtatPlat(p.etat)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = if (p.etat == "disponible") Couleurs.Succes else Couleurs.Danger,
                    )
                }
            }
        }

        CarteSectionTitre("Modifier les horaires et le numéro à joindre")
        Text(
            "Ces deux informations n'ont aucun effet sur ce que voient les clients. La publication reste sur le site.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        OutlinedTextField(
            value = horaires,
            onValueChange = { horaires = it.take(500); erreur = null },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Horaires d'ouverture") },
            supportingText = { Text("Obligatoire, 500 caractères maximum.") },
        )
        OutlinedTextField(
            value = telephone,
            onValueChange = { telephone = it.take(30); erreur = null },
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Numéro à joindre") },
            supportingText = { Text("Numéro interne, jamais public. Laissez vide pour le retirer.") },
        )
        OutlinedButton(
            onClick = { surEnregistrement(horaires, telephone) },
            enabled = !e.actionEnCours,
            modifier = Modifier.fillMaxWidth(),
            border = BorderStroke(1.dp, Couleurs.Encre),
        ) { Text(if (e.actionEnCours) "Enregistrement…" else "Enregistrer", color = Couleurs.Encre) }
    }
}

@Composable
private fun CarteSectionTitre(titre: String) {
    Text(titre, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 4.dp))
}

/** Phrase d'état de publication : la décision se prend sur le site, on montre seulement l'état réel. */
internal fun etatPublication(r: RestaurantEquipe): String = when {
    r.suspendu -> "Suspendu — invisible par les clients"
    r.publie -> "Publié — visible par les clients"
    else -> "Non publié — invisible par les clients"
}
