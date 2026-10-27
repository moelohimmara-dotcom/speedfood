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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.CourseLivreur
import com.speedfood.app.data.OffreLivreur
import com.speedfood.app.data.cleCourseFile
import com.speedfood.app.data.courseEnCours
import com.speedfood.app.data.coursesSuivantes
import com.speedfood.app.data.etapeSuivante
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.libelleStatutLivreur
import com.speedfood.app.data.peutDeclarerEchec
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import kotlinx.coroutines.delay
import org.koin.compose.viewmodel.koinViewModel
import kotlin.time.Clock

/**
 * Espace livreur, onglet « Courses » : la file se lit de haut en bas — la course en cours d'abord, puis celles qui viennent.
 * L'écran montre aussi l'état du dossier d'activation (jamais le document : seulement ce qui manque) et l'accès à l'assistance.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LivreurScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: LivreurViewModel = koinViewModel(), aide: LivreurAideViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    val whatsapp by aide.whatsapp.collectAsState()
    var assistance by remember { mutableStateOf(false) }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Espace livreur", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatEspaceLivreur.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatEspaceLivreur.NonConnecte -> MessageEtat("Connectez-vous avec le compte livreur que l'équipe Speedfood vous a ouvert.", "Me connecter", onConnexion)
                EtatEspaceLivreur.PasLivreur -> MessageEtat(
                    "Ce compte n'est pas un compte livreur. Les comptes livreurs sont créés par l'équipe Speedfood : contactez-la si vous souhaitez livrer.",
                    "Changer de compte",
                    onConnexion,
                )
                is EtatEspaceLivreur.Erreur -> MessageEtat(e.message, "Retour", onRetour)
                is EtatEspaceLivreur.Pret -> {
                    var maintenant by remember { mutableStateOf(Clock.System.now().toEpochMilliseconds()) }
                    LaunchedEffect(e.etat.offre?.offreId) {
                        while (true) {
                            maintenant = Clock.System.now().toEpochMilliseconds()
                            delay(1_000)
                        }
                    }
                    ContenuLivreur(
                        e,
                        maintenant,
                        surBascule = viewModel::basculer,
                        surOffre = viewModel::repondreOffre,
                        surEtape = viewModel::avancer,
                        surDemandePosition = viewModel::demanderPosition,
                        surChoixArrierePlan = viewModel::choisirSuiviArrierePlan,
                        surPosteFixe = viewModel::definirPosteFixe,
                        onAssistance = { assistance = true },
                    )
                }
            }
        }
    }
    if (assistance) {
        DialogueAssistanceLivreur(
            whatsapp = whatsapp,
            courseEnCours = (etat as? EtatEspaceLivreur.Pret)?.etat?.course?.commandeReference,
            onFermer = { assistance = false },
        )
    }
}

@Composable
internal fun ContenuLivreur(
    e: EtatEspaceLivreur.Pret,
    maintenantMillis: Long,
    surBascule: (Boolean) -> Unit,
    surOffre: (String, Boolean) -> Unit,
    surEtape: (String, String?, String?) -> Unit,
    surDemandePosition: () -> Unit,
    surChoixArrierePlan: (Boolean) -> Unit = {},
    surPosteFixe: (Boolean) -> Unit = {},
    onAssistance: () -> Unit = {},
) {
    var consentement by remember { mutableStateOf(false) }
    val fiche = e.etat.livreur
    // La course en cours vient de l'état, de la file en repli : les deux disent la même chose.
    val enCours = courseEnCours(e.etat, e.file)
    val suivantes = coursesSuivantes(e.etat, e.file)
    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "entete") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(fiche.nom, style = MaterialTheme.typography.headlineMedium)
                val detail = listOfNotNull(fiche.vehicule.takeIf { it.isNotBlank() }, fiche.restaurantNom?.let { "Livreur de $it" } ?: "Groupe Speedfood").joinToString(" · ")
                Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        if (fiche.cycle != "actif") {
            item(key = "cycle") {
                when (fiche.cycle) {
                    "candidat" -> BlocMessage("Votre fiche est en cours d'examen par l'équipe Speedfood. Vous pourrez recevoir des courses dès qu'elle sera approuvée.", erreur = false)
                    "suspendu" -> BlocMessage("Votre fiche est suspendue." + (fiche.motifCycle?.let { " Motif : $it" } ?: "") + " Contactez l'équipe Speedfood.", erreur = true)
                    else -> BlocMessage("Votre fiche n'est plus active. Contactez l'équipe Speedfood.", erreur = true)
                }
            }
            return@LazyColumn
        }

        item(key = "statut") {
            val statut = when (fiche.statut) {
                "disponible" -> libelleStatutLivreur(fiche.statut) to Ton.Succes
                "en_course" -> libelleStatutLivreur(fiche.statut) to Ton.Succes
                else -> libelleStatutLivreur(fiche.statut) to Ton.Neutre
            }
            Pastille(statut.first, statut.second)
        }

        e.message?.let { message -> item(key = "message") { BlocMessage(message, erreur = false) } }

        // Ce qui demande une action immédiate (une offre à accepter, la course en cours) passe avant les rappels de dossier et de position : un livreur en route n'a pas à les chercher.
        e.etat.offre?.let { offre -> item(key = "offre") { CarteOffre(offre, maintenantMillis, e.actionEnCours, surOffre) } }
        enCours?.let { course -> item(key = "course") { CarteCourse(course, e.actionEnCours, surEtape) } }

        e.dossier?.takeIf { it.manquantes.isNotEmpty() }?.let { dossier ->
            item(key = "dossier") {
                BlocMessage(
                    dossier.resume() + " Déposez la pièce sur le site Speedfood : l'équipe Speedfood la vérifie, vous n'avez rien à envoyer ici.",
                    erreur = false,
                )
            }
        }

        if (e.positionDisponible && !e.positionAutorisee) {
            item(key = "position") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    BlocMessage("Autorisez la position de votre téléphone : sans elle, Speedfood ne peut pas vous proposer les courses proches de vous.", erreur = false)
                    BoutonPrincipal("Autoriser la position", surClic = surDemandePosition)
                }
            }
        } else if (!e.positionDisponible) {
            item(key = "position-absente") {
                Text("La position n'est pas disponible sur cet appareil.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else if (fiche.statut != "hors_ligne" && !e.etat.positionConnue) {
            item(key = "position-attente") {
                Text("Position en cours de recherche…", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        if (fiche.statut != "en_course") {
            item(key = "en-ligne") {
                if (fiche.statut == "hors_ligne") {
                    BoutonPrincipal("Me mettre en ligne", actif = !e.actionEnCours) {
                        // Première mise en ligne : on explique le suivi application fermée et on demande le choix, une seule fois.
                        if (e.arrierePlanPossible && e.suiviArrierePlan == null && e.positionAutorisee) consentement = true else surBascule(true)
                    }
                } else {
                    OutlinedButton(onClick = { surBascule(false) }, enabled = !e.actionEnCours, modifier = Modifier.fillMaxWidth(), border = BorderStroke(2.dp, Couleurs.Encre)) {
                        Text("Me mettre hors ligne", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                    }
                }
            }
        }

        if (e.arrierePlanPossible && e.suiviArrierePlan != null) {
            item(key = "arriere-plan") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (e.suiviArrierePlan) "Suivi application fermée : activé" else "Suivi application fermée : désactivé",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = { surChoixArrierePlan(!e.suiviArrierePlan) }) { Text(if (e.suiviArrierePlan) "Désactiver" else "Activer", color = Couleurs.Encre) }
                }
            }
        }

        item(key = "poste-fixe") {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Mode poste fixe", style = MaterialTheme.typography.titleSmall)
                    Text("L'écran reste allumé pendant la livraison.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Switch(checked = e.posteFixe, onCheckedChange = surPosteFixe)
            }
        }

        if (suivantes.isNotEmpty()) {
            item(key = "file-titre") {
                Text("Courses à venir", style = MaterialTheme.typography.titleLarge)
            }
            items(suivantes.size, key = { index -> cleCourseFile(suivantes[index].livraisonId, index) }) { index ->
                LigneCourseFile(suivantes[index])
            }
        }

        item(key = "aide") {
            OutlinedButton(onClick = onAssistance, modifier = Modifier.fillMaxWidth(), border = BorderStroke(2.dp, Couleurs.Encre)) {
                Text("Assistance conducteur", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
        }
    }
    if (consentement) {
        AlertDialog(
            onDismissRequest = { consentement = false },
            title = { Text("Recevoir vos courses écran éteint ?") },
            text = {
                Text(
                    "Pour vous proposer des courses même quand l'écran est éteint ou l'application fermée, Speedfood suit votre position tant que vous êtes en ligne. " +
                        "Une notification reste affichée pendant ce suivi. Votre position ne sert qu'à vous proposer des courses et à suivre votre livraison ; " +
                        "le suivi s'arrête dès que vous vous mettez hors ligne. Vous pouvez changer d'avis à tout moment.",
                )
            },
            confirmButton = {
                TextButton(onClick = { consentement = false; surChoixArrierePlan(true); surBascule(true) }) { Text("Autoriser le suivi", color = Couleurs.RougeFonce) }
            },
            dismissButton = {
                TextButton(onClick = { consentement = false; surChoixArrierePlan(false); surBascule(true) }) { Text("Seulement application ouverte", color = Couleurs.Encre) }
            },
        )
    }
}

/** Une course de la file : l'ordre, le restaurant, le quartier et le gain. */
@Composable
private fun LigneCourseFile(course: CourseLivreur) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(course.commandeReference.ifBlank { "Course" }, style = MaterialTheme.typography.titleMedium)
            Text(course.restaurantNom, style = MaterialTheme.typography.bodyLarge)
            val details = listOfNotNull(
                course.quartier.takeIf { it.isNotBlank() },
                course.heurePrevue?.takeIf { it.isNotBlank() }?.let { "vers $it" },
            )
            if (details.isNotEmpty()) Text(details.joinToString(" · "), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Gain : ${formaterGnf(course.fraisGnf)}", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun CarteOffre(offre: OffreLivreur, maintenantMillis: Long, occupe: Boolean, surOffre: (String, Boolean) -> Unit) {
    val reste = offre.secondesRestantes(maintenantMillis)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.AvertissementFond),
        border = BorderStroke(1.dp, Couleurs.Mangue),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Nouvelle course", style = MaterialTheme.typography.titleLarge, color = Couleurs.AvertissementTexte)
            Text(offre.restaurantNom, style = MaterialTheme.typography.titleMedium)
            Text("Gain : ${formaterGnf(offre.fraisGnf)}", style = MaterialTheme.typography.titleMedium)
            val details = listOfNotNull(
                offre.distanceCourseKm?.let { "Course de $it km" },
                offre.distanceRestaurantKm?.let { "Restaurant à $it km de vous" },
            )
            if (details.isNotEmpty()) Text(details.joinToString(" · "), style = MaterialTheme.typography.bodyMedium)
            Text(if (reste > 0) "Répondez dans $reste s" else "Offre expirée", style = MaterialTheme.typography.labelMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = { surOffre(offre.offreId, true) },
                    enabled = !occupe && reste > 0,
                    colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme),
                ) { Text("Accepter", style = MaterialTheme.typography.labelLarge) }
                OutlinedButton(onClick = { surOffre(offre.offreId, false) }, enabled = !occupe, border = BorderStroke(2.dp, Couleurs.Encre)) {
                    Text("Refuser", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
            }
        }
    }
}

