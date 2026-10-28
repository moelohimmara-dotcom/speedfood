package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AuthApi
import com.speedfood.app.data.ErreurAuth
import com.speedfood.app.data.FournisseurFacebook
import com.speedfood.app.data.FournisseurGoogle
import com.speedfood.app.data.ResultatFacebook
import com.speedfood.app.data.ResultatGoogle
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.normaliserTelephone
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class EtatConnexion(
    val enCours: Boolean = false,
    val erreur: String? = null,
    val inscriptionEnvoyee: String? = null,
    /** Adresse pour laquelle l'e-mail de réinitialisation vient d'être demandé (affichée dans la confirmation, jamais pour dire si le compte existe). */
    val reinitialisationEnvoyee: String? = null,
)

const val LONGUEUR_MIN_MOT_DE_PASSE = 12

/** Pré-contrôle des saisies, pour répondre vite ; le service d'authentification revérifie toujours. Renvoie un message, ou null si tout est correct. */
fun verifierConnexion(email: String, motDePasse: String): String? = when {
    !email.contains("@") || email.trim().length < 6 -> "Indiquez une adresse e-mail valide."
    motDePasse.isEmpty() -> "Indiquez votre mot de passe."
    else -> null
}

/** Création de compte à l'entrée de l'application : l'adresse et le mot de passe suffisent (le nom et le téléphone sont demandés à la première commande). */
fun verifierInscriptionEntree(email: String, motDePasse: String): String? = when {
    !email.contains("@") || email.trim().length < 6 -> "Indiquez une adresse e-mail valide."
    motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE -> "Le mot de passe doit contenir au moins $LONGUEUR_MIN_MOT_DE_PASSE caractères."
    else -> null
}

fun verifierInscription(nom: String, telephone: String, email: String, motDePasse: String): String? = when {
    nom.trim().length < 2 -> "Indiquez votre nom (2 caractères au moins)."
    normaliserTelephone(telephone) == null -> "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56)."
    !email.contains("@") || email.trim().length < 6 -> "Indiquez une adresse e-mail valide."
    motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE -> "Le mot de passe doit contenir au moins $LONGUEUR_MIN_MOT_DE_PASSE caractères."
    else -> null
}

