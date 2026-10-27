package com.speedfood.app

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.ProfilEntree
import com.speedfood.app.data.ProfilService
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.data.cleVisiteVue
import com.speedfood.app.data.visiteAProposer
import com.speedfood.app.design.Couleurs
import com.speedfood.app.ui.AccesProScreen
import com.speedfood.app.ui.AideScreen
import com.speedfood.app.ui.CandidatureScreen
import com.speedfood.app.ui.CompteRestaurateurScreen
import com.speedfood.app.ui.ConnexionScreen
import com.speedfood.app.ui.IconesApp
import com.speedfood.app.ui.LibelleOnglet
import com.speedfood.app.ui.ParametresScreen
import com.speedfood.app.ui.VisiteGuidee
import kotlinx.serialization.Serializable
import org.koin.compose.koinInject

/*
 * Une coque par profil. Le profil choisi à l'entrée décide de tout ce qui s'affiche : le consommateur a ses quatre onglets (ApplicationClient, dans App.kt), le restaurateur qui n'a pas encore
 * d'espace a « Mon restaurant » (ci-dessous), le professionnel non connecté a l'accès à son espace. On ne passe d'une coque à l'autre que par « Changer de profil » : jamais par une flèche retour.
 */

@Serializable private object InscriptionRestaurateur

@Serializable private object DemandeRestaurateur

@Serializable private object AideRestaurateur

@Serializable private object CompteRestaurateur

@Serializable private object ConnexionRestaurateur

@Serializable private object ParametresRestaurateur

@Serializable private object VisiteRestaurateur

private class OngletRestaurateur(val libelle: String, val icone: ImageVector, val route: Any)

/** « Retour » d'un écran de la coque : recule s'il y a un écran avant, sinon revient à la demande (jamais à une autre coque). */
private fun NavHostController.reculerOuDemande() {
    if (previousBackStackEntry != null) popBackStack() else navigate(DemandeRestaurateur) { popUpTo(0) }
}

/**
 * Coque du restaurateur qui n'a pas encore d'espace : créer son compte, puis « Mon restaurant » avec trois onglets (Ma demande, Aide, Compte). Rien du monde du client (ni restaurants, ni
 * panier, ni commandes). Dès que l'équipe a créé son établissement et rattaché son compte, l'application bascule seule dans son espace restaurateur.
 */
