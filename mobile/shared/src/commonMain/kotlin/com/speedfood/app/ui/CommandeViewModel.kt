package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ClientCommande
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.CreationCommande
import com.speedfood.app.data.DestinationEnvoyee
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.EstimationLivraison
import com.speedfood.app.data.LigneEnvoyee
import com.speedfood.app.data.LivraisonApi
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.QuartierChoix
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.ResultatCommande
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.nouvelleCleIdempotence
import com.speedfood.app.data.normaliserTelephone
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlin.time.Clock

data class EtatCommande(
    val enCours: Boolean = false,
    val erreur: String? = null,
    /** Message d'information (par exemple : prix remis à jour après un changement). */
    val info: String? = null,
    /** Jeton de suivi de la commande envoyée : l'écran ouvre le suivi dès qu'il est présent. */
    val envoyee: String? = null,
    /** Mode choisi : retrait au restaurant ou livraison. */
    val livraison: Boolean = false,
    val quartierId: String? = null,
    /** Estimation des frais pour le quartier choisi ; null tant qu'elle n'est pas demandée. */
    val estimation: EstimationLivraison? = null,
    val estimationEnCours: Boolean = false,
) {
    /** Frais de livraison à ajouter au total affiché : seulement si le serveur les a calculés. */
    val fraisLivraison: Int get() = if (livraison) (estimation as? EstimationLivraison.Ok)?.fraisGnf ?: 0 else 0
}

const val ADRESSE_MIN = 5
const val ADRESSE_MAX = 300

/** Pré-contrôle de la saisie du client ; le serveur revérifie tout. Renvoie un message, ou null si tout est correct. */
fun verifierSaisieCommande(
    nom: String,
    telephone: String,
    consentement: Boolean,
    livraison: Boolean = false,
    adresse: String = "",
    quartierId: String? = null,
    estimation: EstimationLivraison? = null,
    estimationEnCours: Boolean = false,
): String? = when {
    nom.trim().length < 2 -> "Indiquez votre nom (2 caractères au moins)."
    normaliserTelephone(telephone) == null -> "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56)."
    livraison && quartierId == null -> "Choisissez votre quartier pour la livraison."
    livraison && adresse.trim().length !in ADRESSE_MIN..ADRESSE_MAX -> "Indiquez votre adresse de livraison ($ADRESSE_MIN à $ADRESSE_MAX caractères) : rue, repère, bâtiment."
    livraison && estimationEnCours -> "Le calcul de la livraison est en cours : patientez un instant."
    livraison && estimation == null -> "Le calcul de la livraison n'est pas encore fait : choisissez de nouveau votre quartier."
    livraison && estimation is EstimationLivraison.Erreur -> estimation.message
    !consentement -> "Cochez la case pour confirmer que vous réglez directement le restaurant et qu'il doit confirmer votre commande."
    else -> null
}

/**
 * Envoi de la commande. La clé d'idempotence est créée UNE fois par tentative de commande et reste la même tant que le panier, le mode ou la destination ne
 * changent pas : renvoyer (réseau coupé, double appui) ne crée jamais une seconde commande. Elle change dès que l'un d'eux change, ou après une commande réussie.
 */
