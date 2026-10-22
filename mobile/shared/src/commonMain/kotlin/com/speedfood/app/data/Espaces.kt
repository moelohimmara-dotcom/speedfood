package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlin.time.Clock
import kotlinx.serialization.Serializable

/**
 * Les espaces de l'application. Le client est l'espace de tout le monde (aucun compte requis pour parcourir) ; les trois autres sont professionnels, chacun avec sa
 * propre barre de navigation, et ne s'ouvrent que pour un compte qui en a le droit.
 */
enum class Espace(val cle: String, val nom: String) {
    Client("client", "client"),
    Restaurateur("restaurateur", "restaurateur"),
    Livreur("livreur", "livreur"),
    Equipe("equipe", "équipe Speedfood");

    /** « Espace restaurateur », « Espace équipe Speedfood »… : le libellé affiché partout (jamais recalculé à la main, pour garder les majuscules). */
    val libelle: String get() = "Espace $nom"
}

@Serializable
data class RoleRestaurateur(val restaurant: String = "Mon restaurant")

/** Droits professionnels du compte connecté (réponse de `/api/v1/moi`). Rien : un compte client ordinaire. */
@Serializable
data class RolesCompte(val restaurateur: RoleRestaurateur? = null, val livreur: Boolean = false, val equipe: String? = null) {
    val aUnEspacePro: Boolean get() = restaurateur != null || livreur || equipe != null

    fun autorise(espace: Espace): Boolean = when (espace) {
        Espace.Client -> true
        Espace.Restaurateur -> restaurateur != null
        Espace.Livreur -> livreur
        Espace.Equipe -> equipe != null
    }

    val espacesPro: List<Espace> get() = listOf(Espace.Restaurateur, Espace.Livreur, Espace.Equipe).filter { autorise(it) }
}

@Serializable
private data class ReponseRoles(val ok: Boolean = false, val roles: RolesCompte? = null)

interface MoiApi {
    /** Droits du compte, ou null si le serveur n'a pas répondu (réseau) : l'espace actuel est alors conservé tel quel. */
    suspend fun roles(jetonAcces: String): RolesCompte?
}

class KtorMoiApi(private val client: HttpClient, private val config: SpeedfoodConfig) : MoiApi {
    override suspend fun roles(jetonAcces: String): RolesCompte? = try {
        val r = client.get("${config.siteUrl.trimEnd('/')}/api/v1/moi") { header(HttpHeaders.Authorization, "Bearer $jetonAcces") }.body<ReponseRoles>()
        if (r.ok) r.roles ?: RolesCompte() else null
    } catch (_: Exception) {
        null
    }
}

/** Un refus d'accès (statut 401 ou 403) renvoyé par le serveur à un appel authentifié : traité au même endroit pour tout le monde, jamais confondu avec une coupure du réseau. */
class ReactionAcces {
    internal var gestionnaire: ((statut: Int, chemin: String, jeton: String) -> Unit)? = null

    fun signaler(statut: Int, chemin: String, jeton: String) {
        gestionnaire?.invoke(statut, chemin, jeton)
    }
}

/** Message à montrer quand l'état de l'accès change sans que la personne l'ait demandé. [reconnexion] : propose « Me reconnecter ». */
data class AvisAcces(val message: String, val reconnexion: Boolean = false)

/**
 * Espace actif et droits du compte. Au démarrage, l'espace professionnel utilisé la dernière fois est repris tout de suite (un restaurateur retrouve sa console, comme
 * une application de livreur) ; dès que les droits sont connus, un espace que le compte n'a plus (ou une personne déconnectée) ramène au client.
 *
 * C'est aussi le point central de l'état d'accès (docs/AUDIT-PARCOURS-2026-10-22.md) : un 401 ferme la session proprement (« Votre session a expiré »), un 403 dans un
 * espace relit les droits (« Votre accès a été retiré »), les droits sont relus à la reprise et toutes les 10 minutes dans un espace pro. Rien de ce que la personne a sur
 * l'appareil (panier, commandes en cours) n'est effacé par ces changements.
 */