@Composable
private fun CarteCourse(course: CourseLivreur, occupe: Boolean, surEtape: (String, String?, String?) -> Unit) {
    var code by remember(course.livraisonId, course.statut) { mutableStateOf("") }
    var echec by remember { mutableStateOf(false) }
    val etape = etapeSuivante(course.statut, course.mode)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Course ${course.commandeReference}", style = MaterialTheme.typography.titleLarge)
            Pastille(course.libelle.ifBlank { course.statut }, Ton.Succes)
            Text("Restaurant : ${course.restaurantNom}", style = MaterialTheme.typography.bodyLarge)
            Text("Gain : ${formaterGnf(course.fraisGnf)}", style = MaterialTheme.typography.bodyMedium)
            course.client?.let { c ->
                Text("Client : ${c.nom}", style = MaterialTheme.typography.bodyLarge)
                Text("Téléphone : ${c.telephone}", style = MaterialTheme.typography.bodyLarge)
                c.adresse?.takeIf { it.isNotBlank() }?.let { Text("Adresse : $it", style = MaterialTheme.typography.bodyLarge) }
            } ?: Text("Les coordonnées du client s'affichent une fois la commande récupérée.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

            if (etape != null) {
                if (etape.demandeCode) {
                    ChampTexte(code, { code = it.filter(Char::isDigit).take(4) }, "Code de remise du client (4 chiffres)", KeyboardType.NumberPassword, aide = "Demandez-le au client : il l'a sur son suivi de commande")
                }
                BoutonPrincipal(etape.libelle, actif = !occupe && (!etape.demandeCode || code.length == 4)) { surEtape(etape.vers, code.takeIf { etape.demandeCode }, null) }
            }
            if (peutDeclarerEchec(course.statut)) {
                TextButton(onClick = { echec = true }, enabled = !occupe) { Text("Livraison impossible", color = Couleurs.Danger) }
            }
        }
    }
    if (echec) {
        var raison by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { echec = false },
            title = { Text("Livraison impossible ?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Dites pourquoi (client injoignable, adresse introuvable…). L'équipe Speedfood sera prévenue.", style = MaterialTheme.typography.bodyMedium)
                    ChampTexte(raison, { raison = it.take(300) }, "Raison")
                }
            },
            confirmButton = {
                TextButton(onClick = { echec = false; surEtape("echec", null, raison.trim().ifBlank { null }) }) { Text("Confirmer", color = Couleurs.Danger) }
            },
            dismissButton = { TextButton(onClick = { echec = false }) { Text("Annuler", color = Couleurs.Encre) } },
        )
    }
}
