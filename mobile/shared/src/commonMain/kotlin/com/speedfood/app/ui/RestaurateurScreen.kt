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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.ActionCommande
import com.speedfood.app.data.ActionPaiement
import com.speedfood.app.data.CommandeRestaurateur
import com.speedfood.app.data.actionsPaiement
import com.speedfood.app.data.actionsPossibles
import com.speedfood.app.data.classerCommandes
import com.speedfood.app.data.formaterGnf
import com.speedfood.app.data.peutProposer
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import com.speedfood.app.disponibilite.ancienneteLisible
import org.koin.compose.viewmodel.koinViewModel
import kotlin.time.Clock
import kotlin.time.Instant

/** Console du restaurateur : commandes en direct (à traiter, en cours, historique), accepter / refuser / préparer / remettre, proposer un changement, ouvrir ou mettre en pause. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RestaurateurScreen(siteUrl: String, onRetour: () -> Unit, onConnexion: () -> Unit, onMenu: () -> Unit, viewModel: RestaurateurViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Console restaurateur", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { BoutonRetour(onRetour) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatConsole.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatConsole.NonConnecte -> MessageEtat(
                    "Connectez-vous avec le compte de votre restaurant. Pas encore partenaire ? La demande de référencement se fait sur le site : ${siteUrl.trimEnd('/')}/restaurateurs",
                    "Me connecter",
                    onConnexion,
                )
                is EtatConsole.Erreur -> MessageEtat(e.message, "Changer de compte", onConnexion)
                is EtatConsole.Pret -> ContenuConsole(
                    e,
                    Clock.System.now().toEpochMilliseconds(),
                    surAction = viewModel::traiter,
                    surProposition = viewModel::proposer,
                    surStatut = viewModel::definirStatut,
                    surMenu = onMenu,
                    surPaiement = viewModel::confirmerPaiement,
                    surDocument = viewModel::emettreDocument,
                    surChoixAlerte = viewModel::choisirAlerteArrierePlan,
                )
            }
        }
    }
}

@Composable
internal fun ContenuConsole(
    e: EtatConsole.Pret,
    maintenantMillis: Long,
    surAction: (String, String) -> Unit,
    surProposition: (String, Int, Int, String) -> Unit,
    surStatut: (String, Boolean) -> Unit,
    surMenu: () -> Unit = {},
    surPaiement: (String, String) -> Unit = { _, _ -> },
    surDocument: (String, String) -> Unit = { _, _ -> },
    surChoixAlerte: (Boolean) -> Unit = {},
) {
    val classees = classerCommandes(e.etat.commandes)
    // Première ouverture : on explique l'alerte application fermée et on demande le choix, une seule fois.
    var question by remember(e.arrierePlanPossible, e.alerteArrierePlan) { mutableStateOf(e.arrierePlanPossible && e.alerteArrierePlan == null) }
    var historiqueOuvert by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        e.etat.restaurant?.let { r ->
            Text(r.nom, style = MaterialTheme.typography.headlineMedium)
            InterrupteurStatut("Ouvert", r.ouvert, !e.actionEnCours) { surStatut("ouvert", it) }
            InterrupteurStatut("Prend des commandes en ce moment", r.accepteCommandes, !e.actionEnCours) { surStatut("accepte_commandes", it) }
        }
        if (e.arrierePlanPossible && e.alerteArrierePlan != null) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (e.alerteArrierePlan) "Alerte application fermée : activée" else "Alerte application fermée : désactivée",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                TextButton(onClick = { surChoixAlerte(!e.alerteArrierePlan) }) { Text(if (e.alerteArrierePlan) "Désactiver" else "Activer", color = Couleurs.Encre) }
            }
        }
        OutlinedButton(onClick = surMenu, modifier = Modifier.fillMaxWidth(), border = BorderStroke(2.dp, Couleurs.Encre)) {
            Text("Mon menu et mes disponibilités", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
        }
        e.message?.let { BlocMessage(it, erreur = false) }

        Text("À traiter (${classees.aTraiter.size})", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 4.dp))
        if (classees.aTraiter.isEmpty()) Text("Aucune commande n'attend votre réponse.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        classees.aTraiter.forEach { CarteCommandeRestaurateur(it, maintenantMillis, e.actionEnCours, surAction, surProposition, surPaiement, surDocument) }

        if (classees.enCours.isNotEmpty()) {
            Text("En cours (${classees.enCours.size})", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
            classees.enCours.forEach { CarteCommandeRestaurateur(it, maintenantMillis, e.actionEnCours, surAction, surProposition, surPaiement, surDocument) }
        }

        if (classees.historique.isNotEmpty()) {
            TextButton(onClick = { historiqueOuvert = !historiqueOuvert }) {
                Text((if (historiqueOuvert) "Masquer" else "Afficher") + " l'historique récent (${classees.historique.size})", color = Couleurs.Encre)
            }
            if (historiqueOuvert) classees.historique.forEach { CarteCommandeRestaurateur(it, maintenantMillis, e.actionEnCours, surAction, surProposition, surPaiement, surDocument) }
        }
    }
    if (question) {
        AlertDialog(
            onDismissRequest = { question = false },
            title = { Text("Être alerté application fermée ?") },
            text = {
                Text(
                    "Sans cela, vous n'êtes alerté d'une nouvelle commande que si l'application est ouverte. Avec l'alerte activée, Speedfood surveille vos commandes en continu " +
                        "(une notification reste affichée) et fait sonner le téléphone à chaque nouvelle commande, même écran éteint ou application fermée. " +
                        "Branchez de préférence le téléphone sur secteur. La surveillance s'arrête quand le restaurant est fermé et sans commande à traiter. Vous pouvez changer d'avis à tout moment.",
                )
            },
            confirmButton = { TextButton(onClick = { question = false; surChoixAlerte(true) }) { Text("Activer l'alerte", color = Couleurs.RougeFonce) } },
            dismissButton = { TextButton(onClick = { question = false; surChoixAlerte(false) }) { Text("Seulement application ouverte", color = Couleurs.Encre) } },
        )
    }
}

@Composable
private fun InterrupteurStatut(libelle: String, actif: Boolean, modifiable: Boolean, surChangement: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(libelle, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.weight(1f))
        Switch(
            checked = actif,
            onCheckedChange = surChangement,
            enabled = modifiable,
            colors = SwitchDefaults.colors(checkedTrackColor = Couleurs.Succes, checkedThumbColor = Couleurs.Surface),
        )
    }
}

private fun libelleEtat(c: CommandeRestaurateur): Pair<String, Ton> = when (c.etatDerive) {
    "en_attente" -> "À traiter" to Ton.Neutre
    "attente_confirmation_client" -> "Attente du client" to Ton.Neutre
    "acceptee" -> "Acceptée · à préparer" to Ton.Succes
    "prete" -> "Prête" to Ton.Succes
    "terminee" -> "Terminée" to Ton.Succes
    "refusee" -> "Refusée" to Ton.Danger
    "annulee" -> "Annulée" to Ton.Danger
    else -> c.etatDerive to Ton.Neutre
}

@Composable
internal fun CarteCommandeRestaurateur(
    c: CommandeRestaurateur,
    maintenantMillis: Long,
    occupe: Boolean,
    surAction: (String, String) -> Unit,
    surProposition: (String, Int, Int, String) -> Unit,
    surPaiement: (String, String) -> Unit = { _, _ -> },
    surDocument: (String, String) -> Unit = { _, _ -> },
) {
    val ouvreur = LocalUriHandler.current
    var paiementAConfirmer by remember { mutableStateOf<ActionPaiement?>(null) }
    var aConfirmer by remember { mutableStateOf<ActionCommande?>(null) }
    var proposition by remember { mutableStateOf(false) }
    val age = try {
        ancienneteLisible(maintenantMillis - Instant.parse(c.creeLe).toEpochMilliseconds())
    } catch (_: IllegalArgumentException) {
        ""
    }
    val (texteEtat, ton) = libelleEtat(c)
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = if (c.etatDerive == "en_attente") Couleurs.AvertissementFond else Couleurs.Surface),
        border = BorderStroke(1.dp, if (c.etatDerive == "en_attente") Couleurs.Mangue else Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text(c.reference + if (c.estTest) " · TEST" else "", style = MaterialTheme.typography.titleLarge)
                Text(formaterGnf(c.total), style = MaterialTheme.typography.titleMedium)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Pastille(texteEtat, ton)
                val mode = when (c.mode) {
                    "livraison" -> "Livraison"
                    "sur_place" -> "Sur place" + (c.tableNumero?.let { " · table $it" } ?: "")
                    else -> "Retrait"
                }
                Text(listOf(mode, age).filter { it.isNotBlank() }.joinToString(" · "), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            c.lignes.forEach { l ->
                Text(
                    "${l.quantite} × ${l.nom}" + if (l.options.isNotEmpty()) " (+ ${l.options.joinToString(", ") { it.nom }})" else "",
                    style = MaterialTheme.typography.bodyLarge,
                )
            }
            if (c.fraisLivraisonEstime > 0) Text("Livraison : ${formaterGnf(c.fraisLivraisonEstime)}", style = MaterialTheme.typography.bodyMedium)
            Text("Client : ${c.clientNom} · ${c.clientTelephone}", style = MaterialTheme.typography.bodyMedium)
            c.clientAdresse?.takeIf { it.isNotBlank() }?.let { Text("Adresse : $it", style = MaterialTheme.typography.bodyMedium) }
            c.propositionActive?.let { p ->
                Text(
                    "Proposition envoyée : ${formaterGnf(p.nouveauSousTotal)} + livraison ${formaterGnf(p.nouveauxFraisLivraison)}. Le client décide.",
                    style = MaterialTheme.typography.labelMedium,
                    color = Couleurs.AvertissementTexte,
                )
            }

            val actions = actionsPossibles(c)
            if (actions.isNotEmpty() || peutProposer(c)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    actions.forEachIndexed { i, a ->
                        if (i == 0 && !a.destructive) {
                            Button(
                                onClick = { surAction(c.id, a.code) },
                                enabled = !occupe,
                                colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme),
                            ) { Text(a.libelle, style = MaterialTheme.typography.labelLarge) }
                        } else {
                            OutlinedButton(
                                onClick = { if (a.destructive) aConfirmer = a else surAction(c.id, a.code) },
                                enabled = !occupe,
                                border = BorderStroke(2.dp, if (a.destructive) Couleurs.Danger else Couleurs.Encre),
                            ) { Text(a.libelle, style = MaterialTheme.typography.labelLarge, color = if (a.destructive) Couleurs.Danger else Couleurs.Encre) }
                        }
                    }
                }
                if (peutProposer(c)) {
                    TextButton(onClick = { proposition = true }, enabled = !occupe) { Text("Proposer un changement", color = Couleurs.Encre) }
                }
            }

            if (c.paiementVisible) {
                Text("Paiement", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 6.dp))
                Text(
                    c.paiementLibelle + (c.paiementReference?.let { " · réf. $it" } ?: "") + (c.documents.recu?.let { " · reçu $it" } ?: ""),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (c.paiementMode == "speedfood") {
                    Text(
                        if (c.paiementStatut == "recu") "Le client a payé en ligne : rien à encaisser. Vous serez payé dès que la commande sera remise."
                        else "Le client règle en ligne : rien à encaisser ni à confirmer, la confirmation vient du prestataire de paiement.",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (c.paiementStatut == "declare") {
                    Text("Comparez avec le SMS de confirmation de votre opérateur avant de valider.", style = MaterialTheme.typography.labelMedium, color = Couleurs.AvertissementTexte)
                }
                actionsPaiement(c).forEach { a ->
                    OutlinedButton(
                        onClick = {
                            when (a.genre) {
                                ActionPaiement.Genre.WhatsApp -> ouvreur.openUri(a.code)
                                ActionPaiement.Genre.Document -> surDocument(c.id, a.code)
                                ActionPaiement.Genre.Paiement -> if (a.confirmation != null) paiementAConfirmer = a else surPaiement(c.id, a.code)
                            }
                        },
                        enabled = !occupe || a.genre == ActionPaiement.Genre.WhatsApp,
                        modifier = Modifier.fillMaxWidth(),
                        border = BorderStroke(1.dp, Couleurs.Bordure),
                    ) { Text(a.libelle, style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre) }
                }
            }
        }
    }
    paiementAConfirmer?.let { a ->
        AlertDialog(
            onDismissRequest = { paiementAConfirmer = null },
            title = { Text("Confirmer ?") },
            text = { Text(a.confirmation ?: "") },
            confirmButton = { TextButton(onClick = { paiementAConfirmer = null; surPaiement(c.id, a.code) }) { Text("Confirmer", color = Couleurs.RougeFonce) } },
            dismissButton = { TextButton(onClick = { paiementAConfirmer = null }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
    aConfirmer?.let { a ->
        AlertDialog(
            onDismissRequest = { aConfirmer = null },
            title = { Text("${a.libelle} la commande ${c.reference} ?") },
            text = { Text("Le client sera prévenu. Cette décision ne peut pas être annulée.") },
            confirmButton = { TextButton(onClick = { aConfirmer = null; surAction(c.id, a.code) }) { Text(a.libelle, color = Couleurs.Danger) } },
            dismissButton = { TextButton(onClick = { aConfirmer = null }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
    if (proposition) {
        DialogueProposition(c, surAnnuler = { proposition = false }) { s, f, cond ->
            proposition = false
            surProposition(c.id, s, f, cond)
        }
    }
}

@Composable
private fun DialogueProposition(c: CommandeRestaurateur, surAnnuler: () -> Unit, surEnvoi: (Int, Int, String) -> Unit) {
    var sousTotal by remember { mutableStateOf(c.sousTotal.toString()) }
    var frais by remember { mutableStateOf(c.fraisLivraisonEstime.toString()) }
    var conditions by remember { mutableStateOf("") }
    var erreur by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Proposer un changement") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Le client verra votre proposition et décidera. Rien n'est préparé avant sa réponse.", style = MaterialTheme.typography.bodyMedium)
                ChampTexte(sousTotal, { sousTotal = it.filter(Char::isDigit) }, "Nouveau total des plats (GNF)", KeyboardType.Number)
                ChampTexte(frais, { frais = it.filter(Char::isDigit) }, "Frais de livraison (GNF)", KeyboardType.Number)
                ChampTexte(conditions, { conditions = it.take(500) }, "Explication (facultatif)", aide = "Par exemple : plat remplacé, supplément indisponible")
                erreur?.let { BlocMessage(it, erreur = true) }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val probleme = verifierProposition(sousTotal, frais, conditions, c.sousTotal, c.fraisLivraisonEstime)
                if (probleme != null) erreur = probleme else surEnvoi(sousTotal.trim().toInt(), frais.trim().toInt(), conditions.trim())
            }) { Text("Envoyer au client", color = Couleurs.RougeFonce) }
        },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Annuler", color = Couleurs.Encre) } },
    )
}
