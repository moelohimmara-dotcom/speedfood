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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.ProfilEntree
import com.speedfood.app.data.ProfilService
import com.speedfood.app.data.QUESTIONS_AIDE
import com.speedfood.app.data.QUESTIONS_AIDE_RESTAURATEUR
import com.speedfood.app.design.Couleurs
import com.speedfood.app.ui.CLE_VISITE_VUE
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/** Une ligne de menu : icône, titre, sous-titre facultatif, flèche. Même aspect partout (Compte, Paramètres). */
@Composable
internal fun LigneMenu(titre: String, icone: ImageVector, sousTitre: String? = null, onClick: () -> Unit) {
    CarteMarche(modifier = Modifier.fillMaxWidth(), surClic = onClick, rayon = 14.dp) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Icon(icone, contentDescription = null, tint = Couleurs.RougeFonce)
            Column(Modifier.weight(1f)) {
                Text(titre, style = MaterialTheme.typography.titleMedium)
                sousTitre?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            Icon(IconesApp.Chevron, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
internal fun TitreRubrique(texte: String) {
    Text(texte, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 10.dp))
}

/** Onglet « Compte » : identité, accès aux rubriques, autres espaces (restaurateur, livreur, équipe), liens légaux, déconnexion. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompteScreen(
    onConnexion: () -> Unit,
    onCommandes: () -> Unit,
    onParametres: () -> Unit,
    onAide: () -> Unit,
    onProfil: () -> Unit = {},
    onAdresses: () -> Unit = {},
    onFavoris: () -> Unit = {},
    onAvis: () -> Unit = {},
    config: SpeedfoodConfig = koinInject(),
    espaces: com.speedfood.app.data.EspaceService = koinInject(),
    viewModel: CompteViewModel = koinViewModel(),
) {
    val session by viewModel.connexion.collectAsState()
    val message by viewModel.message.collectAsState()
    val ouvreur = LocalUriHandler.current
    var deconnexion by remember { mutableStateOf(false) }
    var suppression by remember { mutableStateOf(false) }
    val droits by espaces.roles.collectAsState()
    val pro = droits?.takeIf { it.aUnEspacePro }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopAppBar(title = { Text("Compte", style = MaterialTheme.typography.titleLarge) }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            CarteMarche(modifier = Modifier.fillMaxWidth(), rayon = 18.dp) {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Box(Modifier.size(52.dp).background(Couleurs.Mangue, CircleShape), contentAlignment = Alignment.Center) {
                        val initiale = session?.email?.take(1)?.uppercase()
                        if (initiale != null) Text(initiale, style = MaterialTheme.typography.titleLarge, color = Couleurs.Encre) else Icon(IconesApp.Compte, contentDescription = null, tint = Couleurs.Encre)
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        if (session != null) {
                            Text(session?.email ?: "Compte connecté", style = MaterialTheme.typography.titleMedium)
                            Text("Compte Speedfood" + (pro?.let { " · " + it.espacesPro.joinToString(", ") { e -> e.nom } } ?: ""), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        } else {
                            Text("Vous n'êtes pas connecté", style = MaterialTheme.typography.titleMedium)
                            Text("Connectez-vous pour commander et retrouver vos commandes.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            if (session == null) BoutonPrincipal("Me connecter", surClic = onConnexion)
            message?.let { BlocMessage(it, erreur = false) }

            // La coque du consommateur ne montre AUCUN espace professionnel, même à un compte qui y a droit : on y va par « Changer de profil » (confirmation puis choix), jamais par une porte directe.
            TitreRubrique("Mon espace")
            if (session != null) {
                LigneMenu("Mon profil", IconesApp.Compte, "Pseudo, avatar, préférences de commande", onProfil)
                LigneMenu("Mes adresses", IconesApp.Epingle, "Maison, travail...", onAdresses)
                LigneMenu("Mes favoris", IconesApp.Coeur, "Restaurants enregistrés", onFavoris)
                LigneMenu("Mes avis", IconesApp.Etoile, "Notes laissées aux restaurants", onAvis)
            }
            LigneMenu("Mes commandes", IconesApp.Commandes, "Suivi et historique", onCommandes)
            LigneMenu("Paramètres", IconesApp.Reglages, "Notifications, mises à jour, cet appareil", onParametres)
            LigneMenu("Aide et contact", IconesApp.Telephone, "Questions fréquentes, assistance, à propos", onAide)

            // Passer à un autre profil (restaurateur, professionnel) se fait ici, par une confirmation : plus de porte directe vers un autre monde.
            LigneChangerProfil()

            TitreRubrique("Informations")
            LigneMenu("Conditions d'utilisation", IconesApp.Info) { ouvreur.openUri("${config.siteUrl.trimEnd('/')}/conditions") }
            LigneMenu("Confidentialité", IconesApp.Cadenas) { ouvreur.openUri("${config.siteUrl.trimEnd('/')}/confidentialite") }

            if (session != null) {
                OutlinedButton(onClick = { deconnexion = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), border = BorderStroke(2.dp, Couleurs.Encre)) {
                    Text("Me déconnecter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
                // Droit à l'effacement : un compte professionnel passe par l'équipe (le serveur le refuse et l'explique).
                TextButton(onClick = { suppression = true }, modifier = Modifier.fillMaxWidth()) {
                    Text("Supprimer mon compte", style = MaterialTheme.typography.labelLarge, color = Couleurs.Danger)
                }
            }
            Text("Speedfood ${viewModel.infos.versionNom}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
    }
    if (deconnexion) {
        DialogueDeconnexion(surAnnuler = { deconnexion = false }, surConfirmer = { effacer -> deconnexion = false; viewModel.deconnecter(effacer) })
    }
    if (suppression) {
        DialogueSuppressionCompte(surAnnuler = { suppression = false }, surConfirmer = { mot -> suppression = false; viewModel.supprimerCompte(mot) })
    }
}

/** Paramètres : notifications (essai), version et mise à jour, données de cet appareil, visite guidée. Rien n'est affiché qui ne fonctionne pas. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ParametresScreen(onRetour: () -> Unit, onVisite: () -> Unit, viewModel: CompteViewModel = koinViewModel(), stockage: StockageLocal = koinInject()) {
    val session by viewModel.connexion.collectAsState()
    val message by viewModel.message.collectAsState()
    val versionDisponible by viewModel.versionDisponible.collectAsState()
    val ouvreur = LocalUriHandler.current
    var oubli by remember { mutableStateOf(false) }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Paramètres", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(IconesApp.Retour, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            message?.let { BlocMessage(it, erreur = false) }

            TitreRubrique("Notifications")
            Text(
                "Speedfood vous prévient à chaque étape de votre commande. Si rien n'arrive, vérifiez que les notifications de Speedfood sont autorisées dans les réglages du téléphone.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (session != null) {
                OutlinedButton(onClick = viewModel::essaiNotification, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                    Text("Tester les notifications", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
            } else {
                Text("Connectez-vous pour tester les notifications.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            TitreRubrique("Application")
            Text("Version installée : ${viewModel.infos.versionNom}", style = MaterialTheme.typography.bodyMedium)
            OutlinedButton(onClick = viewModel::verifierMiseAJour, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                Text("Vérifier les mises à jour", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
            versionDisponible?.let { url ->
                val publiee by viewModel.versionPubliee.collectAsState()
                val etatInstallation by viewModel.installation.etat.collectAsState()
                val proposee = publiee
                if (proposee != null && viewModel.installation.possible(proposee)) {
                    ActionMiseAJour(proposee, url, viewModel.installation, etatInstallation)
                } else {
                    BoutonPrincipal("Télécharger la nouvelle version", surClic = { ouvreur.openUri(url) })
                }
            }
            OutlinedButton(onClick = { stockage.effacer(CLE_VISITE_VUE); onVisite() }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                Text("Revoir la visite guidée", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }

            SectionSecurite()

            TitreRubrique("Cet appareil")
            Text("Les commandes que vous passez sont gardées sur ce téléphone pour que vous les retrouviez même sans compte.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedButton(onClick = { oubli = true }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Danger)) {
                Text("Oublier les commandes de cet appareil", style = MaterialTheme.typography.labelLarge, color = Couleurs.Danger)
            }
        }
    }
    if (oubli) {
        AlertDialog(
            onDismissRequest = { oubli = false },
            title = { Text("Oublier les commandes de cet appareil ?") },
            text = { Text("Elles disparaissent de ce téléphone. Les commandes liées à un compte restent disponibles quand vous vous reconnectez.") },
            confirmButton = { TextButton(onClick = { oubli = false; viewModel.oublierCommandesDeCetAppareil() }) { Text("Oublier", color = Couleurs.Danger) } },
            dismissButton = { TextButton(onClick = { oubli = false }) { Text("Retour", color = Couleurs.Encre) } },
        )
    }
}

/** Aide : contact d'assistance (WhatsApp si l'administration en a renseigné un), questions fréquentes, à propos, liens légaux. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AideScreen(onRetour: () -> Unit, avecRetour: Boolean = true, config: SpeedfoodConfig = koinInject(), profils: ProfilService = koinInject(), viewModel: CompteViewModel = koinViewModel()) {
    val whatsapp by viewModel.whatsapp.collectAsState()
    val ouvreur = LocalUriHandler.current
    LaunchedEffect(Unit) { viewModel.chargerContact() }
    val site = config.siteUrl.trimEnd('/')
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Aide et contact", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { if (avecRetour) IconButton(onClick = onRetour) { Icon(IconesApp.Retour, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            TitreRubrique("Nous contacter")
            val numero = whatsapp
            if (numero != null) {
                BoutonPrincipal("Écrire à l'assistance sur WhatsApp", surClic = { ouvreur.openUri("https://wa.me/$numero") })
                OutlinedButton(onClick = { ouvreur.openUri("tel:+$numero") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                    Text("Appeler l'assistance", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
                }
            } else {
                Text("Pour toute question, consultez le centre d'aide du site.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            OutlinedButton(onClick = { ouvreur.openUri("$site/aide") }, modifier = Modifier.fillMaxWidth(), border = BorderStroke(1.dp, Couleurs.Encre)) {
                Text("Centre d'aide complet (site)", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }

            TitreRubrique("Questions fréquentes")
            // Les questions suivent le profil : le restaurateur n'a pas à lire comment commander un repas.
            val profil by profils.profil.collectAsState()
            (if (profil == ProfilEntree.Restaurateur) QUESTIONS_AIDE_RESTAURATEUR else QUESTIONS_AIDE).forEach { q ->
                var ouverte by remember { mutableStateOf(false) }
                CarteMarche(modifier = Modifier.fillMaxWidth(), surClic = { ouverte = !ouverte }, rayon = 14.dp) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(q.question, style = MaterialTheme.typography.titleSmall)
                        if (ouverte) Text(q.reponse, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            TitreRubrique("À propos")
            Text(
                "Speedfood est le portail de commande de repas de Conakry : vous parcourez les restaurants, commandez, puis suivez votre commande jusqu'à la remise. Version ${viewModel.infos.versionNom}.",
                style = MaterialTheme.typography.bodyMedium,
            )
            // Sur un écran étroit ou en grande police, les liens passent à la ligne ensemble au lieu de couper un mot en deux.
            @OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
            androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                TextButton(onClick = { ouvreur.openUri("$site/a-propos") }) { Text("Qui sommes-nous", color = Couleurs.RougeFonce) }
                TextButton(onClick = { ouvreur.openUri("$site/conditions") }) { Text("Conditions", color = Couleurs.Encre) }
                TextButton(onClick = { ouvreur.openUri("$site/confidentialite") }) { Text("Confidentialité", color = Couleurs.Encre) }
            }
        }
    }
}
