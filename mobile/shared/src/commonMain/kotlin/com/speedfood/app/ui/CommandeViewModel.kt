package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.ClientCommande
import com.speedfood.app.data.CommandeApi
import com.speedfood.app.data.CommandeLocale
import com.speedfood.app.data.CommandesLocales
import com.speedfood.app.data.CreationCommande
import com.speedfood.app.data.ErreurReseau
import com.speedfood.app.data.LigneEnvoyee
import com.speedfood.app.data.PanierService
import com.speedfood.app.data.RestaurantApi
import com.speedfood.app.data.ResultatCommande
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.nouvelleCleIdempotence
import com.speedfood.app.data.normaliserTelephone
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
)

/** Pré-contrôle de la saisie du client ; le serveur revérifie tout. Renvoie un message, ou null si tout est correct. */
fun verifierSaisieCommande(nom: String, telephone: String, consentement: Boolean): String? = when {
    nom.trim().length < 2 -> "Indiquez votre nom (2 caractères au moins)."
    normaliserTelephone(telephone) == null -> "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56)."
    !consentement -> "Cochez la case pour confirmer que vous réglez directement le restaurant et qu'il doit confirmer votre commande."
    else -> null
}

/**
 * Envoi de la commande. La clé d'idempotence est créée UNE fois par tentative de commande et reste la même tant que le panier ne change pas : renvoyer
 * (réseau coupé, double appui) ne crée jamais une seconde commande. Elle change dès que le panier change, ou après une commande réussie.
 */
class CommandeViewModel(
    private val panier: PanierService,
    private val session: SessionService,
    private val api: CommandeApi,
    private val restaurants: RestaurantApi,
    private val locales: CommandesLocales,
) : ViewModel() {
    private val _etat = MutableStateFlow(EtatCommande())
    val etat: StateFlow<EtatCommande> = _etat.asStateFlow()
    private var cle: String = nouvelleCleIdempotence()
    private var signaturePanier: String = ""

    private fun signature(): String = panier.panier.value.lignes.joinToString(";") { it.cle + "x" + it.quantite }

    fun envoyer(nom: String, telephone: String, consentement: Boolean) {
        val courant = panier.panier.value
        val restaurantId = courant.restaurantId
        if (restaurantId == null || courant.estVide) {
            _etat.value = EtatCommande(erreur = "Votre panier est vide.")
            return
        }
        verifierSaisieCommande(nom, telephone, consentement)?.let { _etat.value = EtatCommande(erreur = it); return }
        val signatureActuelle = signature()
        if (signatureActuelle != signaturePanier) {
            cle = nouvelleCleIdempotence()
            signaturePanier = signatureActuelle
        }
        _etat.value = EtatCommande(enCours = true)
        viewModelScope.launch {
            val jetonAcces = session.jetonValide()
            if (jetonAcces == null) {
                _etat.value = EtatCommande(erreur = "Connectez-vous pour envoyer votre commande.")
                return@launch
            }
            val commande = CreationCommande(
                cleIdempotence = cle,
                restaurantId = restaurantId,
                client = ClientCommande(nom = nom.trim(), telephone = normaliserTelephone(telephone) ?: telephone, adresse = null),
                mode = "retrait",
                lignes = courant.lignes.map { LigneEnvoyee(it.plat.id, it.quantite, it.options.map { o -> o.id }) },
                sousTotalAffiche = courant.sousTotal,
                consentementReglement = consentement,
            )
            try {
                when (val r = api.creer(commande, jetonAcces)) {
                    is ResultatCommande.Creee -> {
                        locales.ajouter(CommandeLocale(r.reference, r.jeton, courant.restaurantNom ?: "Restaurant", Clock.System.now().toEpochMilliseconds(), courant.sousTotal))
                        panier.vider()
                        cle = nouvelleCleIdempotence()
                        signaturePanier = ""
                        _etat.value = EtatCommande(envoyee = r.jeton)
                    }
                    is ResultatCommande.Refusee -> {
                        if (r.code == "CONFLIT_ETAT") {
                            // Prix changés depuis l'affichage : on remet le panier à jour avec le menu d'aujourd'hui, la personne vérifie le nouveau total puis confirme.
                            try {
                                val retirees = panier.actualiser(restaurants.menu(restaurantId))
                                val suffixe = if (retirees > 0) " $retirees plat(s) n'existent plus et ont été retirés." else ""
                                _etat.value = EtatCommande(info = "Les prix ont changé : le panier est à jour. Vérifiez le nouveau total, puis confirmez.$suffixe")
                            } catch (e: ErreurReseau) {
                                _etat.value = EtatCommande(erreur = r.message)
                            }
                        } else {
                            _etat.value = EtatCommande(erreur = r.message)
                        }
                    }
                }
            } catch (e: ErreurReseau) {
                _etat.value = EtatCommande(erreur = e.message)
            } catch (e: Exception) {
                _etat.value = EtatCommande(erreur = "Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }
}
