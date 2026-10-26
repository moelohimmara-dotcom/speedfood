package com.speedfood.app.data

/** Clé de stockage du profil choisi sur l'écran de choix. Effacée à la déconnexion volontaire : l'écran de choix revient alors à la prochaine ouverture. */
const val CLE_PROFIL_CHOISI = "profil_choisi"

/** Le profil que la personne a choisi à l'entrée de l'application. */
enum class ProfilEntree(val cle: String) {
    /** « Je veux commander ». */
    Consommateur("consommateur"),

    /** « J'ai un restaurant » : crée son compte puis inscrit son restaurant. */
    Restaurateur("restaurateur"),

    /** « Livreur ou équipe Speedfood » : va à la connexion de l'espace professionnel. */
    Professionnel("professionnel"),
    ;

    companion object {
        fun depuis(cle: String?): ProfilEntree? = entries.firstOrNull { it.cle == cle }
    }
}

enum class EcranEntree { Choix, Application }

/**
 * Premier écran après le logo : l'écran de choix, sauf si la personne n'a pas besoin de choisir (lien reçu qui ouvre une fiche, compte déjà connecté, ou profil déjà choisi
 * à un lancement précédent). Un compte connecté va directement à son espace, sans écran de choix.
 */
fun ecranApresOuverture(lienProfond: Boolean, connecte: Boolean, profil: ProfilEntree?): EcranEntree =
    if (lienProfond || connecte || profil != null) EcranEntree.Application else EcranEntree.Choix

/** Clé de stockage de la visite déjà vue, par profil (la clé historique `visite_vue` vaut pour le consommateur : ceux qui l'avaient vue ne la revoient pas). */
fun cleVisiteVue(restaurateur: Boolean): String = if (restaurateur) "visite_vue_restaurateur" else "visite_vue_consommateur"

/** La visite du profil doit-elle être proposée ? Une seule fois par profil ; le consommateur qui avait déjà vu l'ancienne visite ne la revoit pas. */
fun visiteAProposer(restaurateur: Boolean, vues: Set<String>): Boolean {
    if (cleVisiteVue(restaurateur) in vues) return false
    if (!restaurateur && "visite_vue" in vues) return false
    return true
}

/** Par quel écran commence l'application une fois passé l'écran de choix. */
enum class DebutApplication {
    /** L'accueil des restaurants. */
    Normal,

    /** Création de compte consommateur, avec « Voir d'abord les restaurants ». */
    CreationCompte,

    /** Création de compte avant d'inscrire son restaurant. */
    CreationCompteRestaurateur,

    /** Connexion à l'espace professionnel (livreur, équipe, restaurateur déjà référencé). */
    AccesPro,
}

/**
 * Début de l'application selon le profil et l'état de connexion. Quelqu'un de connecté arrive à l'accueil (ou à son espace, géré ailleurs). Quelqu'un qui a choisi
 * « restaurateur » ou « professionnel » sans finir sa connexion retrouve son écran de compte au lancement suivant ; le consommateur retrouve l'accueil.
 */
fun debutApplication(profil: ProfilEntree?, connecte: Boolean, apresChoix: Boolean = false): DebutApplication = when {
    connecte -> DebutApplication.Normal
    profil == ProfilEntree.Consommateur -> if (apresChoix) DebutApplication.CreationCompte else DebutApplication.Normal
    profil == ProfilEntree.Restaurateur -> DebutApplication.CreationCompteRestaurateur
    profil == ProfilEntree.Professionnel -> DebutApplication.AccesPro
    else -> DebutApplication.Normal
}
