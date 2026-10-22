package com.speedfood.app.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Déconnexion volontaire, la même partout (Compte, Compte d'un espace pro, onglet Commandes). L'appareil est d'abord retiré du compte (il ne doit plus recevoir ses
 * alertes), puis la session est fermée. Les **commandes en cours restent suivies sur l'appareil** (c'est leur seul moyen de suivi) sauf si la personne demande de les
 * effacer. Le panier est conservé. Un message s'affiche ensuite (l'écran d'où elle venait n'existe plus).
 *
 * Elle s'exécute dans sa propre portée : fermer la session change de coque et détruit l'écran d'où la demande est partie, ce qui ne doit pas l'interrompre.
 */
class DeconnexionService(
    private val session: SessionService,
    private val enregistrementPush: EnregistrementPush,
    private val locales: CommandesLocales,
    private val espaces: EspaceService,
    private val portee: CoroutineScope,
) {
    fun deconnecter(effacerCommandes: Boolean) {
        portee.launch { executer(effacerCommandes) }
    }

    internal suspend fun executer(effacerCommandes: Boolean) {
        try {
            enregistrementPush.retirer()
        } catch (_: Exception) {
            // Meilleur effort : on se déconnecte quoi qu'il arrive.
        }
        if (effacerCommandes) locales.oublier()
        session.deconnecter()
        espaces.quitter()
        espaces.annoncer(
            if (effacerCommandes) "Vous êtes déconnecté. Les commandes de cet appareil ont été effacées."
            else "Vous êtes déconnecté. Vos commandes en cours restent suivies sur cet appareil.",
        )
    }
}