class CommandeViewModel(
    private val panier: PanierService,
    private val session: SessionService,
    private val api: CommandeApi,
    private val restaurants: RestaurantApi,
    private val livraisonApi: LivraisonApi,
    private val locales: CommandesLocales,
    private val clientApi: com.speedfood.app.data.ClientApi,
) : ViewModel() {
    private val _etat = MutableStateFlow(EtatCommande())
    val etat: StateFlow<EtatCommande> = _etat.asStateFlow()
    private val _quartiers = MutableStateFlow<List<QuartierChoix>>(emptyList())
    val quartiers: StateFlow<List<QuartierChoix>> = _quartiers.asStateFlow()
    private val _adresses = MutableStateFlow<List<com.speedfood.app.data.AdresseClient>>(emptyList())

    /** Carnet d'adresses du compte connecté (vide sans compte ou hors ligne) : proposé dans le formulaire de livraison. */
    val adresses: StateFlow<List<com.speedfood.app.data.AdresseClient>> = _adresses.asStateFlow()
    private var cle: String = nouvelleCleIdempotence()
    private var signaturePanier: String = ""
    private var calcul: Job? = null

    private fun signature(): String {
        val e = _etat.value
        return panier.panier.value.lignes.joinToString(";") { it.cle + "x" + it.quantite } +
            "|" + (if (e.livraison) "livraison:${e.quartierId}:${e.fraisLivraison}" else "retrait")
    }

    /** Les quartiers ne sont lus que si la personne choisit la livraison ; un échec n'empêche pas le retrait. */
    private fun chargerQuartiers() {
        if (_quartiers.value.isNotEmpty()) return
        viewModelScope.launch {
            try {
                _quartiers.value = restaurants.quartiers()
            } catch (e: ErreurReseau) {
                _etat.value = _etat.value.copy(erreur = e.message)
            }
        }
    }

    /** Le carnet d'adresses n'est lu qu'une fois, si la personne est connectée ; un échec ne gêne jamais la commande (elle saisit l'adresse à la main). */
    private fun chargerAdresses() {
        if (_adresses.value.isNotEmpty()) return
        viewModelScope.launch {
            val jeton = session.jetonValide() ?: return@launch
            try {
                _adresses.value = clientApi.espace(jeton).adresses
            } catch (_: ErreurReseau) {
                // Meilleur effort.
            }
        }
    }

    fun choisirMode(livraison: Boolean) {
        _etat.value = _etat.value.copy(livraison = livraison, erreur = null, info = null)
        if (livraison) {
            chargerQuartiers()
            chargerAdresses()
            estimer()
        } else {
            calcul?.cancel()
            _etat.value = _etat.value.copy(estimation = null, estimationEnCours = false)
        }
    }

    fun choisirQuartier(id: String) {
        _etat.value = _etat.value.copy(quartierId = id, erreur = null, info = null)
        estimer()
    }

    /** Demande les frais au serveur pour le quartier choisi et le total actuel du panier ; la dernière demande remplace les précédentes. */
    fun estimer() {
        val courant = _etat.value
        val quartierId = courant.quartierId
        val restaurantId = panier.panier.value.restaurantId
        if (!courant.livraison || quartierId == null || restaurantId == null) return
        val sousTotal = panier.panier.value.sousTotal
        calcul?.cancel()
        _etat.value = courant.copy(estimation = null, estimationEnCours = true)
        calcul = viewModelScope.launch {
            val estimation = try {
                val jeton = session.jetonValide()
                if (jeton == null) EstimationLivraison.Erreur("Connectez-vous pour calculer la livraison.")
                else livraisonApi.estimer(restaurantId, quartierId, sousTotal, jeton)
            } catch (e: ErreurReseau) {
                EstimationLivraison.Erreur(e.message ?: "Le calcul de la livraison est momentanément indisponible.")
            }
            _etat.value = _etat.value.copy(estimation = estimation, estimationEnCours = false)
        }
    }

    fun envoyer(nom: String, telephone: String, adresse: String, consentement: Boolean) {
        val courant = panier.panier.value
        val restaurantId = courant.restaurantId
        if (restaurantId == null || courant.estVide) {
            _etat.value = _etat.value.copy(erreur = "Votre panier est vide.")
            return
        }
        val avant = _etat.value
        verifierSaisieCommande(nom, telephone, consentement, avant.livraison, adresse, avant.quartierId, avant.estimation, avant.estimationEnCours)
            ?.let { _etat.value = avant.copy(erreur = it, info = null); return }
        val signatureActuelle = signature()
        if (signatureActuelle != signaturePanier) {
            cle = nouvelleCleIdempotence()
            signaturePanier = signatureActuelle
        }
        val livraison = avant.livraison
        val frais = (avant.estimation as? EstimationLivraison.Ok)?.fraisGnf
        _etat.value = avant.copy(enCours = true, erreur = null, info = null)
        viewModelScope.launch {
            val jetonAcces = session.jetonValide()
            if (jetonAcces == null) {
                _etat.value = _etat.value.copy(enCours = false, erreur = "Connectez-vous pour envoyer votre commande.")
                return@launch
            }
            val lignes = courant.lignes.map { LigneEnvoyee(it.plat.id, it.quantite, it.options.map { o -> o.id }) }
            val commande = CreationCommande(
                cleIdempotence = cle,
                restaurantId = restaurantId,
                client = ClientCommande(nom = nom.trim(), telephone = normaliserTelephone(telephone) ?: telephone, adresse = if (livraison) adresse.trim() else null),
                mode = if (livraison) "livraison" else "retrait",
                lignes = lignes,
                sousTotalAffiche = courant.sousTotal,
                consentementReglement = consentement,
                destination = if (livraison) avant.quartierId?.let { DestinationEnvoyee(it) } else null,
                fraisAffiches = if (livraison) frais else null,
            )
            try {
                when (val r = api.creer(commande, jetonAcces)) {
                    is ResultatCommande.Creee -> {
                        val total = courant.sousTotal + (if (livraison) frais ?: 0 else 0)
                        locales.ajouter(
                            CommandeLocale(
                                r.reference, r.jeton, courant.restaurantNom ?: "Restaurant", Clock.System.now().toEpochMilliseconds(), total,
                                restaurantId = restaurantId, lignes = lignes, mode = commande.mode,
                            ),
                        )
                        panier.vider()
                        cle = nouvelleCleIdempotence()
                        signaturePanier = ""
                        _etat.value = EtatCommande(envoyee = r.jeton)
                    }
                    is ResultatCommande.Refusee -> {
                        if (r.code == "CONFLIT_ETAT") {
                            // Prix ou frais changés depuis l'affichage : on remet le panier à jour avec le menu d'aujourd'hui et on recalcule la livraison ;
                            // la personne vérifie le nouveau total puis confirme.
                            try {
                                val retirees = panier.actualiser(restaurants.menu(restaurantId))
                                val suffixe = if (retirees > 0) " $retirees plat(s) n'existent plus et ont été retirés." else ""
                                _etat.value = _etat.value.copy(enCours = false, info = "Les prix ou les frais ont changé : le total est à jour. Vérifiez-le, puis confirmez.$suffixe")
                                estimer()
                            } catch (e: ErreurReseau) {
                                _etat.value = _etat.value.copy(enCours = false, erreur = r.message)
                            }
                        } else {
                            _etat.value = _etat.value.copy(enCours = false, erreur = r.message)
                        }
                    }
                }
            } catch (e: ErreurReseau) {
                _etat.value = _etat.value.copy(enCours = false, erreur = e.message)
            } catch (e: Exception) {
                _etat.value = _etat.value.copy(enCours = false, erreur = "Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }
}
