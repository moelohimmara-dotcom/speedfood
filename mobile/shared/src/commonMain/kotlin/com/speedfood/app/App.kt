package com.speedfood.app

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.Icon
import androidx.compose.runtime.collectAsState
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import com.speedfood.app.data.CLE_PROFIL_CHOISI
import com.speedfood.app.data.DebutApplication
import com.speedfood.app.data.EcranEntree
import com.speedfood.app.data.Espace
import com.speedfood.app.data.ProfilEntree
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.debutApplication
import com.speedfood.app.data.cleVisiteVue
import com.speedfood.app.data.ecranApresOuverture
import com.speedfood.app.data.visiteAProposer
import com.speedfood.app.ui.CandidatureScreen
import com.speedfood.app.ui.EcranChoixProfil
import com.speedfood.app.data.EspaceService
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.VerrouEspacesPro
import com.speedfood.app.ui.AccesProScreen
import com.speedfood.app.ui.BandeauAvisAcces
import com.speedfood.app.ui.ChoixEspaceDialogue
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.speedfood.app.design.Couleurs
import com.speedfood.app.ui.CompteScreen
import com.speedfood.app.ui.ParametresScreen
import com.speedfood.app.ui.AideScreen
import com.speedfood.app.ui.ProfilClientScreen
import com.speedfood.app.ui.AdressesClientScreen
import com.speedfood.app.ui.FavorisClientScreen
import com.speedfood.app.ui.AvisClientScreen
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
import com.speedfood.app.data.LienProfond
import com.speedfood.app.data.lireLienProfond
import com.speedfood.app.design.SpeedfoodTheme
import com.speedfood.app.ui.BandeauMiseAJour
import com.speedfood.app.ui.CommandeScreen
import com.speedfood.app.ui.EquipeScreen
import com.speedfood.app.ui.RepartitionScreen
import com.speedfood.app.ui.SupportCommandesScreen
import com.speedfood.app.ui.LivraisonsEquipeScreen
import com.speedfood.app.ui.MenusEquipeScreen
import com.speedfood.app.ui.LivreursEquipeScreen
import com.speedfood.app.ui.DetailSupportScreen
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

/** Formulaire d'inscription du restaurant (demande de référencement) puis suivi de la demande. */
@Serializable
object CandidatureDestination

/** Visite guidée du profil, proposée une fois après la création du compte (ou « Voir d'abord »). */
@Serializable
data class VisiteProfilDestination(val restaurateur: Boolean)

/** Création de compte à l'entrée : consommateur (avec « Voir d'abord les restaurants ») ou restaurateur (avant d'inscrire son restaurant). */
@Serializable
data class CreationCompteDestination(val restaurateur: Boolean)

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

@Serializable
object SupportDestination

@Serializable
object CompteDestination

@Serializable
object AccesProDestination

@Serializable
object ParametresDestination

@Serializable
object AideDestination

@Serializable
object ProfilDestination

@Serializable
object AdressesDestination

@Serializable
object FavorisDestination

@Serializable
object AvisDestination

@Serializable
object LivraisonsEquipeDestination

@Serializable
object MenusEquipeDestination

@Serializable
object LivreursEquipeDestination

@Serializable
data class DetailSupportDestination(val id: String)

/** Les temps du lancement : le logo s'anime, l'écran de choix du profil (premier lancement ou après une déconnexion), la visite guidée, puis l'application. */
private enum class Phase { Ouverture, Choix, Visite, Application }

@Composable
fun App(config: SpeedfoodConfig, lienInitial: String? = null, numeroLien: Int = 0) {
    SpeedfoodTheme {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            val stockage: StockageLocal = koinInject()
            val lienProfond = remember(lienInitial) { lienInitial?.let(::lireLienProfond) }
            val sessionService: SessionService = koinInject()
            var phase by remember { mutableStateOf(if (lienProfond != null) Phase.Application else Phase.Ouverture) }
            var debut by remember { mutableStateOf(DebutApplication.Normal) }
            Crossfade(phase, animationSpec = tween(450)) { courante ->
                when (courante) {
                    Phase.Ouverture -> EcranOuverture {
                        val profil = ProfilEntree.depuis(stockage.lire(CLE_PROFIL_CHOISI))
                        val connecte = sessionService.session.value != null
                        when (ecranApresOuverture(lienProfond != null, connecte, profil)) {
                            EcranEntree.Choix -> phase = Phase.Choix
                            EcranEntree.Application -> {
                                debut = debutApplication(profil, connecte)
                                phase = Phase.Application
                            }
                        }
                    }
                    Phase.Choix -> {
                        fun choisir(profil: ProfilEntree) {
                            stockage.ecrire(CLE_PROFIL_CHOISI, profil.cle)
                            debut = debutApplication(profil, connecte = false, apresChoix = true)
                            phase = Phase.Application
                        }
                        EcranChoixProfil(
                            surConsommateur = { choisir(ProfilEntree.Consommateur) },
                            surRestaurateur = { choisir(ProfilEntree.Restaurateur) },
                            surProfessionnel = { choisir(ProfilEntree.Professionnel) },
                        )
                    }
                    Phase.Visite -> VisiteGuidee {
                        stockage.ecrire(CLE_VISITE_VUE, "1")
                        phase = Phase.Application
                    }
                    Phase.Application -> Box {
                        Application(config, lienProfond, numeroLien, debut)
                        BandeauMiseAJour(Modifier.align(Alignment.TopCenter))
                    }
                }
            }
        }
    }
}

