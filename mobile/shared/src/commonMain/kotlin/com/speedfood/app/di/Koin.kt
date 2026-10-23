package com.speedfood.app.di

import com.speedfood.app.config.SpeedfoodConfig
import com.speedfood.app.data.AuthApi
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.ActiviteApi
import com.speedfood.app.data.AideApi
import com.speedfood.app.data.AvisEquipeApi
import com.speedfood.app.data.KtorPaiementsEquipeApi
import com.speedfood.app.data.PaiementsEquipeApi
import com.speedfood.app.data.KtorReferencementsEquipeApi
import com.speedfood.app.data.ReferencementsEquipeApi
import com.speedfood.app.data.KtorRestaurantsEquipeApi
import com.speedfood.app.data.RestaurantsEquipeApi
import com.speedfood.app.data.KtorPartenariatsEquipeApi
import com.speedfood.app.data.PartenariatsEquipeApi
import com.speedfood.app.data.KtorListeAttenteEquipeApi
import com.speedfood.app.data.ListeAttenteEquipeApi
import com.speedfood.app.data.KtorComptesEquipeApi
import com.speedfood.app.data.ComptesEquipeApi
import com.speedfood.app.data.KtorAvisEquipeApi
import com.speedfood.app.data.KtorActiviteApi
import com.speedfood.app.data.ClientApi
import com.speedfood.app.data.KtorClientApi
import com.speedfood.app.data.InfosApplication
import com.speedfood.app.data.KtorAideApi
import com.speedfood.app.data.EquipeApi
import com.speedfood.app.data.KtorAuthApi
import com.speedfood.app.data.KtorEquipeApi
import com.speedfood.app.data.KtorVersionApi
import com.speedfood.app.data.DeconnexionService
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.ReactionAcces
import io.ktor.client.plugins.HttpSend
import io.ktor.client.plugins.plugin
import io.ktor.http.HttpHeaders
import com.speedfood.app.data.DemandeNotifications
import com.speedfood.app.data.InstallateurApk
import com.speedfood.app.data.NotificationsIndisponibles
import com.speedfood.app.data.VerrouAppareil
import com.speedfood.app.data.VerrouEspacesPro
import com.speedfood.app.data.VerrouIndisponible
import com.speedfood.app.data.KtorMoiApi
import com.speedfood.app.data.MoiApi
import com.speedfood.app.data.InstallateurIndisponible
import com.speedfood.app.data.InstallationMiseAJour
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
import com.speedfood.app.data.RestaurantApiAvecCache
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.StockageLocal
import com.speedfood.app.ui.CommandeViewModel
import com.speedfood.app.ui.EquipeViewModel
import com.speedfood.app.ui.RepartitionViewModel
import com.speedfood.app.ui.SupportViewModel
import com.speedfood.app.ui.CompteViewModel
import com.speedfood.app.ui.EspaceClientViewModel
import com.speedfood.app.ui.ExploitationViewModel
import com.speedfood.app.ui.ActiviteRestaurantViewModel
import com.speedfood.app.ui.AvisEquipeViewModel
import com.speedfood.app.ui.PaiementsEquipeViewModel
import com.speedfood.app.ui.ReferencementsEquipeViewModel
import com.speedfood.app.ui.RestaurantsEquipeViewModel
import com.speedfood.app.ui.PartenariatsEquipeViewModel
import com.speedfood.app.ui.ListeAttenteEquipeViewModel
import com.speedfood.app.ui.ComptesEquipeViewModel
import com.speedfood.app.ui.GainsLivreurViewModel
import com.speedfood.app.ui.MenusEquipeViewModel
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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
    installateurApk: InstallateurApk = InstallateurIndisponible(),
    demandeNotifications: DemandeNotifications = NotificationsIndisponibles(),
    verrouAppareil: VerrouAppareil = VerrouIndisponible(),
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
        single { installateurApk }
        single { demandeNotifications }
        single { VerrouEspacesPro(get(), verrouAppareil) }
        single { InstallationMiseAJour(get(), CoroutineScope(SupervisorJob() + Dispatchers.Default), config.siteUrl) }
        single { ReactionAcces() }
        single {
            val reaction: ReactionAcces = get()
            HttpClient {
                install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
                // Réseau mobile lent à Conakry : on attend, mais pas indéfiniment.
                install(HttpTimeout) {
                    requestTimeoutMillis = 20_000
                    connectTimeoutMillis = 10_000
                }
            }.also { client ->
                // Un 401/403 sur un appel authentifié n'est PAS une coupure du réseau : il est signalé au service d'accès (session expirée, droit retiré).
                client.plugin(HttpSend).intercept { requete ->
                    val appel = execute(requete)
                    val autorisation = requete.headers[HttpHeaders.Authorization]
                    val statut = appel.response.status.value
                    if ((statut == 401 || statut == 403) && autorisation != null && autorisation.startsWith("Bearer ")) {
                        reaction.signaler(statut, requete.url.build().encodedPath, autorisation.removePrefix("Bearer "))
                    }
                    appel
                }
            }
        }
        single<RestaurantApi> { RestaurantApiAvecCache(KtorRestaurantApi(get(), get()), get()) }
        single<AuthApi> { KtorAuthApi(get(), get()) { Clock.System.now().epochSeconds } }
        single { SessionService(get(), get()) { Clock.System.now().epochSeconds } }
        single<CommandeApi> { KtorCommandeApi(get(), get()) }
        single<LivraisonApi> { KtorLivraisonApi(get(), get()) }
        single<LivreurApi> { KtorLivreurApi(get(), get()) }
        single<RestaurateurApi> { KtorRestaurateurApi(get(), get()) }
        single<EquipeApi> { KtorEquipeApi(get(), get()) }
        single<ActiviteApi> { KtorActiviteApi(get(), get()) }
        single<AvisEquipeApi> { KtorAvisEquipeApi(get(), get()) }
        single<PaiementsEquipeApi> { KtorPaiementsEquipeApi(get(), get()) }
        single<ReferencementsEquipeApi> { KtorReferencementsEquipeApi(get(), get()) }
        single<RestaurantsEquipeApi> { KtorRestaurantsEquipeApi(get(), get()) }
        single<PartenariatsEquipeApi> { KtorPartenariatsEquipeApi(get(), get()) }
        single<ListeAttenteEquipeApi> { KtorListeAttenteEquipeApi(get(), get()) }
        single<ComptesEquipeApi> { KtorComptesEquipeApi(get(), get()) }
        single<AppareilApi> { KtorAppareilApi(get(), get()) }
        single<VersionApi> { KtorVersionApi(get(), get()) }
        single<MoiApi> { KtorMoiApi(get(), get()) }
        single { EspaceService(get(), get(), get(), CoroutineScope(SupervisorJob() + Dispatchers.Default), get()) }
        single { DeconnexionService(get(), get(), get(), get(), CoroutineScope(SupervisorJob() + Dispatchers.Default)) }
        single<AideApi> { KtorAideApi(get(), get()) }
        single<ClientApi> { KtorClientApi(get(), get()) }
        single { InfosApplication(versionApp ?: "", codeVersionApp) }
        single { SuiviMiseAJour(get(), get(), codeVersionApp, get(), get()) }
        single { EnregistrementPush(get(), get(), get(), get(), plateforme, versionApp) }
        single { PanierService(get()) }
        single { CommandesLocales(get()) }
        factoryOf(::RestaurantsViewModel)
        factory { parametres -> RestaurantViewModel(get(), parametres.get()) }
        factory { parametres -> com.speedfood.app.ui.FavoriRestaurantViewModel(get(), get(), parametres.get()) }
        factoryOf(::ConnexionViewModel)
        factoryOf(::CommandeViewModel)
        factoryOf(::MesCommandesViewModel)
        factoryOf(::LivreurViewModel)
        factoryOf(::RestaurateurViewModel)
        factoryOf(::MenuRestaurateurViewModel)
        factoryOf(::EquipeViewModel)
        factoryOf(::RepartitionViewModel)
        factoryOf(::SupportViewModel)
        factoryOf(::CompteViewModel)
        factoryOf(::EspaceClientViewModel)
        factoryOf(::ExploitationViewModel)
        factoryOf(::MenusEquipeViewModel)
        factoryOf(::ActiviteRestaurantViewModel)
        factoryOf(::AvisEquipeViewModel)
        factoryOf(::PaiementsEquipeViewModel)
        factoryOf(::ReferencementsEquipeViewModel)
        factoryOf(::RestaurantsEquipeViewModel)
        factoryOf(::PartenariatsEquipeViewModel)
        factoryOf(::ListeAttenteEquipeViewModel)
        factoryOf(::ComptesEquipeViewModel)
        factoryOf(::GainsLivreurViewModel)
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
    installateurApk: InstallateurApk = InstallateurIndisponible(),
    demandeNotifications: DemandeNotifications = NotificationsIndisponibles(),
    verrouAppareil: VerrouAppareil = VerrouIndisponible(),
) {
    startKoin { modules(modulesApplication(config, stockage, position, alerte, jetonPush, plateforme, versionApp, google, codeVersionApp, notificateurMiseAJour, selecteurPhoto, installateurApk, demandeNotifications, verrouAppareil)) }
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
