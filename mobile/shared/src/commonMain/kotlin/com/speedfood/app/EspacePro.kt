package com.speedfood.app

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.ui.unit.dp
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.Espace
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.VerrouEspacesPro
import com.speedfood.app.ui.EcranVerrou
import com.speedfood.app.design.Couleurs
import com.speedfood.app.ui.ActiviteRestaurantScreen
import com.speedfood.app.ui.AideScreen
import com.speedfood.app.ui.AvisEquipeScreen
import com.speedfood.app.ui.PaiementsEquipeScreen
import com.speedfood.app.ui.ReferencementsEquipeScreen
import com.speedfood.app.ui.RestaurantsEquipeScreen
import com.speedfood.app.ui.GainsLivreurScreen
import com.speedfood.app.ui.CompteProScreen
import com.speedfood.app.ui.ConnexionScreen
import com.speedfood.app.ui.DetailSupportScreen
import com.speedfood.app.ui.EquipeScreen
import com.speedfood.app.ui.LivraisonsEquipeScreen
import com.speedfood.app.ui.LivreurScreen
import com.speedfood.app.ui.LivreursEquipeScreen
import com.speedfood.app.ui.LocalRetourVisible
import com.speedfood.app.ui.MenuRestaurateurScreen
import com.speedfood.app.ui.MenusEquipeScreen
import com.speedfood.app.ui.ParametresScreen
import com.speedfood.app.ui.RepartitionScreen
import com.speedfood.app.ui.RestaurateurScreen
import com.speedfood.app.ui.SupportCommandesScreen
import com.speedfood.app.ui.VisiteGuidee
import kotlinx.serialization.Serializable
import org.koin.compose.koinInject

@Serializable
object CompteProDestination

@Serializable
object ActiviteDestination

@Serializable
object AvisEquipeDestination

@Serializable
object PaiementsEquipeDestination

@Serializable
object ReferencementsEquipeDestination

@Serializable
object RestaurantsEquipeDestination

@Serializable
object GainsDestination

private class OngletPro(val libelle: String, val icone: ImageVector, val route: Any)

private fun ongletsDe(espace: Espace): List<OngletPro> = when (espace) {
    Espace.Restaurateur -> listOf(
        OngletPro("Commandes", Icons.Default.Notifications, RestaurateurDestination),
        OngletPro("Menu", Icons.Default.List, MenuRestaurateurDestination),
        OngletPro("Activité", Icons.Default.Info, ActiviteDestination),
        OngletPro("Compte", Icons.Default.Person, CompteProDestination),
    )
    Espace.Livreur -> listOf(
        OngletPro("Courses", Icons.Default.Notifications, LivreurDestination),
        OngletPro("Gains", Icons.Default.Info, GainsDestination),
        OngletPro("Compte", Icons.Default.Person, CompteProDestination),
    )
    Espace.Equipe -> listOf(
        OngletPro("Tableau", Icons.Default.Home, EquipeDestination),
        OngletPro("Commandes", Icons.Default.List, SupportDestination),
        OngletPro("Livraisons", Icons.Default.Notifications, LivraisonsEquipeDestination),
        OngletPro("Compte", Icons.Default.Person, CompteProDestination),
    )
    Espace.Client -> emptyList()
}

@Composable
private fun sansFleche(contenu: @Composable () -> Unit) {
    CompositionLocalProvider(LocalRetourVisible provides false) { contenu() }
}

private fun racineDe(espace: Espace): Any = ongletsDe(espace).first().route

/**
 * Coque d'un espace professionnel (restaurateur, livreur, équipe) : sa propre barre de navigation, sombre pour ne jamais être confondue avec celle du client, ses
 * propres onglets, et aucune flèche « retour » à la racine d'un onglet. On en sort par Compte, « Espace client ».
 */
@Composable
fun EspacePro(espace: Espace, config: SpeedfoodConfig, verrou: VerrouEspacesPro = koinInject()) {
    // Verrou optionnel (Paramètres) : jamais actif sans verrouillage d'écran sur le téléphone, pour ne pas bloquer un restaurateur devant une commande.
    val actif by verrou.actif.collectAsState()
    val deverrouille by verrou.deverrouille.collectAsState()
    if (actif && !deverrouille && verrou.disponible()) EcranVerrou(espace) else CoquePro(espace, config)
}