/**
 * « Retour » d'un écran. Sur un écran de départ (lien reçu, accès pro, candidature, création de compte) il n'y a rien avant : retirer le dernier écran laisserait une page blanche
 * et le bouton paraîtrait inactif. On va alors à la liste des restaurants.
 */
internal fun NavHostController.retour(repli: Any = RestaurantsDestination) {
    if (previousBackStackEntry == null) navigate(repli) { popUpTo(0) } else popBackStack()
}

@Composable
private fun Application(config: SpeedfoodConfig, lienProfond: LienProfond? = null, numeroLien: Int = 0, debut: DebutApplication = DebutApplication.Normal) {
    val espaces: EspaceService = koinInject()
    val espace by espaces.espace.collectAsState()
    // À la reprise de l'application, les droits du compte sont relus (un droit ajouté ou retiré se voit tout de suite).
    val verrou: VerrouEspacesPro = koinInject()
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        espaces.actualiser()
        verrou.reprise()
    }
    LifecycleEventEffect(Lifecycle.Event.ON_STOP) { verrou.quitte() }
    Box {
        // Chaque espace a sa propre coque : le client n'a jamais la navigation d'un espace professionnel, et inversement.
        if (espace == Espace.Client) ApplicationClient(config, lienProfond, numeroLien, debut) else EspacePro(espace, config)
        BandeauAvisAcces(Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun ApplicationClient(config: SpeedfoodConfig, lienProfond: LienProfond? = null, numeroLien: Int = 0, debut: DebutApplication = DebutApplication.Normal) {
        val espaces: EspaceService = koinInject()
        val connexionDemandee by espaces.connexionDemandee.collectAsState()
        ChoixEspaceDialogue()
        val navController: NavHostController = rememberNavController()
        val panierService: PanierService = koinInject()
        val panier by panierService.panier.collectAsState()
        val entree by navController.currentBackStackEntryAsState()
        val destination = entree?.destination
        val destinationInitiale: Any = when (lienProfond) {
            is LienProfond.Restaurant -> RestaurantDestination(lienProfond.id)
            is LienProfond.Commande -> SuiviDestination(lienProfond.jeton)
            null -> when (debut) {
                DebutApplication.Normal -> RestaurantsDestination
                DebutApplication.CreationCompte -> CreationCompteDestination(restaurateur = false)
                DebutApplication.CreationCompteRestaurateur -> CreationCompteDestination(restaurateur = true)
                DebutApplication.AccesPro -> AccesProDestination
                DebutApplication.Candidature -> CandidatureDestination
            }
        }
        // Un lien reçu pendant que l'application tourne (WhatsApp, navigateur) ouvre sa destination ; le lien de lancement est déjà la destination de départ.
        var numeroTraite by remember { mutableStateOf(numeroLien) }
        LaunchedEffect(numeroLien) {
            if (numeroLien != numeroTraite && lienProfond != null) {
                navController.navigate(destinationInitiale)
                numeroTraite = numeroLien
            }
        }
        val onglets = listOf(
            Onglet("Accueil", Icons.Default.Home, RestaurantsDestination),
            Onglet("Commandes", Icons.Default.List, MesCommandesDestination),
            Onglet("Panier", Icons.Default.ShoppingCart, PanierDestination),
            Onglet("Compte", Icons.Default.Person, CompteDestination),
        )
        // « Me reconnecter » (session expirée) ouvre l'écran de connexion ; la demande est consommée une seule fois.
        LaunchedEffect(connexionDemandee) {
            if (connexionDemandee) {
                navController.navigate(ConnexionDestination)
                espaces.connexionTraitee()
            }
        }
        val barreVisible = onglets.any { o -> destination?.hierarchy?.any { it.hasRoute(o.route::class) } == true }
        fun versOnglet(route: Any) = navController.navigate(route) {
            popUpTo<RestaurantsDestination> { saveState = true }
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
                                icon = {
                                    if (o.route == PanierDestination && panier.nombreArticles > 0) {
                                        BadgedBox(badge = { Badge(containerColor = Couleurs.RougeFonce) { Text(panier.nombreArticles.toString()) } }) { Icon(o.icone, contentDescription = null) }
                                    } else {
                                        Icon(o.icone, contentDescription = null)
                                    }
                                },
                                label = { Text(o.libelle, style = MaterialTheme.typography.labelMedium) },
                                colors = NavigationBarItemDefaults.colors(selectedIconColor = Couleurs.Encre, selectedTextColor = Couleurs.Encre, indicatorColor = Couleurs.Mangue, unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant, unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant),
                            )
                        }
                    }
                }
            },
        ) { interieur ->
        Box(Modifier.padding(interieur).consumeWindowInsets(interieur)) {
        NavHost(navController = navController, startDestination = destinationInitiale) {
            composable<CompteDestination> {
                CompteScreen(
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onCommandes = { versOnglet(MesCommandesDestination) },
                    onParametres = { navController.navigate(ParametresDestination) },
                    onAide = { navController.navigate(AideDestination) },
                    onProfil = { navController.navigate(ProfilDestination) },
                    onAdresses = { navController.navigate(AdressesDestination) },
                    onFavoris = { navController.navigate(FavorisDestination) },
                    onAvis = { navController.navigate(AvisDestination) },
                    onAccesPro = { navController.navigate(AccesProDestination) },
                )
            }
            composable<ParametresDestination> {
                ParametresScreen(onRetour = { navController.retour() }, onVisite = { navController.navigate(VisiteDestination) })
            }
            composable<AccesProDestination> {
                AccesProScreen(
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onAide = { navController.navigate(AideDestination) },
                    onInscrireRestaurant = { navController.navigate(CandidatureDestination) },
                )
            }
            composable<CandidatureDestination> {
                CandidatureScreen(
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onAide = { navController.navigate(AideDestination) },
                )
            }
            composable<ProfilDestination> {
                ProfilClientScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<AdressesDestination> {
                AdressesClientScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<FavorisDestination> {
                FavorisClientScreen(
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onOuvrir = { id -> navController.navigate(RestaurantDestination(id)) },
                )
            }
            composable<AvisDestination> {
                AvisClientScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<AideDestination> {
                AideScreen(onRetour = { navController.retour() })
            }
            composable<RestaurantsDestination> {
                RestaurantsScreen(
                    racine = true,
                    onRetour = { navController.retour() },
                    onOuvrir = { id -> navController.navigate(RestaurantDestination(id)) },
                    onPanier = { navController.navigate(PanierDestination) },
                    onCompte = { navController.navigate(MesCommandesDestination) },
                )
            }
            composable<RestaurantDestination> { entree ->
                RestaurantScreen(
                    restaurantId = entree.toRoute<RestaurantDestination>().id,
                    onRetour = { navController.retour() },
                    onPanier = { navController.navigate(PanierDestination) },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                )
            }
            composable<PanierDestination> {
                PanierScreen(
                    racine = true,
                    onRetour = { navController.retour() },
                    onCommander = { navController.navigate(CommandeDestination) },
                    onVoirRestaurant = { id -> navController.navigate(RestaurantDestination(id)) },
                )
            }
            composable<CommandeDestination> {
                CommandeScreen(
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    // Après l'envoi, on arrive sur le suivi ; « retour » ramène à la liste des restaurants, pas au panier vidé.
                    onEnvoyee = { jeton -> navController.navigate(SuiviDestination(jeton)) { popUpTo<RestaurantsDestination>() } },
                )
            }
            composable<ConnexionDestination> {
                ConnexionScreen(onRetour = { navController.retour() }, onConnecte = { navController.retour() })
            }
            composable<CreationCompteDestination> { entree ->
                val restaurateur = entree.toRoute<CreationCompteDestination>().restaurateur
                val stockage: StockageLocal = koinInject()
                val finale: Any = if (restaurateur) CandidatureDestination else RestaurantsDestination
                // Un restaurateur déjà référencé qui se connecte ici arrive directement dans son espace (même mécanisme que « Me connecter à mon espace »).
                if (restaurateur) LaunchedEffect(Unit) { espaces.intentionPro = true }
                // Après le compte (ou « Voir d'abord ») : la visite du profil, une seule fois ; sinon directement la destination.
                fun suite() {
                    val vues = listOf("visite_vue", cleVisiteVue(false), cleVisiteVue(true)).filter { stockage.lire(it) != null }.toSet()
                    val cible: Any = if (visiteAProposer(restaurateur, vues)) VisiteProfilDestination(restaurateur) else finale
                    navController.navigate(cible) { popUpTo<CreationCompteDestination> { inclusive = true } }
                }
                // Retour à l'accueil sans compte : pour un restaurateur, ce n'est pas la candidature (qui exige un compte) mais la liste des restaurants.
                fun versAccueil() = if (restaurateur) navController.navigate(RestaurantsDestination) { popUpTo<CreationCompteDestination> { inclusive = true } } else suite()
                ConnexionScreen(
                    onRetour = { navController.retour() },
                    // Compte créé ou connecté : le consommateur arrive à l'accueil ; le restaurateur à l'espace professionnel (le formulaire d'inscription du restaurant arrive au lot R2).
                    onConnecte = { suite() },
                    inscriptionInitiale = true,
                    onVoirDabord = { versAccueil() },
                    libelleRetourApresEnvoi = if (restaurateur) "Retour" else "Voir les restaurants",
                    intro = if (restaurateur) "Créez votre compte pour inscrire votre restaurant. L'équipe Speedfood vous répond sous 48 h." else "Créez votre compte pour commander. Le même compte fonctionne sur le site Speedfood.",
                    avecContact = false,
                    introConnexion = "Connectez-vous avec votre compte Speedfood.",
                    messageConservation = null,
                )
            }
            composable<SuiviDestination> { entree ->
                SuiviScreen(jeton = entree.toRoute<SuiviDestination>().jeton, onRetour = { navController.retour() })
            }
            composable<MesCommandesDestination> {
                MesCommandesScreen(
                    racine = true,
                    onRetour = { navController.retour() },
                    onOuvrir = { jeton -> navController.navigate(SuiviDestination(jeton)) },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onPanier = { navController.navigate(PanierDestination) },
                )
            }
            composable<VisiteDestination> {
                VisiteGuidee { navController.retour() }
            }
            composable<VisiteProfilDestination> { entree ->
                val restaurateur = entree.toRoute<VisiteProfilDestination>().restaurateur
                val stockage: StockageLocal = koinInject()
                VisiteGuidee(restaurateur = restaurateur) {
                    stockage.ecrire(cleVisiteVue(restaurateur), "1")
                    navController.navigate(if (restaurateur) CandidatureDestination else RestaurantsDestination) { popUpTo<VisiteProfilDestination> { inclusive = true } }
                }
            }
            composable<LivreurDestination> {
                LivreurScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<RestaurateurDestination> {
                RestaurateurScreen(siteUrl = config.siteUrl, onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) }, onMenu = { navController.navigate(MenuRestaurateurDestination) })
            }
            composable<EquipeDestination> {
                EquipeScreen(
                    siteUrl = config.siteUrl,
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onRepartition = { navController.navigate(RepartitionDestination) },
                    onSupport = { navController.navigate(SupportDestination) },
                    onLivraisons = { navController.navigate(LivraisonsEquipeDestination) },
                    onLivreurs = { navController.navigate(LivreursEquipeDestination) },
                    onParametres = { navController.navigate(ParametresDestination) },
                    onMenus = { navController.navigate(MenusEquipeDestination) },
                )
            }
            composable<MenusEquipeDestination> {
                MenusEquipeScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<LivraisonsEquipeDestination> {
                LivraisonsEquipeScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<LivreursEquipeDestination> {
                LivreursEquipeScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<SupportDestination> {
                SupportCommandesScreen(
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                    onOuvrir = { id -> navController.navigate(DetailSupportDestination(id)) },
                )
            }
            composable<DetailSupportDestination> { entree ->
                DetailSupportScreen(
                    commandeId = entree.toRoute<DetailSupportDestination>().id,
                    onRetour = { navController.retour() },
                    onConnexion = { navController.navigate(ConnexionDestination) },
                )
            }
            composable<RepartitionDestination> {
                RepartitionScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
            composable<MenuRestaurateurDestination> {
                MenuRestaurateurScreen(onRetour = { navController.retour() }, onConnexion = { navController.navigate(ConnexionDestination) })
            }
        }
        }
        }
}

/** Un onglet de la barre du bas : libellé, icône et destination. */
private class Onglet(val libelle: String, val icone: androidx.compose.ui.graphics.vector.ImageVector, val route: Any)
