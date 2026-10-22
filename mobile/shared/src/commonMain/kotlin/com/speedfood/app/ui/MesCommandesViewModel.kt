package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.CommandeServeur
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.EnregistrementPush
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.LigneEnvoyee
import com.speedfood.app.data.Menu
import com.speedfood.app.data.OptionPlat
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.Plat
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.SessionService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Instant

/** Une commande de l'historique : celles du compte (serveur) complétées par ce que l'appareil a gardé (lignes envoyées, pour commander à nouveau). */
data class CommandeAffichee(
    val reference: String,
    val jeton: String,
    val restaurantId: String,
    val restaurantNom: String,
    val creeLeMillis: Long?,
    val total: Int,
    val statut: String?,
    val livraison: Boolean,
    val lignes: List<LigneEnvoyee>,
) {
    val peutRecommander: Boolean get() = restaurantId.isNotBlank() && lignes.isNotEmpty()
}

data class EtatMesCommandes(
    val commandes: List<CommandeAffichee> = emptyList(),
    val chargement: Boolean = false,
    /** Message non bloquant : l'historique du compte n'a pas pu être lu, ce que l'appareil a gardé reste affiché. */
    val alerte: String? = null,
    val message: String? = null,
    val recommandeEnCours: Boolean = false,
)

/**
 * Fusionne l'historique du serveur et les commandes de l'appareil, par référence : le serveur fait foi pour le statut et le total, l'appareil apporte les lignes
 * envoyées. Les plus récentes d'abord ; 50 au plus.
 */
fun fusionnerCommandes(serveur: List<CommandeServeur>, locales: List<CommandeLocale>): List<CommandeAffichee> {
    val localesParReference = locales.associateBy { it.reference }
    val duServeur = serveur.map { s ->
        val l = localesParReference[s.reference]
        CommandeAffichee(
            reference = s.reference,
            jeton = s.jeton.ifBlank { l?.jeton ?: "" },
            restaurantId = s.restaurantId.ifBlank { l?.restaurantId ?: "" },
            restaurantNom = s.restaurantNom,
            creeLeMillis = try {
                Instant.parse(s.creeLe).toEpochMilliseconds()
            } catch (_: IllegalArgumentException) {
                l?.creeLe
            },
            total = s.totalGnf,
            statut = s.statut.ifBlank { null },
            livraison = s.mode == "livraison",
            lignes = l?.lignes ?: emptyList(),
        )
    }
    val references = duServeur.map { it.reference }.toSet()
    val seulementLocales = locales.filter { it.reference !in references }.map { l ->
        CommandeAffichee(l.reference, l.jeton, l.restaurantId, l.restaurantNom, l.creeLe, l.total, null, l.mode == "livraison", l.lignes)
    }
    return (duServeur + seulementLocales).filter { it.jeton.isNotBlank() }.sortedByDescending { it.creeLeMillis ?: 0L }.take(CommandesLocales.MAX)
}

/** Lignes à remettre dans le panier d'après le menu d'aujourd'hui : plat existant et disponible, suppléments encore disponibles. Le reste est ignoré. */
fun lignesRecommandees(menu: Menu, lignes: List<LigneEnvoyee>): List<Triple<Plat, List<OptionPlat>, Int>> =
    lignes.mapNotNull { l ->
        val plat = menu.plats.firstOrNull { it.id == l.menuItemId && it.disponible } ?: return@mapNotNull null
        Triple(plat, plat.options.filter { it.id in l.optionIds && it.disponible }, l.quantite)
    }

class MesCommandesViewModel(
    private val session: SessionService,
    private val api: CommandeApi,
    private val locales: CommandesLocales,
    private val restaurants: RestaurantApi,
    private val panier: PanierService,
    private val enregistrementPush: EnregistrementPush,
) : ViewModel() {
    private val _etat = MutableStateFlow(EtatMesCommandes(commandes = fusionnerCommandes(emptyList(), locales.lister())))
    val etat: StateFlow<EtatMesCommandes> = _etat.asStateFlow()

    init {
        charger()
    }

    fun charger() {
        _etat.value = _etat.value.copy(chargement = true, alerte = null)
        viewModelScope.launch {
            val jeton = session.jetonValide()
            if (jeton == null) {
                _etat.value = _etat.value.copy(chargement = false)
                return@launch
            }
            try {
                val serveur = api.lister(jeton)
                _etat.value = _etat.value.copy(commandes = fusionnerCommandes(serveur, locales.lister()), chargement = false)
            } catch (e: ErreurReseau) {
                _etat.value = _etat.value.copy(chargement = false, alerte = "Votre historique complet n'a pas pu être chargé (${e.message}) Les commandes de cet appareil restent affichées.")
            }
        }
    }

    /** Essai des notifications poussées : le résultat s'affiche dans le message de l'écran. */
    fun essaiNotification() {
        _etat.value = _etat.value.copy(message = "Essai en cours…")
        viewModelScope.launch {
            val message = try {
                enregistrementPush.essai()
            } catch (_: Exception) {
                "L'essai n'a pas pu être lancé. Réessayez dans un instant."
            }
            _etat.value = _etat.value.copy(message = message)
        }
    }

    /** Déconnexion : l'appareil est d'abord retiré du compte (il ne doit plus recevoir ses alertes), puis la session est fermée et ce que l'appareil gardait est oublié. */
    fun deconnecter() {
        viewModelScope.launch {
            try {
                enregistrementPush.retirer()
            } catch (_: Exception) {
                // Meilleur effort : on se déconnecte quoi qu'il arrive.
            }
            session.deconnecter()
            oublierCetAppareil()
        }
    }

    fun oublierCetAppareil() {
        locales.oublier()
        _etat.value = EtatMesCommandes()
    }

    /**
     * « Commander à nouveau » : remet dans le panier les plats de cette commande d'après le menu d'AUJOURD'HUI (prix, plats et suppléments à jour). Ce qui n'existe plus
     * est ignoré ; le panier précédent est remplacé. [surPret] est appelé quand le panier est prêt.
     */
    fun recommander(commande: CommandeAffichee, surPret: () -> Unit) {
        if (!commande.peutRecommander || _etat.value.recommandeEnCours) return
        _etat.value = _etat.value.copy(recommandeEnCours = true, message = null)
        viewModelScope.launch {
            try {
                val menu = restaurants.menu(commande.restaurantId)
                val aAjouter = lignesRecommandees(menu, commande.lignes)
                if (aAjouter.isEmpty()) {
                    _etat.value = _etat.value.copy(recommandeEnCours = false, message = "Les plats de cette commande ne sont plus disponibles chez ${commande.restaurantNom}.")
                    return@launch
                }
                panier.vider()
                aAjouter.forEach { (plat, options, quantite) -> panier.ajouter(commande.restaurantId, commande.restaurantNom, plat, options, quantite) }
                val manquants = commande.lignes.size - aAjouter.size
                _etat.value = _etat.value.copy(
                    recommandeEnCours = false,
                    message = if (manquants > 0) "$manquants plat(s) n'existent plus ou ne sont plus disponibles : ils n'ont pas été remis dans le panier." else null,
                )
                surPret()
            } catch (e: ErreurReseau) {
                _etat.value = _etat.value.copy(recommandeEnCours = false, message = e.message)
            }
        }
    }
}
