package com.speedfood.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.speedfood.app.data.AuthApi
import com.speedfood.app.data.ErreurAuth
import com.speedfood.app.data.FournisseurGoogle
import com.speedfood.app.data.ResultatGoogle
import com.speedfood.app.data.SessionService
import com.speedfood.app.data.normaliserTelephone
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class EtatConnexion(val enCours: Boolean = false, val erreur: String? = null, val inscriptionEnvoyee: String? = null)

const val LONGUEUR_MIN_MOT_DE_PASSE = 12

/** Pré-contrôle des saisies, pour répondre vite ; le service d'authentification revérifie toujours. Renvoie un message, ou null si tout est correct. */
fun verifierConnexion(email: String, motDePasse: String): String? = when {
    !email.contains("@") || email.trim().length < 6 -> "Indiquez une adresse e-mail valide."
    motDePasse.isEmpty() -> "Indiquez votre mot de passe."
    else -> null
}

fun verifierInscription(nom: String, telephone: String, email: String, motDePasse: String): String? = when {
    nom.trim().length < 2 -> "Indiquez votre nom (2 caractères au moins)."
    normaliserTelephone(telephone) == null -> "Numéro guinéen invalide : 9 chiffres commençant par 6 ou 7 (par exemple 622 12 34 56)."
    !email.contains("@") || email.trim().length < 6 -> "Indiquez une adresse e-mail valide."
    motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE -> "Le mot de passe doit contenir au moins $LONGUEUR_MIN_MOT_DE_PASSE caractères."
    else -> null
}

class ConnexionViewModel(private val session: SessionService, private val google: FournisseurGoogle, private val auth: AuthApi) : ViewModel() {
    private val _etat = MutableStateFlow(EtatConnexion())
    val etat: StateFlow<EtatConnexion> = _etat.asStateFlow()
    private val _googleActif = MutableStateFlow(false)

    /** Le bouton « Continuer avec Google » n'apparaît que si le téléphone sait le faire ET si le service d'authentification a activé Google. */
    val googleActif: StateFlow<Boolean> = _googleActif.asStateFlow()

    init {
        if (google.disponible) viewModelScope.launch { _googleActif.value = "google" in auth.fournisseursActifs() }
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

    fun inscrire(nom: String, telephone: String, email: String, motDePasse: String) {
        verifierInscription(nom, telephone, email, motDePasse)?.let { _etat.value = EtatConnexion(erreur = it); return }
        _etat.value = EtatConnexion(enCours = true)
        viewModelScope.launch {
            try {
                session.inscrire(nom, normaliserTelephone(telephone) ?: telephone, email, motDePasse)
                _etat.value = EtatConnexion(inscriptionEnvoyee = email.trim())
            } catch (e: ErreurAuth) {
                _etat.value = EtatConnexion(erreur = e.message)
            } catch (e: Exception) {
                _etat.value = EtatConnexion(erreur = "Une erreur est survenue. Réessayez dans un instant.")
            }
        }
    }

    fun effacerErreur() {
        _etat.value = _etat.value.copy(erreur = null)
    }
}
