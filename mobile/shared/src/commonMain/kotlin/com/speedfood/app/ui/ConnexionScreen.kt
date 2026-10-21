package com.speedfood.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.speedfood.app.design.Couleurs
import org.koin.compose.viewmodel.koinViewModel

@Composable
internal fun ChampTexte(valeur: String, surChangement: (String) -> Unit, libelle: String, clavier: KeyboardType = KeyboardType.Text, secret: Boolean = false, aide: String? = null) {
    OutlinedTextField(
        value = valeur,
        onValueChange = surChangement,
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text(libelle) },
        supportingText = aide?.let { { Text(it) } },
        keyboardOptions = KeyboardOptions(keyboardType = clavier),
        visualTransformation = if (secret) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        shape = MaterialTheme.shapes.medium,
    )
}

@Composable
internal fun BoutonPrincipal(texte: String, actif: Boolean = true, surClic: () -> Unit) {
    Button(
        onClick = surClic,
        enabled = actif,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.buttonColors(containerColor = Couleurs.RougeFonce, contentColor = Couleurs.Creme),
    ) { Text(texte, style = MaterialTheme.typography.labelLarge) }
}

@Composable
internal fun BlocMessage(texte: String, erreur: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(containerColor = if (erreur) Couleurs.DangerFond else Couleurs.AvertissementFond),
        border = BorderStroke(1.dp, if (erreur) Couleurs.Danger else Couleurs.Bordure),
    ) {
        Text(texte, Modifier.padding(12.dp), style = MaterialTheme.typography.bodyMedium, color = if (erreur) Couleurs.Danger else Couleurs.AvertissementTexte)
    }
}

/** Connexion et création de compte client (même compte que le site). Un compte est nécessaire pour envoyer une commande. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConnexionScreen(onRetour: () -> Unit, onConnecte: () -> Unit, viewModel: ConnexionViewModel = koinViewModel()) {
    val etat by viewModel.etat.collectAsState()
    var inscription by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var motDePasse by remember { mutableStateOf("") }
    var nom by remember { mutableStateOf("") }
    var telephone by remember { mutableStateOf("") }

    Scaffold(
        modifier = Modifier.safeDrawingPadding(),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(if (inscription) "Créer mon compte" else "Connexion", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onRetour) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { marges ->
        Column(Modifier.fillMaxSize().padding(marges).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(false to "Se connecter", true to "Créer un compte").forEach { (valeur, texte) ->
                    FilterChip(
                        selected = inscription == valeur,
                        onClick = { inscription = valeur; viewModel.effacerErreur() },
                        label = { Text(texte, style = MaterialTheme.typography.labelMedium) },
                        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Couleurs.Mangue, selectedLabelColor = Couleurs.Encre),
                    )
                }
            }
            Text(
                "Un compte client est nécessaire pour envoyer une commande. Le même compte fonctionne sur le site Speedfood.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (etat.inscriptionEnvoyee != null) {
                BlocMessage(
                    "Vérifiez votre boîte de réception : un e-mail vient d'être envoyé à ${etat.inscriptionEnvoyee} pour confirmer votre adresse. " +
                        "Si cette adresse a déjà un compte, aucun e-mail n'est envoyé : connectez-vous. Une fois l'adresse confirmée, revenez vous connecter ici.",
                    erreur = false,
                )
            } else {
                if (inscription) {
                    ChampTexte(nom, { nom = it }, "Nom")
                    ChampTexte(telephone, { telephone = it }, "Téléphone", KeyboardType.Phone, aide = "Numéro guinéen, par exemple 622 12 34 56")
                }
                ChampTexte(email, { email = it }, "Adresse e-mail", KeyboardType.Email)
                ChampTexte(motDePasse, { motDePasse = it }, "Mot de passe", KeyboardType.Password, secret = true, aide = if (inscription) "12 caractères au moins" else null)
                etat.erreur?.let { BlocMessage(it, erreur = true) }
                BoutonPrincipal(
                    texte = if (etat.enCours) "Veuillez patienter…" else if (inscription) "Créer mon compte" else "Se connecter",
                    actif = !etat.enCours,
                ) {
                    if (inscription) viewModel.inscrire(nom, telephone, email, motDePasse) else viewModel.connecter(email, motDePasse, onConnecte)
                }
            }
        }
    }
}