@Composable
internal fun CoqueRestaurateur(config: SpeedfoodConfig) {
    val session: SessionService = koinInject()
    val stockage: StockageLocal = koinInject()
    val espaces: EspaceService = koinInject()
    val profils: ProfilService = koinInject()
    val connecte by session.session.collectAsState()
    val droits by espaces.roles.collectAsState()
    val nav = rememberNavController()

    // Un restaurateur déjà référencé qui se connecte ici, ou dont l'équipe vient de rattacher le compte, entre dans son espace sans autre geste : les droits sont relus à chaque connexion
    // et à la reprise de l'application. (Pas d'« intention pro » ici : elle afficherait « aucun espace professionnel » à un candidat dont la demande est simplement en cours.)
    LaunchedEffect(droits) {
        if (droits?.espacesPro?.contains(Espace.Restaurateur) == true) espaces.entrer(Espace.Restaurateur)
    }

    // Après le compte : la visite du profil, une seule fois ; sinon directement la demande.
    fun suite() {
        val vues = listOf("visite_vue", cleVisiteVue(false), cleVisiteVue(true)).filter { stockage.lire(it) != null }.toSet()
        nav.navigate(if (visiteAProposer(true, vues)) VisiteRestaurateur else DemandeRestaurateur) { popUpTo(0) }
    }

    val depart: Any = remember { if (session.session.value == null) InscriptionRestaurateur else DemandeRestaurateur }
    val onglets = listOf(
        OngletRestaurateur("Ma demande", IconesApp.Restaurants, DemandeRestaurateur),
        OngletRestaurateur("Aide", IconesApp.Telephone, AideRestaurateur),
        OngletRestaurateur("Compte", IconesApp.Compte, CompteRestaurateur),
    )
    val entree by nav.currentBackStackEntryAsState()
    val destination = entree?.destination
    val barreVisible = connecte != null && onglets.any { o -> destination?.hierarchy?.any { it.hasRoute(o.route::class) } == true }
    fun versOnglet(route: Any) = nav.navigate(route) {
        popUpTo<DemandeRestaurateur> { saveState = true }
        launchSingleTop = true
        restoreState = true
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            if (barreVisible) {
                NavigationBar(containerColor = Couleurs.Surface) {
                    onglets.forEach { o ->
                        val choisi = destination?.hierarchy?.any { it.hasRoute(o.route::class) } == true
                        NavigationBarItem(
                            selected = choisi,
                            onClick = { if (!choisi) versOnglet(o.route) },
                            icon = { androidx.compose.material3.Icon(o.icone, contentDescription = null) },
                            label = { LibelleOnglet(o.libelle) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Couleurs.Encre,
                                selectedTextColor = Couleurs.Encre,
                                indicatorColor = Couleurs.Mangue,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                        )
                    }
                }
            }
        },
    ) { marges ->
        Box(Modifier.padding(marges)) {
            NavHost(navController = nav, startDestination = depart) {
                composable<InscriptionRestaurateur> {
                    ConnexionScreen(
                        onRetour = { profils.demanderChangement() },
                        onConnecte = { suite() },
                        inscriptionInitiale = true,
                        onVoirDabord = { profils.demanderChangement() },
                        libelleVoirDabord = "Ce n'est pas moi : changer de profil",
                        libelleRetourApresEnvoi = "Retour",
                        intro = "Créez votre compte pour inscrire votre restaurant. L'équipe Speedfood vous répond sous 48 h.",
                        avecContact = false,
                        introConnexion = "Connectez-vous avec votre compte Speedfood.",
                        messageConservation = null,
                    )
                }
                composable<ConnexionRestaurateur> {
                    ConnexionScreen(onRetour = { nav.reculerOuDemande() }, onConnecte = { nav.reculerOuDemande() })
                }
                composable<DemandeRestaurateur> {
                    CandidatureScreen(
                        onRetour = {},
                        avecRetour = false,
                        onConnexion = { nav.navigate(ConnexionRestaurateur) },
                        onAide = { versOnglet(AideRestaurateur) },
                    )
                }
                composable<AideRestaurateur> { AideScreen(onRetour = {}, avecRetour = false) }
                composable<CompteRestaurateur> {
                    CompteRestaurateurScreen(onParametres = { nav.navigate(ParametresRestaurateur) })
                }
                composable<ParametresRestaurateur> {
                    ParametresScreen(onRetour = { nav.reculerOuDemande() }, onVisite = { nav.navigate(VisiteRestaurateur) })
                }
                composable<VisiteRestaurateur> {
                    VisiteGuidee(restaurateur = true) {
                        stockage.ecrire(cleVisiteVue(true), "1")
                        nav.reculerOuDemande()
                    }
                }
            }
        }
    }
}

@Serializable private object AccesProfessionnel

@Serializable private object ConnexionProfessionnel

@Serializable private object AideProfessionnel

/**
 * Coque du professionnel (livreur, équipe) qui n'est pas encore entré dans son espace : l'accès à son espace et rien d'autre. « Retour » ramène à l'écran de choix du profil.
 * Une fois connecté avec un compte qui a un espace, l'application bascule seule dans cet espace.
 */
@Composable
internal fun CoqueProfessionnel(config: SpeedfoodConfig) {
    val profils: ProfilService = koinInject()
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = AccesProfessionnel) {
        composable<AccesProfessionnel> {
            AccesProScreen(
                onRetour = { profils.demanderChangement() },
                onConnexion = { nav.navigate(ConnexionProfessionnel) },
                onAide = { nav.navigate(AideProfessionnel) },
                // Un restaurateur qui s'est trompé de profil bascule dans la coque du restaurateur (le compte est créé là), sans passer par le client.
                onInscrireRestaurant = { profils.choisir(ProfilEntree.Restaurateur) },
            )
        }
        composable<ConnexionProfessionnel> {
            ConnexionScreen(onRetour = { nav.popBackStack() }, onConnecte = { nav.popBackStack() })
        }
        composable<AideProfessionnel> { AideScreen(onRetour = { nav.popBackStack() }) }
    }
}
