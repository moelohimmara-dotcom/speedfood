package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.unit.dp
import com.speedfood.app.data.AVATARS_CLIENT
import com.speedfood.app.data.AdresseClient
import com.speedfood.app.data.AvisClient
import com.speedfood.app.data.FavoriClient
import com.speedfood.app.data.MODES_PREFERES_CLIENT
import com.speedfood.app.data.emojiAvatarClient
import com.speedfood.app.data.verifierAdresse
import com.speedfood.app.data.verifierPseudo
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

/** Cadre commun des écrans de l'espace client : barre avec retour, chargement, connexion requise, erreur. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CadreEspaceClient(titre: String, onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: EspaceClientViewModel, contenu: @Composable (EtatEspaceClient.Pret) -> Unit) {
    val etat by viewModel.etat.collectAsState()
    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(titre, style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(IconesApp.Retour, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Box(Modifier.fillMaxSize().padding(marges)) {
            when (val e = etat) {
                EtatEspaceClient.Chargement -> CircularProgressIndicator(Modifier.align(Alignment.Center), color = Couleurs.RougeFonce)
                EtatEspaceClient.NonConnecte -> MessageEtat("Connectez-vous pour retrouver votre espace.", "Me connecter", onConnexion)
                is EtatEspaceClient.Erreur -> MessageEtat(e.message, "Réessayer", viewModel::charger)
                is EtatEspaceClient.Pret -> contenu(e)
            }
        }
    }
}

@Composable
private fun Corps(e: EtatEspaceClient.Pret, contenu: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        e.message?.let { BlocMessage(it, erreur = false) }
        contenu()
    }
}

/** Profil : avatar (liste fermée) et pseudo, mode de commande préféré, notifications de suivi. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfilClientScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: EspaceClientViewModel = koinViewModel()) {
    CadreEspaceClient("Mon profil", onRetour, onConnexion, viewModel) { e ->
        val profil = e.espace.profil
        var pseudo by remember(profil?.pseudo) { mutableStateOf(profil?.pseudo ?: "") }
        var avatar by remember(profil?.avatar) { mutableStateOf(profil?.avatar ?: "burger") }
        val erreur = if (pseudo.isBlank()) null else verifierPseudo(pseudo)
        Corps(e) {
            Box(Modifier.size(72.dp).background(Couleurs.Mangue, CircleShape).align(Alignment.CenterHorizontally), contentAlignment = Alignment.Center) {
                Text(emojiAvatarClient(avatar), style = MaterialTheme.typography.headlineLarge)
            }
            Text("Votre pseudo et votre avatar sont les seuls éléments visibles de votre profil : pas de photo, pas de nom complet.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                AVATARS_CLIENT.forEach { (cle, emoji) ->
                    FilterChip(
                        selected = avatar == cle,
                        onClick = { avatar = cle },
                        label = { Text(emoji, style = MaterialTheme.typography.titleLarge) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue),
                    )
                }
            }
            OutlinedTextField(
                value = pseudo,
                onValueChange = { if (it.length <= 24) pseudo = it },
                label = { Text("Pseudo (3 à 24 caractères)") },
                singleLine = true,
                isError = erreur != null,
                supportingText = { erreur?.let { Text(it) } },
                modifier = Modifier.fillMaxWidth(),
            )
            BoutonPrincipal(if (profil == null) "Créer mon profil" else "Enregistrer", actif = !e.actionEnCours && pseudo.isNotBlank() && erreur == null, surClic = { viewModel.enregistrerProfil(pseudo, avatar) })

            if (profil != null) {
                Text("Préférences de commande", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 10.dp))
                Text("Mode proposé en premier au moment de commander.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    MODES_PREFERES_CLIENT.forEach { (cle, libelle) ->
                        FilterChip(
                            selected = profil.modePrefere == cle,
                            onClick = { if (!e.actionEnCours) viewModel.definirModePrefere(cle) },
                            label = { Text(libelle, style = MaterialTheme.typography.labelMedium) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                        )
                    }
                }
                Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Notifications de suivi de commande", style = MaterialTheme.typography.titleSmall)
                        Text("Une notification à chaque étape de votre commande.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Switch(
                        checked = profil.notificationsCommande,
                        onCheckedChange = { if (!e.actionEnCours) viewModel.definirNotifications(it) },
                        colors = SwitchDefaults.colors(checkedTrackColor = Couleurs.Succes, checkedThumbColor = Couleurs.Surface),
                    )
                }
            }
        }
    }
}

/** Carnet d'adresses : cinq au plus, une principale. */
@Composable
fun AdressesClientScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: EspaceClientViewModel = koinViewModel()) {
    CadreEspaceClient("Mes adresses", onRetour, onConnexion, viewModel) { e ->
        var libelle by remember { mutableStateOf("") }
        var adresse by remember { mutableStateOf("") }
        var suppression by remember { mutableStateOf<AdresseClient?>(null) }
        val erreur = if (libelle.isBlank() && adresse.isBlank()) null else verifierAdresse(libelle, adresse)
        Corps(e) {
            Text("Enregistrez vos adresses de livraison : « Maison », « Travail »... Écrivez-les comme vous les dicteriez à un livreur (quartier, rue, point de repère).", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (e.espace.adresses.isEmpty()) Text("Aucune adresse enregistrée.", style = MaterialTheme.typography.bodyLarge)
            e.espace.adresses.forEach { a ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = MaterialTheme.shapes.medium,
                    colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
                    border = BorderStroke(1.dp, if (a.parDefaut) Couleurs.Mangue else Couleurs.Bordure),
                ) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(a.libelle, style = MaterialTheme.typography.titleMedium)
                            if (a.parDefaut) Text("Principale", style = MaterialTheme.typography.labelLarge, color = Couleurs.Succes)
                        }
                        Text(a.adresse, style = MaterialTheme.typography.bodyMedium)
                        Row {
                            if (!a.parDefaut) TextButton(onClick = { viewModel.adressePrincipale(a.id) }, enabled = !e.actionEnCours) { Text("Définir comme principale", color = Couleurs.Encre) }
                            TextButton(onClick = { suppression = a }, enabled = !e.actionEnCours) { Text("Supprimer", color = Couleurs.Danger) }
                        }
                    }
                }
            }
            if (e.espace.adresses.size < 5) {
                Text("Ajouter une adresse", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
                OutlinedTextField(value = libelle, onValueChange = { if (it.length <= 30) libelle = it }, label = { Text("Nom (Maison, Travail...)") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(
                    value = adresse,
                    onValueChange = { if (it.length <= 300) adresse = it },
                    label = { Text("Adresse et point de repère") },
                    isError = erreur != null,
                    supportingText = { erreur?.let { Text(it) } },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
                BoutonPrincipal("Enregistrer l'adresse", actif = !e.actionEnCours && erreur == null && libelle.isNotBlank() && adresse.isNotBlank(), surClic = {
                    viewModel.ajouterAdresse(libelle, adresse)
                    libelle = ""
                    adresse = ""
                })
            } else {
                Text("Vous avez 5 adresses : supprimez-en une avant d'en ajouter.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        suppression?.let { a ->
            AlertDialog(
                onDismissRequest = { suppression = null },
                title = { Text("Supprimer « ${a.libelle} » ?") },
                text = { Text(a.adresse) },
                confirmButton = { TextButton(onClick = { suppression = null; viewModel.supprimerAdresse(a.id) }) { Text("Supprimer", color = Couleurs.Danger) } },
                dismissButton = { TextButton(onClick = { suppression = null }) { Text("Retour", color = Couleurs.Encre) } },
            )
        }
    }
}

/** Restaurants favoris : ouvrir la fiche, retirer. */
@Composable
fun FavorisClientScreen(onRetour: () -> Unit, onConnexion: () -> Unit, onOuvrir: (String) -> Unit, viewModel: EspaceClientViewModel = koinViewModel()) {
    CadreEspaceClient("Mes favoris", onRetour, onConnexion, viewModel) { e ->
        Corps(e) {
            if (e.espace.favoris.isEmpty()) Text("Aucun favori pour l'instant. Touchez le cœur sur la fiche d'un restaurant pour l'ajouter à vos favoris.", style = MaterialTheme.typography.bodyLarge)
            e.espace.favoris.forEach { f -> CarteFavori(f, e.actionEnCours, onOuvrir) { viewModel.retirerFavori(f.restaurantId) } }
        }
    }
}

@Composable
private fun CarteFavori(f: FavoriClient, occupe: Boolean, onOuvrir: (String) -> Unit, onRetirer: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onOuvrir(f.restaurantId) },
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f)) {
                Text(f.nom, style = MaterialTheme.typography.titleMedium)
                Text(if (f.ouvert) "Ouvert" else "Fermé", style = MaterialTheme.typography.labelMedium, color = if (f.ouvert) Couleurs.Succes else Couleurs.Danger)
            }
            OutlinedButton(onClick = onRetirer, enabled = !occupe, border = BorderStroke(1.dp, Couleurs.Danger)) { Text("Retirer", color = Couleurs.Danger) }
        }
    }
}

