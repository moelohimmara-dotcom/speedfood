package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.AlertDialog
import androidx.compose.foundation.layout.Row
import androidx.compose.ui.Alignment
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.RolesCompte
import com.speedfood.app.design.Couleurs
import org.koin.compose.koinInject
import org.koin.compose.viewmodel.koinViewModel

/**
 * Faux à la RACINE d'un onglet d'un espace professionnel : l'écran n'y affiche pas de flèche « retour » (on change d'onglet avec la barre du bas, comme dans toute
 * application). Les écrans ouverts par-dessus gardent leur flèche.
 */
internal val LocalRetourVisible = compositionLocalOf { true }

@Composable
internal fun BoutonRetour(onRetour: () -> Unit) {
    if (LocalRetourVisible.current) IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") }
}

internal fun Espace.sousTitre(roles: RolesCompte?): String = when (this) {
    Espace.Client -> "Commander et suivre vos commandes"
    Espace.Restaurateur -> roles?.restaurateur?.restaurant ?: "Commandes et menu de votre restaurant"
    Espace.Livreur -> "Courses et gains"
    Espace.Equipe -> "Gestion de Speedfood"
}

internal fun Espace.icone() = when (this) {
    Espace.Client -> Icons.Default.Home
    Espace.Restaurateur -> Icons.Default.Person
    Espace.Livreur -> Icons.Default.Notifications
    Espace.Equipe -> Icons.Default.Lock
}

/**
 * « Espace professionnel » : porte d'entrée de ceux qui travaillent avec Speedfood. Hors connexion, elle explique comment rejoindre Speedfood ; une fois connecté, elle
 * ne propose QUE les espaces auxquels le compte a droit. Un client ordinaire ne voit jamais l'espace équipe ni les autres espaces dans son Compte.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccesProScreen(onRetour: () -> Unit, onConnexion: () -> Unit, onAide: () -> Unit, config: SpeedfoodConfig = koinInject(), espaces: EspaceService = koinInject(), viewModel: CompteViewModel = koinViewModel()) {
    val session by viewModel.connexion.collectAsState()
    val roles by espaces.roles.collectAsState()
    val ouvreur = LocalUriHandler.current
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("Espace professionnel", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Pour les restaurateurs, les livreurs et l'équipe de Speedfood. Chaque espace a sa propre navigation et son propre compte.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            val droits = roles
            when {
                session == null -> {
                    BoutonPrincipal("Me connecter à mon espace") {
                        // Après la connexion, l'application ouvre directement l'espace du compte (ou propose le choix s'il en a plusieurs).
                        espaces.intentionPro = true
                        onConnexion()
                    }
                }
                droits == null -> {
                    CircularProgressIndicator(color = Couleurs.RougeFonce)
                    Text("Vérification de vos accès…", style = MaterialTheme.typography.bodyMedium)
                }
                droits.aUnEspacePro -> {
                    TitreRubrique("Vos espaces")
                    droits.espacesPro.forEach { e -> LigneMenu(e.libelle, e.icone(), e.sousTitre(droits)) { espaces.entrer(e) } }
                }
                else -> {
                    BlocMessage("Ce compte n'est rattaché à aucun espace professionnel. Connectez-vous avec le compte de votre restaurant, de livreur ou d'équipe.", erreur = false)
                }
            }

            if (droits?.aUnEspacePro != true) {
                TitreRubrique("Rejoindre Speedfood")
                LigneMenu("Je suis restaurateur", Icons.Default.Person, "Demander à être référencé sur Speedfood") { ouvreur.openUri("${config.siteUrl.trimEnd('/')}/restaurateurs") }
                LigneMenu("Je suis livreur", Icons.Default.Notifications, "Le compte est ouvert par l'équipe Speedfood : contactez-nous", onAide)
            }
        }
    }
}

/** Compte à l'intérieur d'un espace professionnel : identité, retour à l'espace client, autres espaces, paramètres, aide, déconnexion. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CompteProScreen(espace: Espace, onParametres: () -> Unit, onAide: () -> Unit, espaces: EspaceService = koinInject(), viewModel: CompteViewModel = koinViewModel()) {
    val session by viewModel.connexion.collectAsState()
    val roles by espaces.roles.collectAsState()
    var deconnexion by remember { mutableStateOf(false) }
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { TopAppBar(title = { Text("Compte", style = MaterialTheme.typography.titleLarge) }, colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)) },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(containerColor = Couleurs.Encre),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(espace.libelle, style = MaterialTheme.typography.titleLarge, color = Couleurs.Mangue)
                    Text(espace.sousTitre(roles), style = MaterialTheme.typography.bodyMedium, color = Couleurs.Creme)
                    Text(session?.email ?: "", style = MaterialTheme.typography.bodySmall, color = Couleurs.Creme)
                }
            }
            TitreRubrique("Changer d'espace")
            LigneMenu("Espace client", Icons.Default.Home, "Retourner commander comme un client") { espaces.quitter() }
            roles?.espacesPro?.filter { it != espace }?.forEach { e -> LigneMenu(e.libelle, e.icone(), e.sousTitre(roles)) { espaces.entrer(e) } }

            TitreRubrique("Application")
            LigneMenu("Paramètres", Icons.Default.Settings, "Notifications, mises à jour, cet appareil", onParametres)
            LigneMenu("Aide et contact", Icons.Default.Phone, "Assistance Speedfood", onAide)

            OutlinedButton(onClick = { deconnexion = true }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), border = BorderStroke(2.dp, Couleurs.Encre)) {
                Text("Me déconnecter", style = MaterialTheme.typography.labelLarge, color = Couleurs.Encre)
            }
            Text("Speedfood ${viewModel.infos.versionNom}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
        }
    }
    if (deconnexion) {
        DialogueDeconnexion(surAnnuler = { deconnexion = false }, surConfirmer = { effacer -> deconnexion = false; viewModel.deconnecter(effacer) })
    }
}

/**
 * Confirmation de déconnexion, la même dans tous les espaces. Les commandes en cours restent suivies sur l'appareil (c'est leur seul moyen de suivi) : la case permet de
 * les effacer, par exemple sur un téléphone prêté.
 */
@Composable
internal fun DialogueDeconnexion(surAnnuler: () -> Unit, surConfirmer: (effacerCommandes: Boolean) -> Unit) {
    var effacer by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = surAnnuler,
        title = { Text("Se déconnecter ?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Cet appareil ne recevra plus les notifications de votre compte. Vos commandes en cours restent suivies ici, et votre panier est conservé.")
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = effacer, onCheckedChange = { effacer = it })
                    Text("Effacer aussi les commandes enregistrées sur cet appareil", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = { TextButton(onClick = { surConfirmer(effacer) }) { Text("Me déconnecter", color = Couleurs.Danger) } },
        dismissButton = { TextButton(onClick = surAnnuler) { Text("Retour", color = Couleurs.Encre) } },
    )
}