class ConnexionViewModel(
    private val session: SessionService,
    private val google: FournisseurGoogle,
    private val auth: AuthApi,
    private val facebook: FournisseurFacebook,
) : ViewModel() {
    private val _etat = MutableStateFlow(EtatConnexion())
    val etat: StateFlow<EtatConnexion> = _etat.asStateFlow()
    private val _googleActif = MutableStateFlow(false)

    /** Le bouton « Continuer avec Google » n'apparaît que si le téléphone sait le faire ET si le service d'authentification a activé Google. */
    val googleActif: StateFlow<Boolean> = _googleActif.asStateFlow()

    private val _facebookActif = MutableStateFlow(false)

    /** Même règle que Google : le bouton n'apparaît que si le téléphone sait le faire ET si le service d'authentification a activé Facebook. */
    val facebookActif: StateFlow<Boolean> = _facebookActif.asStateFlow()

    init {
        if (google.disponible || facebook.disponible) viewModelScope.launch {
            val actifs = auth.fournisseursActifs()
            _googleActif.value = google.disponible && "google" in actifs
            _facebookActif.value = facebook.disponible && "facebook" in actifs
        }
    }

    fun continuerAvecFacebook(surReussite: () -> Unit) {
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            when (val r = facebook.obtenirCode { auth.urlConnexionFacebook(it) }) {
                ResultatFacebook.Annule -> _etat.value = EtatConnexion()
                is ResultatFacebook.Erreur -> _etat.value = EtatConnexion(erreur = r.message)
                is ResultatFacebook.Code -> try {
                    session.connecterAvecCode(r.code, r.verificateur)
                    _etat.value = EtatConnexion()
                    surReussite()
                } catch (e: ErreurAuth) {
                    _etat.value = EtatConnexion(erreur = e.message)
                } catch (e: Exception) {
                    _etat.value = EtatConnexion(erreur = "Une erreur est survenue. Réessayez dans un instant.")
                }
            }
        }
    }

    fun continuerAvecGoogle(surReussite: () -> Unit) {
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            when (val r = google.jetonIdentite()) {
                ResultatGoogle.Annule -> _etat.value = EtatConnexion()
                is ResultatGoogle.Erreur -> _etat.value = EtatConnexion(erreur = r.message)
                is ResultatGoogle.Jeton -> try {
                    session.connecterAvecGoogle(r.jetonIdentite, r.nonce)
                    _etat.value = EtatConnexion()
                    surReussite()
                } catch (e: ErreurAuth) {
                    _etat.value = EtatConnexion(erreur = e.message)
                } catch (e: Exception) {
                    _etat.value = EtatConnexion(erreur = "Une erreur est survenue. Réessayez dans un instant.")
                }
            }
        }
    }

    /** Connexion courte réservée au faux serveur de l'émulateur : elle appelle le même SessionService que le formulaire réel. */
    fun connecterCompteEssai(email: String, surReussite: () -> Unit) {
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            try {
                session.connecter(email, "essai-local")
                _etat.value = EtatConnexion()
                surReussite()
            } catch (e: ErreurAuth) {
                _etat.value = EtatConnexion(erreur = e.message)
            } catch (e: Exception) {
                _etat.value = EtatConnexion(erreur = "Impossible de joindre le faux serveur. Réessayez dans un instant.")
            }
        }
    }

    fun connecter(email: String, motDePasse: String, surReussite: () -> Unit) {
        verifierConnexion(email, motDePasse)?.let { _etat.value = EtatConnexion(erreur = it); return }
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            try {
                session.connecter(email, motDePasse)
                _etat.value = EtatConnexion()
                surReussite()
            } catch (e: ErreurAuth) {
                _etat.value = EtatConnexion(erreur = e.message)
            } catch (e: Exception) {
                _etat.value = EtatConnexion(erreur = "Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }

    fun inscrire(nom: String, telephone: String, email: String, motDePasse: String, surReussite: () -> Unit = {}, avecContact: Boolean = true) {
        val probleme = if (avecContact) verifierInscription(nom, telephone, email, motDePasse) else verifierInscriptionEntree(email, motDePasse)
        probleme?.let { _etat.value = EtatConnexion(erreur = it); return }
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            try {
                if (session.inscrire(nom, if (avecContact) normaliserTelephone(telephone) ?: telephone else telephone, email, motDePasse)) {
                    // Compte ouvert tout de suite : on retourne là où l'on était (la commande), sans passer par la boîte mail.
                    com.speedfood.app.data.BrouillonContact.vider()
                    _etat.value = EtatConnexion()
                    surReussite()
                } else {
                    _etat.value = EtatConnexion(inscriptionEnvoyee = email.trim())
                }
            } catch (e: ErreurAuth) {
                _etat.value = EtatConnexion(erreur = e.message)
            } catch (e: Exception) {
                _etat.value = EtatConnexion(erreur = "Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }

    fun demanderReinitialisation(email: String) {
        if (!email.contains("@") || email.trim().length < 6) {
            _etat.value = EtatConnexion(erreur = "Indiquez l'adresse e-mail de votre compte.")
            return
        }
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            try {
                auth.demanderReinitialisation(email)
                _etat.value = EtatConnexion(reinitialisationEnvoyee = email.trim())
            } catch (e: ErreurAuth) {
                _etat.value = EtatConnexion(erreur = e.message)
            } catch (e: Exception) {
                _etat.value = EtatConnexion(erreur = "Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }

    /** Après la confirmation de l'adresse : on repart sur l'écran de connexion, adresse conservée par l'écran. */
    fun reprendreConnexion() {
        _etat.value = EtatConnexion()
    }

    fun effacerErreur() {
        _etat.value = _etat.value.copy(erreur = null)
    }
}
