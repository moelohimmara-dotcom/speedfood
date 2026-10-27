package com.speedfood.app.data

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Le profil choisi à l'entrée (consommateur, restaurateur, professionnel) et son changement. L'application a une coque par profil : ce service dit laquelle afficher et permet d'en sortir
 * explicitement (« Changer de profil »), jamais par un détour d'écran. Le profil est mémorisé ; il est effacé quand la session se ferme (déconnexion, expiration) ou quand la personne
 * demande à changer.
 */
class ProfilService(private val stockage: StockageLocal) {
    private val _profil = MutableStateFlow(lire())

    /** Profil actif, ou null tant qu'aucun n'est choisi (l'écran de choix est alors proposé). */
    val profil: StateFlow<ProfilEntree?> = _profil.asStateFlow()

    private val _choixDemande = MutableStateFlow(false)

    /** Vrai quand la personne vient de demander à changer de profil : l'application affiche l'écran de choix. */
    val choixDemande: StateFlow<Boolean> = _choixDemande.asStateFlow()

    private fun lire(): ProfilEntree? = ProfilEntree.depuis(stockage.lire(CLE_PROFIL_CHOISI))

    /** Mémorise le profil choisi sur l'écran de choix. */
    fun choisir(profil: ProfilEntree) {
        stockage.ecrire(CLE_PROFIL_CHOISI, profil.cle)
        _profil.value = profil
        _choixDemande.value = false
    }

    /** « Changer de profil » : on oublie le choix et on revient à l'écran de choix. Le compte reste connecté. */
    fun demanderChangement() {
        stockage.effacer(CLE_PROFIL_CHOISI)
        _profil.value = null
        _choixDemande.value = true
    }

    fun choixTraite() {
        _choixDemande.value = false
    }

    /** Relit le stockage : à appeler quand autre chose l'a modifié (la session fermée efface le profil). */
    fun relire() {
        _profil.value = lire()
    }
}
