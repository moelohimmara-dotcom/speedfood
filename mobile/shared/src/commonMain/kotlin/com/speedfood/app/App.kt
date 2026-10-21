package com.speedfood.app

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.design.SpeedfoodTheme
import com.speedfood.app.ui.CommandeScreen
import com.speedfood.app.ui.ConnexionScreen
import com.speedfood.app.ui.EntreeScreen
import com.speedfood.app.ui.MesCommandesScreen
import com.speedfood.app.ui.PanierScreen
import com.speedfood.app.ui.RestaurantScreen
import com.speedfood.app.ui.RestaurantsScreen
import com.speedfood.app.ui.RestaurateurBientotScreen
import com.speedfood.app.ui.SuiviScreen
import kotlinx.serialization.Serializable

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

@Composable
fun App(config: SpeedfoodConfig) {
    SpeedfoodTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            val navController: NavHostController = rememberNavController()
            NavHost(navController = navController, startDestination = EntreeDestination) {
                composable<EntreeDestination> {
                    EntreeScreen(
                        onClient = { navController.navigate(RestaurantsDestination) },
                        onRestaurateur = { navController.navigate(RestaurateurDestination) },
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
                composable<RestaurateurDestination> {
                    RestaurateurBientotScreen(siteUrl = config.siteUrl, onRetour = { navController.popBackStack() })
                }
            }
        }
    }
}
