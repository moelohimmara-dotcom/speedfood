package com.speedfood.app.ui

import com.speedfood.app.data.dateLisible
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.ChoixCreation
import com.speedfood.app.data.DemandeReferencement
import com.speedfood.app.data.DossierCandidatureEquipe
import com.speedfood.app.data.MOYENS_PAIEMENT_CANDIDATURE
import com.speedfood.app.data.OptionsCreation
import com.speedfood.app.data.SERVICES_CANDIDATURE
import com.speedfood.app.data.peutCreerEtablissement
import com.speedfood.app.data.quartiersCorrespondants
import com.speedfood.app.data.StatutDemande
import com.speedfood.app.data.aRappeler
import com.speedfood.app.data.libelleStatutDemande
import com.speedfood.app.data.libelleTypeEtablissement
import com.speedfood.app.data.numeroAppel
import com.speedfood.app.data.statutsProposes
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Demandes de référencement (équipe) : qui veut rejoindre Speedfood, à rappeler en premier ; on appelle et on change le statut ici ; créer la fiche se fait sur le site. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReferencementsEquipeScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: ReferencementsEquipeViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Référencements", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                actions = { TextButton(onClick = viewModel::charger) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatReferencements.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatReferencements.NonConnecte -> MessageEtat("Connectez-vous avec votre compte de l'équipe.", "Me connecter", onConnexion)
                is EtatReferencements.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatReferencements.Pret -> ContenuReferencements(e, siteUrl, viewModel::changerStatut, viewModel::creerEtablissement, viewModel::rattacherCompte, viewModel::chargerOptions)
            }
        }
    }
}