class EspaceService(
    private val session: SessionService,
    private val api: MoiApi,
    private val stockage: StockageLocal,
    private val portee: CoroutineScope,
    reaction: ReactionAcces = ReactionAcces(),
    private val maintenantMs: () -> Long = { Clock.System.now().toEpochMilliseconds() },
) {
    private val _roles = MutableStateFlow<RolesCompte?>(null)

    /** Droits du compte connecté ; null tant qu'ils ne sont pas connus (hors ligne, ou pas de compte). */
    val roles: StateFlow<RolesCompte?> = _roles.asStateFlow()

    private val _espace = MutableStateFlow(lireEspace())
    val espace: StateFlow<Espace> = _espace.asStateFlow()

    private val _avis = MutableSharedFlow<AvisAcces>(extraBufferCapacity = 8)

    /** Changements d'accès à annoncer à la personne. */
    val avis: SharedFlow<AvisAcces> = _avis.asSharedFlow()

    private val _connexionDemandee = MutableStateFlow(false)

    /** Vrai quand l'application doit ouvrir l'écran de connexion (après « Me reconnecter »). */
    val connexionDemandee: StateFlow<Boolean> = _connexionDemandee.asStateFlow()

    private val _choixAProposer = MutableStateFlow(false)

    /** Vrai quand le compte a plusieurs espaces professionnels et vient de se connecter depuis « Espace professionnel » : l'application propose le choix. */
    val choixAProposer: StateFlow<Boolean> = _choixAProposer.asStateFlow()

    /** Posé par l'écran « Espace professionnel » : la prochaine connexion ouvre l'espace du compte (un seul) ou propose le choix (plusieurs). */
    var intentionPro: Boolean = false

    private val traitementRefus = Mutex()
    private var dernierRafraichissement = 0L

    private fun lireEspace(): Espace {
        if (session.session.value == null) return Espace.Client
        return Espace.entries.firstOrNull { it.cle == stockage.lire(CLE) } ?: Espace.Client
    }

    init {
        reaction.gestionnaire = { statut, chemin, jeton -> portee.launch { surRefus(statut, chemin, jeton) } }
        // Les droits se relisent au démarrage puis à chaque connexion ou déconnexion.
        portee.launch { session.session.collect { rafraichir() } }
        // Dans un espace professionnel, un droit retiré se voit au plus tard dix minutes après.
        portee.launch {
            _espace.collectLatest {
                if (it != Espace.Client) {
                    while (true) {
                        delay(INTERVALLE_MS)
                        rafraichir()
                    }
                }
            }
        }
    }

    private suspend fun surRefus(statut: Int, chemin: String, jeton: String) {
        if (!traitementRefus.tryLock()) return
        try {
            if (statut == 401) {
                if (session.jetonRefuse(jeton)) _avis.emit(AvisAcces("Votre session a expiré. Reconnectez-vous pour continuer.", reconnexion = true))
            } else if (statut == 403 && ESPACES_PRO.any { chemin.startsWith("/api/v1/$it/") }) {
                rafraichir()
            }
        } finally {
            traitementRefus.unlock()
        }
    }

    private suspend fun rafraichir() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            // Pas de jeton : soit plus personne n'est connecté, soit le réseau est coupé (la session est alors gardée : on ne change rien).
            if (session.session.value == null) {
                _roles.value = null
                poser(Espace.Client)
            }
            return
        }
        val roles = api.roles(jeton) ?: return
        dernierRafraichissement = maintenantMs()
        _roles.value = roles
        val actuel = _espace.value
        if (!roles.autorise(actuel)) {
            poser(Espace.Client)
            _avis.emit(AvisAcces("Votre accès à l'${actuel.libelle.replaceFirstChar { it.lowercase() }} a été retiré. Vous êtes revenu à l'espace client."))
            return
        }
        if (intentionPro) {
            intentionPro = false
            val pros = roles.espacesPro
            when {
                pros.isEmpty() -> _avis.emit(AvisAcces("Ce compte n'est rattaché à aucun espace professionnel."))
                pros.size == 1 -> poser(pros.single())
                else -> _choixAProposer.value = true
            }
        }
    }

    /** Relit les droits du compte (reprise de l'application, ouverture de l'accès professionnel) ; au plus une fois toutes les 30 secondes. */
    fun actualiser() {
        if (!intentionPro && maintenantMs() - dernierRafraichissement < 30_000) return
        portee.launch { rafraichir() }
    }

    /** Entre dans un espace, si le compte y a droit (les droits ont été lus au serveur). */
    fun entrer(espace: Espace) {
        _choixAProposer.value = false
        if (espace == Espace.Client || _roles.value?.autorise(espace) == true) poser(espace)
    }

    fun quitter() = poser(Espace.Client)

    fun fermerChoix() {
        _choixAProposer.value = false
    }

    /** Annonce un message à la personne (par exemple après une déconnexion : l'écran d'où elle venait n'existe plus). */
    fun annoncer(message: String) {
        _avis.tryEmit(AvisAcces(message))
    }

    fun demanderConnexion() {
        _connexionDemandee.value = true
    }

    fun connexionTraitee() {
        _connexionDemandee.value = false
    }

    private fun poser(espace: Espace) {
        _espace.value = espace
        if (espace == Espace.Client) stockage.effacer(CLE) else stockage.ecrire(CLE, espace.cle)
    }

    private companion object {
        const val CLE = "espace_actif"
        const val INTERVALLE_MS = 10L * 60 * 1000
        val ESPACES_PRO = listOf("restaurant", "livreur", "equipe")
    }
}
