package com.speedfood.app.di

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AuthApi
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorCommandeApi
import com.speedfood.app.data.FournisseurPosition
import com.speedfood.app.data.KtorLivraisonApi
import com.speedfood.app.data.KtorLivreurApi
import com.speedfood.app.data.LivreurApi
import com.speedfood.app.data.PositionIndisponible
import com.speedfood.app.data.LivraisonApi
import com.speedfood.app.data.KtorRestaurantApi
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.ui.CommandeViewModel
import com.speedfood.app.ui.ConnexionViewModel
import com.speedfood.app.ui.LivreurViewModel
import com.speedfood.app.ui.MesCommandesViewModel
import com.speedfood.app.ui.RestaurantViewModel
import com.speedfood.app.ui.RestaurantsViewModel
import com.speedfood.app.ui.SuiviViewModel
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import org.koin.core.context.startKoin
import org.koin.core.module.dsl.factoryOf
import org.koin.dsl.module
import kotlin.time.Clock

fun modulesApplication(config: SpeedfoodConfig, stockage: StockageLocal, position: FournisseurPosition = PositionIndisponible()) = listOf(
    module {
        single { config }
        single { stockage }
        single { position }
        single {
            HttpClient {
                install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
                // Réseau mobile lent à Conakry : on attend, mais pas indéfiniment.
                install(HttpTimeout) {
                    requestTimeoutMillis = 20_000
                    connectTimeoutMillis = 10_000
                }
            }
        }
        single<RestaurantApi> { KtorRestaurantApi(get(), get()) }
        single<AuthApi> { KtorAuthApi(get(), get()) { Clock.System.now().epochSeconds } }
        single { SessionService(get(), get()) { Clock.System.now().epochSeconds } }
        single<CommandeApi> { KtorCommandeApi(get(), get()) }
        single<LivraisonApi> { KtorLivraisonApi(get(), get()) }
        single<LivreurApi> { KtorLivreurApi(get(), get()) }
        single { PanierService() }
        single { CommandesLocales(get()) }
        factoryOf(::RestaurantsViewModel)
        factory { parametres -> RestaurantViewModel(get(), parametres.get()) }
        factoryOf(::ConnexionViewModel)
        factoryOf(::CommandeViewModel)
        factoryOf(::MesCommandesViewModel)
        factoryOf(::LivreurViewModel)
        factory { parametres -> SuiviViewModel(get(), parametres.get()) }
    },
)

fun initKoin(config: SpeedfoodConfig, stockage: StockageLocal, position: FournisseurPosition = PositionIndisponible()) {
    startKoin { modules(modulesApplication(config, stockage, position)) }
}

/**
 * Suivi du livreur pour le service d'arrière-plan de la plateforme : même session, même client réseau que le reste de l'application (démarrée par [initKoin]).
 * Une nouvelle instance par démarrage du service, car elle garde la dernière position mesurée.
 */
fun suiviLivreurEnArrierePlan(): com.speedfood.app.data.SuiviLivreur = org.koin.mp.KoinPlatform.getKoin().let { com.speedfood.app.data.SuiviLivreur(it.get(), it.get()) }
