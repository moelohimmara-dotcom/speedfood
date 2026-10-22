package com.speedfood.app.data

import com.speedfood.app.config.SpeedfoodConfig
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.http.HttpHeaders
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

/**
 * Les espaces de l'application. Le client est l'espace de tout le monde (aucun compte requis pour parcourir) ; les trois autres sont professionnels, chacun avec sa
 * propre barre de navigation, et ne s'ouvrent que pour un compte qui en a le droit.
 */
enum class Espace(val cle: String, val titre: String) {
    Client("client", "Client"),
    Restaurateur("restaurateur", "Restaurateur"),
    Livreur("livreur", "Livreur"),
    Equipe("equipe", "Équipe Speedfood"),
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

/**
 * Espace actif et droits du compte. Au démarrage, l'espace professionnel utilisé la dernière fois est repris tout de suite (un restaurateur retrouve sa console, comme
 * une application de livreur) ; dès que les droits sont connus, un espace que le compte n'a plus (ou une personne déconnectée) ramène au client.
 */
class EspaceService(
    private val session: SessionService,
    private val api: MoiApi,
    private val stockage: StockageLocal,
    private val portee: CoroutineScope,
) {
    private val _roles = MutableStateFlow<RolesCompte?>(null)

    /** Droits du compte connecté ; null tant qu'ils ne sont pas connus (hors ligne, ou pas de compte). */
    val roles: StateFlow<RolesCompte?> = _roles.asStateFlow()

    private val _espace = MutableStateFlow(lireEspace())
    val espace: StateFlow<Espace> = _espace.asStateFlow()

    private fun lireEspace(): Espace {
        if (session.session.value == null) return Espace.Client
        return Espace.entries.firstOrNull { it.cle == stockage.lire(CLE) } ?: Espace.Client
    }

    init {
        // Les droits se relisent au démarrage puis à chaque connexion ou déconnexion.
        portee.launch { session.session.collect { rafraichir() } }
    }

    private suspend fun rafraichir() {
        val jeton = session.jetonValide()
        if (jeton == null) {
            _roles.value = null
            poser(Espace.Client)
            return
        }
        val roles = api.roles(jeton) ?: return
        _roles.value = roles
        if (!roles.autorise(_espace.value)) poser(Espace.Client)
    }

    /** Relit les droits du compte (par exemple quand la personne ouvre l'accès professionnel). */
    fun actualiser() {
        portee.launch { rafraichir() }
    }

    /** Entre dans un espace, si le compte y a droit (les droits ont été lus au serveur). */
    fun entrer(espace: Espace) {
        if (espace == Espace.Client || _roles.value?.autorise(espace) == true) poser(espace)
    }

    fun quitter() = poser(Espace.Client)

    private fun poser(espace: Espace) {
        _espace.value = espace
        if (espace == Espace.Client) stockage.effacer(CLE) else stockage.ecrire(CLE, espace.cle)
    }

    private companion object {
        const val CLE = "espace_actif"
    }
}
