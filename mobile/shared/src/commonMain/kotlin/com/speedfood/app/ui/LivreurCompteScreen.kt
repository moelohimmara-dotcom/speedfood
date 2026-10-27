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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.libelleStatutLivreur
import com.speedfood.app.design.Couleurs
import com.speedfood.app.disponibilite.Ton
import kotlinx.coroutines.delay
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/**
 * Onglet « Compte » du livreur : son état (en ligne, en course, hors ligne), ses réglages, l'état de son dossier d'activation,
 * et les liens habituels (changer d'espace, paramètres, aide, déconnexion).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LivreurCompteScreen(
    onParametres: () -> Unit,
    onAide: () -> Unit,
    viewModel: LivreurCompteViewModel = koinViewModel(),
    compte: CompteViewModel = koinViewModel(),
    aide: LivreurAideViewModel = koinViewModel(),
    espaces: EspaceService = koinInject(),
) {
    val etat by viewModel.etat.collectAsState()
    val session by compte.connexion.collectAsState()
    val roles by espaces.roles.collectAsState()
    val whatsapp by aide.whatsapp.collectAsState()
    var assistance by remember { mutableStateOf(false) }
    var deconnexion by remember { mutableStateOf(false) }
    // Le statut est relu tant que l'écran est visible : le livreur voit son état réel, même après une action.
    LaunchedEffect(Unit) {
        while (true) {
            delay(DELAI_STATUT_MS)
            viewModel.rafraichirStatut()
        }
    }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Compte", style = MaterialTheme.typography.titleLarge) },
                actions = { TextButton(onClick = { viewModel.charger() }) { Text("Actualiser", color = Couleurs.Encre) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatCompteLivreur.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatCompteLivreur.NonConnecte -> MessageEtat("Connectez-vous avec votre compte livreur.", "Me connecter", { espaces.quitter() })
                EtatCompteLivreur.PasLivreur -> MessageEtat(
                    "Ce compte n'est pas un compte livreur. Les comptes livreurs sont créés par l'équipe Speedfood : contactez-la si vous souhaitez livrer.",
                    "Changer d'espace",
                    { espaces.quitter() },
                )
                is EtatCompteLivreur.Erreur -> MessageEtat(e.message, "Réessayer", { viewModel.charger() })
                is EtatCompteLivreur.Pret -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item(key = "compte") {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.large,
                                colors = CardDefaults.cardColors(containerColor = Couleurs.Encre),
                            ) {
                                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                    Text(Espace.Livreur.libelle, style = MaterialTheme.typography.titleLarge, color = Couleurs.Mangue)
                                    Text(Espace.Livreur.sousTitre(roles), style = MaterialTheme.typography.bodyMedium, color = Couleurs.Creme)
                                    Text(session?.email ?: "", style = MaterialTheme.typography.bodySmall, color = Couleurs.Creme)
                                }
                            }
                        }

                        e.message?.let { message -> item(key = "message") { BlocMessage(message, erreur = false) } }

                        item(key = "statut") {
                            val enLigne = e.etat.livreur.statut != "hors_ligne"
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium,
                                colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
                                border = BorderStroke(1.dp, Couleurs.Bordure),
                            ) {
                                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Text("Statut", style = MaterialTheme.typography.titleMedium)
                                    Pastille(libelleStatutLivreur(e.etat.livreur.statut), if (enLigne) Ton.Succes else Ton.Neutre)
                                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            if (enLigne) "Vous êtes en ligne : Speedfood peut vous proposer des courses." else "Vous êtes hors ligne : aucune course ne vous est proposée.",
                                            style = MaterialTheme.typography.labelMedium,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            modifier = Modifier.weight(1f),
                                        )
                                        Switch(
                                            checked = enLigne,
                                            onCheckedChange = { viewModel.basculer(it) },
                                            enabled = !e.actionEnCours && e.etat.livreur.cycle == "actif" && e.etat.livreur.statut != "en_course",
                                        )
                                    }
                                    if (e.etat.livreur.statut == "en_course") {
                                        Text("Une course est en cours : vous ne pouvez pas vous mettre hors ligne avant de l'avoir terminée.", style = MaterialTheme.typography.labelMedium, color = Couleurs.AvertissementTexte)
                                    }
                                    if (e.etat.livreur.cycle != "actif") {
                                        Text("Votre fiche n'est pas active : demandez son approbation à l'équipe Speedfood.", style = MaterialTheme.typography.labelMedium, color = Couleurs.AvertissementTexte)
                                    }
                                }
                            }
                        }

                        item(key = "poste-fixe") {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium,
                                colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
                                border = BorderStroke(1.dp, Couleurs.Bordure),
                            ) {
                                Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                    Column(Modifier.weight(1f)) {
                                        Text("Mode poste fixe", style = MaterialTheme.typography.titleMedium)
                                        Text("L'écran reste allumé pendant toute la livraison, même si vous ne suivez pas votre position.", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    Switch(checked = e.posteFixe, onCheckedChange = { viewModel.definirPosteFixe(it) })
                                }
                            }
                        }

                        item(key = "dossier") {
                            val dossier = e.dossier
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = MaterialTheme.shapes.medium,
                                colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
                                border = BorderStroke(1.dp, Couleurs.Bordure),
                            ) {
                                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text("Mon dossier", style = MaterialTheme.typography.titleMedium)
                                    if (dossier == null) {
                                        Text("L'état de votre dossier n'a pas pu être vérifié pour l'instant.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    } else {
                                        Text(dossier.resume(), style = MaterialTheme.typography.bodyLarge)
                                        dossier.manquantes.forEach { piece ->
                                            Text(
                                                piece.explication.ifBlank { "Déposez cette pièce sur le site Speedfood." },
                                                style = MaterialTheme.typography.labelMedium,
                                                color = Couleurs.AvertissementTexte,
                                            )
                                        }
                                        dossier.message?.let { message -> Text(message, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                                    }
                                    Text(
                                        "Votre dossier d'identité se dépose sur le site Speedfood et reste réservé à l'équipe Speedfood : l'application ne montre que ce qui manque, jamais vos documents.",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }

                        item(key = "assistance") {
                            LigneMenu("Assistance conducteur", IconesApp.Info, "Règles de la plateforme, appel, incident") { assistance = true }
                        }

                        item(key = "rubrique-espace") { TitreRubrique("Changer d'espace") }
                        item(key = "espace-client") {
                            LigneMenu("Espace client", IconesApp.Restaurants, "Retourner commander comme un client") { espaces.quitter() }
                        }
                        roles?.espacesPro?.filter { it != Espace.Livreur }?.forEach { autre ->
                            item(key = "espace-${autre.name}") {
                                LigneMenu(autre.libelle, autre.icone(), autre.sousTitre(roles)) { espaces.entrer(autre) }
                            }
                        }

                        item(key = "rubrique-application") { TitreRubrique("Application") }
                        item(key = "parametres") { LigneMenu("Paramètres", IconesApp.Reglages, "Notifications, mises à jour, cet appareil", onParametres) }
                        item(key = "aide") { LigneMenu("Aide et contact", IconesApp.Telephone, "Assistance Speedfood", onAide) }

                        item(key = "deconnexion") {
                            OutlinedButton(onClick = { deconnexion = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), border = BorderStroke(2.dp, Couleurs.Encre)) {
                                Text("Me déconnecter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                            }
                        }
                        item(key = "version") {
                            Text("Speedfood ${compte.infos.versionNom}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }
            }
        }
    }
    if (deconnexion) {
        DialogueDeconnexion(surAnnuler = { deconnexion = false }, surConfirmer = { effacer -> deconnexion = false; compte.deconnecter(effacer) })
    }
    if (assistance) {
        DialogueAssistanceLivreur(
            whatsapp = whatsapp,
            courseEnCours = (etat as? EtatCompteLivreur.Pret)?.etat?.course?.commandeReference,
            onFermer = { assistance = false },
        )
    }
}

/** Délai de relecture du statut : l'écran montre l'état réel sans que le livreur ait à actualiser. */
const val DELAI_STATUT_MS = 10_000L