@Composable
internal fun ContenuReferencements(
    e: EtatReferencements.Pret,
    siteUrl: String,
    surStatut: (String, StatutDemande, String?) -> Unit,
    surCreer: (String, String, String) -> Unit = { _, _, _ -> },
    surRattacher: (String) -> Unit = {},
    surOptions: () -> Unit = {},
) {
    val ouvreur = LocalUriHandler.current
    val nouvelles = e.demandes.count { aRappeler(it) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        Text(
            if (nouvelles == 0) "Aucune demande à rappeler." else if (nouvelles == 1) "1 demande à rappeler sous 48 heures." else "$nouvelles demandes à rappeler sous 48 heures.",
            style = MaterialTheme.typography.titleMedium,
            color = if (nouvelles == 0) Couleurs.Succes else Couleurs.Danger,
        )
        Text(
            "Les coordonnées sont des données personnelles : elles ne servent qu'à rappeler la personne. Vous pouvez tout traiter ici : rappeler, refuser avec un motif, créer l'établissement, rattacher le compte du candidat. Seule la suppression d'une demande se fait sur le site.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (e.demandes.isEmpty()) Text("Aucune demande pour l'instant. Quand un établissement remplit la page « Demander à être référencé » ou dépose sa candidature dans l'application, elle apparaît ici.", style = MaterialTheme.typography.bodyMedium)
        // Les demandes à rappeler d'abord, puis les plus récentes.
        e.demandes.sortedWith(compareByDescending<DemandeReferencement> { aRappeler(it) }.thenByDescending { it.creeLe }).forEach { d ->
            CarteDemande(d, e.actionEnCours, e.options, ouvreur::openUri, surStatut, surCreer, surRattacher, surOptions)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CarteDemande(
    d: DemandeReferencement,
    occupe: Boolean,
    options: OptionsCreation?,
    ouvrir: (String) -> Unit,
    surStatut: (String, StatutDemande, String?) -> Unit,
    surCreer: (String, String, String) -> Unit,
    surRattacher: (String) -> Unit,
    surOptions: () -> Unit,
) {
    var refus by remember(d.id) { mutableStateOf(false) }
    var creation by remember(d.id) { mutableStateOf(false) }
    val alerte = aRappeler(d)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (alerte) Couleurs.AvertissementFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (alerte) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(d.organisation, style = MaterialTheme.typography.titleMedium)
            Text(
                libelleTypeEtablissement(d.type) + " · " + listOf(d.quartier, d.commune).filter { it.isNotBlank() }.joinToString(", "),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            listOfNotNull(d.categories, d.specialites).filter { it.isNotBlank() }.takeIf { it.isNotEmpty() }?.let { Text(it.joinToString(" · "), style = MaterialTheme.typography.bodySmall) }
            d.indications?.takeIf { it.isNotBlank() }?.let { Text("Indications : $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Text("Responsable : ${d.responsable}", style = MaterialTheme.typography.bodyMedium)
            d.candidature?.let { DossierDepose(it) }
            Text("${libelleStatutDemande(d.statut)} · reçue : ${dateLisible(d.creeLe)}", style = MaterialTheme.typography.labelLarge, color = if (alerte) Couleurs.Danger else Couleurs.Encre)
            numeroAppel(d.telephone)?.let { numero ->
                OutlinedButton(onClick = { ouvrir("tel:$numero") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) { Text("Appeler ${d.telephone}", color = Couleurs.Encre) }
            }
            val propositions = statutsProposes(d)
            if (propositions.isNotEmpty()) {
                Text("Passer à :", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    propositions.forEach { s ->
                        AssistChip(
                            onClick = { if (s == StatutDemande.Refusee) refus = true else surStatut(d.id, s, null) },
                            enabled = !occupe,
                            label = { Text(s.libelle) },
                        )
                    }
                }
            }
            if (peutCreerEtablissement(d)) {
                OutlinedButton(
                    onClick = { surOptions(); creation = true },
                    enabled = !occupe,
                    modifier = Modifier.fillMaxWidth(),
                    border = BorderStroke(1.5.dp, Couleurs.RougeFonce),
                ) { Text("Créer l'établissement", color = Couleurs.RougeFonce) }
            }
            if (d.etablissementCree) {
                Text("Établissement créé : la demande ne change plus. Il n'est pas publié tant que vous ne l'avez pas vérifié sur le site.", style = MaterialTheme.typography.bodySmall, color = Couleurs.Succes)
            }
            if (d.candidature?.compteRattachable == true) {
                Text("Le candidat a un compte Speedfood. En le rattachant, il voit son espace restaurateur dans l'application.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                OutlinedButton(onClick = { surRattacher(d.id) }, enabled = !occupe, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.5.dp, Couleurs.RougeFonce)) {
                    Text("Rattacher le compte du candidat", color = Couleurs.RougeFonce)
                }
            } else if (d.candidature?.compteRattache == true) {
                Text("Compte du candidat rattaché : il gère déjà son restaurant.", style = MaterialTheme.typography.bodySmall, color = Couleurs.Succes)
            }
        }
    }
    if (refus) DialogueRefus(d.organisation, surAnnuler = { refus = false }) { motif -> refus = false; surStatut(d.id, StatutDemande.Refusee, motif) }
    if (creation) DialogueCreation(d.organisation, options, surAnnuler = { creation = false }) { categorie, quartier -> creation = false; surCreer(d.id, categorie, quartier) }
}

/** Ce que le candidat a rempli dans l'application : horaires, paiements, services, nombre de plats lus, images, et le motif s'il a été refusé. */
@Composable
private fun DossierDepose(c: DossierCandidatureEquipe) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("Dossier déposé dans l'application", style = MaterialTheme.typography.labelLarge, color = Couleurs.RougeFonce)
        c.horaires?.takeIf { it.isNotBlank() }?.let { Text("Horaires : $it", style = MaterialTheme.typography.bodySmall) }
        val paiements = c.moyensPaiement.mapNotNull { code -> MOYENS_PAIEMENT_CANDIDATURE.firstOrNull { it.first == code }?.second }
        if (paiements.isNotEmpty()) Text("Paiements : ${paiements.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
        val services = c.services.mapNotNull { code -> SERVICES_CANDIDATURE.firstOrNull { it.first == code }?.second }
        if (services.isNotEmpty()) Text("Services : ${services.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
        Text(
            (if (c.nombrePlats == 0) "Aucun plat" else if (c.nombrePlats == 1) "1 plat à reprendre" else "${c.nombrePlats} plats à reprendre") +
                (if (c.avecLogo) " · logo" else "") + (if (c.avecPhoto) " · photo" else ""),
            style = MaterialTheme.typography.bodySmall,
        )
        c.motifRefus?.takeIf { it.isNotBlank() }?.let { Text("Motif du refus : $it", style = MaterialTheme.typography.bodySmall, color = Couleurs.Danger) }
    }
}

/** Refus : le motif (facultatif, 300 caractères) est montré au candidat dans l'application. */
@Composable
private fun DialogueRefus(organisation: String, surAnnuler: () -> Unit, surConfirmer: (String) -> Unit) {
    var motif by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Refuser la demande de $organisation ?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Le candidat est prévenu et lit le motif dans l'application. Vous pourrez remettre la demande dans un autre statut.")
                ChampTexte(motif, { if (it.length <= 300) motif = it }, "Motif (facultatif)")
            }
        },
        confirmButton = { TextButton(onClick = { surConfirmer(motif) }) { Text("Refuser", color = Couleurs.Danger) } },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Retour", color = Couleurs.Encre) } },
    )
}

/** Création de l'établissement : la catégorie (une puce parmi la liste officielle) et le quartier (recherche puis choix), exactement comme sur le site. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DialogueCreation(organisation: String, options: OptionsCreation?, surAnnuler: () -> Unit, surConfirmer: (String, String) -> Unit) {
    var categorie by remember { mutableStateOf<ChoixCreation?>(null) }
    var quartier by remember { mutableStateOf<ChoixCreation?>(null) }
    var recherche by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Créer l'établissement « $organisation »") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Il est créé non publié : vous le vérifiez et le publiez ensuite sur le site.", style = MaterialTheme.typography.bodySmall)
                if (options == null) {
                    CircularProgressIndicator(color = Couleurs.RougeFonce)
                } else {
                    Text("Catégorie", style = MaterialTheme.typography.labelLarge)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        options.categories.forEach { c ->
                            FilterChip(
                                selected = categorie?.id == c.id,
                                onClick = { categorie = c },
                                label = { Text(c.nom) },
                                colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                            )
                        }
                    }
                    Text("Quartier", style = MaterialTheme.typography.labelLarge)
                    quartier?.let { q ->
                        Text("Choisi : ${q.nom} (${q.commune})", style = MaterialTheme.typography.bodyMedium, color = Couleurs.Succes)
                    }
                    ChampTexte(recherche, { recherche = it }, "Chercher un quartier ou une commune")
                    quartiersCorrespondants(options.quartiers, recherche).forEach { q ->
                        Row(Modifier.fillMaxWidth().clickable { quartier = q; recherche = "" }.padding(vertical = 10.dp)) {
                            Text("${q.nom} · ${q.commune}", style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { surConfirmer(categorie!!.id, quartier!!.id) }, enabled = categorie != null && quartier != null) { Text("Créer", color = Couleurs.RougeFonce) }
        },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Retour", color = Couleurs.Encre) } },
    )
}