/** Avis laissés sur les restaurants, avec la réponse du restaurant s'il y en a une. Un commentaire masqué par la modération n'est plus montré. */
@Composable
fun AvisClientScreen(onRetour: () -> Unit, onConnexion: () -> Unit, viewModel: EspaceClientViewModel = koinViewModel()) {
    CadreEspaceClient("Mes avis", onRetour, onConnexion, viewModel) { e ->
        Corps(e) {
            if (e.espace.avis.isEmpty()) Text("Vous n'avez laissé aucun avis. Après une commande terminée, vous pouvez noter le restaurant.", style = MaterialTheme.typography.bodyLarge)
            e.espace.avis.forEach { a -> CarteAvis(a) }
        }
    }
}

@Composable
private fun CarteAvis(a: AvisClient) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = Couleurs.Surface),
        border = BorderStroke(1.dp, Couleurs.Bordure),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(a.restaurantNom, style = MaterialTheme.typography.titleMedium)
                Text("★".repeat(a.note.coerceIn(0, 5)) + "☆".repeat(5 - a.note.coerceIn(0, 5)), style = MaterialTheme.typography.titleSmall, color = Couleurs.RougeFonce)
            }
            a.commentaire?.takeIf { it.isNotBlank() }?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
            if (a.statut != "publie") Text("En attente de modération", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            a.reponse?.takeIf { it.isNotBlank() }?.let { Text("Réponse du restaurant : $it", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}
