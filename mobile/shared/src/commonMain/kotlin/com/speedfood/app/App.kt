package com.speedfood.app

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.design.SpeedfoodTheme
import com.speedfood.app.ui.BandeauMiseAJour
import com.speedfood.app.ui.CommandeScreen
import com.speedfood.app.ui.EquipeScreen
import com.speedfood.app.ui.RepartitionScreen
import com.speedfood.app.ui.ConnexionScreen
import com.speedfood.app.ui.CLE_VISITE_VUE
import com.speedfood.app.ui.EcranOuverture
import com.speedfood.app.ui.EntreeScreen
import com.speedfood.app.ui.VisiteGuidee
import com.speedfood.app.ui.LivreurScreen
import com.speedfood.app.ui.MenuRestaurateurScreen
import com.speedfood.app.ui.MesCommandesScreen
import com.speedfood.app.ui.PanierScreen
import com.speedfood.app.ui.RestaurantScreen
import com.speedfood.app.ui.RestaurantsScreen
import com.speedfood.app.ui.RestaurateurScreen
import com.speedfood.app.ui.SuiviScreen
import kotlinx.serialization.Serializable
import org.koin.compose.koinInject

@Serializable
object EntreeDestination

@Serializable
object RestaurantsDestination

@Serializable
data class RestaurantDestination(val id: String)

@Serializable
object RestaurateurDestination

@Serializable
object ConnexionDestination

@Serializable
object PanierDestination

@Serializable
object CommandeDestination

@Serializable
data class SuiviDestination(val jeton: String)

@Serializable
object MesCommandesDestination

@Serializable
object LivreurDestination

@Serializable
object VisiteDestination

@Serializable
object MenuRestaurateurDestination

@Serializable
object EquipeDestination

@Serializable
object RepartitionDestination

/** Les trois temps du lancement : le logo s'anime, la visite guidée (une seule fois, au premier lancement), puis l'application. */
private enum class Phase { Ouverture, Visite, Application }

@Composable
fun App(config: SpeedfoodConfig) {
    SpeedfoodTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            val stockage: StockageLocal = koinInject()
            var phase by remember { mutableStateOf(Phase.Ouverture) }
            Crossfade(phase, animationSpec = tween(450)) { courante ->
                when (courante) {
                    Phase.Ouverture -> EcranOuverture {
                        phase = if (stockage.lire(CLE_VISITE_VUE) == null) Phase.Visite else Phase.Application
                    }
                    Phase.Visite -> VisiteGuidee {
                        stockage.ecrire(CLE_VISITE_VUE, "1")
                        phase = Phase.Application
                    }
                    Phase.Application -> Box {
                        Application(config)
                        BandeauMiseAJour(Modifier.align(Alignment.TopCenter))
                    }
                }
            }
        }
    }
}

@Composable
private fun Application(config: SpeedfoodConfig) {
        val navController: NavHostController = rememberNavController()
        NavHost(navController = navController, startDestination = EntreeDestination) {
            composable<EntreeDestination> {
                EntreeScreen(
                    onClient = { navController.navigate(RestaurantsDestination) },
                    onRestaurateur = { navController.navigate(RestaurateurDestination) },
                    onLivreur = { navController.navigate(LivreurDestination) },
                    onEquipe = { navController.navigate(EquipeDestination) },
                    onVisite = { navController.navigate(VisiteDestination) },
                )
            }
            composable<RestaurantsDestination> {
                RestaurantsScreen(
                    onRetour = { navController.popBackStack() },
                    onOuvrir = { id -> navController.navigate(RestaurantDestination(id)) },
                    onPanier = { navController.navigate(PanierDestination) },
                    onCompte = { navController.navigate(MesCommandesDestination) },
                )
            }
            composable<RestaurantDestination> { entree ->
                RestaurantScreen(
                    restaurantId = entree.toRoute<RestaurantDestination>().id,
                    onRetour = { navController.popBackStack() },
                    onPanier = { navController.navigate(PanierDestination) },
                )
            }
            composable<PanierDestination> {
                PanierScreen(
                    onRetour = { navController.popBackStack() },
                    onCommander = { navController.navigate(CommandeDestination) },
                    onVoirRestaurant = { id -> navController.navigate(RestaurantDestination(id)) },
                )
            }
            composable<CommandeDestination> {
                CommandeScreen(
                    onRetour = { navController.popBackStack() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    // Après l'envoi, on arrive sur le suivi ; « retour » ramène à la liste des restaurants, pas au panier vidé.
                    onEnvoyee = { jeton -> navController.navigate(SuiviDestination(jeton)) { popUpTo<RestaurantsDestination>() } },
                )
            }
            composable<ConnexionDestination> {
                ConnexionScreen(onRetour = { navController.popBackStack() }, onConnecte = { navController.popBackStack() })
            }
            composable<SuiviDestination> { entree ->
                SuiviScreen(jeton = entree.toRoute<SuiviDestination>().jeton, onRetour = { navController.popBackStack() })
            }
            composable<MesCommandesDestination> {
                MesCommandesScreen(
                    onRetour = { navController.popBackStack() },
                    onOuvrir = { jeton -> navController.navigate(SuiviDestination(jeton)) },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onPanier = { navController.navigate(PanierDestination) },
                )
            }
            composable<VisiteDestination> {
                VisiteGuidee { navController.popBackStack() }
            }
            composable<LivreurDestination> {
                LivreurScreen(onRetour = { navController.popBackStack() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<RestaurateurDestination> {
                RestaurateurScreen(siteUrl = config.siteUrl, onRetour = { navController.popBackStack() }, onConnexion = { navController.navigate(ConnexionDestination) }, onMenu = { navController.navigate(MenuRestaurateurDestination) })
            }
            composable<EquipeDestination> {
                EquipeScreen(
                    siteUrl = config.siteUrl,
                    onRetour = { navController.popBackStack() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onRepartition = { navController.navigate(RepartitionDestination) },
                )
            }
            composable<RepartitionDestination> {
                RepartitionScreen(onRetour = { navController.popBackStack() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<MenuRestaurateurDestination> {
                MenuRestaurateurScreen(onRetour = { navController.popBackStack() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
        }
}
