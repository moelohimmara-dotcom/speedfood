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
import com.speedfood.app.ui.RestaurantScreen
import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.design.SpeedfoodTheme
import com.speedfood.app.ui.EntreeScreen
import com.speedfood.app.ui.RestaurantsScreen
import com.speedfood.app.ui.RestaurateurBientotScreen
import kotlinx.serialization.Serializable

@Serializable
object EntreeDestination

@Serializable
object RestaurantsDestination

@Serializable
data class RestaurantDestination(val id: String)

@Serializable
object RestaurateurDestination

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
                    )
                }
                composable<RestaurantDestination> { entree ->
                    RestaurantScreen(restaurantId = entree.toRoute<RestaurantDestination>().id, onRetour = { navController.popBackStack() })
                }
                composable<RestaurateurDestination> {
                    RestaurateurBientotScreen(siteUrl = config.siteUrl, onRetour = { navController.popBackStack() })
                }
            }
        }
    }
}