@Composable
private fun CoquePro(espace: Espace, config: SpeedfoodConfig, espaces: EspaceService = koinInject()) {
    val navController = rememberNavController()
    val entree by navController.currentBackStackEntryAsState()
    val destination = entree?.destination
    val onglets = ongletsDe(espace)
    val barreVisible = onglets.any { o -> destination?.hierarchy?.any { it.hasRoute(o.route::class) } == true }
    val racine = racineDe(espace)
    fun versOnglet(route: Any) = navController.navigate(route) {
        popUpTo(racine) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
    val vers = { route: Any -> navController.navigate(route) }
    val retour: () -> Unit = { navController.popBackStack() }
    val connexion = { navController.navigate(ConnexionDestination) }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            if (barreVisible) {
                NavigationBar(containerColor = Couleurs.Encre) {
                    onglets.forEach { o ->
                        val choisi = destination?.hierarchy?.any { it.hasRoute(o.route::class) } == true
                        NavigationBarItem(
                            selected = choisi,
                            onClick = { if (!choisi) versOnglet(o.route) },
                            icon = { Icon(o.icone, contentDescription = null) },
                            label = { Text(o.libelle, style = MaterialTheme.typography.labelMedium) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Couleurs.Encre,
                                selectedTextColor = Couleurs.Mangue,
                                indicatorColor = Couleurs.Mangue,
                                unselectedIconColor = Couleurs.Creme,
                                unselectedTextColor = Couleurs.Creme,
                            ),
                        )
                    }
                }
            }
        },
    ) { interieur ->
        Column(Modifier.padding(interieur).consumeWindowInsets(interieur)) {
            BandeauEspace(espace)
            Box(Modifier.weight(1f).consumeWindowInsets(WindowInsets.statusBars)) {
            NavHost(navController = navController, startDestination = racine) {
                composable<RestaurateurDestination> {
                    sansFleche { RestaurateurScreen(siteUrl = config.siteUrl, onRetour = { espaces.quitter() }, onConnexion = connexion, onMenu = { versOnglet(MenuRestaurateurDestination) }) }
                }
                composable<MenuRestaurateurDestination> {
                    sansFleche { MenuRestaurateurScreen(onRetour = { versOnglet(RestaurateurDestination) }, onConnexion = connexion) }
                }
                composable<LivreurDestination> {
                    sansFleche { LivreurScreen(onRetour = { espaces.quitter() }, onConnexion = connexion) }
                }
                composable<EquipeDestination> {
                    sansFleche {
                        EquipeScreen(
                            siteUrl = config.siteUrl,
                            onRetour = { espaces.quitter() },
                            onConnexion = connexion,
                            onRepartition = { vers(RepartitionDestination) },
                            onSupport = { versOnglet(SupportDestination) },
                            onLivraisons = { versOnglet(LivraisonsEquipeDestination) },
                            onLivreurs = { vers(LivreursEquipeDestination) },
                            onParametres = { vers(ParametresDestination) },
                            onMenus = { vers(MenusEquipeDestination) },
                            onAvis = { vers(AvisEquipeDestination) },
                            onPaiements = { vers(PaiementsEquipeDestination) },
                            onReferencements = { vers(ReferencementsEquipeDestination) },
                            onRestaurants = { vers(RestaurantsEquipeDestination) },
                        )
                    }
                }
                composable<SupportDestination> {
                    sansFleche { SupportCommandesScreen(onRetour = { versOnglet(EquipeDestination) }, onConnexion = connexion, onOuvrir = { id -> vers(DetailSupportDestination(id)) }) }
                }
                composable<LivraisonsEquipeDestination> {
                    sansFleche { LivraisonsEquipeScreen(onRetour = { versOnglet(EquipeDestination) }, onConnexion = connexion) }
                }
                composable<DetailSupportDestination> { e ->
                    DetailSupportScreen(commandeId = e.toRoute<DetailSupportDestination>().id, onRetour = retour, onConnexion = connexion)
                }
                composable<RepartitionDestination> { RepartitionScreen(onRetour = retour, onConnexion = connexion) }
                composable<LivreursEquipeDestination> { LivreursEquipeScreen(onRetour = retour, onConnexion = connexion) }
                composable<MenusEquipeDestination> { MenusEquipeScreen(onRetour = retour, onConnexion = connexion) }
                composable<AvisEquipeDestination> { AvisEquipeScreen(onRetour = retour, onConnexion = connexion) }
                composable<ReferencementsEquipeDestination> { ReferencementsEquipeScreen(siteUrl = config.siteUrl, onRetour = retour, onConnexion = connexion) }
                composable<RestaurantsEquipeDestination> { RestaurantsEquipeScreen(siteUrl = config.siteUrl, onRetour = retour, onConnexion = connexion) }
                composable<PaiementsEquipeDestination> { PaiementsEquipeScreen(siteUrl = config.siteUrl, onRetour = retour, onConnexion = connexion) }
                composable<ActiviteDestination> { sansFleche { ActiviteRestaurantScreen(onConnexion = connexion) } }
                composable<GainsDestination> { sansFleche { GainsLivreurScreen(onConnexion = connexion) } }
                composable<CompteProDestination> {
                    CompteProScreen(espace = espace, onParametres = { vers(ParametresDestination) }, onAide = { vers(AideDestination) })
                }
                composable<ParametresDestination> { ParametresScreen(onRetour = retour, onVisite = { vers(VisiteDestination) }) }
                composable<AideDestination> { AideScreen(onRetour = retour) }
                composable<VisiteDestination> { VisiteGuidee { navController.popBackStack() } }
                composable<ConnexionDestination> { ConnexionScreen(onRetour = retour, onConnecte = retour) }
            }
            }
        }
    }
}

/** Bande d'identité en haut d'un espace professionnel : on sait toujours dans quel espace (et pour quel restaurant) on agit. */
@Composable
private fun BandeauEspace(espace: Espace, espaces: EspaceService = koinInject()) {
    val roles by espaces.roles.collectAsState()
    val detail = when (espace) {
        Espace.Restaurateur -> roles?.restaurateur?.restaurant
        else -> null
    }
    Surface(Modifier.fillMaxWidth(), color = Couleurs.Encre) {
        Text(
            espace.libelle + (detail?.let { " · $it" } ?: ""),
            style = MaterialTheme.typography.labelLarge,
            color = Couleurs.Mangue,
            maxLines = 1,
            modifier = Modifier.statusBarsPadding().padding(horizontal = 16.dp, vertical = 6.dp),
        )
    }
}
