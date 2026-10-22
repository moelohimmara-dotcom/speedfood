package com.speedfood.app.di

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AuthApi
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.EquipeApi
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorEquipeApi
import com.speedfood.app.data.KtorVersionApi
import com.speedfood.app.data.NotificateurMiseAJour
import com.speedfood.app.data.NotificateurIndisponible
import com.speedfood.app.data.PhotoIndisponible
import com.speedfood.app.data.SelecteurPhoto
import com.speedfood.app.data.SuiviMiseAJour
import com.speedfood.app.data.VersionApi
import com.speedfood.app.data.KtorCommandeApi
import com.speedfood.app.data.AlerteCommande
import com.speedfood.app.data.AppareilApi
import com.speedfood.app.data.EnregistrementPush
import com.speedfood.app.data.FournisseurGoogle
import com.speedfood.app.data.FournisseurJetonPush
import com.speedfood.app.data.GoogleIndisponible
import com.speedfood.app.data.JetonPushIndisponible
import com.speedfood.app.data.KtorAppareilApi
import com.speedfood.app.data.AlerteIndisponible
import com.speedfood.app.data.FournisseurPosition
import com.speedfood.app.data.KtorRestaurateurApi
import com.speedfood.app.data.RestaurateurApi
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
import com.speedfood.app.ui.EquipeViewModel
import com.speedfood.app.ui.RepartitionViewModel
import com.speedfood.app.ui.SupportViewModel
import com.speedfood.app.ui.DetailSupportViewModel
import com.speedfood.app.ui.ConnexionViewModel
import com.speedfood.app.ui.LivreurViewModel
import com.speedfood.app.ui.MenuRestaurateurViewModel
import com.speedfood.app.ui.MesCommandesViewModel
import com.speedfood.app.ui.RestaurantViewModel
import com.speedfood.app.ui.RestaurantsViewModel
import com.speedfood.app.ui.RestaurateurViewModel
import com.speedfood.app.ui.SuiviViewModel
import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json
import org.koin.core.context.startKoin
import org.koin.core.module.dsl.factoryOf
import org.koin.dsl.module
import kotlinx.coroutines.launch
import kotlin.time.Clock

fun modulesApplication(
    config: SpeedfoodConfig,
    stockage: StockageLocal,
    position: FournisseurPosition = PositionIndisponible(),
    alerte: AlerteCommande = AlerteIndisponible(),
    jetonPush: FournisseurJetonPush = JetonPushIndisponible(),
    plateforme: String = "android",
    versionApp: String? = null,
    google: FournisseurGoogle = GoogleIndisponible(),
    codeVersionApp: Int = 0,
    notificateurMiseAJour: NotificateurMiseAJour = NotificateurIndisponible(),
    selecteurPhoto: SelecteurPhoto = PhotoIndisponible(),
) = listOf(
    module {
        single { config }
        single { stockage }
        single { position }
        single { alerte }
        single { jetonPush }
        single { google }
        single { notificateurMiseAJour }
        single { selecteurPhoto }
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
        single<RestaurateurApi> { KtorRestaurateurApi(get(), get()) }
        single<EquipeApi> { KtorEquipeApi(get(), get()) }
        single<AppareilApi> { KtorAppareilApi(get(), get()) }
        single<VersionApi> { KtorVersionApi(get(), get()) }
        single { SuiviMiseAJour(get(), get(), codeVersionApp, get(), get()) }
        single { EnregistrementPush(get(), get(), get(), get(), plateforme, versionApp) }
        single { PanierService() }
        single { CommandesLocales(get()) }
        factoryOf(::RestaurantsViewModel)
        factory { parametres -> RestaurantViewModel(get(), parametres.get()) }
        factoryOf(::ConnexionViewModel)
        factoryOf(::CommandeViewModel)
        factoryOf(::MesCommandesViewModel)
        factoryOf(::LivreurViewModel)
        factoryOf(::RestaurateurViewModel)
        factoryOf(::MenuRestaurateurViewModel)
        factoryOf(::EquipeViewModel)
        factoryOf(::RepartitionViewModel)
        factoryOf(::SupportViewModel)
        factory { parametres -> DetailSupportViewModel(get(), get(), parametres.get()) }
        factory { parametres -> SuiviViewModel(get(), parametres.get()) }
    },
)

fun initKoin(
    config: SpeedfoodConfig,
    stockage: StockageLocal,
    position: FournisseurPosition = PositionIndisponible(),
    alerte: AlerteCommande = AlerteIndisponible(),
    jetonPush: FournisseurJetonPush = JetonPushIndisponible(),
    plateforme: String = "android",
    versionApp: String? = null,
    google: FournisseurGoogle = GoogleIndisponible(),
    codeVersionApp: Int = 0,
    notificateurMiseAJour: NotificateurMiseAJour = NotificateurIndisponible(),
    selecteurPhoto: SelecteurPhoto = PhotoIndisponible(),
) {
    startKoin { modules(modulesApplication(config, stockage, position, alerte, jetonPush, plateforme, versionApp, google, codeVersionApp, notificateurMiseAJour, selecteurPhoto)) }
}

/**
 * Lie l'appareil au compte connecté pour les notifications poussées : enregistre à chaque connexion (et dès le démarrage si une session existe). À appeler une fois au
 * démarrage de l'application, avec une portée qui vit autant qu'elle ; les changements de jeton rappellent [enregistrerAppareilPush].
 */
fun lancerEnregistrementPush(portee: kotlinx.coroutines.CoroutineScope) {
    val koin = org.koin.mp.KoinPlatform.getKoin()
    val session: com.speedfood.app.data.SessionService = koin.get()
    val enregistrement: EnregistrementPush = koin.get()
    portee.launch {
        session.session.collect { if (it != null) enregistrement.enregistrer() }
    }
}

/** Rejoue l'enregistrement de l'appareil (nouveau jeton fourni par la plateforme). */
suspend fun enregistrerAppareilPush() {
    org.koin.mp.KoinPlatform.getKoin().get<EnregistrementPush>().enregistrer()
}

/**
 * Suivi du livreur pour le service d'arrière-plan de la plateforme : même session, même client réseau que le reste de l'application (démarrée par [initKoin]).
 * Une nouvelle instance par démarrage du service, car elle garde la dernière position mesurée.
 */
/** Surveillance des commandes pour le service d'arrière-plan du restaurateur (même session et même client réseau que le reste de l'application). */
fun surveillanceCommandesEnArrierePlan(): com.speedfood.app.data.SurveillanceCommandes = org.koin.mp.KoinPlatform.getKoin().let { com.speedfood.app.data.SurveillanceCommandes(it.get(), it.get()) }

fun suiviLivreurEnArrierePlan(): com.speedfood.app.data.SuiviLivreur = org.koin.mp.KoinPlatform.getKoin().let { com.speedfood.app.data.SuiviLivreur(it.get(), it.get()) }
